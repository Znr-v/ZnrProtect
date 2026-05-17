import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ComponentType,
} from "discord.js";
import { BotCommand } from "./index";
import { BotContext } from "../index";
import { t } from "../lib/i18n";

export const helpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche l'aide complète du bot de sécurité"),

  async execute(_ctx: BotContext, interaction: ChatInputCommandInteraction) {
    const lang = ((interaction as any).language || "fr") as "en" | "fr";
    const translations = t[lang];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_module")
      .setPlaceholder(translations.help_placeholder)
      .addOptions(
        { label: translations.help_modules.antiraid.label, description: translations.help_modules.antiraid.desc, emoji: "🛡️", value: "antiraid" },
        { label: translations.help_modules.antispam.label, description: translations.help_modules.antispam.desc, emoji: "📢", value: "antispam" },
        { label: translations.help_modules.antiphishing.label, description: translations.help_modules.antiphishing.desc, emoji: "🔗", value: "antiphishing" },
        { label: translations.help_modules.secretscanner.label, description: translations.help_modules.secretscanner.desc, emoji: "🔐", value: "secretscanner" },
        { label: translations.help_modules.canary.label, description: translations.help_modules.canary.desc, emoji: "🍯", value: "canary" },
        { label: translations.help_modules.quarantine.label, description: translations.help_modules.quarantine.desc, emoji: "🔒", value: "quarantine" },
        { label: translations.help_modules.riskscore.label, description: translations.help_modules.riskscore.desc, emoji: "📊", value: "riskscore" },
        { label: translations.help_modules.emergency.label, description: translations.help_modules.emergency.desc, emoji: "🚨", value: "emergency" },
        { label: translations.help_modules.audit.label, description: translations.help_modules.audit.desc, emoji: "🔑", value: "audit" },
        { label: translations.help_modules.dashboard.label, description: translations.help_modules.dashboard.desc, emoji: "🌐", value: "dashboard" },
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const response = await interaction.reply({
      embeds: [translations.help_main()],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300_000,
    });

    const moduleEmbeds: Record<string, () => EmbedBuilder> = {
      antiraid: translations.help_antiraid,
      antispam: translations.help_antispam,
      antiphishing: translations.help_antiphishing,
      secretscanner: translations.help_secretscanner,
      canary: translations.help_canary,
      quarantine: translations.help_quarantine,
      riskscore: translations.help_riskscore,
      emergency: translations.help_emergency,
      audit: translations.help_audit,
      dashboard: translations.help_dashboard,
    };

    collector.on("collect", async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: translations.help_not_for_you, ephemeral: true });
        return;
      }

      const selected = i.values[0];
      const embedFn = moduleEmbeds[selected];
      if (embedFn) {
        await i.update({ embeds: [embedFn()], components: [row] });
      }
    });

    collector.on("end", async () => {
      const disabledMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
      await response.edit({ components: [disabledRow] }).catch(() => {});
    });
  },
};
