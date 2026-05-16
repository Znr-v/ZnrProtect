import { FastifyInstance } from "fastify";
import { getDiscordIdFromRequest, requirePermission, DASHBOARD_PERMISSIONS, requireGuildAccess } from "../lib/permissions";

export async function guildRoutes(app: FastifyInstance) {
  // List guilds where bot is present
  app.get("/", async (request, reply) => {
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    if (!discordId) {
      return reply.status(401).send({ error: "Non authentifié" });
    }

    const dashboardUser = await prisma.dashboardUser.findUnique({ where: { discordId } });
    if (!dashboardUser || !dashboardUser.approved) {
      return reply.status(401).send({ error: "Non authentifié" });
    }

    const guildPerms = await prisma.dashboardGuildPermission.findMany({
      where: { userId: dashboardUser.id },
    });
    
    // Si l'utilisateur est VIEWER, on ne lui donne accès qu'aux serveurs où il a explicitement au moins 1 permission
    const allowedGuildIds = dashboardUser.role === "VIEWER"
      ? guildPerms.filter((gp: any) => gp.permissions && gp.permissions.length > 0).map((gp: any) => gp.guildId)
      : guildPerms.map((gp: any) => gp.guildId);

    if (allowedGuildIds.length === 0) {
      return { guilds: [] };
    }

    const guilds = await prisma.guild.findMany({
      where: { id: { in: allowedGuildIds } },
      select: {
        id: true,
        name: true,
        riskScore: true,
        lockdownActive: true,
        _count: { select: { members: true, incidents: true, securityEvents: true } },
      },
      orderBy: { name: "asc" },
    });
    return { guilds };
  });

  // Guild detail
  app.get("/:guildId", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requireGuildAccess(prisma, discordId, guildId);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        config: true,
        _count: {
          select: {
            members: true,
            incidents: true,
            securityEvents: true,
            detectedLinks: true,
            detectedSecrets: true,
          },
        },
      },
    });

    if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });
    return { guild };
  });

  // Get guild roles
  app.get("/:guildId/roles", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const client = (request as any).client;
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requireGuildAccess(prisma, discordId, guildId);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    try {
      if (!client) return { error: "Client Discord non connecté" };
      const guild = await client.guilds.fetch(guildId);
      if (!guild) return { error: "Serveur introuvable" };

      const roles = guild.roles.cache
        .filter(r => r.name !== "@everyone")
        .map(r => ({
          id: r.id,
          name: r.name,
          color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99aab5",
        }))
        .sort((a, b) => b.position - a.position);

      return { roles };
    } catch (e: any) {
      return { error: e.message };
    }
  });
}
