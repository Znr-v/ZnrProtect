import { FastifyInstance } from "fastify";

export async function eventsRoutes(app: FastifyInstance) {
  // Security events for a guild
  app.get("/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const { type, severity, page = "1", limit = "50" } = request.query as any;
    const prisma = (request as any).prisma;
    const client = (request as any).client;

    const where: any = { guildId };
    if (type) where.type = type;
    if (severity) where.severity = severity;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
        skip,
      }),
      prisma.securityEvent.count({ where }),
    ]);

    // Enrichir avec les noms Discord
    const enrichedEvents = await Promise.all(
      events.map(async (e) => {
        let actorName = e.actorId || null;
        let channelName = null;

        if (e.actorId && client) {
          try {
            const guild = await client.guilds.fetch(guildId);
            if (guild) {
              const member = await guild.members.fetch(e.actorId).catch(() => null);
              if (member) actorName = member.user.tag;
              else {
                const user = await client.users.fetch(e.actorId).catch(() => null);
                if (user) actorName = user.tag;
              }
            }
          } catch {}
        }

        if (e.channelId && client) {
          try {
            const guild = await client.guilds.fetch(guildId);
            if (guild) {
              const channel = await guild.channels.fetch(e.channelId).catch(() => null);
              if (channel) channelName = channel.name;
            }
          } catch {}
        }

        return { ...e, actorName, channelName };
      })
    );

    return { events: enrichedEvents, total, page: parseInt(page) };
  });

  // Detected links
  app.get("/:guildId/links", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const { page = "1", limit = "50" } = request.query as any;
    const prisma = (request as any).prisma;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [links, total] = await Promise.all([
      prisma.detectedLink.findMany({
        where: { guildId },
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
        skip,
      }),
      prisma.detectedLink.count({ where: { guildId } }),
    ]);

    return { links, total };
  });

  // Detected secrets
  app.get("/:guildId/secrets", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;

    const secrets = await prisma.detectedSecret.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        actorId: true,
        channelId: true,
        secretType: true,
        createdAt: true,
        // Never return secretHash to dashboard
      },
    });

    return { secrets };
  });

  // Permission changes
  app.get("/:guildId/permissions", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;

    const changes = await prisma.permissionChange.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { changes };
  });
}
