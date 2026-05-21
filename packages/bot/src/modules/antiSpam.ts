import { Message } from "discord.js";
import { ActionType } from "@prisma/client";
import { BotContext } from "../index";
import { logBotAction } from "../lib/botLogs";
import { executeSanction } from "../services/quarantine";

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

  // Track messages in last 5 seconds (sustained spam for bots)
  const msgKey5s = `spam:msg5s:${guildId}:${userId}`;
  await ctx.redis.zadd(msgKey5s, now, `${message.id}:${now}`);
  await ctx.redis.expire(msgKey5s, 8);
  await ctx.redis.zremrangebyscore(msgKey5s, 0, now - 5000);
  const msgCount5s = await ctx.redis.zcard(msgKey5s);

  // Also track 10s for regular users
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

  await ctx.redis.rpush(msgListKey, currentMsg);
  await ctx.redis.ltrim(msgListKey, -30, -1);
  await ctx.redis.expire(msgListKey, 60);

  const allMsgsKey = `spam:allmsgs:${guildId}:${userId}`;
  await ctx.redis.rpush(allMsgsKey, `[${new Date().toLocaleTimeString("fr-FR")}] ${currentMsg}`);
  await ctx.redis.ltrim(allMsgsKey, -30, -1);
  await ctx.redis.expire(allMsgsKey, 60);

  // SPAM DETECTION FILTERS
  const maxMsg1s = config.spamMaxMessages ?? 5;
  const maxMsg10s = config.spamMaxMessages10s ?? 8;
  const repeatThreshold = config.spamRepeatThreshold ?? 3;
  const maxMentions = config.spamMaxMentions ?? 3;
  const maxMentions10s = config.spamMaxMentions10s ?? 5;

  // Track cross-channel messages (5s window)
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

  // Cooldown to prevent duplicate sanctions
  const processedKey = `spam:processed:${guildId}:${userId}`;
  const alreadyProcessed = await ctx.redis.get(processedKey);
  
  if (alreadyProcessed) {
    console.log(`[SPAM] ⏭️ Already processed recently, skipping: ${message.author.tag}`);
    return;
  }

  const member = await message.guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  // Determine spam reason
  let spamReason = "";
  if (isFlood) spamReason += `Flood (${msgCount1s} msgs/1s)`;
  if (isSustained) spamReason += (spamReason ? " + " : "") + `Spam soutenu (${msgCount5s} msgs/5s)`;
  if (isRepeat) spamReason += (spamReason ? " + " : "") + `Répétition (${sameMsgCount + 1}x même message)`;
  if (isMentionSpam) spamReason += (spamReason ? " + " : "") + `Mentions abusives (${mentionCount} mentions)`;
  if (isMentionFlood) spamReason += (spamReason ? " + " : "") + `Mention flood (${totalMentions} mentions/10s)`;
  if (isCrossChannelSpam) spamReason += (spamReason ? " + " : "") + `Multi-salon (${crossChannelCount} salons en 5s)`;

  console.log(`[SPAM] Détecté: ${message.author.tag} - ${spamReason}`);

  // Determine sanction based on type
  let sanction: ActionType;
  if (isBotUser && useBotConfig) {
    sanction = (config.botSpamSanction as ActionType) || "KICK";
  } else if (isCrossChannelSpam) {
    // Cross-channel spam uses bot sanction if bot, otherwise default spam sanction
    sanction = isBotUser 
      ? ((config.botSpamSanction as ActionType) || "KICK")
      : ((config.spamSanction as ActionType) || "TIMEOUT");
  } else {
    sanction = (config.spamSanction as ActionType) || "TIMEOUT";
  }

  // Execute sanction
  await ctx.redis.set(processedKey, "1", "EX", 30);
  
  const timeoutMinutes = config.defaultTimeoutMinutes ?? 5;
  const success = await executeSanction(ctx, member, sanction, `Anti-spam: ${spamReason}`, timeoutMinutes);

  if (success) {
    await logBotAction(ctx.prisma, guildId, sanction, {
      targetId: userId,
      targetName: message.author.tag,
      reason: `Anti-spam automatique - ${spamReason}`,
      details: { channel: message.channel.isTextBased() && "name" in message.channel ? message.channel.name : "unknown", spamType: isCrossChannelSpam ? "cross_channel" : "general" },
    });
  }

  // Delete messages
  let deletedCount = 1;
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

  // Log once per spam wave
  const logKey = `spam:logged:${guildId}:${userId}`;
  if (!await ctx.redis.get(logKey)) {
    const allMessages = await ctx.redis.lrange(allMsgsKey, 0, -1);
    try {
      await ctx.prisma.securityEvent.create({
        data: {
          guildId,
          type: message.webhookId ? "WEBHOOK_SPAM" : "SPAM_DETECTED",
          severity: isMentionSpam || isMentionFlood ? "HIGH" : "MEDIUM",
          actorId: message.webhookId || userId,
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

  // Update member warn count
  try {
    await ctx.prisma.member.updateMany({
      where: { discordId: userId, guildId },
      data: { warnCount: { increment: 1 } },
    });
  } catch (e) {
    console.log(`[SPAM] ❌ Warn count update failed: ${e}`);
  }
}