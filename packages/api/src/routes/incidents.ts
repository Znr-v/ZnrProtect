import { FastifyInstance } from "fastify";
import { getDiscordIdFromRequest, requireGuildAccess } from "../lib/permissions";

export async function incidentRoutes(app: FastifyInstance) {
  // List incidents for a guild
  app.get("/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const discordId = await getDiscordIdFromRequest(request);
    const prisma = (request as any).prisma;
    await requireGuildAccess(prisma, discordId ?? undefined, guildId);

    const { status, severity, page = "1", limit = "20" } = request.query as any;
    const client = (request as any).client;

    const where: any = { guildId };
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
        skip,
        include: {
          _count: { select: { events: true, actions: true } },
        },
      }),
      prisma.incident.count({ where }),
    ]);

    // Enrichir avec les détails des événements
    const enrichedIncidents = await Promise.all(
      incidents.map(async (incident) => {
        const events = await prisma.securityEvent.findMany({
          where: { incidentId: incident.id },
          orderBy: { createdAt: "asc" },
        });

        let channelName = null;
        if (events[0]?.channelId && client) {
          try {
            const guild = await client.guilds.fetch(guildId);
            if (guild) {
              const channel = await guild.channels.fetch(events[0].channelId).catch(() => null);
              if (channel) channelName = channel.name;
            }
          } catch {}
        }

        return { ...incident, channelName, events };
      })
    );

    return { incidents: enrichedIncidents, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) };
  });

  // Incident detail with timeline
  app.get("/detail/:incidentId", async (request) => {
    const { incidentId } = request.params as { incidentId: string };
    const discordId = await getDiscordIdFromRequest(request);
    const prisma = (request as any).prisma;

    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        actions: { orderBy: { createdAt: "asc" } },
      },
    });

    if (incident) {
      await requireGuildAccess(prisma, discordId ?? undefined, incident.guildId);
    }

    return { incident };
  });

  // Update incident status
  app.patch("/:incidentId", async (request) => {
    const { incidentId } = request.params as { incidentId: string };
    const { status } = request.body as { status: string };
    const discordId = await getDiscordIdFromRequest(request);
    const prisma = (request as any).prisma;

    const existing = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (existing) {
      await requireGuildAccess(prisma, discordId ?? undefined, existing.guildId);
    }

    const incident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status,
        ...(status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
      },
    });

    return { incident };
  });
}
