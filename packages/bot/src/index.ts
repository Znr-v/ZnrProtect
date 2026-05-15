import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { registerEvents } from "./events";
import { registerCommands } from "./commands";
import { startWorkers } from "./workers";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Message, Partials.Channel],
});

export type BotContext = {
  client: typeof client;
  prisma: typeof prisma;
  redis: typeof redis;
};

const ctx: BotContext = { client, prisma, redis };

client.once("ready", async () => {
  console.log(`[+] Bot connecté : ${client.user?.tag}`);
  console.log(`[+] ${client.guilds.cache.size} serveur(s)`);

  await registerCommands(ctx);
  console.log("[+] Commandes slash enregistrées");
});

registerEvents(ctx);
startWorkers(ctx);

client.login(process.env.DISCORD_TOKEN);
