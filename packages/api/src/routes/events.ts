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

    // Enrichir avec les noms Discord - OPTIMISÉ
    let guild = null;
    let channelCache = new Map();
    
    if (client && client.isReady()) {
      try { guild = await client.guilds.fetch(guildId); } catch {}
    }

    const enrichedEvents = events.map((e) => {
      // Use metadata authorName for webhooks first
      let actorName = e.metadata?.authorName || null;
      let channelName = null;

      // Only fetch from Discord if needed and available
      if (!actorName && e.actorId && guild) {
        try {
          actorName = e.actorId;
        } catch {}
      }

      if (e.channelId && guild && !channelCache.has(e.channelId)) {
        try {
          const channel = guild.channels.cache.get(e.channelId);
          if (channel) {
            channelCache.set(e.channelId, channel.name);
          }
        } catch {}
      }
      channelName = channelCache.get(e.channelId) || null;

      return { ...e, actorName, channelName };
    });

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
