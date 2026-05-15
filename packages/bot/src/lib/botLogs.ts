import { PrismaClient } from "@prisma/client";

export async function logBotAction(
  prisma: PrismaClient,
  guildId: string,
  action: string,
  data: {
    targetId?: string;
    targetName?: string;
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
        reason: data.reason,
        details: data.details,
      },
    });
  } catch (e) {
    console.error("Failed to log bot action:", e);
  }
}