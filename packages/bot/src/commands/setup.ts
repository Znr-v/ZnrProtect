import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { BotCommand } from "./index";
import { BotContext } from "../index";

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
        return handleSetupQuarantine(ctx, interaction);
      case "canary":
        return handleSetupCanary(ctx, interaction);
      case "antiraid":
        return handleSetupAntiRaid(ctx, interaction);
      case "show":
        return handleShowConfig(ctx, interaction);
    }
  },
};

async function handleSetupQuarantine(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole("role", true);

  await ctx.prisma.guildConfig.upsert({
    where: { guildId: interaction.guildId! },
    create: { guildId: interaction.guildId!, quarantineRoleId: role.id },
    update: { quarantineRoleId: role.id },
  });

  await interaction.reply(`✅ Rôle de quarantaine défini: **${role.name}**`);
}

async function handleSetupCanary(ctx: BotContext, interaction: ChatInputCommandInteraction) {
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

  await interaction.editReply(
    `✅ Salon piège créé: ${channel}\n` +
      `Il ressemble à un salon normal — tout message dedans = kick automatique.`
  );
}

async function handleSetupAntiRaid(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const threshold = interaction.options.getInteger("threshold");
  const window = interaction.options.getInteger("window");

  const updateData: Record<string, number> = {};
  if (threshold) updateData.raidJoinThreshold = threshold;
  if (window) updateData.raidJoinWindow = window;

  if (Object.keys(updateData).length === 0) {
    return interaction.reply({ content: "❌ Spécifie au moins un paramètre.", ephemeral: true });
  }

  await ctx.prisma.guildConfig.upsert({
    where: { guildId: interaction.guildId! },
    create: { guildId: interaction.guildId!, ...updateData },
    update: updateData,
  });

  await interaction.reply(
    `✅ Anti-raid configuré:\n` +
      (threshold ? `• Seuil: **${threshold} joins**\n` : "") +
      (window ? `• Fenêtre: **${window}s**\n` : "")
  );
}

async function handleShowConfig(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const config = await ctx.prisma.guildConfig.findUnique({
    where: { guildId: interaction.guildId! },
  });

  if (!config) {
    return interaction.reply({ content: "❌ Aucune configuration trouvée.", ephemeral: true });
  }

  const lines = [
    `**Anti-Raid:** seuil=${config.raidJoinThreshold} joins / ${config.raidJoinWindow}s, auto-lockdown=${config.raidAutoLockdown ? "✅" : "❌"}`,
    `**Anti-Spam:** max=${config.spamMaxMessages} msgs/${config.spamWindow}s, mentions max=${config.spamMaxMentions}/${config.spamMentionWindow}s`,
    `**Anti-Phishing:** ${config.phishingEnabled ? "✅" : "❌"}, redirects=${config.phishingCheckRedirects ? "✅" : "❌"}`,
    `**Secret Scan:** ${config.secretScanEnabled ? "✅" : "❌"}`,
    `**Quarantaine:** ${config.quarantineEnabled ? "✅" : "❌"}, rôle=${config.quarantineRoleId || "non défini"}`,
    `**Emergency:** ${config.emergencyEnabled ? "✅" : "❌"}`,
  ];

  await interaction.reply({ content: `⚙️ **Configuration**\n\n${lines.join("\n")}`, ephemeral: true });
}
