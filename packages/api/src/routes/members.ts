import { FastifyInstance } from "fastify";

export async function memberRoutes(app: FastifyInstance) {
  // Get recent messages from a member in the guild
  app.get("/:guildId/:discordId/messages", async (request, reply) => {
    const { guildId, discordId } = request.params as { guildId: string; discordId: string };
    const client = (request as any).client;

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const messages: any[] = [];
      const channels = guild.channels.cache.filter(c => c.type === 0); // text channels

      for (const [, channel] of channels) {
        try {
          const fetched = await channel.messages.fetch({ limit: 100 });
          const userMessages = fetched.filter(m => m.author.id === discordId).first(10);
          
          for (const msg of userMessages) {
            messages.push({
              id: msg.id,
              content: msg.content,
              channelId: msg.channelId,
              channelName: msg.channel.name,
              createdAt: msg.createdAt.toISOString(),
            });
          }
        } catch {}
        
        if (messages.length >= 30) break;
      }

      // Sort by date descending
      messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return { messages: messages.slice(0, 30) };
    } catch (e: any) {
      console.error("Get messages error:", e);
      return { error: e.message };
    }
  });
  // Get member details with history
  app.get("/:guildId/:discordId/details", async (request) => {
    const { guildId, discordId } = request.params as { guildId: string; discordId: string };
    const prisma = (request as any).prisma;

    const member = await prisma.member.findUnique({
      where: { discordId_guildId: { discordId, guildId } },
    });

    if (!member) return { error: "Membre introuvable" };

    const [botLogs, securityEvents, detectedLinks, riskScores] = await Promise.all([
      prisma.botActionLog.findMany({
        where: { guildId, targetId: discordId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.securityEvent.findMany({
        where: { guildId, actorId: discordId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.detectedLink.findMany({
        where: { guildId, actorId: discordId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.riskScore.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
    ]);

    return { member, botLogs, securityEvents, detectedLinks, riskScores: riskScores[0] || null };
  });

  // List members for a guild (with risk filtering)
  app.get("/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const {
      minRisk = "0",
      quarantined,
      page = "1",
      limit = "50",
      sort = "riskScore",
      order = "desc",
    } = request.query as any;
    const prisma = (request as any).prisma;

    const where: any = { guildId, riskScore: { gte: parseInt(minRisk) } };
    if (quarantined === "true") where.quarantined = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        orderBy: { [sort]: order },
        take: parseInt(limit),
        skip,
      }),
      prisma.member.count({ where }),
    ]);

    return { members, total, page: parseInt(page) };
  });

  // Member detail with risk history
  app.get("/detail/:memberId", async (request) => {
    const { memberId } = request.params as { memberId: string };
    const prisma = (request as any).prisma;

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        riskScores: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    return { member };
  });
}
