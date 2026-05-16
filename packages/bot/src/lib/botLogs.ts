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
  console.log(`[BOTLOG] Creating log: action=${action}, targetId=${data.targetId}, guildId=${guildId}`);
  try {
    const result = await prisma.botActionLog.create({
      data: {
        guildId,
        action,
        targetId: data.targetId,
        targetName: data.targetName,
        reason: data.reason,
        details: data.details,
      },
    });
    console.log(`[BOTLOG] Created log ID: ${result.id}`);
  } catch (e) {
    console.error("Failed to log bot action:", e);
  }
}