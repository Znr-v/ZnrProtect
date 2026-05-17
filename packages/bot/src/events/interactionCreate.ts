import { Interaction } from "discord.js";
import { BotContext } from "../index";
import { commands } from "../commands";
import { getUserLanguage, t } from "../lib/i18n";

export async function onInteractionCreate(ctx: BotContext, interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  // Retrieve preferred language before executing command
  const lang = await getUserLanguage(ctx, interaction.user.id);
  (interaction as any).language = lang;

  try {
    await command.execute(ctx, interaction);
  } catch (error) {
    console.error(`[!] Erreur commande /${interaction.commandName}:`, error);
    
    const errorMsg = t[lang].error_occurred;
    const reply = {
      content: errorMsg,
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}
