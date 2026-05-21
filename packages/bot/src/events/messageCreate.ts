import { Message } from "discord.js";
import { BotContext } from "../index";
import { checkSpam } from "../modules/antiSpam";
import { checkPhishing } from "../modules/antiPhishing";
import { checkSecrets } from "../modules/secretScanner";
import { checkCanary } from "../modules/canary";

export async function onMessageCreate(ctx: BotContext, message: Message) {
  if (!message.guild) return;

  const config = await ctx.prisma.guildConfig.findUnique({
    where: { guildId: message.guild.id },
  });

  

  const guildId = message.guild.id;

  // Update member message count
  await ctx.prisma.member.upsert({
    where: { discordId_guildId: { discordId: message.author.id, guildId } },
    create: {
      discordId: message.author.id,
      guildId,
      username: message.author.tag,
      accountAge: message.author.createdAt,
      messageCount: 1,
    },
    update: { messageCount: { increment: 1 } },
  });

  // Canary channel check
  const canaryTriggered = await checkCanary(ctx, message);
  if (canaryTriggered) return;

  // Anti-spam
  await checkSpam(ctx, message);

  // Anti-phishing (check links)
  await checkPhishing(ctx, message);

  // Secret scanner
  await checkSecrets(ctx, message);
}
