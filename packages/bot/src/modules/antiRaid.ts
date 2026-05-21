import { Guild, ChannelType, GuildMember } from "discord.js";
import { GuildConfig } from "@prisma/client";
import { BotContext } from "../index";
import { executeSanction, ensureQuarantineRole } from "../services/quarantine";
import { logBotAction } from "../lib/botLogs";

export async function evaluateRaidScore(
  ctx: BotContext,
  guild: Guild,
  config: GuildConfig
) {
  const key = `joins:${guild.id}`;
  const now = Date.now();
  const windowMs = config.raidJoinWindow * 1000;

  // Count recent joins
  const recentJoins = await ctx.redis.zrangebyscore(key, now - windowMs, now);
  if (recentJoins.length < config.raidJoinThreshold) return;

  // Analyze join patterns
  const memberIds = recentJoins.map((j) => j.split(":")[0]);
  const members = await Promise.all(
    memberIds.map((id) => guild.members.fetch(id).catch(() => null))
  );
  const validMembers = members.filter((m): m is GuildMember => m !== null);

  // Check account ages
  const youngAccounts = validMembers.filter((m) => {
    const ageMs = Date.now() - m.user.createdTimestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays < config.raidMinAccountAge;
  });

  // Check name similarity (simple approach: check for common prefix/suffix)
  const names = validMembers.map((m) => m.user.username.toLowerCase());
  const namePairs = new Set<string>();
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (
        names[i].slice(0, 4) === names[j].slice(0, 4) ||
        names[i].slice(-4) === names[j].slice(-4)
      ) {
        namePairs.add(`${names[i]}:${names[j]}`);
      }
    }
  }

  // Calculate raid coordination score
  const joinRate = recentJoins.length / config.raidJoinThreshold;
  const youngRatio = youngAccounts.length / validMembers.length;
  const nameSimRatio = namePairs.size / Math.max(validMembers.length, 1);
  const raidScore = Math.min(
    100,
    Math.round(joinRate * 30 + youngRatio * 40 + nameSimRatio * 30)
  );

  if (raidScore < 60) return;

  // Create security event
  const incident = await ctx.prisma.incident.create({
    data: {
      guildId: guild.id,
      title: `Raid détecté — Score: ${raidScore}`,
      severity: raidScore >= 80 ? "CRITICAL" : "HIGH",
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy: "bot",
      description: `${recentJoins.length} joins en ${config.raidJoinWindow}s, ${youngAccounts.length} comptes récents, ${namePairs.size} noms similaires`,
    },
  });

  await ctx.prisma.securityEvent.create({
    data: {
      guildId: guild.id,
      type: "RAID_DETECTED",
      severity: raidScore >= 80 ? "CRITICAL" : "HIGH",
      description: `Raid coordination score: ${raidScore}`,
      metadata: {
        joinCount: recentJoins.length,
        youngAccounts: youngAccounts.length,
        nameSimilarity: namePairs.size,
        score: raidScore,
      },
      incidentId: incident.id,
    },
  });

  // Auto-lockdown
  if (config.raidAutoLockdown) {
    await activateLockdown(ctx, guild, incident.id);
  }

  // Alert moderators
  await alertModerators(
    ctx,
    guild,
    `🚨 **RAID DÉTECTÉ** (score: ${raidScore}/100)\n` +
      `${recentJoins.length} joins en ${config.raidJoinWindow}s\n` +
      `${youngAccounts.length} comptes de moins de ${config.raidMinAccountAge} jours\n` +
      `${namePairs.size} paires de noms similaires\n` +
      `Incident: \`${incident.id}\``
  );

  // Ensure quarantine role exists once before parallel operations
  await ensureQuarantineRole(ctx, guild).catch(() => {});

  // Create a security event per member, then quarantine all in parallel
  await Promise.allSettled(
    validMembers.map(async (member) => {
      const reason = `Raid détecté (score: ${raidScore}/100) — Anti mass join`;
      const success = await executeSanction(ctx, member, "QUARANTINE", reason, config.defaultTimeoutMinutes)
        .catch((e: any) => {
          console.log(`[RAID] ❌ Échec quarantine pour ${member.user.tag}: ${e}`);
          return false;
        });

      await ctx.prisma.securityEvent.create({
        data: {
          guildId: guild.id,
          type: "QUARANTINE_APPLIED",
          severity: "HIGH",
          actorId: member.id,
          description: success
            ? `Membre mis en quarantine: ${member.user.tag} — ${reason}`
            : `Échec quarantine pour ${member.user.tag} — ${reason}`,
          metadata: {
            raidScore,
            incidentId: incident.id,
            success,
            username: member.user.tag,
          },
          incidentId: incident.id,
        },
      });

      if (success) {
        await ctx.prisma.incidentAction.create({
          data: {
            incidentId: incident.id,
            action: "quarantine",
            targetId: member.id,
            executedBy: "bot",
            reason,
            metadata: { username: member.user.tag, raidScore },
          },
        });
      }
    })
  );
}

export async function activateLockdown(
  ctx: BotContext,
  guild: Guild,
  incidentId?: string
) {
  await ctx.prisma.guild.update({
    where: { id: guild.id },
    data: { lockdownActive: true, lockdownAt: new Date() },
  });

  // Delete all existing invites
  try {
    const invites = await guild.invites.fetch();
    for (const [, invite] of invites) {
      await invite.delete("Lockdown activated");
    }
  } catch (err) {
    console.error(`[!] Failed to delete invites during lockdown for guild ${guild.id}:`, err);
  }

  // Restrict @everyone from sending messages and creating invites in all text channels
  for (const [, channel] of guild.channels.cache) {
    if (channel.type === ChannelType.GuildText) {
      try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: false,
          CreateInstantInvite: false,
        });
      } catch {}
    }
  }

  if (incidentId) {
    await ctx.prisma.incidentAction.create({
      data: {
        incidentId,
        action: "lockdown",
        executedBy: "bot",
        reason: "Lockdown automatique anti-raid",
      },
    });
  }

  logBotAction(ctx.prisma, guild.id, "LOCKDOWN_ON", {
    executedBy: "bot",
    reason: "Lockdown automatique anti-raid",
    details: { incidentId, invitesDeleted: true },
  });
}

export async function deactivateLockdown(ctx: BotContext, guild: Guild) {
  await ctx.prisma.guild.update({
    where: { id: guild.id },
    data: { lockdownActive: false },
  });

  for (const [, channel] of guild.channels.cache) {
    if (channel.type === ChannelType.GuildText) {
      try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: null,
          CreateInstantInvite: null,
        });
      } catch {}
    }
  }

  logBotAction(ctx.prisma, guild.id, "LOCKDOWN_OFF", {
    executedBy: "bot",
    reason: "Lockdown désactivé",
  });
}

async function alertModerators(ctx: BotContext, guild: Guild, message: string) {
  // Find a channel named "mod-log" or "security-log" or first admin channel
  const logChannel = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      ["mod-log", "security-log", "mod-logs", "security-logs"].includes(c.name)
  );

  if (logChannel && logChannel.type === ChannelType.GuildText) {
    try {
      await logChannel.send(message);
    } catch {}
  }
}
