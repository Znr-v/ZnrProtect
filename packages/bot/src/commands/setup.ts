import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { BotCommand } from "./index";
import { BotContext } from "../index";
import { t } from "../lib/i18n";

export const setupCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configuration du bot de sécurité")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("quarantine")
        .setDescription("Définit le rôle de quarantaine")
        .addRoleOption((o) => o.setName("role").setDescription("Le rôle de quarantaine").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("canary").setDescription("Crée un salon piège (canary channel)")
    )
    .addSubcommand((sub) =>
      sub
        .setName("antiraid")
        .setDescription("Configure l'anti-raid")
        .addIntegerOption((o) =>
          o.setName("threshold").setDescription("Nombre de joins pour déclencher (défaut: 10)").setMinValue(3).setMaxValue(100)
        )
        .addIntegerOption((o) =>
          o.setName("window").setDescription("Fenêtre en secondes (défaut: 60)").setMinValue(10).setMaxValue(300)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Affiche la configuration actuelle")
    ) as SlashCommandBuilder,

  async execute(ctx: BotContext, interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "quarantine":
        await handleSetupQuarantine(ctx, interaction);
        break;
      case "canary":
        await handleSetupCanary(ctx, interaction);
        break;
      case "antiraid":
        await handleSetupAntiRaid(ctx, interaction);
        break;
      case "show":
        await handleShowConfig(ctx, interaction);
        break;
    }
  },
};

async function handleSetupQuarantine(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];
  const role = interaction.options.getRole("role", true);

  await ctx.prisma.guildConfig.upsert({
    where: { guildId: interaction.guildId! },
    create: { guildId: interaction.guildId!, quarantineRoleId: role.id },
    update: { quarantineRoleId: role.id },
  });

  await interaction.reply(translations.setup_quarantine_success(role.name));
}

async function handleSetupCanary(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild!;

  const channel = await guild.channels.create({
    name: "🍯・general-chat",
    type: ChannelType.GuildText,
    topic: "Bienvenue ! Présentez-vous ici.",
    permissionOverwrites: [
      { id: guild.roles.everyone, allow: ["ViewChannel", "SendMessages"] },
      { id: guild.members.me!.id, allow: ["ViewChannel", "SendMessages", "ManageMessages", "KickMembers"] },
    ],
  });

  await ctx.prisma.canaryChannel.create({
    data: {
      guildId: guild.id,
      channelId: channel.id,
      type: "honeypot",
    },
  });

  await interaction.editReply(translations.setup_canary_success(channel));
}

async function handleSetupAntiRaid(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];
  const threshold = interaction.options.getInteger("threshold");
  const window = interaction.options.getInteger("window");

  const updateData: Record<string, number> = {};
  if (threshold) updateData.raidJoinThreshold = threshold;
  if (window) updateData.raidJoinWindow = window;

  if (Object.keys(updateData).length === 0) {
    return interaction.reply({ content: translations.specify_one_param, ephemeral: true });
  }

  await ctx.prisma.guildConfig.upsert({
    where: { guildId: interaction.guildId! },
    create: { guildId: interaction.guildId!, ...updateData },
    update: updateData,
  });

  await interaction.reply(translations.setup_antiraid_success(threshold ?? undefined, window ?? undefined));
}

async function handleShowConfig(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];
  const config = await ctx.prisma.guildConfig.findUnique({
    where: { guildId: interaction.guildId! },
  });

  if (!config) {
    return interaction.reply({ content: translations.config_not_found, ephemeral: true });
  }

  const lines = translations.config_lines(config);

  await interaction.reply({ content: `⚙️ **${translations.config_title}**\n\n${lines.join("\n")}`, ephemeral: true });
}
