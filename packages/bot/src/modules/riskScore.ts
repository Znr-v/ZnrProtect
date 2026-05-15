import { GuildMember } from "discord.js";
import { Member } from "@prisma/client";
import { BotContext } from "../index";

export async function calculateRiskScore(
  ctx: BotContext,
  discordMember: GuildMember,
  dbMember: Member
): Promise<number> {
  const factors: Record<string, number> = {};

  // Account age (max 30 points)
  const ageMs = Date.now() - discordMember.user.createdTimestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 1) factors.accountAge = 30;
  else if (ageDays < 3) factors.accountAge = 25;
  else if (ageDays < 7) factors.accountAge = 20;
  else if (ageDays < 30) factors.accountAge = 10;
  else factors.accountAge = 0;

  // Server tenure (max 15 points)
  const tenureDays =
    (Date.now() - (discordMember.joinedTimestamp || Date.now())) /
    (1000 * 60 * 60 * 24);
  if (tenureDays < 0.04) factors.tenure = 15; // < 1 hour
  else if (tenureDays < 1) factors.tenure = 10;
  else if (tenureDays < 7) factors.tenure = 5;
  else factors.tenure = 0;

  // No avatar (5 points)
  if (!discordMember.user.avatar) factors.noAvatar = 5;
  else factors.noAvatar = 0;

  // Default username pattern (5 points)
  if (/^[a-z]+\d{3,}$/.test(discordMember.user.username)) factors.defaultName = 5;
  else factors.defaultName = 0;

  // Message to link ratio (max 15 points)
  if (dbMember.messageCount > 0) {
    const ratio = dbMember.linkCount / dbMember.messageCount;
    if (ratio > 0.5) factors.linkRatio = 15;
    else if (ratio > 0.3) factors.linkRatio = 10;
    else factors.linkRatio = 0;
  } else {
    factors.linkRatio = 0;
  }

  // Warning count (max 20 points)
  if (dbMember.warnCount >= 5) factors.warnings = 20;
  else if (dbMember.warnCount >= 3) factors.warnings = 15;
  else if (dbMember.warnCount >= 1) factors.warnings = 10;
  else factors.warnings = 0;

  // Previous quarantine (10 points)
  if (dbMember.quarantined) factors.prevQuarantine = 10;
  else factors.prevQuarantine = 0;

  const totalScore = Math.min(
    100,
    Object.values(factors).reduce((a, b) => a + b, 0)
  );

  // Save score
  await ctx.prisma.riskScore.create({
    data: {
      memberId: dbMember.id,
      score: totalScore,
      factors,
    },
  });

  // Update member
  await ctx.prisma.member.update({
    where: { id: dbMember.id },
    data: { riskScore: totalScore },
  });

  return totalScore;
}
