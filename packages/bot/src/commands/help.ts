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

const EMBED_COLOR = 0x5865f2;

function mainEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🛡️ Security Bot — Centre d'aide")
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
    .setTimestamp();
}

function antiRaidEmbed(): EmbedBuilder {
  return new EmbedBuilder()
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
    .setFooter({ text: "Module actif automatiquement dès le premier join" });
}

function antiSpamEmbed(): EmbedBuilder {
  return new EmbedBuilder()
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
    .setFooter({ text: "Module actif automatiquement" });
}

function antiPhishingEmbed(): EmbedBuilder {
  return new EmbedBuilder()
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
    .setFooter({ text: "Module actif automatiquement sur chaque message" });
}

function secretScannerEmbed(): EmbedBuilder {
  return new EmbedBuilder()
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
    .setFooter({ text: "Module actif automatiquement" });
}

function canaryEmbed(): EmbedBuilder {
  return new EmbedBuilder()
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
    .setFooter({ text: "Nécessite : Administrateur" });
}

function quarantineEmbed(): EmbedBuilder {
  return new EmbedBuilder()
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
    .setFooter({ text: "Nécessite : Modérer les membres" });
}

function riskScoreEmbed(): EmbedBuilder {
  return new EmbedBuilder()
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
    .setFooter({ text: "Score recalculé à chaque action du membre" });
}

function emergencyEmbed(): EmbedBuilder {
  return new EmbedBuilder()
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
    .setFooter({ text: "Nécessite : Administrateur — À utiliser en dernier recours" });
}

function auditEmbed(): EmbedBuilder {
  return new EmbedBuilder()
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
    .setFooter({ text: "Module actif automatiquement via l'audit log Discord" });
}

function dashboardEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🌐 Dashboard Web — Interface de gestion")
    .setColor(0x5865f2)
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
    .setFooter({ text: "Lance le dashboard avec : npm run dev" });
}

const moduleEmbeds: Record<string, () => EmbedBuilder> = {
  antiraid: antiRaidEmbed,
  antispam: antiSpamEmbed,
  antiphishing: antiPhishingEmbed,
  secretscanner: secretScannerEmbed,
  canary: canaryEmbed,
  quarantine: quarantineEmbed,
  riskscore: riskScoreEmbed,
  emergency: emergencyEmbed,
  audit: auditEmbed,
  dashboard: dashboardEmbed,
};

export const helpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche l'aide complète du bot de sécurité"),

  async execute(_ctx: BotContext, interaction: ChatInputCommandInteraction) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_module")
      .setPlaceholder("Choisis un module pour plus de détails")
      .addOptions(
        { label: "Anti-Raid", description: "Protection contre les raids", emoji: "🛡️", value: "antiraid" },
        { label: "Anti-Spam", description: "Détection et blocage du spam", emoji: "📢", value: "antispam" },
        { label: "Anti-Phishing", description: "Détection de liens malveillants", emoji: "🔗", value: "antiphishing" },
        { label: "Secret Scanner", description: "Détection de tokens et clés API", emoji: "🔐", value: "secretscanner" },
        { label: "Canary Channels", description: "Salons pièges (honeypot)", emoji: "🍯", value: "canary" },
        { label: "Quarantaine", description: "Isolation de membres suspects", emoji: "🔒", value: "quarantine" },
        { label: "Score de Risque", description: "Analyse de risque 0-100", emoji: "📊", value: "riskscore" },
        { label: "Mode Urgence", description: "Bouton d'urgence lockdown", emoji: "🚨", value: "emergency" },
        { label: "Surveillance Audit", description: "Monitoring du journal d'audit", emoji: "🔑", value: "audit" },
        { label: "Dashboard Web", description: "Interface web de gestion", emoji: "🌐", value: "dashboard" },
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const response = await interaction.reply({
      embeds: [mainEmbed()],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300_000,
    });

    collector.on("collect", async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "Ce menu n'est pas pour toi.", ephemeral: true });
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
