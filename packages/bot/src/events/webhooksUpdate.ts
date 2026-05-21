import { TextChannel, NewsChannel, GuildChannel } from "discord.js";
import { BotContext } from "../index";

export async function onWebhooksUpdate(
  ctx: BotContext,
  channel: GuildChannel
) {
  if (!channel.guild || !channel.isTextBased()) return;

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
    console.error(`[!] Webhook sync failed for #${"name" in channel ? channel.name : "unknown"}:`, err);
  }
}
