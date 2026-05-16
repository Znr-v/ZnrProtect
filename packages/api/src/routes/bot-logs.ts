import { FastifyInstance } from "fastify";
import { getDiscordIdFromRequest, requirePermission, DASHBOARD_PERMISSIONS } from "../lib/permissions";

export async function botLogsRoutes(app: FastifyInstance) {
  // Get logs for a guild
  app.get("/:guildId", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const { limit = "50", targetId } = request.query as any;
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.VIEW_LOGS);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    const where: any = { guildId };
    if (targetId) where.targetId = targetId;

    const logs = await prisma.botActionLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
    });

    return { logs };
  });

  // Get ban history for a guild
  app.get("/:guildId/ban-history", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.VIEW_LOGS);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    const history = await prisma.botActionLog.findMany({
      where: {
        guildId,
        action: { in: ["BAN", "UNBAN"] },
      },
      orderBy: { createdAt: "desc" },
    });

    return { history };
  });

  // Create a log entry
  app.post("/:guildId", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const { action, targetId, targetName, moderatorId, moderatorName, reason, details } = request.body as any;
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.VIEW_LOGS);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

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