import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { BotCommand } from "./index";
import { BotContext } from "../index";
import { t } from "../lib/i18n";
import { applyQuarantine, liftQuarantine } from "../services/quarantine";
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
        await handleStatus(ctx, interaction);
        break;
      case "lockdown":
        await handleLockdown(ctx, interaction);
        break;
      case "unlock":
        await handleUnlock(ctx, interaction);
        break;
      case "incidents":
        await handleIncidents(ctx, interaction);
        break;
      case "user":
        await handleUser(ctx, interaction);
        break;
      case "quarantine":
        await handleQuarantine(ctx, interaction);
        break;
      case "trust":
        await handleTrust(ctx, interaction);
        break;
      case "emergency":
        await handleEmergency(ctx, interaction);
        break;
    }
  },
};

async function handleStatus(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];
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
    .setTitle(translations.status_title)
    .setColor(guild?.lockdownActive ? 0xff0000 : 0x00ff00)
    .addFields(
      translations.status_fields(
        !!guild?.lockdownActive,
        recentEvents,
        openIncidents,
        highRiskMembers,
        guild?.riskScore || 0
      )
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleLockdown(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];
  
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: translations.admin_required, ephemeral: true });
  }
  await interaction.deferReply();
  await activateLockdown(ctx, interaction.guild!);
  await interaction.editReply(translations.lockdown_active_reply);
}

async function handleUnlock(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: translations.admin_required, ephemeral: true });
  }
  await interaction.deferReply();
  await deactivateLockdown(ctx, interaction.guild!);
  await interaction.editReply(translations.lockdown_deactive_reply);
}

async function handleIncidents(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];
  const incidents = await ctx.prisma.incident.findMany({
    where: { guildId: interaction.guildId! },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (incidents.length === 0) {
    return interaction.reply({ content: translations.incidents_empty, ephemeral: true });
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
    .setTitle(translations.incidents_title)
    .setColor(0x5865f2)
    .setDescription(
      incidents
        .map((i) => translations.incidents_map(i, severityEmoji[i.severity] || "❓", statusEmoji[i.status] || "❓"))
        .join("\n\n")
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleUser(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];
  const user = interaction.options.getUser("membre", true);
  const guildId = interaction.guildId!;

  const member = await ctx.prisma.member.findUnique({
    where: { discordId_guildId: { discordId: user.id, guildId } },
  });

  if (!member) {
    return interaction.reply({ content: translations.member_not_found, ephemeral: true });
  }

  const riskColor = member.riskScore >= 81 ? 0xff0000 : member.riskScore >= 61 ? 0xff8c00 : member.riskScore >= 31 ? 0xffff00 : 0x00ff00;
  
  let riskLabel = "";
  if (lang === "fr") {
    riskLabel = member.riskScore >= 81 ? "CRITIQUE" : member.riskScore >= 61 ? "ÉLEVÉ" : member.riskScore >= 31 ? "MODÉRÉ" : "NORMAL";
  } else {
    riskLabel = member.riskScore >= 81 ? "CRITICAL" : member.riskScore >= 61 ? "HIGH" : member.riskScore >= 31 ? "MODERATE" : "NORMAL";
  }

  const recentEvents = await ctx.prisma.securityEvent.count({
    where: { guildId, actorId: user.id, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
  });

  const embed = new EmbedBuilder()
    .setTitle(`👤 ${user.tag}`)
    .setThumbnail(user.displayAvatarURL())
    .setColor(riskColor)
    .addFields(
      translations.user_fields(
        member.riskScore,
        riskLabel,
        member.messageCount,
        member.linkCount,
        member.warnCount,
        member.quarantined,
        member.trusted,
        recentEvents
      )
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleQuarantine(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];
  const user = interaction.options.getUser("membre", true);
  const reason = interaction.options.getString("raison") || (lang === "fr" ? "Quarantaine manuelle" : "Manual quarantine");
  
  const member = interaction.guild!.members.cache.get(user.id);
  if (!member) return interaction.reply({ content: translations.member_not_found_guild, ephemeral: true });

  const success = await applyQuarantine(ctx, member, reason, interaction.user.id);

  if (success) {
    await interaction.reply(translations.quarantine_success(user.tag, reason));
  } else {
    await interaction.reply({ content: "❌ Impossible de mettre en quarantine (déjà en quarantine?)", ephemeral: true });
  }
}

async function handleTrust(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];
  const user = interaction.options.getUser("membre", true);
  
  const member = interaction.guild!.members.cache.get(user.id);
  if (!member) return interaction.reply({ content: translations.member_not_found_guild, ephemeral: true });

  const success = await liftQuarantine(ctx, member, lang === "fr" ? "Marqué comme fiable" : "Marked as trusted", true);

  if (success) {
    await interaction.reply(translations.trust_success(user.tag));
  } else {
    await interaction.reply({ content: "❌ Membre non trouvé en quarantine", ephemeral: true });
  }
}

async function handleEmergency(ctx: BotContext, interaction: ChatInputCommandInteraction) {
  const lang = ((interaction as any).language || "fr") as "en" | "fr";
  const translations = t[lang];

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: translations.admin_required, ephemeral: true });
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
      description: translations.emergency_event_desc(interaction.user.tag),
    },
  });

  await ctx.prisma.incident.create({
    data: {
      guildId: guild.id,
      title: translations.emergency_incident_title,
      severity: "CRITICAL",
      description: translations.emergency_incident_desc(interaction.user.tag),
    },
  });

  await interaction.editReply(translations.emergency_reply);
}
