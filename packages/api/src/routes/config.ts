import { FastifyInstance } from "fastify";
import { getDiscordIdFromRequest, requirePermission, DASHBOARD_PERMISSIONS, logAudit } from "../lib/permissions";

export async function configRoutes(app: FastifyInstance) {
  // Get guild config
  app.get("/:guildId", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_GUILD);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    return { config };
  });

  // Update guild config (with versioning)
  app.patch("/:guildId", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const body = request.body as any;
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_GUILD);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    const currentConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (currentConfig) {
      await prisma.configVersion.create({
        data: {
          guildId,
          config: currentConfig as any,
          changedBy: body._changedBy || "dashboard",
          changelog: body._changelog || "Mise à jour depuis le dashboard",
        },
      });
    }

    const { _changedBy, _changelog, ...updateData } = body;

    const config = await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, ...updateData },
      update: updateData,
    });

    await logAudit(prisma, discordId!, "CONFIG_CHANGE", {
      guildId,
      metadata: { changelog: body._changelog, changes: Object.keys(updateData) },
    });

    return { config };
  });

  // Config history (for diff/rollback)
  app.get("/:guildId/history", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_GUILD);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    const versions = await prisma.configVersion.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return { versions };
  });

  // Rollback config
  app.post("/:guildId/rollback/:versionId", async (request, reply) => {
    const { guildId, versionId } = request.params as { guildId: string; versionId: string };
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_GUILD);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    const version = await prisma.configVersion.findUnique({ where: { id: versionId } });
    if (!version) return { error: "Version introuvable" };

    const configData = version.config as any;
    const { id, guildId: _, ...rest } = configData;

    await prisma.guildConfig.update({
      where: { guildId },
      data: rest,
    });

    await logAudit(prisma, discordId!, "CONFIG_ROLLBACK", {
      guildId,
      metadata: { versionId },
    });

    return { success: true, message: "Configuration restaurée" };
  });
}
