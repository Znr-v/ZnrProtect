import { Message } from "discord.js";
import { BotContext } from "../index";

export async function checkSpam(ctx: BotContext, message: Message) {
  if (!message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  const config = await ctx.prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config) return;

  const now = Date.now();
  const msgKey = `spam:msg:${guildId}:${userId}`;
  const mentionKey = `spam:mention:${guildId}:${userId}`;

  // Track message rate
  await ctx.redis.zadd(msgKey, now, `${message.id}:${now}`);
  await ctx.redis.expire(msgKey, 30);
  await ctx.redis.zremrangebyscore(msgKey, 0, now - config.spamWindow * 1000);

  const msgCount = await ctx.redis.zcard(msgKey);

  // Track mention rate
  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionCount > 0) {
    await ctx.redis.zadd(mentionKey, now, `${message.id}:${now}`);
    await ctx.redis.expire(mentionKey, 30);
    await ctx.redis.zremrangebyscore(mentionKey, 0, now - config.spamMentionWindow * 1000);
  }
  const totalMentions = await ctx.redis.zcard(mentionKey);

  // Check duplicate messages
  const contentKey = `spam:content:${guildId}:${userId}`;
  const contentHash = simpleHash(message.content);
  const dupeCount = await ctx.redis.hincrby(contentKey, contentHash, 1);
  await ctx.redis.expire(contentKey, 60);

  // Evaluate
  const isSpam =
    msgCount > config.spamMaxMessages ||
    totalMentions > config.spamMaxMentions ||
    dupeCount >= 3;

  if (!isSpam) return;

  // Delete message
  try {
    await message.delete();
  } catch {}

  // Timeout the user (5 minutes)
  try {
    const member = message.member;
    if (member) {
      await member.timeout(5 * 60 * 1000, "Anti-spam automatique");
    }
  } catch {}

  // Log event
  await ctx.prisma.securityEvent.create({
    data: {
      guildId,
      type: "SPAM_DETECTED",
      severity: totalMentions > config.spamMaxMentions ? "HIGH" : "MEDIUM",
      actorId: userId,
      channelId: message.channel.id,
      description: `Spam détecté: ${msgCount} msgs/${config.spamWindow}s, ${totalMentions} mentions, ${dupeCount} dupes`,
      metadata: {
        messageCount: msgCount,
        mentionCount: totalMentions,
        duplicates: dupeCount,
        content: message.content.slice(0, 200),
      },
    },
  });

  // Update risk score
  await ctx.prisma.member.updateMany({
    where: { discordId: userId, guildId },
    data: { warnCount: { increment: 1 } },
  });
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}
