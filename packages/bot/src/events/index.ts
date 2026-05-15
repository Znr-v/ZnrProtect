import { BotContext } from "../index";
import { onReady } from "./ready";
import { onGuildMemberAdd } from "./guildMemberAdd";
import { onMessageCreate } from "./messageCreate";
import { onInteractionCreate } from "./interactionCreate";
import { onGuildAuditLogEntryCreate } from "./auditLog";
import { onWebhooksUpdate } from "./webhooksUpdate";

export function registerEvents(ctx: BotContext) {
  ctx.client.on("ready", () => onReady(ctx));
  ctx.client.on("guildMemberAdd", (member) => onGuildMemberAdd(ctx, member));
  ctx.client.on("messageCreate", (message) => onMessageCreate(ctx, message));
  ctx.client.on("interactionCreate", (interaction) => onInteractionCreate(ctx, interaction));
  ctx.client.on("guildAuditLogEntryCreate", (entry, guild) => onGuildAuditLogEntryCreate(ctx, entry, guild));
  ctx.client.on("webhooksUpdate", (channel) => onWebhooksUpdate(ctx, channel));
}
