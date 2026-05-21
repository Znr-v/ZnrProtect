import { Message } from "discord.js";
import { ActionType } from "@prisma/client";
import { BotContext } from "../index";
import { logBotAction } from "../lib/botLogs";
import { executeSanction } from "../services/quarantine";

async function handleWebhookSpam(
  ctx: BotContext,
  message: Message,
  spamReason: string,
  deletedCount: number
) {
  const guild = message.guild!;
  const guildId = guild.id;
  const webhookId = message.webhookId!;

  try {
    const webhooks = await guild.fetchWebhooks();
    const webhook = webhooks.get(webhookId) || webhooks.find(w => w.id === webhookId);
    if (webhook) {
      await webhook.delete(`Anti-spam: webhook supprimé (${spamReason})`);
      console.log(`[SPAM] ✅ Webhook supprimé: ${webhook.name} (${webhookId})`);
    }

    const textChannels = Array.from(guild.channels.cache.values()).filter(c => c.isTextBased() && c.isSendable());
    for (const channel of textChannels) {
      try {
        const msgs = await channel.messages.fetch({ limit: 50 });
        const webhookMsgs = msgs.filter(m => m.webhookId === webhookId);
        for (const [, msg] of webhookMsgs) {
          try { await msg.delete(); deletedCount++; } catch {}
        }
      } catch {}
    }
  } catch (e) {
    console.log(`[SPAM] Webhook cleanup failed: ${e}`);
  }

  const incident = await ctx.prisma.incident.create({
    data: {
      guildId,
      title: `Webhook spam — ${message.author.tag}`,
      severity: "HIGH",
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy: "bot",
      description: `Webhook ${webhookId} supprimé: ${spamReason}`,
      isBot: true,
      actionType: "DELETE_WEBHOOK",
    },
  });

  await ctx.prisma.incidentAction.create({
    data: {
      incidentId: incident.id,
      action: "DELETE_WEBHOOK",
      targetId: webhookId,
      executedBy: "bot",
      reason: spamReason,
      metadata: { webhookName: message.author.tag, messagesDeleted: deletedCount },
    },
  });

  await ctx.prisma.securityEvent.create({data:{
    guildId,
    type: "WEBHOOK_SPAM",
    severity: "HIGH",
    actorId: webhookId,
    channelId: message.channel.id,
    description: `Webhook spam détecté (${message.author.tag}): ${spamReason}`,
    incidentId: incident.id,
    metadata: { spamReason, webhookId, messagesDeleted: deletedCount },
  }});

  logBotAction(ctx.prisma, guildId, "DELETE_WEBHOOK", {
    targetId: webhookId,
    targetName: message.author.tag,
    executedBy: "bot",
    reason: `Anti-spam: webhook supprimé - ${spamReason}`,
    details: { webhookId, messagesDeleted: deletedCount },
  });
}

export async function checkSpam(ctx: BotContext, message: Message) {
  if (!message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const isWebhook = !!message.webhookId;

  const config = await ctx.prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config) return;

  const now = Date.now();

  const msgKey1s = `spam:msg1s:${guildId}:${userId}`;
  await ctx.redis.zadd(msgKey1s, now, `${message.id}:${now}`);
  await ctx.redis.expire(msgKey1s, 2);
  await ctx.redis.zremrangebyscore(msgKey1s, 0, now - 1000);
  const msgCount1s = await ctx.redis.zcard(msgKey1s);

  const msgKey5s = `spam:msg5s:${guildId}:${userId}`;
  await ctx.redis.zadd(msgKey5s, now, `${message.id}:${now}`);
  await ctx.redis.expire(msgKey5s, 8);
  await ctx.redis.zremrangebyscore(msgKey5s, 0, now - 5000);
  const msgCount5s = await ctx.redis.zcard(msgKey5s);

  const msgKey10s = `spam:msg10s:${guildId}:${userId}`;
  await ctx.redis.zadd(msgKey10s, now, `${message.id}:${now}`);
  await ctx.redis.expire(msgKey10s, 12);
  await ctx.redis.zremrangebyscore(msgKey10s, 0, now - 10000);
  const msgCount10s = await ctx.redis.zcard(msgKey10s);

  const mentionKey = `spam:mention:${guildId}:${userId}`;
  const userMentions = message.mentions.users.size;
  const roleMentions = message.mentions.roles.size;
  const everyoneMention = message.mentions.everyone ? 1 : 0;

  const mentionRegex = /<@!?(\d+)>/g;
  const roleRegex = /<@&(\d+)>/g;
  const userMentionMatches = (message.content.match(mentionRegex) || []).length;
  const roleMentionMatches = (message.content.match(roleRegex) || []).length;
  const mentionCount = userMentionMatches + roleMentionMatches + everyoneMention;

  if (mentionCount > 0) {
    await ctx.redis.zadd(mentionKey, now, `${message.id}:${now}`);
    await ctx.redis.expire(mentionKey, 30);
    await ctx.redis.zremrangebyscore(mentionKey, 0, now - 10000);
  }
  const totalMentions = await ctx.redis.zcard(mentionKey);

  const msgListKey = `spam:msglist:${guildId}:${userId}`;
  const currentMsg = message.content.slice(0, 150);
  const existingList = await ctx.redis.lrange(msgListKey, 0, -1);
  const sameMsgCount = existingList.filter(m => m === currentMsg).length;

  await ctx.redis.rpush(msgListKey, currentMsg);
  await ctx.redis.ltrim(msgListKey, -30, -1);
  await ctx.redis.expire(msgListKey, 60);

  const allMsgsKey = `spam:allmsgs:${guildId}:${userId}`;
  await ctx.redis.rpush(allMsgsKey, `[${new Date().toLocaleTimeString("fr-FR")}] ${currentMsg}`);
  await ctx.redis.ltrim(allMsgsKey, -30, -1);
  await ctx.redis.expire(allMsgsKey, 60);

  const maxMsg1s = config.spamMaxMessages ?? 5;
  const maxMsg10s = config.spamMaxMessages10s ?? 8;
  const repeatThreshold = config.spamRepeatThreshold ?? 3;
  const maxMentions = config.spamMaxMentions ?? 3;
  const maxMentions10s = config.spamMaxMentions10s ?? 5;

  const channelKey = `spam:channels:${guildId}:${userId}`;
  const channelId = message.channel.id;
  await ctx.redis.zadd(channelKey, now, `${channelId}:${now}`);
  await ctx.redis.expire(channelKey, 8);
  await ctx.redis.zremrangebyscore(channelKey, 0, now - 5000);
  const channelEntries = await ctx.redis.zrange(channelKey, 0, -1);
  const uniqueChannels = new Set(channelEntries.map(e => e.split(':')[0]));
  const crossChannelCount = uniqueChannels.size;

  const isBotUser = message.author.bot;
  const useBotConfig = config.scanBots && isBotUser;
  const botCrossChannelThreshold = config.botSpamCrossChannel ?? 2;
  const isCrossChannelSpam = crossChannelCount >= (useBotConfig ? botCrossChannelThreshold : 3);

  const effectiveMaxMsg1s = useBotConfig ? (config.botSpamMaxMessages ?? 3) : maxMsg1s;
  const effectiveMaxMsg5s = useBotConfig ? (config.botSpamMaxMessages5s ?? 5) : maxMsg10s;

  const isFlood = msgCount1s >= effectiveMaxMsg1s;
  const isSustained = msgCount5s >= effectiveMaxMsg5s;
  const isRepeat = sameMsgCount + 1 >= repeatThreshold;
  const isMentionSpam = mentionCount > maxMentions;
  const isMentionFlood = totalMentions > maxMentions10s;

  const isSpam = isFlood || isSustained || isRepeat || isMentionSpam || isMentionFlood || isCrossChannelSpam;

  if (!isSpam) return;

  const processedKey = `spam:processed:${guildId}:${userId}`;
  const alreadyProcessed = await ctx.redis.get(processedKey);

  if (alreadyProcessed) {
    console.log(`[SPAM] ⏭️ Already processed recently, skipping: ${message.author.tag}`);
    return;
  }

  await ctx.redis.set(processedKey, "1", "EX", 30);

  let spamReason = "";
  if (isFlood) spamReason += `Flood (${msgCount1s} msgs/1s)`;
  if (isSustained) spamReason += (spamReason ? " + " : "") + `Spam soutenu (${msgCount5s} msgs/5s)`;
  if (isRepeat) spamReason += (spamReason ? " + " : "") + `Répétition (${sameMsgCount + 1}x même message)`;
  if (isMentionSpam) spamReason += (spamReason ? " + " : "") + `Mentions abusives (${mentionCount} mentions)`;
  if (isMentionFlood) spamReason += (spamReason ? " + " : "") + `Mention flood (${totalMentions} mentions/10s)`;
  if (isCrossChannelSpam) spamReason += (spamReason ? " + " : "") + `Multi-salon (${crossChannelCount} salons en 5s)`;

  console.log(`[SPAM] Détecté: ${message.author.tag} - ${spamReason}`);

  let deletedCount = 1;

  // WEBHOOK SPAM — special handling
  if (isWebhook) {
    await handleWebhookSpam(ctx, message, spamReason, deletedCount);
    return;
  }

  // REGULAR USER/BOT SPAM — sanction + message deletion
  const member = await message.guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  let sanction: ActionType;
  if (isBotUser && useBotConfig) {
    sanction = (config.botSpamSanction as ActionType) || "KICK";
  } else if (isCrossChannelSpam) {
    sanction = isBotUser
      ? ((config.botSpamSanction as ActionType) || "KICK")
      : ((config.spamSanction as ActionType) || "TIMEOUT");
  } else {
    sanction = (config.spamSanction as ActionType) || "TIMEOUT";
  }

  const timeoutMinutes = config.defaultTimeoutMinutes ?? 5;
  const success = await executeSanction(ctx, member, sanction, `Anti-spam: ${spamReason}`, timeoutMinutes);

  if (config.spamAutoDelete !== false) {
    try {
      if (isCrossChannelSpam && message.guild) {
        const textChannels = Array.from(message.guild.channels.cache.values()).filter(c => c.isTextBased() && c.isSendable());
        for (const channel of textChannels) {
          try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const userMessages = messages.filter(m => m.author.id === userId);
            for (const [, msg] of userMessages) {
              try { await msg.delete(); deletedCount++; } catch {}
            }
          } catch {}
        }
      } else {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const userMessages = messages.filter(m =>
          m.id !== message.id &&
          ((message.webhookId && m.webhookId === message.webhookId) ||
          m.author.id === userId)
        );
        for (const [, msg] of userMessages) {
          try { await msg.delete(); deletedCount++; } catch {}
        }
      }
    } catch (e) {
      console.log(`[SPAM] Failed to delete messages: ${e}`);
    }
  }

  const logKey = `spam:logged:${guildId}:${userId}`;
  if (!await ctx.redis.get(logKey)) {
    const allMessages = await ctx.redis.lrange(allMsgsKey, 0, -1);
    try {
      const event = await ctx.prisma.securityEvent.create({
        data: {
          guildId,
          type: "SPAM_DETECTED",
          severity: isMentionSpam || isMentionFlood ? "HIGH" : "MEDIUM",
          actorId: userId,
          channelId: message.channel.id,
          description: `Spam détecté (${message.author.tag}): ${spamReason}`,
          metadata: {
            spamReason,
            sanction,
            isBot: isBotUser,
            crossChannel: isCrossChannelSpam,
            thresholds: {
              flood: `${maxMsg1s} msgs/1s`,
              sustained: `${maxMsg10s} msgs/10s`,
              repeat: `${repeatThreshold}x`,
            },
            messagesSupprimes: deletedCount,
            messages: allMessages,
          },
        },
      });


    } catch (e) {
      console.log(`[SPAM] ❌ Event log failed: ${e}`);
    }
    await ctx.redis.set(logKey, "1", "EX", 60);
  }

  try {
    await ctx.prisma.member.updateMany({
      where: { discordId: userId, guildId },
      data: { warnCount: { increment: 1 } },
    });
  } catch (e) {
    console.log(`[SPAM] ❌ Warn count update failed: ${e}`);
  }
}
