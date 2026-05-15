import { FastifyInstance } from "fastify";

const logBotAction = async (prisma: any, guildId: string, action: string, data: any) => {
  try {
    await prisma.botActionLog.create({
      data: { guildId, action, ...data },
    });
  } catch (e) {
    console.error("Failed to log bot action:", e);
  }
};

export async function configRoutes(app: FastifyInstance) {
  // Get guild config
  app.get("/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;

    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    return { config };
  });

  // Update guild config (with versioning)
  app.patch("/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const body = request.body as any;
    const prisma = (request as any).prisma;

    // Save current config as version before updating
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

    // Remove metadata fields
    const { _changedBy, _changelog, ...updateData } = body;

    const config = await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, ...updateData },
      update: updateData,
    });

    await logBotAction(prisma, guildId, "CONFIG_CHANGE", {
      reason: body._changelog || "Mise à jour de la configuration",
      details: { changes: Object.keys(updateData) },
    });

    return { config };
  });

  // Config history (for diff/rollback)
  app.get("/:guildId/history", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;

    const versions = await prisma.configVersion.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return { versions };
  });

  // Rollback config
  app.post("/:guildId/rollback/:versionId", async (request) => {
    const { guildId, versionId } = request.params as { guildId: string; versionId: string };
    const prisma = (request as any).prisma;

    const version = await prisma.configVersion.findUnique({ where: { id: versionId } });
    if (!version) return { error: "Version introuvable" };

    const configData = version.config as any;
    const { id, guildId: _, ...rest } = configData;

    await prisma.guildConfig.update({
      where: { guildId },
      data: rest,
    });

    return { success: true, message: "Configuration restaurée" };
  });
}
