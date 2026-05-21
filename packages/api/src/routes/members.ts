import { FastifyInstance } from "fastify";
import { getDiscordIdFromRequest, requireGuildAccess } from "../lib/permissions";

export async function memberRoutes(app: FastifyInstance) {
  // Get recent messages from a member in the guild
  app.get("/:guildId/:memberDiscordId/messages", async (request, reply) => {
    const { guildId, memberDiscordId } = request.params as { guildId: string; memberDiscordId: string };
    const discordId = await getDiscordIdFromRequest(request);
    const prisma = (request as any).prisma;
    await requireGuildAccess(prisma, discordId ?? undefined, guildId);

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
          const userMessages = fetched.filter(m => m.author.id === memberDiscordId).first(10);
          
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
  app.get("/:guildId/:memberDiscordId/details", async (request) => {
    const { guildId, memberDiscordId } = request.params as { guildId: string; memberDiscordId: string };
    const discordId = await getDiscordIdFromRequest(request);
    const prisma = (request as any).prisma;
    await requireGuildAccess(prisma, discordId ?? undefined, guildId);

    const client = (request as any).client;

    const member = await prisma.member.findUnique({
      where: { discordId_guildId: { discordId: memberDiscordId, guildId } },
    });

    if (!member) return { error: "Membre introuvable" };

    let roleIds: string[] = [];
    let avatar: string | null = null;
    if (client?.isReady()) {
      try {
        const guild = await client.guilds.fetch(guildId);
        if (guild) {
          const discordMember = await guild.members.fetch(memberDiscordId).catch(() => null);
          if (discordMember) {
            roleIds = discordMember.roles.cache.map(r => r.id);
            const hash = discordMember.user.avatar;
            if (hash) {
              const ext = hash.startsWith("a_") ? "gif" : "png";
              avatar = `https://cdn.discordapp.com/avatars/${memberDiscordId}/${hash}.${ext}`;
            } else {
              const defaultIndex = Number(discordMember.user.discriminator) % 5;
              avatar = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
            }
          }
        }
      } catch {}
    }

    const [botLogs, securityEvents, detectedLinks, riskScores] = await Promise.all([
      prisma.botActionLog.findMany({
        where: { guildId, targetId: memberDiscordId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.securityEvent.findMany({
        where: { guildId, actorId: memberDiscordId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.detectedLink.findMany({
        where: { guildId, actorId: memberDiscordId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.riskScore.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
    ]);

    return { member: { ...member, roleIds }, avatar, botLogs, securityEvents, detectedLinks, riskScores: riskScores[0] || null };
  });

  // Get member Discord roles and all server roles
  app.get("/:guildId/:memberDiscordId/roles", async (request, reply) => {
    const { guildId, memberDiscordId } = request.params as { guildId: string; memberDiscordId: string };
    const discordId = await getDiscordIdFromRequest(request);
    const prisma = (request as any).prisma;
    await requireGuildAccess(prisma, discordId ?? undefined, guildId);

    const client = (request as any).client;

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const discordMember = await guild.members.fetch(memberDiscordId).catch(() => null);
      
      const userRoles = discordMember?.roles.cache
        .filter((r: any) => r.name !== "@everyone")
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99aab5",
        }))
        .sort((a: any, b: any) => b.position - a.position) || [];

      const allRoles = guild.roles.cache
        .filter((r: any) => r.name !== "@everyone")
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99aab5",
        }))
        .sort((a: any, b: any) => b.position - a.position);

      return { roles: userRoles, allRoles };
    } catch (e: any) {
      console.error("Get roles error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });

  // Get Discord ban list
  app.get("/:guildId/bans", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const discordId = await getDiscordIdFromRequest(request);
    const prisma = (request as any).prisma;
    await requireGuildAccess(prisma, discordId ?? undefined, guildId);

    const client = (request as any).client;

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });
      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const bans = await guild.bans.fetch();
      const members = bans.map((ban: any) => ({
        id: ban.user.id,
        discordId: ban.user.id,
        username: ban.user.tag,
        riskScore: 100,
        quarantined: false,
        trusted: false,
        messageCount: 0,
        warnCount: 0,
        avatar: ban.user.avatar
          ? `https://cdn.discordapp.com/avatars/${ban.user.id}/${ban.user.avatar}.${ban.user.avatar.startsWith("a_") ? "gif" : "png"}`
          : `https://cdn.discordapp.com/embed/avatars/${Number(ban.user.discriminator) % 5}.png`,
        reason: ban.reason,
        isBot: ban.user.bot,
      }));

      return { members, total: members.length };
    } catch (e: any) {
      console.error("Get bans error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });

  // List members for a guild (with risk filtering)
  app.get("/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    const discordId = await getDiscordIdFromRequest(request);
    const prisma = (request as any).prisma;
    await requireGuildAccess(prisma, discordId ?? undefined, guildId);

    const {
      minRisk = "0",
      quarantined,
      page = "1",
      limit = "50",
      sort = "riskScore",
      order = "desc",
    } = request.query as any;
    const client = (request as any).client;

    const where: any = { guildId, riskScore: { gte: parseInt(minRisk) } };
    if (quarantined === "true") where.quarantined = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [dbMembers, total] = await Promise.all([
      prisma.member.findMany({
        where,
        orderBy: { [sort]: order },
        take: parseInt(limit),
        skip,
      }),
      prisma.member.count({ where }),
    ]);

    let members = dbMembers;
    if (client && client.isReady()) {
      try {
        const guild = await client.guilds.fetch(guildId);
        if (guild) {
          try {
            await guild.members.fetch();
          } catch {}
          
          const discordMemberIds = new Set(guild.members.cache.keys());
          
          const showQuarantined = quarantined === "true";
          
          // Get quarantine role from config
          const config = await prisma.guildConfig.findUnique({ where: { guildId } });
          const quarantineRoleId = config?.quarantineRoleId;
          
          // Map member IDs to quarantine status based on Discord role
          const memberQuarantineStatus = new Map<string, boolean>();
          for (const [userId, member] of guild.members.cache) {
            const hasQuarantineRole = quarantineRoleId 
              ? member.roles.cache.has(quarantineRoleId)
              : member.roles.cache.some(r => r.name === "Quarantaine");
            memberQuarantineStatus.set(userId, hasQuarantineRole);
          }
          
          // Filter: only show members that are still on Discord, unless showing quarantined
          members = dbMembers.filter(m => {
            const isOnDiscord = discordMemberIds.has(m.discordId);
            const isQuarantinedOnDiscord = memberQuarantineStatus.get(m.discordId) || false;
            // Always show quarantined (even if left server), otherwise only show if on Discord
            return showQuarantined ? isQuarantinedOnDiscord : isOnDiscord;
          });
          
          const memberRoleMap = new Map<string, string[]>();
          for (const [userId, member] of guild.members.cache) {
            memberRoleMap.set(userId, member.roles.cache.map(r => r.id));
          }
          
          members = members.map(m => {
            const discordMember = guild.members.cache.get(m.discordId);
            let avatar: string | null = null;
            let isBot = false;
            const isQuarantinedOnDiscord = memberQuarantineStatus.get(m.discordId) || false;
            if (discordMember?.user.avatar) {
              const hash = discordMember.user.avatar;
              const ext = hash.startsWith("a_") ? "gif" : "png";
              avatar = `https://cdn.discordapp.com/avatars/${m.discordId}/${hash}.${ext}`;
            } else if (discordMember) {
              const defaultIndex = Number(discordMember.user.discriminator) % 5;
              avatar = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
            }
            if (discordMember) {
              isBot = discordMember.user.bot;
            }
            return {
              ...m,
              quarantined: isQuarantinedOnDiscord,
              roleIds: memberRoleMap.get(m.discordId) || [],
              avatar,
              isBot,
            };
          });
        }
      } catch (e) {
        console.log("Could not fetch Discord members:", e);
      }
    } else {
      console.log("Client not ready or not available");
    }

    return { members, total, page: parseInt(page) };
  });

  // Member detail with risk history
  app.get("/detail/:memberId", async (request) => {
    const { memberId } = request.params as { memberId: string };
    const discordId = await getDiscordIdFromRequest(request);
    const prisma = (request as any).prisma;

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        riskScores: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (member) {
      await requireGuildAccess(prisma, discordId ?? undefined, member.guildId);
    }

    return { member };
  });
}
