import { TextChannel, NewsChannel } from "discord.js";
import { BotContext } from "../index";

export async function onWebhooksUpdate(
  ctx: BotContext,
  channel: TextChannel | NewsChannel
) {
  if (!channel.guild) return;

  try {
    const webhooks = await channel.fetchWebhooks();
    for (const [, webhook] of webhooks) {
      await ctx.prisma.webhookEntry.upsert({
        where: {
          guildId_webhookId: {
            guildId: channel.guild.id,
            webhookId: webhook.id,
          },
        },
        create: {
          guildId: channel.guild.id,
          webhookId: webhook.id,
          channelId: channel.id,
          createdBy: webhook.owner?.id || undefined,
          name: webhook.name || "Unknown",
        },
        update: {
          name: webhook.name || "Unknown",
          channelId: channel.id,
        },
      });
    }
  } catch (err) {
    console.error(`[!] Webhook sync failed for #${channel.name}:`, err);
  }
}
