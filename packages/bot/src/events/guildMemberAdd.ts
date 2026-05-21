import { GuildMember } from "discord.js";
import { BotContext } from "../index";
import { evaluateRaidScore } from "../modules/antiRaid";
import { calculateRiskScore } from "../modules/riskScore";
import { applyQuarantine } from "../services/quarantine";

export async function onGuildMemberAdd(ctx: BotContext, member: GuildMember) {
  const guildId = member.guild.id;

  // Check if lockdown is active
  const dbGuild = await ctx.prisma.guild.findUnique({ where: { id: guildId } });
  if (dbGuild?.lockdownActive) {
    try {
      await member.send("Le serveur est actuellement en mode lockdown (verrouillé). Vous ne pouvez pas le rejoindre pour le moment.");
    } catch {}
    try {
      await member.kick("Serveur en lockdown");
    } catch (err) {
      console.error(`[!] Failed to kick member ${member.id} during lockdown:`, err);
    }
    return;
  }

  // Upsert member in DB
  const accountAge = member.user.createdAt;
  const dbMember = await ctx.prisma.member.upsert({
    where: { discordId_guildId: { discordId: member.id, guildId } },
    create: {
      discordId: member.id,
      guildId,
      username: member.user.tag,
      accountAge,
    },
    update: {
      username: member.user.tag,
    },
  });

  // Track join in Redis for raid detection
  const key = `joins:${guildId}`;
  const now = Date.now();
  await ctx.redis.zadd(key, now, `${member.id}:${now}`);
  await ctx.redis.expire(key, 120);

  // Evaluate raid score
  const config = await ctx.prisma.guildConfig.findUnique({ where: { guildId } });
  if (config) {
    await evaluateRaidScore(ctx, member.guild, config);
  }

  // Calculate initial risk score
  const score = await calculateRiskScore(ctx, member, dbMember);

  // Auto-quarantine if high risk (using configurable threshold)
  const minScore = config?.quarantineMinScore || 61;
  if (config?.quarantineEnabled && config?.quarantineAutoOnJoin !== false && score >= minScore) {
    try {
      await applyQuarantine(ctx, member, `Score de risque élevé à l'arrivée (${score})`, "AUTO");
      await ctx.prisma.securityEvent.create({
        data: {
          guildId,
          type: "QUARANTINE_APPLIED",
          severity: score >= 81 ? "CRITICAL" : "HIGH",
          actorId: member.id,
          description: `Quarantaine auto — score de risque: ${score}`,
          metadata: { score },
        },
      });
    } catch (err) {
      console.error(`[!] Quarantine failed for ${member.id}:`, err);
    }
  }
}
