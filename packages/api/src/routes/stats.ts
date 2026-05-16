import { FastifyInstance } from "fastify";
import { getDiscordIdFromRequest, requireGuildAccess } from "../lib/permissions";

export async function statsRoutes(app: FastifyInstance) {
  // Global stats
  app.get("/", async (request, reply) => {
    const discordId = await getDiscordIdFromRequest(request);
    if (!discordId) return reply.status(401).send({ error: "Non authentifié" });

    const prisma = (request as any).prisma;
    const now = new Date();
    const h24 = new Date(now.getTime() - 86400000);
    const d7 = new Date(now.getTime() - 7 * 86400000);

    const [
      guildCount,
      memberCount,
      events24h,
      events7d,
      openIncidents,
      highRiskMembers,
      phishingLinks,
      secretsDetected,
    ] = await Promise.all([
      prisma.guild.count(),
      prisma.member.count(),
      prisma.securityEvent.count({ where: { createdAt: { gte: h24 } } }),
      prisma.securityEvent.count({ where: { createdAt: { gte: d7 } } }),
      prisma.incident.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
      prisma.member.count({ where: { riskScore: { gte: 61 } } }),
      prisma.detectedLink.count({ where: { createdAt: { gte: d7 } } }),
      prisma.detectedSecret.count({ where: { createdAt: { gte: d7 } } }),
    ]);

    return {
      guilds: guildCount,
      members: memberCount,
      events24h,
      events7d,
      openIncidents,
      highRiskMembers,
      phishingLinks,
      secretsDetected,
    };
  });

  // Event type breakdown
  app.get("/breakdown/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const discordId = await getDiscordIdFromRequest(request);
    const prisma = (request as any).prisma;
    await requireGuildAccess(prisma, discordId ?? undefined, guildId);

    const { days = "7" } = request.query as any;

    const since = new Date(Date.now() - parseInt(days) * 86400000);

    const events = await prisma.securityEvent.groupBy({
      by: ["type"],
      where: { guildId, createdAt: { gte: since } },
      _count: true,
      orderBy: { _count: { type: "desc" } },
    });

    return { breakdown: events.map((e: any) => ({ type: e.type, count: e._count })) };
  });
}
