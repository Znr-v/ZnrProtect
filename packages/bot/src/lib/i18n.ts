import { EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { BotContext } from "../index";

export async function getUserLanguage(ctx: BotContext, userId: string): Promise<"en" | "fr"> {
  try {
    const dbUser = await ctx.prisma.dashboardUser.findUnique({
      where: { discordId: userId },
    });
    return (dbUser?.language === "en" ? "en" : "fr") as "en" | "fr";
  } catch (err) {
    return "fr";
  }
}

const EMBED_COLOR = 0x5865f2;

export const t = {
  fr: {
    error_occurred: "❌ Une erreur est survenue.",
    admin_required: "❌ Permission Administrateur requise.",
    config_not_found: "❌ Aucune configuration trouvée.",
    specify_one_param: "❌ Spécifie au moins un paramètre.",
    member_not_found: "❌ Membre non trouvé en base.",
    member_not_found_guild: "❌ Membre introuvable.",
    role_not_found: "❌ Rôle de quarantaine introuvable.",
    no_quarantine_role: "❌ Aucun rôle de quarantaine configuré. Utilise `/setup quarantine`.",
    help_not_for_you: "Ce menu n'est pas pour toi.",
    help_placeholder: "Choisis un module pour plus de détails",
    help_modules: {
      antiraid: { label: "Anti-Raid", desc: "Protection contre les raids" },
      antispam: { label: "Anti-Spam", desc: "Détection et blocage du spam" },
      antiphishing: { label: "Anti-Phishing", desc: "Détection de liens malveillants" },
      secretscanner: { label: "Secret Scanner", desc: "Détection de tokens et clés API" },
      canary: { label: "Canary Channels", desc: "Salons pièges (honeypot)" },
      quarantine: { label: "Quarantaine", desc: "Isolation de membres suspects" },
      riskscore: { label: "Score de Risque", desc: "Analyse de risque 0-100" },
      emergency: { label: "Mode Urgence", desc: "Bouton d'urgence lockdown" },
      audit: { label: "Surveillance Audit", desc: "Monitoring du journal d'audit" },
      dashboard: { label: "Dashboard Web", desc: "Interface web de gestion" },
    },
    
    setup_quarantine_success: (roleName: string) => `✅ Rôle de quarantaine défini: **${roleName}**`,
    setup_canary_success: (channel: any) => `✅ Salon piège créé: ${channel}\nIl ressemble à un salon normal — tout message dedans = kick automatique.`,
    setup_antiraid_success: (threshold?: number, window?: number) => {
      let msg = "✅ Anti-raid configuré:\n";
      if (threshold !== undefined && threshold !== null) msg += `• Seuil: **${threshold} joins**\n`;
      if (window !== undefined && window !== null) msg += `• Fenêtre: **${window}s**\n`;
      return msg;
    },
    
    lockdown_active_reply: "🔒 **Lockdown activé** — tous les salons sont verrouillés.",
    lockdown_deactive_reply: "🔓 **Lockdown désactivé** — salons déverrouillés.",
    no_recent_incidents: "✅ Aucun incident récent.",
    quarantine_success: (tag: string, reason: string) => `🔒 **${tag}** mis en quarantaine. Raison: ${reason}`,
    trust_success: (tag: string) => `✅ **${tag}** marqué comme fiable.`,
    
    emergency_activated: (userTag: string) => `🚨 **MODE URGENCE ACTIVÉ** par ${userTag} !\n` +
      `• Serveur verrouillé (lockdown)\n` +
      `• Toutes les invitations ont été supprimées\n` +
      `• Incident critique créé`,
    emergency_reply: "🚨 **MODE URGENCE ACTIVÉ**\n" +
      "• Lockdown activé sur tous les salons\n" +
      "• Toutes les invitations supprimées\n" +
      "• Incident créé\n\n" +
      "Utilise `/security unlock` quand la situation est résolue.",

    help_main: () => new EmbedBuilder()
      .setTitle("🛡️ ZnrProtect — Centre d'aide")
      .setColor(EMBED_COLOR)
      .setDescription(
        "Bot de sécurité avancé pour Discord. Protection anti-raid, anti-spam, anti-phishing, " +
        "détection de secrets, salons pièges, système de quarantaine et plus encore.\n\n" +
        "**Utilise le menu ci-dessous** pour explorer chaque module."
      )
      .addFields(
        {
          name: "🔐 Commandes de sécurité",
          value:
            "`/security status` — Vue d'ensemble\n" +
            "`/security lockdown` — Verrouiller le serveur\n" +
            "`/security unlock` — Déverrouiller\n" +
            "`/security incidents` — Incidents récents\n" +
            "`/security user @membre` — Profil de risque\n" +
            "`/security quarantine @membre` — Quarantaine\n" +
            "`/security trust @membre` — Marquer fiable\n" +
            "`/security emergency` — Bouton d'urgence",
          inline: false,
        },
        {
          name: "⚙️ Commandes de configuration",
          value:
            "`/setup quarantine @role` — Rôle de quarantaine\n" +
            "`/setup canary` — Créer un salon piège\n" +
            "`/setup antiraid` — Configurer l'anti-raid\n" +
            "`/setup show` — Afficher la config\n" +
            "`/help` — Ce message",
          inline: false,
        },
        {
          name: "🌐 Dashboard web",
          value: "Accède au dashboard sur **http://localhost:3000** pour une vue complète avec graphiques, timeline et gestion avancée.",
          inline: false,
        }
      )
      .setFooter({ text: "Sélectionne un module ci-dessous pour plus de détails" })
      .setTimestamp(),

    help_antiraid: () => new EmbedBuilder()
      .setTitle("🛡️ Anti-Raid — Protection contre les raids")
      .setColor(0xff4444)
      .setDescription(
        "Détecte automatiquement les raids en analysant les arrivées de membres en temps réel."
      )
      .addFields(
        {
          name: "Comment ça fonctionne",
          value:
            "Le bot surveille le rythme des joins et calcule un **score de coordination** basé sur :\n" +
            "• **Taux de joins** — nombre d'arrivées dans une fenêtre de temps\n" +
            "• **Âge des comptes** — ratio de comptes récemment créés\n" +
            "• **Similarité de noms** — détecte les noms générés automatiquement\n\n" +
            "Si le score dépasse le seuil, le bot **verrouille automatiquement** tous les salons.",
        },
        {
          name: "Configuration",
          value:
            "`/setup antiraid threshold:15 window:60`\n" +
            "→ Déclenche si **15 joins en 60 secondes**\n\n" +
            "Valeurs par défaut : 10 joins / 60s",
        },
        {
          name: "Commandes manuelles",
          value:
            "`/security lockdown` — Verrouille tous les salons immédiatement\n" +
            "`/security unlock` — Déverrouille après la fin du raid",
        },
        {
          name: "Permissions requises",
          value: "`Administrateur` pour lockdown/unlock",
          inline: true,
        }
      )
      .setFooter({ text: "Module actif automatiquement dès le premier join" }),

    help_antispam: () => new EmbedBuilder()
      .setTitle("📢 Anti-Spam — Détection de spam")
      .setColor(0xffaa00)
      .setDescription(
        "Empêche le spam par rate-limiting, détection de doublons et mentions massives."
      )
      .addFields(
        {
          name: "Comment ça fonctionne",
          value:
            "Le bot suit en temps réel via Redis :\n" +
            "• **Rate de messages** — max de messages par fenêtre de temps\n" +
            "• **Mentions massives** — max de mentions par fenêtre\n" +
            "• **Messages dupliqués** — hash du contenu pour détecter le copier-coller\n\n" +
            "Si un seuil est dépassé → **timeout automatique de 5 minutes** + alerte.",
        },
        {
          name: "Seuils par défaut",
          value:
            "• **Messages** : 7 messages / 5 secondes\n" +
            "• **Mentions** : 5 mentions / 10 secondes\n" +
            "• **Doublons** : 3 messages identiques en 30 secondes",
        },
        {
          name: "Actions automatiques",
          value:
            "1. Timeout du membre (5 min)\n" +
            "2. Event de sécurité créé\n" +
            "3. Score de risque du membre augmenté\n" +
            "4. Alerte dans le salon de logs",
        }
      )
      .setFooter({ text: "Module actif automatiquement" }),

    help_antiphishing: () => new EmbedBuilder()
      .setTitle("🔗 Anti-Phishing — Protection contre le phishing")
      .setColor(0x9b59b6)
      .setDescription(
        "Analyse chaque lien posté et détecte les tentatives de phishing."
      )
      .addFields(
        {
          name: "Méthodes de détection",
          value:
            "• **Typosquatting** — ex: `discrod.com`, `stearn.com` (distance de Levenshtein)\n" +
            "• **Punycode** — liens utilisant des caractères Unicode trompeurs\n" +
            "• **Patterns connus** — regex pour les domaines de phishing courants\n" +
            "• **Raccourcisseurs d'URL** — `bit.ly`, `tinyurl`, etc. sont analysés\n" +
            "• **Domaines suspects** — `.ru`, `.xyz` avec noms trompeurs",
        },
        {
          name: "Actions automatiques",
          value:
            "1. Message supprimé\n" +
            "2. Membre mis en quarantaine\n" +
            "3. DM envoyé au membre avec explication\n" +
            "4. Lien enregistré en base de données\n" +
            "5. Event de sécurité créé",
        },
        {
          name: "Domaines protégés",
          value:
            "`discord.com`, `discord.gg`, `steam.com`, `steampowered.com`, " +
            "`epicgames.com`, `twitch.tv`, `youtube.com`, `paypal.com`, " +
            "`github.com`, `roblox.com`",
        }
      )
      .setFooter({ text: "Module actif automatiquement sur chaque message" }),

    help_secretscanner: () => new EmbedBuilder()
      .setTitle("🔐 Secret Scanner — Détection de secrets")
      .setColor(0xe74c3c)
      .setDescription(
        "Scanne les messages pour détecter les tokens, clés API et secrets accidentellement postés."
      )
      .addFields(
        {
          name: "Secrets détectés",
          value:
            "• **Tokens Discord** — tokens bot et utilisateur\n" +
            "• **Tokens GitHub** — `ghp_`, `gho_`, `ghs_`\n" +
            "• **Clés OpenAI** — `sk-...`\n" +
            "• **Clés Anthropic** — `sk-ant-...`\n" +
            "• **Clés AWS** — Access Key ID + Secret\n" +
            "• **JWT** — `eyJ...`\n" +
            "• **Clés privées** — PEM / RSA\n" +
            "• **URLs de base de données** — avec mots de passe",
        },
        {
          name: "Actions automatiques",
          value:
            "1. Message supprimé immédiatement\n" +
            "2. DM envoyé au membre : \"Ton secret a été détecté, change-le !\"\n" +
            "3. **Seul un hash SHA-256 est stocké** — jamais le secret brut\n" +
            "4. Event de sécurité CRITICAL créé",
        },
        {
          name: "Sécurité",
          value: "Le bot ne stocke **jamais** le secret en clair. Seul un hash SHA-256 est conservé pour traçabilité.",
        }
      )
      .setFooter({ text: "Module actif automatiquement" }),

    help_canary: () => new EmbedBuilder()
      .setTitle("🍯 Canary Channels — Salons pièges")
      .setColor(0xf39c12)
      .setDescription(
        "Des salons qui ressemblent à de vrais salons mais qui sont des pièges. " +
        "Tout message envoyé dedans = kick automatique."
      )
      .addFields(
        {
          name: "Comment ça fonctionne",
          value:
            "1. Utilise `/setup canary` pour créer un salon piège\n" +
            "2. Le bot crée un salon qui ressemble à un vrai (ex: `🍯・general-chat`)\n" +
            "3. Les vrais membres savent qu'il ne faut pas y écrire\n" +
            "4. Les bots/raiders qui spamment partout tombent dans le piège\n" +
            "5. **Message supprimé + kick automatique + event loggé**",
        },
        {
          name: "Utilisation",
          value: "`/setup canary` — Crée un nouveau salon piège\n\nTu peux en créer plusieurs avec des noms différents.",
        },
        {
          name: "Astuce",
          value: "Place le salon piège entre tes vrais salons pour qu'il paraisse légitime. Les raiders automatisés ne font pas la différence.",
        }
      )
      .setFooter({ text: "Nécessite : Administrateur" }),

    help_quarantine: () => new EmbedBuilder()
      .setTitle("🔒 Quarantaine — Isolation de membres")
      .setColor(0x2ecc71)
      .setDescription(
        "Isole un membre suspect en lui attribuant un rôle qui restreint ses accès."
      )
      .addFields(
        {
          name: "Mise en place",
          value:
            "**1.** Crée un rôle (ex: `Quarantaine`) avec **aucune permission**\n" +
            "**2.** Configure-le : `/setup quarantine @Quarantaine`\n" +
            "**3.** Le bot ajoutera ce rôle automatiquement ou manuellement",
        },
        {
          name: "Quarantaine manuelle",
          value:
            "`/security quarantine @membre raison:Comportement suspect`\n" +
            "→ Ajoute le rôle de quarantaine au membre",
        },
        {
          name: "Quarantaine automatique",
          value: "Le bot met automatiquement en quarantaine lors de :\n• Détection de lien phishing\n• Score de risque trop élevé\n• Détection de secret leaké",
        },
        {
          name: "Retirer la quarantaine",
          value:
            "`/security trust @membre`\n" +
            "→ Retire la quarantaine + marque le membre comme fiable + reset le score de risque à 0",
        }
      )
      .setFooter({ text: "Nécessite : Modérer les membres" }),

    help_riskscore: () => new EmbedBuilder()
      .setTitle("📊 Score de Risque — Analyse de membres")
      .setColor(0x3498db)
      .setDescription(
        "Chaque membre a un score de risque de **0 à 100** calculé automatiquement."
      )
      .addFields(
        {
          name: "Facteurs de calcul",
          value:
            "| Facteur | Points max |\n" +
            "|---|---|\n" +
            "| Âge du compte (<30j) | 0-30 |\n" +
            "| Ancienneté serveur (<7j) | 0-15 |\n" +
            "| Pas d'avatar | 0-5 |\n" +
            "| Nom par défaut | 0-5 |\n" +
            "| Ratio de liens | 0-15 |\n" +
            "| Avertissements | 0-20 |\n" +
            "| Quarantaine passée | 0-10 |",
        },
        {
          name: "Niveaux de risque",
          value:
            "🟢 **0-30** — Normal\n" +
            "🟡 **31-60** — Modéré — à surveiller\n" +
            "🟠 **61-80** — Élevé — actions recommandées\n" +
            "🔴 **81-100** — Critique — action immédiate requise",
        },
        {
          name: "Consulter le profil",
          value: "`/security user @membre` — Affiche le score détaillé, les stats et l'historique",
        }
      )
      .setFooter({ text: "Score recalculé à chaque action du membre" }),

    help_emergency: () => new EmbedBuilder()
      .setTitle("🚨 Mode Urgence — Bouton d'urgence")
      .setColor(0xff0000)
      .setDescription(
        "En cas de raid massif ou d'attaque en cours, active le mode urgence pour tout verrouiller instantanément."
      )
      .addFields(
        {
          name: "Que fait le bouton d'urgence ?",
          value:
            "1. **Lockdown** — Verrouille tous les salons (plus personne ne peut écrire)\n" +
            "2. **Invitations supprimées** — Toutes les invites actives sont supprimées\n" +
            "3. **Incident CRITICAL** — Un incident est créé automatiquement\n" +
            "4. **Event loggé** — Tracé dans le système de sécurité",
        },
        {
          name: "Utilisation",
          value: "`/security emergency`\n\n**Attention :** action irréversible sans intervention manuelle.",
        },
        {
          name: "Revenir à la normale",
          value:
            "1. Résous la menace (ban les attaquants, etc.)\n" +
            "2. `/security unlock` — Déverrouille les salons\n" +
            "3. Crée de nouvelles invitations si nécessaire",
        }
      )
      .setFooter({ text: "Nécessite : Administrateur — À utiliser en dernier recours" }),

    help_audit: () => new EmbedBuilder()
      .setTitle("🔑 Surveillance Audit — Détection de menaces")
      .setColor(0x1abc9c)
      .setDescription(
        "Le bot surveille en continu le journal d'audit de Discord pour détecter les actions suspectes."
      )
      .addFields(
        {
          name: "Events surveillés",
          value:
            "• **Permission Drift** — Ajout de permissions dangereuses (Admin, ManageGuild, ManageRoles...)\n" +
            "• **Bans/Kicks massifs** — 5+ bans ou kicks en 60 secondes\n" +
            "• **Suppression de salons** — Suppression de channels\n" +
            "• **Création de webhooks** — Nouveaux webhooks (vecteur d'attaque courant)\n" +
            "• **Ajout de bots** — Nouveaux bots sur le serveur",
        },
        {
          name: "Actions automatiques",
          value:
            "Chaque détection crée un **event de sécurité** avec la sévérité appropriée.\n" +
            "Les events critiques (bans massifs, permission Admin) génèrent un **incident**.",
        },
        {
          name: "Dashboard",
          value: "Retrouve tous les events dans l'onglet **Events** du dashboard avec filtres par type et sévérité.",
        }
      )
      .setFooter({ text: "Module actif automatiquement via l'audit log Discord" }),

    help_dashboard: () => new EmbedBuilder()
      .setTitle("🌐 Dashboard Web — Interface de gestion")
      .setColor(EMBED_COLOR)
      .setDescription(
        "Interface web complète pour gérer la sécurité de tes serveurs."
      )
      .addFields(
        {
          name: "Accès",
          value:
            "**URL** : `http://localhost:3000`\n" +
            "**Connexion** : OAuth2 Discord (bouton \"Connexion avec Discord\")",
        },
        {
          name: "Fonctionnalités",
          value:
            "• **Vue globale** — Stats de tous tes serveurs en un coup d'oeil\n" +
            "• **Détail serveur** — 5 onglets : Overview, Incidents, Events, Membres, Config\n" +
            "• **Incidents** — Timeline avec sévérité et statut\n" +
            "• **Events** — Tous les events de sécurité avec filtres\n" +
            "• **Membres** — Liste triée par score de risque\n" +
            "• **Config** — Tous les paramètres du bot affichés",
        },
        {
          name: "API REST",
          value: "L'API tourne sur `http://localhost:4000` avec 7 modules de routes (auth, guilds, incidents, members, stats, events, config).",
        }
      )
      .setFooter({ text: "Lance le dashboard avec : npm run dev" }),

    status_title: "🛡️ Statut de sécurité",
    status_fields: (lockdown: boolean, recentEvents: number, openIncidents: number, highRiskMembers: number, riskScore: number) => [
      { name: "Lockdown", value: lockdown ? "🔴 ACTIF" : "🟢 Inactif", inline: true },
      { name: "Events (24h)", value: `${recentEvents}`, inline: true },
      { name: "Incidents ouverts", value: `${openIncidents}`, inline: true },
      { name: "Membres à risque", value: `${highRiskMembers}`, inline: true },
      { name: "Score serveur", value: `${riskScore}/100`, inline: true },
    ],

    incidents_title: "📋 Incidents récents",
    incidents_empty: "✅ Aucun incident récent.",
    incidents_map: (i: any, severityEmoji: string, statusEmoji: string) => 
      `${severityEmoji} ${statusEmoji} **${i.title}**\n` +
      `ID: \`${i.id.slice(0, 8)}\` — ${i.createdAt.toLocaleDateString("fr-FR")}`,

    user_fields: (score: number, label: string, messageCount: number, linkCount: number, warnCount: number, quarantined: boolean, trusted: boolean, recentEvents: number) => [
      { name: "Score de risque", value: `**${score}/100** (${label})`, inline: true },
      { name: "Messages", value: `${messageCount}`, inline: true },
      { name: "Liens", value: `${linkCount}`, inline: true },
      { name: "Avertissements", value: `${warnCount}`, inline: true },
      { name: "Quarantaine", value: quarantined ? "🔴 Oui" : "🟢 Non", inline: true },
      { name: "Fiable", value: trusted ? "✅ Oui" : "❌ Non", inline: true },
      { name: "Events (7j)", value: `${recentEvents}`, inline: true },
    ],

    emergency_event_desc: (userTag: string) => `Bouton d'urgence activé par ${userTag}`,
    emergency_incident_title: "🚨 URGENCE — Bouton d'urgence activé",
    emergency_incident_desc: (userTag: string) => `Activé par ${userTag}`,
    
    config_lines: (config: any) => [
      `**Anti-Raid:** seuil=${config.raidJoinThreshold} joins / ${config.raidJoinWindow}s, auto-lockdown=${config.raidAutoLockdown ? "✅" : "❌"}`,
      `**Anti-Spam:** max=${config.spamMaxMessages} msgs/${config.spamMuteDuration}m, mentions max=${config.spamMaxMentions}/${config.spamMuteDuration}m`,
      `**Anti-Phishing:** ${config.phishingEnabled ? "✅" : "❌"}, redirects=${config.phishingCheckRedirects ? "✅" : "❌"}`,
      `**Secret Scan:** ${config.secretScanEnabled ? "✅" : "❌"}`,
      `**Quarantaine:** ${config.quarantineEnabled ? "✅" : "❌"}, rôle=${config.quarantineRoleId || "non défini"}`,
      `**Emergency:** ${config.emergencyEnabled ? "✅" : "❌"}`,
    ],
    config_title: "⚙️ Configuration",
  },
  en: {
    error_occurred: "❌ An error occurred.",
    admin_required: "❌ Administrator permission required.",
    config_not_found: "❌ No configuration found.",
    specify_one_param: "❌ Specify at least one parameter.",
    member_not_found: "❌ Member not found in database.",
    member_not_found_guild: "❌ Member not found.",
    role_not_found: "❌ Quarantine role not found.",
    no_quarantine_role: "❌ No quarantine role configured. Use `/setup quarantine`.",
    help_not_for_you: "This menu is not for you.",
    help_placeholder: "Choose a module for more details",
    help_modules: {
      antiraid: { label: "Anti-Raid", desc: "Raid Protection" },
      antispam: { label: "Anti-Spam", desc: "Spam Detection" },
      antiphishing: { label: "Anti-Phishing", desc: "Phishing Protection" },
      secretscanner: { label: "Secret Scanner", desc: "Secret Detection" },
      canary: { label: "Canary Channels", desc: "Trap Channels" },
      quarantine: { label: "Quarantine", desc: "Member Isolation" },
      riskscore: { label: "Risk Score", desc: "Member Analysis" },
      emergency: { label: "Emergency Mode", desc: "Emergency Button" },
      audit: { label: "Audit Surveillance", desc: "Threat Detection" },
      dashboard: { label: "Web Dashboard", desc: "Management Interface" },
    },
    
    setup_quarantine_success: (roleName: string) => `✅ Quarantine role set: **${roleName}**`,
    setup_canary_success: (channel: any) => `✅ Trap channel created: ${channel}\nIt looks like a normal channel — any message inside = automatic kick.`,
    setup_antiraid_success: (threshold?: number, window?: number) => {
      let msg = "✅ Anti-raid configured:\n";
      if (threshold !== undefined && threshold !== null) msg += `• Threshold: **${threshold} joins**\n`;
      if (window !== undefined && window !== null) msg += `• Window: **${window}s**\n`;
      return msg;
    },
    
    lockdown_active_reply: "🔒 **Lockdown activated** — all channels are locked.",
    lockdown_deactive_reply: "🔓 **Lockdown deactivated** — channels unlocked.",
    no_recent_incidents: "✅ No recent incidents.",
    quarantine_success: (tag: string, reason: string) => `🔒 **${tag}** put in quarantine. Reason: ${reason}`,
    trust_success: (tag: string) => `✅ **${tag}** marked as trusted.`,
    
    emergency_activated: (userTag: string) => `🚨 **EMERGENCY MODE ACTIVATED** by ${userTag} !\n` +
      `• Server locked (lockdown)\n` +
      `• All active invites deleted\n` +
      `• Critical incident created`,
    emergency_reply: "🚨 **EMERGENCY MODE ACTIVATED**\n" +
      "• Lockdown activated on all channels\n" +
      "• All active invites deleted\n" +
      "• Incident created\n\n" +
      "Use `/security unlock` when the situation is resolved.",

    help_main: () => new EmbedBuilder()
      .setTitle("🛡️ ZnrProtect — Help Center")
      .setColor(EMBED_COLOR)
      .setDescription(
        "Advanced security bot for Discord. Anti-raid, anti-spam, anti-phishing protection, " +
        "secret detection, trap channels, quarantine system and more.\n\n" +
        "**Use the menu below** to explore each module."
      )
      .addFields(
        {
          name: "🔐 Security Commands",
          value:
            "`/security status` — Overview\n" +
            "`/security lockdown` — Lock the server\n" +
            "`/security unlock` — Unlock the server\n" +
            "`/security incidents` — Recent incidents\n" +
            "`/security user @member` — Risk profile\n" +
            "`/security quarantine @member` — Quarantine\n" +
            "`/security trust @member` — Mark as trusted\n" +
            "`/security emergency` — Emergency button",
          inline: false,
        },
        {
          name: "⚙️ Configuration Commands",
          value:
            "`/setup quarantine @role` — Quarantine role\n" +
            "`/setup canary` — Create a trap channel\n" +
            "`/setup antiraid` — Configure anti-raid\n" +
            "`/setup show` — Show config\n" +
            "`/help` — This message",
          inline: false,
        },
        {
          name: "🌐 Web Dashboard",
          value: "Access the dashboard at **http://localhost:3000** for a full view with graphs, timeline and advanced management.",
          inline: false,
        }
      )
      .setFooter({ text: "Select a module below for more details" })
      .setTimestamp(),

    help_antiraid: () => new EmbedBuilder()
      .setTitle("🛡️ Anti-Raid — Raid Protection")
      .setColor(0xff4444)
      .setDescription(
        "Automatically detects raids by analyzing member joins in real-time."
      )
      .addFields(
        {
          name: "How it works",
          value:
            "The bot monitors join frequency and calculates a **coordination score** based on:\n" +
            "• **Join rate** — number of joins within a time window\n" +
            "• **Account age** — ratio of recently created accounts\n" +
            "• **Name similarity** — detects automatically generated names\n\n" +
            "If the score exceeds the threshold, the bot **automatically locks** all channels.",
        },
        {
          name: "Configuration",
          value:
            "`/setup antiraid threshold:15 window:60`\n" +
            "→ Triggers if **15 joins in 60 seconds**\n\n" +
            "Default values: 10 joins / 60s",
        },
        {
          name: "Manual Commands",
          value:
            "`/security lockdown` — Locks all channels immediately\n" +
            "`/security unlock` — Unlocks after the raid has ended",
        },
        {
          name: "Required Permissions",
          value: "`Administrator` for lockdown/unlock",
          inline: true,
        }
      )
      .setFooter({ text: "Module automatically active from the first join" }),

    help_antispam: () => new EmbedBuilder()
      .setTitle("📢 Anti-Spam — Spam Detection")
      .setColor(0xffaa00)
      .setDescription(
        "Prevents spam via rate-limiting, duplicate detection and mass mentions."
      )
      .addFields(
        {
          name: "How it works",
          value:
            "The bot tracks in real-time via Redis:\n" +
            "• **Message rate** — max messages per time window\n" +
            "• **Mass mentions** — max mentions per window\n" +
            "• **Duplicate messages** — content hashing to detect copy-paste\n\n" +
            "If a threshold is exceeded → **automatic 5-minute timeout** + alert.",
        },
        {
          name: "Default Thresholds",
          value:
            "• **Messages**: 7 messages / 5 seconds\n" +
            "• **Mentions**: 5 mentions / 10 seconds\n" +
            "• **Duplicates**: 3 identical messages in 30 seconds",
        },
        {
          name: "Automatic Actions",
          value:
            "1. Member timeout (5 min)\n" +
            "2. Security event created\n" +
            "3. Member risk score increased\n" +
            "4. Alert in log channel",
        }
      )
      .setFooter({ text: "Module automatically active" }),

    help_antiphishing: () => new EmbedBuilder()
      .setTitle("🔗 Anti-Phishing — Phishing Protection")
      .setColor(0x9b59b6)
      .setDescription(
        "Analyzes every posted link and detects phishing attempts."
      )
      .addFields(
        {
          name: "Detection Methods",
          value:
            "• **Typosquatting** — e.g., `discrod.com`, `stearn.com` (Levenshtein distance)\n" +
            "• **Punycode** — links using misleading Unicode characters\n" +
            "• **Known Patterns** — regex for common phishing domains\n" +
            "• **URL Shorteners** — `bit.ly`, `tinyurl`, etc., are analyzed\n" +
            "• **Suspicious Domains** — `.ru`, `.xyz` with misleading names",
        },
        {
          name: "Automatic Actions",
          value:
            "1. Message deleted\n" +
            "2. Member put in quarantine\n" +
            "3. DM sent to member with explanation\n" +
            "4. Link recorded in database\n" +
            "5. Security event created",
        },
        {
          name: "Protected Domains",
          value:
            "`discord.com`, `discord.gg`, `steam.com`, `steampowered.com`, " +
            "`epicgames.com`, `twitch.tv`, `youtube.com`, `paypal.com`, " +
            "`github.com`, `roblox.com`",
        }
      )
      .setFooter({ text: "Module active automatically on every message" }),

    help_secretscanner: () => new EmbedBuilder()
      .setTitle("🔐 Secret Scanner — Secret Detection")
      .setColor(0xe74c3c)
      .setDescription(
        "Scans messages to detect accidentally posted tokens, API keys and secrets."
      )
      .addFields(
        {
          name: "Secrets Detected",
          value:
            "• **Discord Tokens** — bot and user tokens\n" +
            "• **GitHub Tokens** — `ghp_`, `gho_`, `ghs_`\n" +
            "• **OpenAI Keys** — `sk-...`\n" +
            "• **Anthropic Keys** — `sk-ant-...`\n" +
            "• **AWS Keys** — Access Key ID + Secret\n" +
            "• **JWT** — `eyJ...`\n" +
            "• **Private Keys** — PEM / RSA\n" +
            "• **Database URLs** — with passwords",
        },
        {
          name: "Automatic Actions",
          value:
            "1. Message deleted immediately\n" +
            "2. DM sent to member: \"Your secret was detected, change it!\"\n" +
            "3. **Only a SHA-256 hash is stored** — never the raw secret\n" +
            "4. CRITICAL security event created",
        },
        {
          name: "Security",
          value: "The bot **never** stores the raw secret. Only a SHA-256 hash is kept for traceability.",
        }
      )
      .setFooter({ text: "Module automatically active" }),

    help_canary: () => new EmbedBuilder()
      .setTitle("🍯 Canary Channels — Trap Channels")
      .setColor(0xf39c12)
      .setDescription(
        "Channels that look like real ones but are traps. " +
        "Any message sent inside = automatic kick."
      )
      .addFields(
        {
          name: "How it works",
          value:
            "1. Use `/setup canary` to create a trap channel\n" +
            "2. The bot creates a channel that looks real (e.g., `🍯・general-chat`)\n" +
            "3. Real members know not to write in it\n" +
            "4. Bots/raiders who spam everywhere fall into the trap\n" +
            "5. **Message deleted + automatic kick + logged event**",
        },
        {
          name: "Usage",
          value: "`/setup canary` — Creates a new trap channel\n\nYou can create multiple ones with different names.",
        },
        {
          name: "Tip",
          value: "Place the trap channel among your real channels so it looks legitimate. Automated raiders won't tell the difference.",
        }
      )
      .setFooter({ text: "Requires: Administrator" }),

    help_quarantine: () => new EmbedBuilder()
      .setTitle("🔒 Quarantine — Member Isolation")
      .setColor(0x2ecc71)
      .setDescription(
        "Isolates a suspicious member by assigning a role that restricts their access."
      )
      .addFields(
        {
          name: "Setup",
          value:
            "**1.** Create a role (e.g., `Quarantine`) with **no permissions**\n" +
            "**2.** Configure it: `/setup quarantine @Quarantine`\n" +
            "**3.** The bot will add this role automatically or manually",
        },
        {
          name: "Manual Quarantine",
          value:
            "`/security quarantine @member reason:Suspicious behavior`\n" +
            "→ Adds the quarantine role to the member",
        },
        {
          name: "Automatic Quarantine",
          value: "The bot automatically quarantines on:\n• Phishing link detection\n• High risk score\n• Secret leak detection",
        },
        {
          name: "Remove Quarantine",
          value:
            "`/security trust @member`\n" +
            "→ Removes quarantine + marks the member as trusted + resets risk score to 0",
        }
      )
      .setFooter({ text: "Requires: Moderate Members" }),

    help_riskscore: () => new EmbedBuilder()
      .setTitle("📊 Risk Score — Member Analysis")
      .setColor(0x3498db)
      .setDescription(
        "Each member has a risk score of **0 to 100** automatically calculated."
      )
      .addFields(
        {
          name: "Calculation Factors",
          value:
            "| Factor | Max Points |\n" +
            "|---|---|\n" +
            "| Account age (<30d) | 0-30 |\n" +
            "| Server age (<7d) | 0-15 |\n" +
            "| No avatar | 0-5 |\n" +
            "| Default name | 0-5 |\n" +
            "| Link ratio | 0-15 |\n" +
            "| Warnings | 0-20 |\n" +
            "| Past quarantine | 0-10 |",
        },
        {
          name: "Risk Levels",
          value:
            "🟢 **0-30** — Normal\n" +
            "🟡 **31-60** — Moderate — monitor\n" +
            "🟠 **61-80** — High — action recommended\n" +
            "🔴 **81-100** — Critical — immediate action required",
        },
        {
          name: "Check Profile",
          value: "`/security user @member` — Shows detailed score, stats and history",
        }
      )
      .setFooter({ text: "Score recalculated upon each member action" }),

    help_emergency: () => new EmbedBuilder()
      .setTitle("🚨 Emergency Mode — Emergency Button")
      .setColor(0xff0000)
      .setDescription(
        "In case of a massive raid or active attack, activate the emergency mode to instantly lock down everything."
      )
      .addFields(
        {
          name: "What does the emergency button do?",
          value:
            "1. **Lockdown** — Locks all channels (no one can write)\n" +
            "2. **Active Invites Deleted** — All active invites are deleted\n" +
            "3. **CRITICAL Incident** — An incident is automatically created\n" +
            "4. **Logged Event** — Traced in the security system",
        },
        {
          name: "Usage",
          value: "`/security emergency`\n\n**Warning:** irreversible action without manual intervention.",
        },
        {
          name: "Return to Normal",
          value:
            "1. Resolve the threat (ban attackers, etc.)\n" +
            "2. `/security unlock` — Unlocks channels\n" +
            "3. Create new invites if necessary",
        }
      )
      .setFooter({ text: "Requires: Administrator — To be used as a last resort" }),

    help_audit: () => new EmbedBuilder()
      .setTitle("🔑 Audit Surveillance — Threat Detection")
      .setColor(0x1abc9c)
      .setDescription(
        "The bot continuously monitors the Discord audit log to detect suspicious actions."
      )
      .addFields(
        {
          name: "Monitored Events",
          value:
            "• **Permission Drift** — Addition of dangerous permissions (Admin, ManageGuild, ManageRoles...)\n" +
            "• **Mass Kicks/Bans** — 5+ kicks or bans in 60 seconds\n" +
            "• **Channel Deletions** — Deleting channels\n" +
            "• **Webhook Creation** — New webhooks (common attack vector)\n" +
            "• **Bot Additions** — New bots on the server",
        },
        {
          name: "Automatic Actions",
          value:
            "Each detection creates a **security event** with the appropriate severity.\n" +
            "Critical events (mass bans, Admin permission) generate an **incident**.",
        },
        {
          name: "Dashboard",
          value: "Find all events in the **Events** tab of the dashboard with filters by type and severity.",
        }
      )
      .setFooter({ text: "Module automatically active via the Discord audit log" }),

    help_dashboard: () => new EmbedBuilder()
      .setTitle("🌐 Web Dashboard — Management Interface")
      .setColor(EMBED_COLOR)
      .setDescription(
        "Full web interface to manage your servers' security."
      )
      .addFields(
        {
          name: "Access",
          value:
            "**URL**: `http://localhost:3000`\n" +
            "**Login**: Discord OAuth2 (via \"Login with Discord\" button)",
        },
        {
          name: "Features",
          value:
            "• **Global view** — Stats for all your servers at a glance\n" +
            "• **Server details** — 5 tabs: Overview, Incidents, Events, Members, Config\n" +
            "• **Incidents** — Timeline with severity and status\n" +
            "• **Events** — All security events with filters\n" +
            "• **Members** — List sorted by risk score\n" +
            "• **Config** — All bot settings displayed",
        },
        {
          name: "REST API",
          value: "The API runs on `http://localhost:4000` with 7 routing modules (auth, guilds, incidents, members, stats, events, config).",
        }
      )
      .setFooter({ text: "Launch the dashboard with: npm run dev" }),

    status_title: "🛡️ Security Status",
    status_fields: (lockdown: boolean, recentEvents: number, openIncidents: number, highRiskMembers: number, riskScore: number) => [
      { name: "Lockdown", value: lockdown ? "🔴 ACTIVE" : "🟢 Inactive", inline: true },
      { name: "Events (24h)", value: `${recentEvents}`, inline: true },
      { name: "Open Incidents", value: `${openIncidents}`, inline: true },
      { name: "At-Risk Members", value: `${highRiskMembers}`, inline: true },
      { name: "Server Score", value: `${riskScore}/100`, inline: true },
    ],

    incidents_title: "📋 Recent Incidents",
    incidents_empty: "✅ No recent incidents.",
    incidents_map: (i: any, severityEmoji: string, statusEmoji: string) => 
      `${severityEmoji} ${statusEmoji} **${i.title}**\n` +
      `ID: \`${i.id.slice(0, 8)}\` — ${i.createdAt.toLocaleDateString("en-US")}`,

    user_fields: (score: number, label: string, messageCount: number, linkCount: number, warnCount: number, quarantined: boolean, trusted: boolean, recentEvents: number) => [
      { name: "Risk Score", value: `**${score}/100** (${label})`, inline: true },
      { name: "Messages", value: `${messageCount}`, inline: true },
      { name: "Links", value: `${linkCount}`, inline: true },
      { name: "Warnings", value: `${warnCount}`, inline: true },
      { name: "Quarantine", value: quarantined ? "🔴 Yes" : "🟢 No", inline: true },
      { name: "Trusted", value: trusted ? "✅ Yes" : "❌ No", inline: true },
      { name: "Events (7d)", value: `${recentEvents}`, inline: true },
    ],

    emergency_event_desc: (userTag: string) => `Emergency button activated by ${userTag}`,
    emergency_incident_title: "🚨 EMERGENCY — Emergency button activated",
    emergency_incident_desc: (userTag: string) => `Activated by ${userTag}`,

    config_lines: (config: any) => [
      `**Anti-Raid:** threshold=${config.raidJoinThreshold} joins / ${config.raidJoinWindow}s, auto-lockdown=${config.raidAutoLockdown ? "✅" : "❌"}`,
      `**Anti-Spam:** max=${config.spamMaxMessages} msgs/${config.spamMuteDuration}m, max mentions=${config.spamMaxMentions}/${config.spamMuteDuration}m`,
      `**Anti-Phishing:** ${config.phishingEnabled ? "✅" : "❌"}, redirects=${config.phishingCheckRedirects ? "✅" : "❌"}`,
      `**Secret Scan:** ${config.secretScanEnabled ? "✅" : "❌"}`,
      `**Quarantine:** ${config.quarantineEnabled ? "✅" : "❌"}, role=${config.quarantineRoleId || "not set"}`,
      `**Emergency:** ${config.emergencyEnabled ? "✅" : "❌"}`,
    ],
    config_title: "⚙️ Configuration",
  }
};
