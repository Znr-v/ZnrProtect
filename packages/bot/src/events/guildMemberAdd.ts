import { GuildMember } from "discord.js";
import { BotContext } from "../index";
import { evaluateRaidScore } from "../modules/antiRaid";
import { calculateRiskScore } from "../modules/riskScore";

export async function onGuildMemberAdd(ctx: BotContext, member: GuildMember) {
  const guildId = member.guild.id;

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

  // Auto-quarantine if high risk
  if (score >= 61 && config?.quarantineEnabled && config.quarantineRoleId) {
    try {
      const role = member.guild.roles.cache.get(config.quarantineRoleId);
      if (role) {
        await member.roles.add(role, "Score de risque élevé à l'arrivée");
        await ctx.prisma.member.update({
          where: { id: dbMember.id },
          data: { quarantined: true },
        });
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
      }
    } catch (err) {
      console.error(`[!] Quarantine failed for ${member.id}:`, err);
    }
  }
}
