# 🛡️ Security Bot — Bot Discord de sécurité avancé

## Architecture

**LanguageSwitcher Component**

```tsx
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Usage example
<LanguageSwitcher />
```

The component includes accessibility attributes:
- `aria-label` and `title` toggle between languages.
- `aria-live="polite"` on the language code span ensures screen readers announce changes.

## Architecture

```
├── prisma/                   Schéma de base de données (PostgreSQL)
├── packages/
│   ├── bot/                  Bot Discord (discord.js v14 + TypeScript)
│   │   ├── src/
│   │   │   ├── commands/     Slash commands (/security, /setup)
│   │   │   ├── events/       Event handlers Discord
│   │   │   ├── modules/      Anti-raid, anti-spam, anti-phishing, secrets, canary, risk
│   │   │   └── workers/      BullMQ workers
│   ├── api/                  API REST (Fastify)
│   │   └── src/routes/       Auth, guilds, incidents, members, stats, events, config
│   └── dashboard/            Dashboard web (Next.js + TailwindCSS)
│       └── src/
│           ├── app/          Pages (accueil, guild detail)
│           ├── components/   Composants React
│           └── lib/          Utilitaires
├── docker-compose.yml        PostgreSQL + Redis
└── .env                      Configuration
```

## Prérequis

- Node.js >= 18
- Docker (pour PostgreSQL + Redis)

## Installation

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

## Services

| Service   | Port | URL                    |
|-----------|------|------------------------|
| Dashboard | 3000 | http://localhost:3000   |
| API       | 4000 | http://localhost:4000   |
| PostgreSQL| 5432 |                        |
| Redis     | 6379 |                        |

## Fonctionnalités MVP

- **Anti-raid intelligent** — score de coordination, auto-lockdown
- **Anti-spam** — rate limiting, détection de doublons, mentions massives
- **Anti-phishing** — typosquatting, punycode, patterns connus, raccourcisseurs
- **Secret scanner** — tokens Discord, clés API, JWT, clés privées
- **Canary channels** — salons pièges avec kick automatique
- **Analyse de risque** — score 0-100 par membre avec facteurs détaillés
- **Permission drift** — détection de changements de permissions dangereux
- **Système de quarantaine** — isolation avec rôle dédié
- **Gestion d'incidents** — timeline, actions, statuts
- **Bouton d'urgence** — lockdown + suppression invitations
- **Config versionnée** — historique + rollback
- **Dashboard web** — Next.js avec OAuth2 Discord

## Commandes Discord

- `/security status` — Vue d'ensemble sécurité
- `/security lockdown` — Active le lockdown
- `/security unlock` — Désactive le lockdown
- `/security incidents` — Incidents récents
- `/security user @membre` — Profil de risque
- `/security quarantine @membre` — Met en quarantaine
- `/security trust @membre` — Marque comme fiable
- `/security emergency` — Bouton d'urgence
- `/setup quarantine @role` — Configure le rôle quarantaine
- `/setup canary` — Crée un salon piège
- `/setup antiraid` — Configure l'anti-raid
- `/setup show` — Affiche la config
