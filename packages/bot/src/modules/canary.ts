import { Message } from "discord.js";
import { BotContext } from "../index";
import { logBotAction } from "../lib/botLogs";

export async function checkCanary(ctx: BotContext, message: Message): Promise<boolean> {
  if (!message.guild) return false;

  const canary = await ctx.prisma.canaryChannel.findUnique({
    where: {
      guildId_channelId: {
        guildId: message.guild.id,
        channelId: message.channel.id,
      },
    },
  });

  if (!canary) return false;

  // Canary triggered!
  try {
    await message.delete();
  } catch {}

  // Kick the user
  try {
    if (message.member) {
      await message.member.kick("Message dans un canal piège (canary)");
      await logBotAction(ctx.prisma, message.guild.id, "KICK", {
        targetId: message.author.id,
        targetName: message.author.tag,
        reason: "Canal piège (canary) déclenché",
        details: { channelId: message.channel.id },
      });
    }
  } catch {}

  // Update trigger count
  await ctx.prisma.canaryChannel.update({
    where: { id: canary.id },
    data: { triggers: { increment: 1 } },
  });

  // Log event
  await ctx.prisma.securityEvent.create({
    data: {
      guildId: message.guild.id,
      type: "CANARY_TRIGGERED",
      severity: "HIGH",
      actorId: message.author.id,
      channelId: message.channel.id,
      description: `Canal piège déclenché par ${message.author.tag}`,
      metadata: {
        content: message.content.slice(0, 200),
        canaryType: canary.type,
      },
    },
  });

  return true;
}
