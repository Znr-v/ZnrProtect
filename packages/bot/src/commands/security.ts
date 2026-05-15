import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { BotCommand } from "./index";
import { BotContext } from "../index";
import { activateLockdown, deactivateLockdown } from "../modules/antiRaid";

export const securityCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("security")
    .setDescription("Commandes de sécurité du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Vue d'ensemble de la sécurité du serveur")
    )
    .addSubcommand((sub) =>
      sub.setName("lockdown").setDescription("Active le mode lockdown")
    )
    .addSubcommand((sub) =>
      sub.setName("unlock").setDescription("Désactive le mode lockdown")
    )
    .addSubcommand((sub) =>
      sub.setName("incidents").setDescription("Liste les incidents récents")
    )
    .addSubcommand((sub) =>
      sub
        .setName("user")
        .setDescription("Profil de sécurité d'un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Le membre").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("quarantine")
        .setDescription("Met un membre en quarantaine")
        .addUserOption((o) => o.setName("membre").setDescription("Le membre").setRequired(true))
        .addStringOption((o) => o.setName("raison").setDescription("Raison"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("trust")
        .setDescription("Marque un membre comme fiable")
        .addUserOption((o) => o.setName("membre").setDescription("Le membre").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("emergency").setDescription("Bouton d'urgence — lockdown + coupe invitations")
    ) as SlashCommandBuilder,

  async execute(ctx: BotContext, interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "status":
        return handleStatus(ctx, interaction);
      case "lockdown":
        return handleLockdown(ctx, interaction);
      case "unlock":
        return handleUnlock(ctx, interaction);
      case "incidents":
        return handleIncidents(ctx, interaction);
      case "user":
        return handleUser(ctx, interaction);
      case "quarantine":
        return handleQuarantine(ctx, interaction);
      case "trust":
        return handleTrust(ctx, interaction);
      case "emergency":
        return handleEmergency(ctx, interaction);
    }
  },
};

async function handleStatus(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;

  const [guild, recentEvents, openIncidents, highRiskMembers] = await Promise.all([
    ctx.prisma.guild.findUnique({ where: { id: guildId }, include: { config: true } }),
    ctx.prisma.securityEvent.count({
      where: { guildId, createdAt: { gte: new Date(Date.now() - 86400000) } },
    }),
    ctx.prisma.incident.count({ where: { guildId, status: { in: ["NEW", "IN_PROGRESS"] } } }),
    ctx.prisma.member.count({ where: { guildId, riskScore: { gte: 61 } } }),
  ]);

  const embed = new EmbedBuilder()
    .setTitle("🛡️ Statut de sécurité")
    .setColor(guild?.lockdownActive ? 0xff0000 : 0x00ff00)
    .addFields(
      { name: "Lockdown", value: guild?.lockdownActive ? "🔴 ACTIF" : "🟢 Inactif", inline: true },
      { name: "Events (24h)", value: `${recentEvents}`, inline: true },
      { name: "Incidents ouverts", value: `${openIncidents}`, inline: true },
      { name: "Membres à risque", value: `${highRiskMembers}`, inline: true },
      { name: "Score serveur", value: `${guild?.riskScore || 0}/100`, inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleLockdown(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Permission Administrateur requise.", ephemeral: true });
  }
  await interaction.deferReply();
  await activateLockdown(ctx, interaction.guild!);
  await interaction.editReply("🔒 **Lockdown activé** — tous les salons sont verrouillés.");
}

async function handleUnlock(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Permission Administrateur requise.", ephemeral: true });
  }
  await interaction.deferReply();
  await deactivateLockdown(ctx, interaction.guild!);
  await interaction.editReply("🔓 **Lockdown désactivé** — salons déverrouillés.");
}

async function handleIncidents(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const incidents = await ctx.prisma.incident.findMany({
    where: { guildId: interaction.guildId! },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (incidents.length === 0) {
    return interaction.reply({ content: "✅ Aucun incident récent.", ephemeral: true });
  }

  const severityEmoji: Record<string, string> = {
    LOW: "🟢",
    MEDIUM: "🟡",
    HIGH: "🟠",
    CRITICAL: "🔴",
  };

  const statusEmoji: Record<string, string> = {
    NEW: "🆕",
    IN_PROGRESS: "🔄",
    CONTAINED: "📦",
    RESOLVED: "✅",
    FALSE_POSITIVE: "❌",
  };

  const embed = new EmbedBuilder()
    .setTitle("📋 Incidents récents")
    .setColor(0x5865f2)
    .setDescription(
      incidents
        .map(
          (i) =>
            `${severityEmoji[i.severity]} ${statusEmoji[i.status]} **${i.title}**\n` +
            `ID: \`${i.id.slice(0, 8)}\` — ${i.createdAt.toLocaleDateString("fr-FR")}`
        )
        .join("\n\n")
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleUser(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("membre", true);
  const guildId = interaction.guildId!;

  const member = await ctx.prisma.member.findUnique({
    where: { discordId_guildId: { discordId: user.id, guildId } },
  });

  if (!member) {
    return interaction.reply({ content: "❌ Membre non trouvé en base.", ephemeral: true });
  }

  const riskColor = member.riskScore >= 81 ? 0xff0000 : member.riskScore >= 61 ? 0xff8c00 : member.riskScore >= 31 ? 0xffff00 : 0x00ff00;
  const riskLabel =
    member.riskScore >= 81 ? "CRITIQUE" : member.riskScore >= 61 ? "ÉLEVÉ" : member.riskScore >= 31 ? "MODÉRÉ" : "NORMAL";

  const recentEvents = await ctx.prisma.securityEvent.count({
    where: { guildId, actorId: user.id, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
  });

  const embed = new EmbedBuilder()
    .setTitle(`👤 ${user.tag}`)
    .setThumbnail(user.displayAvatarURL())
    .setColor(riskColor)
    .addFields(
      { name: "Score de risque", value: `**${member.riskScore}/100** (${riskLabel})`, inline: true },
      { name: "Messages", value: `${member.messageCount}`, inline: true },
      { name: "Liens", value: `${member.linkCount}`, inline: true },
      { name: "Avertissements", value: `${member.warnCount}`, inline: true },
      { name: "Quarantaine", value: member.quarantined ? "🔴 Oui" : "🟢 Non", inline: true },
      { name: "Fiable", value: member.trusted ? "✅ Oui" : "❌ Non", inline: true },
      { name: "Events (7j)", value: `${recentEvents}`, inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleQuarantine(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("membre", true);
  const reason = interaction.options.getString("raison") || "Quarantaine manuelle";
  const guildId = interaction.guildId!;

  const config = await ctx.prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config?.quarantineRoleId) {
    return interaction.reply({
      content: "❌ Aucun rôle de quarantaine configuré. Utilise `/setup quarantine`.",
      ephemeral: true,
    });
  }

  const member = interaction.guild!.members.cache.get(user.id);
  if (!member) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });

  const role = interaction.guild!.roles.cache.get(config.quarantineRoleId);
  if (!role) return interaction.reply({ content: "❌ Rôle de quarantaine introuvable.", ephemeral: true });

  await member.roles.add(role, reason);
  await ctx.prisma.member.updateMany({
    where: { discordId: user.id, guildId },
    data: { quarantined: true },
  });

  await interaction.reply(`🔒 **${user.tag}** mis en quarantaine. Raison: ${reason}`);
}

async function handleTrust(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("membre", true);
  const guildId = interaction.guildId!;

  await ctx.prisma.member.updateMany({
    where: { discordId: user.id, guildId },
    data: { trusted: true, quarantined: false, riskScore: 0 },
  });

  // Remove quarantine role if present
  const config = await ctx.prisma.guildConfig.findUnique({ where: { guildId } });
  if (config?.quarantineRoleId) {
    const member = interaction.guild!.members.cache.get(user.id);
    const role = interaction.guild!.roles.cache.get(config.quarantineRoleId);
    if (member && role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role, "Marqué comme fiable");
    }
  }

  await interaction.reply(`✅ **${user.tag}** marqué comme fiable.`);
}

async function handleEmergency(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Permission Administrateur requise.", ephemeral: true });
  }
  await interaction.deferReply();

  const guild = interaction.guild!;

  // 1. Lockdown
  await activateLockdown(ctx, guild);

  // 2. Disable invites
  try {
    const invites = await guild.invites.fetch();
    for (const [, invite] of invites) {
      await invite.delete("Emergency button");
    }
  } catch {}

  // 3. Log
  await ctx.prisma.securityEvent.create({
    data: {
      guildId: guild.id,
      type: "EMERGENCY_ACTIVATED",
      severity: "CRITICAL",
      actorId: interaction.user.id,
      description: `Bouton d'urgence activé par ${interaction.user.tag}`,
    },
  });

  await ctx.prisma.incident.create({
    data: {
      guildId: guild.id,
      title: "🚨 URGENCE — Bouton d'urgence activé",
      severity: "CRITICAL",
      description: `Activé par ${interaction.user.tag}`,
    },
  });

  await interaction.editReply(
    "🚨 **MODE URGENCE ACTIVÉ**\n" +
      "• Lockdown activé sur tous les salons\n" +
      "• Toutes les invitations supprimées\n" +
      "• Incident créé\n\n" +
      "Utilise `/security unlock` quand la situation est résolue."
  );
}
