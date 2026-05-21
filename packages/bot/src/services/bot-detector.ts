import { Guild, User, GuildMember } from "discord.js";
import { BotContext } from "../index";
import { ActionType } from "@prisma/client";
import { logBotAction } from "../lib/botLogs";

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  reasons: string[];
}

const NAME_PATTERNS = [
  /^(user|bot|test|guest|member)\d+$/i,
  /^user[0-9a-f]{4,}$/i,
  /^bot[0-9]{3,}$/i,
  /^[a-z]{10,}$/i,
  /^\d{5,}$/,
  /^[-_]{3,}/,
  /[-_]{3,}$/,
  /^temp[_-]?\d+$/i,
];

const AVATAR_HASHES = new Set([
  "a_0", "f_0", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
]);

export async function detectBot(
  ctx: BotContext,
  member: GuildMember | User,
  guild: Guild
): Promise<BotDetectionResult> {
  const reasons: string[] = [];
  let score = 0;

  const user = member instanceof User ? member : member.user;
  const isOfficialBot = user.bot;

  if (isOfficialBot) {
    reasons.push("Compte Discord officiel bot");
    score += 100;
  }

  const ageMs = Date.now() - user.createdTimestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays < 1) {
    reasons.push(`Compte récent (< 24h)`);
    score += 40;
  } else if (ageDays < 7) {
    reasons.push(`Compte jeune (${Math.round(ageDays)} jours)`);
    score += 20;
  }

  const username = user.username.toLowerCase();
  for (const pattern of NAME_PATTERNS) {
    if (pattern.test(username)) {
      reasons.push(`Nom généré (pattern: ${pattern.source})`);
      score += 30;
      break;
    }
  }

  if (user.avatar === null || user.avatar.startsWith("a_") === false) {
    const defaultAvatars = ["a_0", "f_0"];
    if (defaultAvatars.includes(user.avatar || "")) {
      reasons.push("Avatar par défaut Discord");
      score += 20;
    }
  }

  try {
    const memberData = await ctx.prisma.member.findFirst({
      where: { discordId: user.id, guildId: guild.id },
    });
    if (memberData && memberData.isBot) {
      reasons.push("Déjà identifié comme bot dans la base");
      score += 50;
    }
  } catch {}

  if (member instanceof GuildMember && member.joinedAt) {
    const memberAgeMs = Date.now() - member.joinedAt.getTime();
    const memberAgeHours = memberAgeMs / (1000 * 60 * 60);
    if (memberAgeHours < 1) {
      reasons.push(`Membre récent sur le serveur (< 1h)`);
      score += 15;
    }
  }

  const isBot = score >= 50;
  const confidence = Math.min(100, score);

  return { isBot, confidence, reasons };
}

export async function handleBotAction(
  ctx: BotContext,
  member: GuildMember,
  actionType: ActionType,
  reason: string,
  metadata: Record<string, any> = {}
): Promise<{ action: string; deletedCount: number }> {
  const guild = member.guild;
  const user = member.user;
  
  const fetchedMember = await guild.members.fetch(user.id).catch(() => null);
  if (!fetchedMember) {
    console.log(`[BOT-DETECTOR] ⏭️ Member already left: ${user.tag}`);
    return { action: actionType, deletedCount: 0 };
  }
  
  let deletedCount = 0;

  const isOfficialBot = user.bot;

  if (actionType === ActionType.BAN) {
    // BAN FIRST, then delete messages
    try {
      await member.ban({ reason: `${reason}`, deleteMessageSeconds: 60 });
      console.log(`[BOT-DETECTOR] ✅ Bot banned: ${user.tag} - ${reason}`);
      deletedCount = -1; // Ban deletes messages automatically
    } catch (e) {
      console.log(`[BOT-DETECTOR] ❌ Ban failed: ${e}`);
    }
    await logBotActionWithIncident(ctx, guild.id, member, "BAN", reason, { ...metadata, messagesDeleted: deletedCount });
  } else if (actionType === ActionType.KICK || actionType === ActionType.KICK_DELETE || isOfficialBot) {
    // KICK FIRST, then delete messages (for speed)
    try {
      await member.kick(`${reason}`);
      console.log(`[BOT-DETECTOR] ✅ Bot kicked: ${user.tag} - ${reason}`);
    } catch (e) {
      console.log(`[BOT-DETECTOR] ❌ Kick failed: ${e}`);
    }

    // Delete messages AFTER kick (no delay to kick)
    if (actionType === ActionType.KICK_DELETE || isOfficialBot) {
      try {
        if (metadata.channelId) {
          const channel = guild.channels.cache.get(metadata.channelId);
          if (channel?.isTextBased() && channel.isSendable()) {
            const messages = channel.messages.cache.filter(m => m.author.id === user.id);
            for (const [, msg] of messages) {
              try { await msg.delete(); deletedCount++; } catch {}
            }
          }
        } else {
          const textChannels = guild.channels.cache.filter(c => c.isTextBased());
          for (const [, channel] of textChannels) {
            if (!channel.isSendable()) continue;
            const messages = channel.messages.cache.filter(m => m.author.id === user.id);
            for (const [, msg] of messages) {
              try { await msg.delete(); deletedCount++; } catch {}
            }
          }
        }
      } catch {}
    }

    await logBotActionWithIncident(ctx, guild.id, member, "KICK", reason, { ...metadata, messagesDeleted: deletedCount });
  } else {
    const muteDuration = 15 * 60 * 1000;
    try {
      await member.timeout(muteDuration, reason);
      console.log(`[BOT-DETECTOR] ✅ Bot timed out: ${user.tag}`);
    } catch (e) {
      console.log(`[BOT-DETECTOR] ❌ Timeout failed: ${e}`);
    }

    await logBotActionWithIncident(ctx, guild.id, member, "TIMEOUT", reason, metadata);
  }

  return { action: actionType, deletedCount };
}

async function logBotActionWithIncident(
  ctx: BotContext,
  guildId: string,
  member: GuildMember,
  action: string,
  reason: string,
  metadata: Record<string, any>
) {
  const user = member.user;
  const isOfficialBot = user.bot;
  const isSpamEvent = reason.includes("Anti-spam");
  
  const incidentTitle = isSpamEvent 
    ? `Spam détecté — ${metadata.spamReason || "Bot"}`
    : `Bot détecté — ${action}`;

  const incident = await ctx.prisma.incident.create({
    data: {
      guildId,
      title: incidentTitle,
      severity: isSpamEvent ? "HIGH" : (isOfficialBot ? "MEDIUM" : "HIGH"),
      description: `${user.tag}: ${reason}`,
      isBot: true,
      actionType: action,
    },
  });

  await ctx.prisma.incidentAction.create({
    data: {
      incidentId: incident.id,
      action,
      targetId: user.id,
      executedBy: "bot",
      reason,
      metadata,
    },
  });

  const eventType = isSpamEvent ? "SPAM_DETECTED" : "SUSPICIOUS_JOIN";
  const eventDescription = isSpamEvent
    ? `Spam détecté - ${metadata.spamReason || reason}`
    : `Bot action: ${action} - ${reason}`;

  await ctx.prisma.securityEvent.create({
      data: {
        guildId,
        type: eventType,
        severity: isSpamEvent ? "HIGH" : "MEDIUM",
        actorId: user.id,
        description: eventDescription,
        metadata: { action, reason, ...metadata },
        incidentId: incident.id,
      },
    });

    logBotAction(ctx.prisma, guildId, action, {
      targetId: user.id,
      targetName: user.tag,
      executedBy: "bot",
      reason,
      details: { ...metadata, incidentId: incident.id, isSpamEvent },
    });
  }