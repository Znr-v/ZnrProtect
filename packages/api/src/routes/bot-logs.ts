import { FastifyInstance } from "fastify";

export async function botLogsRoutes(app: FastifyInstance) {
  // Get logs for a guild
  app.get("/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const { limit = "50" } = request.query as any;
    const prisma = (request as any).prisma;

    const logs = await prisma.botActionLog.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
    });

    return { logs };
  });

  // Create a log entry
  app.post("/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const { action, targetId, targetName, moderatorId, moderatorName, reason, details } = request.body as any;
    const prisma = (request as any).prisma;

    const log = await prisma.botActionLog.create({
      data: {
        guildId,
        action,
        targetId,
        targetName,
        moderatorId,
        moderatorName,
        reason,
        details,
      },
    });

    return { log };
  });
}