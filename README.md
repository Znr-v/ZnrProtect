# 🛡️ ZnrProtect — Bot Discord de sécurité avancé

![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=flat&logo=discord)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat&logo=postgresql)

Un système de sécurité complet pour serveurs Discord avec détection de raids, anti-spam, analyse de phishing, scanner de secrets et dashboard web moderne.

## 📁 Architecture

```
├── prisma/                      # Schéma de base de données (PostgreSQL)
├── packages/
│   ├── bot/                     # Bot Discord (discord.js v14 + TypeScript)
│   │   ├── src/
│   │   │   ├── commands/        # Slash commands (/security, /setup)
│   │   │   ├── events/         # Event handlers Discord
│   │   │   ├── modules/        # Modules de sécurité
│   │   │   ├── services/       # Services (détection bots, etc.)
│   │   │   └── workers/        # BullMQ workers
│   ├── api/                     # API REST (Fastify)
│   │   └── src/routes/         # Auth, guilds, incidents, members, stats, roles, config
│   ├── dashboard/              # Dashboard web (Next.js 14 + TailwindCSS)
│   │   └── src/
│   │       ├── app/            # Pages (accueil, guild, admin, configs)
│   │       ├── components/     # Composants React
│   │       └── lib/            # Utilitaires (API, i18n, permissions)
│   └── testbot/                # Bot de test/simulation
├── docker-compose.yml           # PostgreSQL + Redis
└── .env                         # Configuration
```

## 🛠️ Technologies

- **Bot**: Discord.js v14, TypeScript, Prisma
- **API**: Fastify, JWT, OAuth2 Discord
- **Dashboard**: Next.js 14 (App Router), TailwindCSS, NextAuth.js
- **Base de données**: PostgreSQL + Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **i18n**: Support multilingue (français/anglais)

## 🚀 Installation

```bash
# 1. Lancer les services
docker compose up -d

# 2. Installer les dépendances
npm install

# 3. Générer le client Prisma + pousser le schéma
npx prisma generate
npx prisma db push

# 4. Lancer tout en dev
npm run dev
```

## 🌐 Services

| Service   | Port | URL                    |
|-----------|------|------------------------|
| Dashboard | 3000 | http://localhost:3000   |
| API       | 4000 | http://localhost:4000   |
| PostgreSQL| 5432 |                        |
| Redis     | 6379 |                        |

## ✨ Fonctionnalités

### 🔒 Modules de Sécurité

#### Anti-Raid intelligent
- Détection de raids via analyse de coordination (score 0-100)
- Analyse du taux de join, âge des comptes, similarité des noms
- Auto-lockdown automatique configurable
- Suppression des invitations existantes lors du lockdown
- Alerte modérateurs en temps réel

#### Anti-Spam
- Rate limiting intelligent (fenêtres 10s, 30s, 60s)
- Détection de messages doublons
- Détection de mentions massives
- Suppression automatique configurable
- Action: timeout, kick, ou ban

#### Anti-Phishing
- Détection de typosquatting (distance Levenshtein ≤ 2)
- Détection de domaines punycode
- Identification de raccourcisseurs d'URL suspects
- Patterns de phishing connus (Discord, Steam, etc.)
- Quarantaine automatique ou suppression

#### Secret Scanner
- Détection de tokens Discord
- Clés API (AWS, Google, etc.)
- JWT tokens
- Clés privées RSA/SSH
- Suppression automatique et alertes

#### Canary Channels (Salons Pièges)
- Création de salons pièges avec kick automatique
- Types: honeypot (caché), semi_visible (semi-visible)
- Compteur de déclenchements
- Détection d'espions

#### Analyse de Risque (Risk Score)
- Score 0-100 par membre
- Facteurs: âge du compte, durée dans le serveur, avatar, comportement, historique
- Mise à jour en temps réel
- Affichage détaillé des facteurs

#### Détection de Bots
- Utilisation du flag système Discord `bot: true`
- Détection dans tous les modules (anti-spam, anti-raid, anti-phishing)
- Actions configurables (timeout, kick, ban)

### ⚡ Système d'Incidents

- Création automatique d'incidents lors des détections
- Timeline complète avec événements et actions
- Statuts: NEW, IN_PROGRESS, CONTAINED, RESOLVED, FALSE_POSITIVE
- Sévérités: LOW, MEDIUM, HIGH, CRITICAL
- Export et gestion via API

### 🔧 Commandes Slash

**Commandes de sécurité:**
- `/security status` — Vue d'ensemble sécurité
- `/security lockdown` — Active le lockdown
- `/security unlock` — Désactive le lockdown
- `/security incidents` — Liste des incidents récents
- `/security user @membre` — Profil de risque d'un membre
- `/security quarantine @membre` — Met en quarantaine
- `/security trust @membre` — Marque comme fiable
- `/security emergency` — Bouton d'urgence

**Commandes de configuration:**
- `/setup quarantine @role` — Configure le rôle quarantaine
- `/setup canary` — Crée un salon piège
- `/setup antiraid` — Configure l'anti-raid
- `/setup show` — Affiche la configuration

### 🎛️ Dashboard Web

#### Page d'accueil
- Liste des serveurs monitorés
- Stats globales: serveurs, membres, événements 24h/7j
- Incidents ouverts, membres à haut risque
- Liens phishing et secrets détectés (7 jours)
- Indicateur visuel de lockdown

#### Page Serveur (onglets)
- **Overview**: Stats serveur, score de risque global, lockdown, incidents actifs
- **Incidents**: Liste paginée, filtres par statut/sévérité, timeline détaillée
- **Events**: Journal des événements de sécurité, filtres par type/sévérité
- **Members**: Liste des membres triée par risque, profil détaillé
  - Score de risque avec facteurs
  - Historique: messages, mutes, kicks, bans
  - Statut: quarantiné, fiable, mute actif
  - Gestion des rôles Discord
  - Messages récents
- **Logs**: Historique des actions du bot, filtres par type/date/utilisateur
- **Config**: Gestion des rôles panel et Discord, permissions
- **Roles**: Configuration avancée des rôles

#### Page Administration
- Gestion des utilisateurs dashboard
- Attribution de rôles: OWNER, ADMIN, MODERATOR, VIEWER
- Permissions par serveur (VIEW_LOGS, MANAGE_GUILD, MANAGE_MEMBERS, MANAGE_ROLES)
- Recherche et ajout d'utilisateurs
- Gestion des rôles Discord des membres

#### Fonctionnalités Dashboard
- OAuth2 Discord (NextAuth.js)
- Mode sombre/clair (Theming)
- Multilingue (français/anglais)
- Système de permissions granulaires
- Recherche de membres avec mention (@pseudo)
- Indicateurs visuels pour bots

### 🗄️ Schéma de Base de Données

**Modèles principaux:**
- `Guild` — Serveurs Discord monitorés
- `Member` — Membres avec stats de sécurité
- `GuildConfig` — Configuration par serveur
- `SecurityEvent` — Événements de sécurité
- `Incident` — Incidents avec timeline
- `RiskScore` — Historique des scores de risque
- `DetectedLink` / `DetectedSecret` — Liens et secrets détectés
- `ConfigVersion` — Versionnement de config
- `CanaryChannel` — Salons pièges
- `GuildRole` — Rôles panel et Discord
- `DashboardUser` — Utilisateurs du dashboard
- `BotActionLog` — Logs des actions du bot

## 🔧 Configuration

Variables d'environnement nécessaires:
```env
# Discord
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Dashboard
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# API
API_JWT_SECRET=
```

## 📝 Correctif Bots (Mai 2026)

### Problème initial
- Les bots n'apparaissaient pas dans la liste des membres du dashboard
- Les bots n'étaient pas détectés lors de spam (alors que les utilisateurs humains oui)

### Solution technique
- Utilisation du flag système Discord `bot: true` présent dans l'API Discord.js pour détecter les utilisateurs bots
- Ajout d'un champ `isBot` dans le schéma Prisma pour le stockage
- Mise à jour de l'API `members.ts` pour exposer le flag `isBot`

### Modules de sécurité modifiés
- **antiSpam.ts** — Les bots spam sont maintenant détectés et traités
- **antiRaid.ts** — Intégration de la détection bots dans le scoring de raid
- **antiPhishing.ts** — Les bots suspects sont maintenant neutralisés

### Comportement attendu
Quand un bot est détecté en train de spammer :
1. Suppression automatique des messages de spam
2. Expulsion du bot du serveur
3. Création d'un incident dans les logs

### Dashboard
- Les bots apparaissent maintenant dans la liste des membres avec un indicateur visuel (badge "BOT")

---

Développé avec ❤️ pour la communauté Discord.