import { Message } from "discord.js";
import { BotContext } from "../index";
import { logBotAction } from "../lib/botLogs";

export async function checkSpam(ctx: BotContext, message: Message) {
  if (!message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  const config = await ctx.prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config) return;

  const now = Date.now();

  // Track messages in last 1 second (flood detection)
  const msgKey1s = `spam:msg1s:${guildId}:${userId}`;
  await ctx.redis.zadd(msgKey1s, now, `${message.id}:${now}`);
  await ctx.redis.expire(msgKey1s, 2);
  await ctx.redis.zremrangebyscore(msgKey1s, 0, now - 1000);
  const msgCount1s = await ctx.redis.zcard(msgKey1s);

  // Track messages in last 10 seconds (sustained spam)
  const msgKey10s = `spam:msg10s:${guildId}:${userId}`;
  await ctx.redis.zadd(msgKey10s, now, `${message.id}:${now}`);
  await ctx.redis.expire(msgKey10s, 12);
  await ctx.redis.zremrangebyscore(msgKey10s, 0, now - 10000);
  const msgCount10s = await ctx.redis.zcard(msgKey10s);

  // Track mentions - count ALL mentions including duplicates
  const mentionKey = `spam:mention:${guildId}:${userId}`;
  const userMentions = message.mentions.users.size;
  const roleMentions = message.mentions.roles.size;
  const everyoneMention = message.mentions.everyone ? 1 : 0;
  
  // Count actual @mentions in content (including duplicates)
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

  // Track repeated messages (same content)
  const msgListKey = `spam:msglist:${guildId}:${userId}`;
  const currentMsg = message.content.slice(0, 150);
  const existingList = await ctx.redis.lrange(msgListKey, 0, -1);
  const sameMsgCount = existingList.filter(m => m === currentMsg).length;

  // Store ALL messages to count repetitions
  await ctx.redis.rpush(msgListKey, currentMsg);
  await ctx.redis.ltrim(msgListKey, -30, -1);
  await ctx.redis.expire(msgListKey, 60);

  // Accumulate all messages for logs
  const allMsgsKey = `spam:allmsgs:${guildId}:${userId}`;
  await ctx.redis.rpush(allMsgsKey, `[${new Date().toLocaleTimeString("fr-FR")}] ${currentMsg}`);
  await ctx.redis.ltrim(allMsgsKey, -30, -1);
  await ctx.redis.expire(allMsgsKey, 60);

  // SPAM DETECTION FILTERS (using config values with defaults)
  const maxMsg1s = config.spamMaxMessages ?? 5;
  const maxMsg10s = config.spamMaxMessages10s ?? 8;
  const repeatThreshold = config.spamRepeatThreshold ?? 3;
  const maxMentions = config.spamMaxMentions ?? 3;
  const maxMentions10s = config.spamMaxMentions10s ?? 5;

  const isFlood = msgCount1s >= maxMsg1s;
  const isSustained = msgCount10s >= maxMsg10s;
  const isRepeat = sameMsgCount + 1 >= repeatThreshold;
  const isMentionSpam = mentionCount > maxMentions;
  const isMentionFlood = totalMentions > maxMentions10s;

  const isSpam = isFlood || isSustained || isRepeat || isMentionSpam || isMentionFlood;

  console.log(`[SPAM CHECK] 1s=${msgCount1s}/${maxMsg1s}, 10s=${msgCount10s}/${maxMsg10s}, repeat=${sameMsgCount + 1}/${repeatThreshold}, mentions=${mentionCount}/${maxMentions}, totalMentions=${totalMentions}/${maxMentions10s} => isSpam=${isSpam}`);

  if (!isSpam) return;

  console.log(`[SPAM] Spam detected! flood=${isFlood} sustained=${isSustained} repeat=${isRepeat} mentionSpam=${isMentionSpam} mentionFlood=${isMentionFlood}`);

  const authorName = message.webhookId 
    ? (message.author?.username || `Webhook ${message.webhookId}`) 
    : message.author.tag;

  // Determine spam reason for logs
  let spamReason = "";
  if (isFlood) spamReason += `Flood (${msgCount1s} msgs/1s)`;
  if (isSustained) spamReason += (spamReason ? " + " : "") + `Spam soutenu (${msgCount10s} msgs/10s)`;
  if (isRepeat) spamReason += (spamReason ? " + " : "") + `Répétition (${sameMsgCount + 1}x même message)`;
  if (isMentionSpam) spamReason += (spamReason ? " + " : "") + `Mentions abusives (${mentionCount} mentions)`;
  if (isMentionFlood) spamReason += (spamReason ? " + " : "") + `Mention flood (${totalMentions} mentions/10s)`;

  // MUTE FIRST
  if (!message.webhookId) {
    try {
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (member) {
        const muteDuration = (config.spamMuteDuration ?? 5) * 60 * 1000;
        const timeoutUntil = new Date(Date.now() + muteDuration);
        await member.timeout(muteDuration, `Anti-spam: ${spamReason}`);
        console.log(`[SPAM] ✅ Mute applied (${config.spamMuteDuration ?? 5} min)`);
        await logBotAction(ctx.prisma, guildId, "MUTE", {
          targetId: userId,
          targetName: message.author.tag,
          reason: `Anti-spam automatique - ${spamReason}`,
          details: { duration: config.spamMuteDuration ?? 5, endDate: timeoutUntil.toISOString(), channel: message.channel.name, spamReason },
        });
        await ctx.prisma.member.updateMany({
          where: { discordId: userId, guildId },
          data: { timedOutUntil: timeoutUntil },
        });
      }
    } catch (e) {
      console.log(`[SPAM] ❌ Mute failed: ${e}`);
    }
  }

  // Delete messages AFTER muting (if enabled)
  let deletedCount = 1;
  if (config.spamAutoDelete !== false) {
    try {
      const messages = await message.channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(m => 
        m.id !== message.id &&
        ((message.webhookId && m.webhookId === message.webhookId) ||
        m.author.id === userId)
      );
      const deletePromises = [];
      for (const [_, msg] of userMessages) {
        deletePromises.push(msg.delete().catch(() => {}));
        deletedCount++;
      }
      await Promise.allSettled(deletePromises);
    } catch (e) { 
      console.log(`[SPAM] Failed to fetch messages: ${e}`); 
    }
  }

  console.log(`[SPAM] Deleted ${deletedCount} messages total`);

  // ONE log per spam wave
  const logKey = `spam:logged:${guildId}:${userId}`;
  const alreadyLogged = await ctx.redis.get(logKey);
  
  if (!alreadyLogged) {
    const allMessages = await ctx.redis.lrange(allMsgsKey, 0, -1);
    try {
      await logBotAction(ctx.prisma, guildId, "MESSAGE_DELETE", {
        targetId: userId,
        targetName: authorName,
        reason: `Spam détecté - ${deletedCount} message${deletedCount > 1 ? "s" : ""} supprimé${deletedCount > 1 ? "s" : ""} sur #${message.channel.name}`,
        details: { 
          messagesSupprimes: deletedCount,
          salon: message.channel.name,
          type: message.webhookId ? "Webhook" : "Utilisateur",
          spamReason,
          messages: allMessages,
        },
      });
      console.log(`[SPAM] Log created successfully`);
    } catch (e) {
      console.log(`[SPAM] ❌ Log failed: ${e}`);
    }
    await ctx.redis.set(logKey, "1", "EX", 60);
  }

  // ONE event per spam wave
  const eventKey = `spam:event:${guildId}:${userId}`;
  const alreadyEventLogged = await ctx.redis.get(eventKey);
  
  if (!alreadyEventLogged) {
    const allMessages = await ctx.redis.lrange(allMsgsKey, 0, -1);
    try {
      await ctx.prisma.securityEvent.create({
        data: {
          guildId,
          type: message.webhookId ? "WEBHOOK_SPAM" : "SPAM_DETECTED",
          severity: isMentionSpam || isMentionFlood ? "HIGH" : "MEDIUM",
          actorId: message.webhookId || userId,
          channelId: message.channel.id,
          description: `Spam détecté (${authorName}): ${spamReason}`,
          metadata: {
            authorName,
            isWebhook: !!message.webhookId,
            spamReason,
            thresholds: {
              flood: `${maxMsg1s} msgs/1s`,
              sustained: `${maxMsg10s} msgs/10s`,
              repeat: `${repeatThreshold}x`,
              mentions: `${maxMentions}/msg`,
              mentionFlood: `${maxMentions10s}/10s`,
            },
            messages1s: msgCount1s,
            messages10s: msgCount10s,
            mentionCount,
            totalMentions,
            repeatCount: sameMsgCount + 1,
            messagesSupprimes: deletedCount,
            sanction: `Mute ${config.spamMuteDuration ?? 5} minutes`,
            messages: allMessages,
          },
        },
      });
    } catch (e) {
      console.log(`[SPAM] ❌ Event log failed: ${e}`);
    }
    await ctx.redis.set(eventKey, "1", "EX", 60);
  }

  // Update risk score
  try {
    await ctx.prisma.member.updateMany({
      where: { discordId: userId, guildId },
      data: { warnCount: { increment: 1 } },
    });
  } catch (e) {
    console.log(`[SPAM] ❌ Risk score update failed: ${e}`);
  }
}
