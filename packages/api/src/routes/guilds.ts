import { FastifyInstance } from "fastify";

export async function guildRoutes(app: FastifyInstance) {
  // List guilds where bot is present
  app.get("/", async (request) => {
    const prisma = (request as any).prisma;
    const guilds = await prisma.guild.findMany({
      select: {
        id: true,
        name: true,
        riskScore: true,
        lockdownActive: true,
        _count: { select: { members: true, incidents: true, securityEvents: true } },
      },
      orderBy: { name: "asc" },
    });
    return { guilds };
  });

  // Guild detail
  app.get("/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;

    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        config: true,
        _count: {
          select: {
            members: true,
            incidents: true,
            securityEvents: true,
            detectedLinks: true,
            detectedSecrets: true,
          },
        },
      },
    });

    if (!guild) return { error: "Not found" };
    return { guild };
  });
}
