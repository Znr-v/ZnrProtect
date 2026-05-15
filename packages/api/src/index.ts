import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { PrismaClient } from "@prisma/client";
import { Client, GatewayIntentBits } from "discord.js";
import { authRoutes } from "./routes/auth";
import { guildRoutes } from "./routes/guilds";
import { incidentRoutes } from "./routes/incidents";
import { memberRoutes } from "./routes/members";
import { statsRoutes } from "./routes/stats";
import { eventsRoutes } from "./routes/events";
import { configRoutes } from "./routes/config";
import { modActionsRoutes } from "./routes/mod actions";
import { botLogsRoutes } from "./routes/bot-logs";

const prisma = new PrismaClient();

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
discordClient.login(process.env.DISCORD_TOKEN);

const app = Fastify({ logger: false });

app.register(cors, {
  origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
  credentials: true,
});
app.register(cookie);

// Attach prisma and discord client to request
app.decorateRequest("prisma", null);
app.decorateRequest("client", null);
app.addHook("onRequest", async (request) => {
  (request as any).prisma = prisma;
  (request as any).client = discordClient;
});

// Routes
app.register(authRoutes, { prefix: "/api/auth" });
app.register(guildRoutes, { prefix: "/api/guilds" });
app.register(incidentRoutes, { prefix: "/api/incidents" });
app.register(memberRoutes, { prefix: "/api/members" });
app.register(statsRoutes, { prefix: "/api/stats" });
app.register(eventsRoutes, { prefix: "/api/events" });
app.register(configRoutes, { prefix: "/api/config" });
app.register(modActionsRoutes, { prefix: "/api" });
app.register(botLogsRoutes, { prefix: "/api/logs" });

const PORT = parseInt(process.env.API_PORT || "4000");

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`[+] API sur http://localhost:${PORT}`);
});
