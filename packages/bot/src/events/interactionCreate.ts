import { Interaction } from "discord.js";
import { BotContext } from "../index";
import { commands } from "../commands";

export async function onInteractionCreate(ctx: BotContext, interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(ctx, interaction);
  } catch (error) {
    console.error(`[!] Erreur commande /${interaction.commandName}:`, error);
    const reply = {
      content: "❌ Une erreur est survenue.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}
