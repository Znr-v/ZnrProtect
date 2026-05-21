# ZnrProtect

![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=flat&logo=discord)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat&logo=postgresql)

Système de sécurité modulaire pour serveurs Discord avec détection de raids, anti-spam, analyse anti-phishing, scanner de secrets, quarantaine automatisée et dashboard web temps réel.

---

## Démarrage rapide

```bash
docker compose up -d
npm install
npx prisma db push
npm run dev
```

| Service | Port | URL |
|---------|------|-----|
| Dashboard | 3000 | http://localhost:3000 |
| API | 4000 | http://localhost:4000 |

---

## Architecture

```
prisma/                 # Schéma PostgreSQL + migrations
packages/
├── bot/                # Discord bot (discord.js v14)
│   └── src/
│       ├── commands/   # Slash commands
│       ├── events/     # Discord event handlers
│       ├── modules/    # Moteurs de sécurité
│       └── services/   # Quarantaine, détection bots
├── api/                # API REST (Fastify)
├── dashboard/          # Interface web (Next.js 14)
docker-compose.yml      # PostgreSQL + Redis
```

---

## Modules de sécurité

| Module | Description |
|--------|-------------|
| **Anti-Raid** | Analyse de coordination (score 0-100), auto-lockdown, quarantaine massive |
| **Anti-Spam** | Rate limiting, détection doublons, mentions massives, cross-channel |
| **Anti-Phishing** | Typosquatting, punycode, raccourcisseurs, patterns connus |
| **Secret Scanner** | Tokens Discord, clés API, JWT, clés privées |
| **Canary Channels** | Salons pièges avec kick automatique |
| **Risk Score** | Scoring 0-100 par membre (âge, comportement, historique) |
| **Bot Detection** | Détection bots via flags Discord + patterns |

Chaque sanction (timeout, kick, ban, quarantaine) est configurable par module.

---

## Système d'incidents

- Création automatique d'incidents avec timeline
- Événements liés par incident
- Statuts : NEW, IN_PROGRESS, CONTAINED, RESOLVED, FALSE_POSITIVE
- Sévérités : LOW, MEDIUM, HIGH, CRITICAL

---

## Commandes

| Commande | Action |
|----------|--------|
| `/security status` | Vue d'ensemble |
| `/security lockdown` | Verrouillage serveur |
| `/security unlock` | Déverrouillage |
| `/security incidents` | Incidents récents |
| `/security quarantine @user` | Mise en quarantaine |
| `/security trust @user` | Marquer comme fiable |
| `/security emergency` | Bouton d'urgence |
| `/setup antiraid` | Configuration anti-raid |
| `/setup canary` | Création salon piège |
| `/setup show` | Configuration actuelle |

---

## Dashboard

- **Overview** : statistiques, score de risque global, lockdown
- **Incidents** : liste paginée, filtres, timeline détaillée
- **Events** : journal des événements de sécurité
- **Members** : membres triés par risque, profil détaillé, historique
- **Logs** : historique des actions du bot, filtres multiples
- **Config** : rôles panel et Discord, permissions
- **Admin** : gestion utilisateurs, rôles, permissions granulaires

Fonctionnalités : OAuth2 Discord, mode sombre/clair, multilingue (FR/EN), recherche de membres.

---

## Configuration

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DATABASE_URL=postgresql://user:password@localhost:5432/znrprotect
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
API_JWT_SECRET=
```
