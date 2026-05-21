import { PrismaClient } from "@prisma/client";

export async function logBotAction(
  prisma: PrismaClient,
  guildId: string,
  action: string,
  data: {
    targetId?: string;
    targetName?: string;
    moderatorId?: string;
    moderatorName?: string;
    channelId?: string;
    executedBy?: string;
    reason?: string;
    details?: any;
  }
) {
  try {
    await prisma.botActionLog.create({
      data: {
        guildId,
        action,
        targetId: data.targetId,
        targetName: data.targetName,
        moderatorId: data.moderatorId,
        moderatorName: data.moderatorName,
        channelId: data.channelId,
        executedBy: data.executedBy || "bot",
        reason: data.reason,
        details: data.details || {},
      },
    });
  } catch (e) {
    console.error("Failed to log bot action:", e);
  }
}