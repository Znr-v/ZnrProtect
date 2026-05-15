import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Collection,
} from "discord.js";
import { BotContext } from "../index";
import { securityCommand } from "./security";
import { setupCommand } from "./setup";
import { helpCommand } from "./help";

export interface BotCommand {
  data: SlashCommandBuilder | ReturnType<SlashCommandBuilder["addSubcommand"]>;
  execute: (ctx: BotContext, interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Collection<string, BotCommand>();

commands.set("security", securityCommand);
commands.set("setup", setupCommand);
commands.set("help", helpCommand);

export async function registerCommands(ctx: BotContext) {
  const commandData = [...commands.values()].map((c) => c.data.toJSON());
  await ctx.client.application!.commands.set(commandData);
}
