# ZnrProtect

![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=flat&logo=discord)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat&logo=postgresql)

Système de sécurité modulaire pour serveurs Discord avec détection de raids, anti-spam, analyse anti-phishing, scanner de secrets, quarantaine automatisée et dashboard web temps réel.

---

## Prérequis

- **Node.js** ≥ 18
- **Docker** (PostgreSQL + Redis)
- Un bot Discord avec les intents : `Guilds`, `GuildMembers`, `GuildMessages`, `MessageContent`, `GuildModeration`, `GuildWebhooks`, `GuildMessageReactions`, `AuditLogEntry`
- Une application OAuth2 Discord pour le dashboard (callback URL : `http://localhost:3000/api/auth/callback/discord`)

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/Znr-v/ZnrProtect.git
cd ZnrProtect
```

### 2. Variables d'environnement

Créez un fichier `.env` à la racine :

```env
# Discord
DISCORD_CLIENT_ID=          # Application ID (OAuth2)
DISCORD_CLIENT_SECRET=      # Secret OAuth2
DISCORD_BOT_TOKEN=          # Token du bot Discord

# Base de données
DATABASE_URL=postgresql://znrprotect:znrprotect_password@localhost:5432/znrprotect

# Redis
REDIS_URL=redis://localhost:6379

# Dashboard (Next.js)
NEXTAUTH_SECRET=            # Générer avec: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# API
API_JWT_SECRET=             # Générer avec: openssl rand -base64 32
```

### 3. Lancer les services (PostgreSQL + Redis)

```bash
docker compose up -d
```

Vérifiez que les conteneurs tournent :

```bash
docker compose ps
```

### 4. Installer les dépendances

```bash
npm install
```

### 5. Initialiser la base de données

```bash
npx prisma db push
```

### 6. Démarrer les services

```bash
# Démarrer tous les services en parallèle
npm run dev

# Ou séparément :
npm run dev:api     # API REST sur http://localhost:4000
npm run dev:bot     # Bot Discord
npm run dev:dash    # Dashboard sur http://localhost:3000
```

### 7. Configurer le bot sur un serveur

1. Invitez le bot sur votre serveur avec le portail Discord Developer
2. Utilisez `/setup show` sur le serveur pour voir la configuration actuelle
3. Configurez chaque module avec les commandes `/setup`

---

## Services

| Service | Port | URL |
|---------|------|-----|
| Dashboard | 3000 | http://localhost:3000 |
| API | 4000 | http://localhost:4000 |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |

---

## Architecture

```
prisma/                      # Schéma PostgreSQL + migrations
├── schema.prisma            # Modèles : Guild, Member, Incident, SecurityEvent, BotActionLog, etc.
packages/
├── bot/                     # Bot Discord (discord.js v14)
│   └── src/
│       ├── commands/        # Commandes slash (/security, /setup)
│       ├── events/          # Event handlers (messageCreate, guildMemberAdd, auditLog, webhooksUpdate)
│       ├── modules/         # Moteurs de sécurité
│       └── services/        # Quarantaine, détection bots
├── api/                     # API REST (Fastify)
│   └── src/routes/          # Endpoints : members, guilds, incidents, events, config, logs
├── dashboard/               # Interface web (Next.js 14, App Router)
│   └── src/
│       ├── app/             # Pages (guild/[guildId], page.tsx)
│       ├── components/      # UI : StatCard, SeverityBadge, SectionCard, MentionSearch
│       └── lib/             # API client, i18n, permissions
docker-compose.yml           # PostgreSQL + Redis
```

---

## Modules de sécurité

### Anti-Raid

Détecte les raids par analyse de coordination basée sur plusieurs facteurs.

**Fonctionnement :**

1. Chaque arrivée de membre (`guildMemberAdd`) enregistre un score dans Redis (fenêtre configurable de 30 à 300 secondes)
2. Le score de raid (0–100) est calculé à partir de :
   - **Volume de joins** : nombre d'arrivées dans la fenêtre
   - **Âge des comptes** : proportion de comptes de moins de 7 jours
   - **Similarité des pseudos** : patterns de noms générés (user12345, Bot_xxxx, etc.)
3. Si le score dépasse le seuil (`quarantineMinScore`, défaut 60) :
   - Tous les membres du raid sont mis en **quarantaine** (rôle isolé remplaçant tous leurs rôles)
   - Le serveur est verrouillé (**lockdown**) : tous les salons textuels sont rendus invisibles pour `@everyone`
   - Les invitations sont supprimées
   - Un incident est créé (statut RESOLVED, car l'action est déjà effectuée)

**Configuration :**

| Commande | Défaut | Description |
|----------|--------|-------------|
| `/setup antiraid` | — | Configurer les seuils |
| `raidJoinWindow` | 60s | Fenêtre d'observation des joins |
| `raidMinScore` | 60 | Score minimum pour déclencher |
| `quarantineMinScore` | 60 | Alias du seuil (selon version) |

**Exemple de déclenchement :**

> 10 membres avec des comptes créés il y a 2 heures rejoignent en 30 secondes avec des pseudos du type `user7823`, `user4512`, etc. → Score 85 → Quarantaine immédiate + lockdown.

---

### Anti-Spam

Analyse les messages en temps réel via Redis avec plusieurs détecteurs.

**Fonctionnement :**

1. Chaque message est traité par `checkSpam()` dans `messageCreate`
2. Cinq détecteurs tournent en parallèle via des Redis sorted sets :

| Détecteur | Fenêtre | Seuil défaut | Description |
|-----------|---------|--------------|-------------|
| **Flood** | 1s | 5 messages | Rafale de messages en une seconde |
| **Spam soutenu** | 5s | 5 (bots) / 8 (users) | Rythme soutenu sur 5 secondes |
| **Répétition** | 60s | 3 fois | Même message copié-collé |
| **Mentions abusives** | par message | 3 @mentions/message | Ping massif dans un seul message |
| **Mention flood** | 10s | 5 @mentions | Enchaînement de messages avec mentions |
| **Cross-channel** | 5s | 3 salons (user) / 2 (bot) | Messages identiques ou rapides dans plusieurs salons |

3. Sanctions appliquées :
   - **Utilisateurs** : timeout (5min par défaut), configurable via `spamSanction`
   - **Bots** (si `scanBots` activé) : kick par défaut, configurable via `botSpamSanction`
   - **Webhooks** : suppression du webhook + suppression de ses messages
4. Messages supprimés automatiquement si `spamAutoDelete` est activé
5. Un `SecurityEvent` est créé pour chaque vague de spam
6. Anti-doublon : 30s de cooldown Redis pour éviter les sanctions en cascade

**Configuration :**

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `spamMaxMessages` | 5 | Messages max en 1s (flood) |
| `spamMaxMessages10s` | 8 | Messages max en 10s (soutenu) |
| `spamRepeatThreshold` | 3 | Répétitions du même message |
| `spamMaxMentions` | 3 | @mentions max par message |
| `spamMaxMentions10s` | 5 | @mentions max en 10s |
| `spamSanction` | TIMEOUT | Sanction utilisateur |
| `spamAutoDelete` | true | Supprimer les messages de spam |
| `scanBots` | false | Surveiller les bots utilisateurs |
| `botSpamSanction` | KICK | Sanction pour les bots |
| `botSpamMaxMessages` | 3 | Seuil flood pour bots |
| `botSpamCrossChannel` | 2 | Salons avant sanction cross-channel (bots) |

**Exemple :**

> Un utilisateur envoie `@everyone` dans #général, #salon2 et #salon3 en 4 secondes.  
> → Cross-channel détecté (3 salons en 5s) + Mention flood (3+ `@everyone`).  
> → Timeout 5min, messages supprimés dans les 3 salons, SecurityEvent créé.

---

### Anti-Phishing

Détecte les liens malveillants dans les messages.

**Fonctionnement :**

1. Chaque message est scanné par `checkPhishing()` dans `messageCreate`
2. Analyse du contenu pour détecter :
   - **Typosquatting** : domaines imitant des sites connus (disc0rd.com, go0gle.com)
   - **Punycode** : caractères Unicode homoglyphes dans les URL
   - **Raccourcisseurs** : bit.ly, tinyurl, etc. (peuvent masquer des liens malveillants)
   - **Patterns connus** : base de patterns de phishing intégrée
3. Sanction configurable via `phishingSanction` (QUARANTINE par défaut)
4. Création d'un SecurityEvent de type `PHISHING_LINK`
5. Le message peut être supprimé automatiquement

**Configuration :**

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `phishingSanction` | QUARANTINE | Sanction appliquée |

**Exemple :**

> Un membre envoie `https://www.disc0rd-gift.ru/free-nitro`  
> → Typosquatting détecté (disc0rd au lieu de discord, domaine .ru suspect).  
> → Message supprimé, membre mis en quarantaine.

---

### Secret Scanner

Analyse les messages pour détecter les fuites de secrets.

**Fonctionnement :**

1. Chaque message est scanné par `checkSecrets()` dans `messageCreate`
2. Recherche par regex de :
   - **Tokens Discord** : formats `N.DD.W` etc.
   - **Tokens GitHub** : `ghp_*`, `gho_*`, etc.
   - **Clés API** : `sk-*` (OpenAI), `AIza*` (Google), `AKIA*` (AWS), etc.
   - **JWT** : tokens `eyJ*` (JSON Web Tokens)
   - **Clés privées** : `-----BEGIN * PRIVATE KEY-----`
   - **Webhooks Discord** : URLs `discord.com/api/webhooks/*`
3. Sanction configurable via `secretSanction` (QUARANTINE par défaut)
4. Création d'un SecurityEvent de type `SECRET_LEAKED`

**Configuration :**

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `secretSanction` | QUARANTINE | Sanction appliquée |

**Exemple :**

> Un développeur envoie par erreur dans un salon public : `token = "sk-proj-xxxxxxxxxxxx"`  
> → Pattern de clé OpenAI détecté. Message signalé, membre mis en quarantaine.

---

### Canary Channels (Salons Pièges)

Salons cachés qui piègent les utilisateurs malveillants.

**Fonctionnement :**

1. Un salon est créé avec `/setup canary`, invisible pour les membres normaux
2. Si un utilisateur interagit avec le salon (message, réaction), il est **immédiatement kick** (ou sanction configurable)
3. Un SecurityEvent `CANARY_TRIGGERED` est créé
4. Utile pour détecter les scrappers, les utilisateurs utilisant des outils automatisés, ou les membres avec des permissions anormales

**Exemple :**

> Un salon #log-secret est créé avec `/setup canary`, caché de tout le monde sauf des admins.  
> Un membre utilisant un outil de scraping qui liste tous les salons et envoie un message  
> → Canary déclenché → Kick automatique + SecurityEvent.

---

### Bot Detection

Analyse les nouveaux membres pour détecter les comptes bots non officiels.

**Fonctionnement :**

1. Appelé lors de `guildMemberAdd` et manuellement via `/security scan`
2. Calcule un score de confiance (0–100) basé sur :
   - **Flag Discord officiel** : +100 si `user.bot === true`
   - **Âge du compte** : +40 si < 24h, +20 si < 7j
   - **Pattern de pseudo** : +30 si nom généré (user12345, bot_xxxx, etc.)
   - **Avatar** : +20 si avatar par défaut Discord
   - **Flag DB** : +50 si déjà marqué comme bot dans la base
   - **Ancienneté sur le serveur** : +15 si membre depuis < 1h
3. Seuil : score ≥ 50 → considéré comme bot
4. Action configurable (BAN par défaut pour les bots officiels, KICK pour les suspects)
5. Création d'un Incident + IncidentAction + SecurityEvent + BotActionLog

---

### Risk Score

Score de risque individuel par membre (0–100).

**Fonctionnement :**

1. Calculé périodiquement et lors d'événements clés
2. Facteurs pris en compte :
   - **Âge du compte** : plus le compte est récent, plus le score est élevé
   - **Comportement** : messages supprimés, warns, sanctions reçues
   - **Flag bot** : si détecté comme bot par le Bot Detector
   - **Quarantaine** : si déjà été en quarantaine par le passé
   - **Phishing/Secrets** : si déjà envoyé des liens ou secrets
3. Scores sauvegardés dans l'historique `RiskScore` pour analyse temporelle
4. Affiché dans le dashboard avec code couleur :
   - 0–30 : Vert (sûr)
   - 31–60 : Jaune (surveillance)
   - 61–80 : Orange (risqué)
   - 81–100 : Rouge (critique)

---

## Système d'incidents

Chaque action de sécurité génère un incident avec une timeline complète.

**Types de données :**

| Entité | Description |
|--------|-------------|
| `Incident` | Événement de sécurité global (titre, sévérité, statut) |
| `IncidentAction` | Actions prises (ban, kick, timeout, quarantine, etc.) |
| `SecurityEvent` | Événements individuels liés à un incident |
| `BotActionLog` | Journal de toutes les actions du bot |

**Statuts d'incident :**

| Statut | Description |
|--------|-------------|
| `NEW` | Incident créé, en attente d'action |
| `IN_PROGRESS` | En cours de traitement |
| `CONTAINED` | Contenu, risque neutralisé |
| `RESOLVED` | Résolu automatiquement par le bot |
| `FALSE_POSITIVE` | Fausse alerte |

**Sévérités :**

| Sévérité | Description |
|----------|-------------|
| `LOW` | Information, aucun risque |
| `MEDIUM` | Comportement suspect |
| `HIGH` | Attaque en cours ou imminente |
| `CRITICAL` | Raid, brèche de sécurité |

---

## Commandes

### `/security`

| Commande | Action |
|----------|--------|
| `/security status` | Vue d'ensemble du serveur (risque, lockdown, incidents ouverts) |
| `/security lockdown` | Verrouillage manuel du serveur (désactive tous les salons) |
| `/security unlock` | Déverrouillage du serveur |
| `/security incidents` | Liste des incidents récents |
| `/security quarantine @user` | Mettre un membre en quarantaine |
| `/security lift-quarantine @user` | Libérer un membre de la quarantaine |
| `/security trust @user` | Marquer un membre comme fiable (risque ignoré) |
| `/security ban @user` | Bannir un membre |
| `/security kick @user` | Exclure un membre |
| `/security timeout @user` | Mute temporaire |
| `/security emergency` | Bouton d'urgence (lockdown + notifications admins) |

### `/setup`

| Commande | Action |
|----------|--------|
| `/setup antiraid` | Configurer les seuils anti-raid |
| `/setup canary` | Créer un salon piège |
| `/setup show` | Afficher la configuration actuelle du serveur |

---

## Dashboard

### Overview

- Statistiques globales du serveur (membres, incidents, événements)
- Score de risque moyen
- État du lockdown
- Graphiques d'activité

### Incidents

- Liste paginée des incidents
- Filtres par sévérité, statut, type
- Timeline détaillée avec toutes les actions et événements liés
- Changement de statut manuel

### Events

- Journal brut des événements de sécurité
- Types : SPAM_DETECTED, WEBHOOK_SPAM, RAID_DETECTED, PHISHING_LINK, SECRET_LEAKED, CANARY_TRIGGERED, QUARANTINE_APPLIED, etc.
- Recherche et filtres

### Members

- Liste des membres triés par score de risque (décroissant)
- Profil détaillé : historique des logs, événements, liens détectés, score de risque
- Actions rapides : ban, kick, timeout, quarantaine, marquer fiable
- Filtres : quarantaine, bannis (via API Discord), rôles

### Logs

- Historique complet des actions du bot
- Filtres par action, utilisateur, modérateur
- Périodes : aujourd'hui, 7 jours, 30 jours

### Config

- Configuration de tous les modules
- Permissions Discord (rôles autorisés à utiliser le dashboard)
- Panel d'administration

---

## Permissions (Dashboard)

L'accès au dashboard est contrôlé par :

1. **Propriétaire du serveur** : accès complet
2. **Rôles Discord** : les membres avec certains rôles peuvent accéder (configurable)
3. **Permissions granulaires** : lecture seule, actions modération, administration

---

## API

L'API REST expose les endpoints suivants :

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/members/:guildId` | Liste des membres |
| GET | `/api/members/:guildId/bans` | Liste des bannis Discord |
| GET | `/api/members/:guildId/:memberId/details` | Détails d'un membre |
| GET | `/api/incidents/:guildId` | Incidents du serveur |
| GET | `/api/events/:guildId` | Événements de sécurité |
| GET | `/api/logs/:guildId` | Journal d'actions |
| GET | `/api/logs/:guildId/ban-history` | Historique des bans |
| GET | `/api/config/:guildId` | Configuration du serveur |
| POST | `/api/guilds/:guildId/members/:memberId/ban` | Bannir un membre |
| POST | `/api/guilds/:guildId/members/:memberId/unban` | Débannir |
| POST | `/api/guilds/:guildId/members/:memberId/kick` | Exclure |
| POST | `/api/guilds/:guildId/members/:memberId/timeout` | Mute |
| POST | `/api/guilds/:guildId/members/:memberId/unmute` | Unmute |
| POST | `/api/guilds/:guildId/members/:memberId/lift-quarantine` | Libérer quarantaine |

---

## Base de données

Le schéma Prisma inclut les modèles principaux :

| Modèle | Rôle |
|--------|------|
| `Guild` | Configuration par serveur |
| `GuildConfig` | Paramètres de sécurité (seuils, sanctions) |
| `Member` | Profil membre (risque, warns, quarantaine) |
| `Incident` | Incident de sécurité |
| `IncidentAction` | Action liée à un incident |
| `SecurityEvent` | Événement de sécurité individuel |
| `BotActionLog` | Journal des actions du bot |
| `QuarantinedMember` | Membres en quarantaine (rôles sauvegardés) |
| `WebhookEntry` | Suivi des webhooks |
| `DetectedLink` | Liens suspects détectés |
| `RiskScore` | Historique des scores de risque |

---

## Développement

### Structure des packages

```bash
npm run dev          # Tous les services
npm run dev:bot      # Bot uniquement
npm run dev:api      # API uniquement
npm run dev:dash     # Dashboard uniquement
npm run build        # Build tout le projet
```
