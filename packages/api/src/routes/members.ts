import { FastifyInstance } from "fastify";

export async function memberRoutes(app: FastifyInstance) {
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
