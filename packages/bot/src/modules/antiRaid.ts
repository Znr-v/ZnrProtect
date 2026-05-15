import { Guild, ChannelType } from "discord.js";
import { GuildConfig } from "@prisma/client";
import { BotContext } from "../index";

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
  const validMembers = members.filter(Boolean);

  // Check account ages
  const youngAccounts = validMembers.filter((m) => {
    const ageMs = Date.now() - m!.user.createdTimestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays < config.raidMinAccountAge;
  });

  // Check name similarity (simple approach: check for common prefix/suffix)
  const names = validMembers.map((m) => m!.user.username.toLowerCase());
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

  // Restrict @everyone from sending messages in all text channels
  for (const [, channel] of guild.channels.cache) {
    if (channel.type === ChannelType.GuildText) {
      try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: false,
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
        });
      } catch {}
    }
  }
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
