import { FastifyInstance } from "fastify";
import { getDiscordIdFromRequest, DASHBOARD_PERMISSIONS } from "../lib/permissions";

const DISCORD_API = "https://discord.com/api/v10";

export async function authRoutes(app: FastifyInstance) {
  // Exchange Discord OAuth code for user data
  app.post("/discord", async (request, reply) => {
    const { code } = request.body as { code: string };
    if (!code) return reply.status(400).send({ error: "Code requis" });

    // Exchange code for token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/discord`,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return reply.status(401).send({ error: "Token invalide" });
    }

    // Get user
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    // Get guilds
    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const guilds = await guildsRes.json();

    const prisma = (request as any).prisma;
    const botOwnerId = process.env.BOT_OWNER_ID;

    // Check if user is the bot owner
    if (user.id === botOwnerId) {
      // Bot owner gets OWNER role and is always approved
      await prisma.dashboardUser.upsert({
        where: { discordId: user.id },
        create: { 
          discordId: user.id, 
          username: user.username, 
          avatar: user.avatar,
          role: "OWNER",
          approved: true,
          lastLoginAt: new Date()
        },
        update: { 
          username: user.username, 
          avatar: user.avatar,
          role: "OWNER",
          approved: true,
          lastLoginAt: new Date()
        },
      });

      return {
        user: { id: user.id, username: user.username, avatar: user.avatar },
        guilds: guilds.filter((g: any) => (parseInt(g.permissions) & 0x8) === 0x8),
        accessToken: tokenData.access_token,
        role: "OWNER",
        approved: true,
        isPending: false,
      };
    }

    // Check if user exists and their approval status
    const existingUser = await prisma.dashboardUser.findUnique({
      where: { discordId: user.id },
    });

    if (!existingUser) {
      // New user - create with VIEWER role, not approved
      await prisma.dashboardUser.create({
        data: {
          discordId: user.id,
          username: user.username,
          avatar: user.avatar,
          role: "VIEWER",
          approved: false,
        },
      });

      return reply.status(403).send({
        error: "En attente d'approbation",
        isPending: true,
      });
    }

    if (!existingUser.approved) {
      // User exists but not approved
      return reply.status(403).send({
        error: "En attente d'approbation",
        isPending: true,
      });
    }

    // User is approved - update lastLoginAt
    await prisma.dashboardUser.update({
      where: { discordId: user.id },
      data: { 
        username: user.username, 
        avatar: user.avatar,
        lastLoginAt: new Date() 
      },
    });

    return {
      user: { id: user.id, username: user.username, avatar: user.avatar },
      guilds: guilds.filter((g: any) => (parseInt(g.permissions) & 0x8) === 0x8),
      accessToken: tokenData.access_token,
      role: existingUser.role,
      approved: true,
      isPending: false,
    };
  });

  // Get current user info
  app.get("/me", async (request, reply) => {
    const discordId = await getDiscordIdFromRequest(request);
    if (!discordId) {
      return reply.status(401).send({ error: "Non authentifié" });
    }

    const prisma = (request as any).prisma;
    const client = (request as any).client;
    const botOwnerId = process.env.BOT_OWNER_ID;

    let user = await prisma.dashboardUser.findUnique({
      where: { discordId },
    });

    // Try to get Discord user info from bot
    let discordUser: any = null;
    try {
      discordUser = await client.users.fetch(discordId);
    } catch (e) {
      // Bot may not share guild with user, try direct API
      try {
        const res = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
          headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
        });
        if (res.ok) {
          discordUser = await res.json();
        }
      } catch (e2) {
        // Ignore
      }
    }

    const username = discordUser?.username || discordUser?.global_name || "Utilisateur Discord";
    const avatar = discordUser?.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
      : null;

    // Auto-create user if not exists
    if (!user) {
      user = await prisma.dashboardUser.create({
        data: {
          discordId,
          username,
          avatar,
          role: discordId === botOwnerId ? "OWNER" : "VIEWER",
          approved: true,
        },
      });
    } else if (!user.approved || user.username === "New User" || user.username === "Bot Owner") {
      // Update user info if outdated
      await prisma.dashboardUser.update({
        where: { id: user.id },
        data: {
          username: user.username === "New User" || user.username === "Bot Owner" ? username : user.username,
          avatar: user.avatar || avatar,
          approved: true,
        },
      });
      user = await prisma.dashboardUser.findUnique({ where: { discordId } });
    }

    // Ensure user has permissions on all guilds
    const existingPerms = await prisma.dashboardGuildPermission.findMany({
      where: { userId: user.id },
    });
    const guilds = await prisma.guild.findMany({ select: { id: true, name: true } });

    if (existingPerms.length === 0 && guilds.length > 0) {
      // Create permissions for all guilds based on global role
      const defaultRole = user.role;
      const defaultPerms = defaultRole === "OWNER"
        ? Object.values(DASHBOARD_PERMISSIONS)
        : defaultRole === "ADMIN" || defaultRole === "MODERATOR"
          ? ["MANAGE_MEMBERS", "VIEW_LOGS"]
          : [];

      await Promise.all(
        guilds.map((g) =>
          prisma.dashboardGuildPermission.create({
            data: {
              userId: user.id,
              guildId: g.id,
              role: defaultRole,
              permissions: defaultPerms,
            },
          })
        )
      );
    } else if (existingPerms.length > 0) {
      // Migration: ensure existing perms have a role set
      const permsWithoutRole = existingPerms.filter((gp: any) => !gp.role || gp.role === "");
      if (permsWithoutRole.length > 0) {
        await Promise.all(
          permsWithoutRole.map((gp: any) =>
            prisma.dashboardGuildPermission.update({
              where: { id: gp.id },
              data: { role: user.role },
            })
          )
        );
      }
    }

    // Fetch fresh permissions
    const freshPerms = await prisma.dashboardGuildPermission.findMany({
      where: { userId: user.id },
    });

    const guildNameMap: Record<string, string> = {};
    guilds.forEach((g: any) => { guildNameMap[g.id] = g.name; });

    return {
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      avatar: user.avatar,
      approved: user.approved,
      language: user.language,
      guilds: freshPerms.map((gp: any) => {
        // Le rôle global de l'utilisateur a priorité s'il est supérieur ou égal au rôle de la guild
        // Mais pour simplifier, comme il n'y a pas d'UI pour les rôles par guild, on retourne le rôle global
        return {
          guildId: gp.guildId,
          guildName: guildNameMap[gp.guildId] || "Serveur",
          role: user.role, 
          permissions: gp.permissions || [],
        };
      }),
    };
  });

  // Get permissions for a specific guild
  app.get("/permissions/:guildId", async (request, reply) => {
    const discordId = await getDiscordIdFromRequest(request);
    if (!discordId) {
      return reply.status(401).send({ error: "Non authentifié" });
    }

    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;

    const user = await prisma.dashboardUser.findUnique({
      where: { discordId },
    });

    if (!user || !user.approved) {
      return reply.status(403).send({ error: "Utilisateur non approuvé" });
    }

    const guildPerm = await prisma.dashboardGuildPermission.findUnique({
      where: {
        userId_guildId: {
          userId: user.id,
          guildId,
        },
      },
    });

    if (!guildPerm) {
      return {
        role: null,
        permissions: [],
      };
    }

    return {
      role: guildPerm.role,
      permissions: guildPerm.role === "OWNER" || guildPerm.role === "ADMIN"
        ? Object.values(DASHBOARD_PERMISSIONS)
        : guildPerm.permissions || [],
    };
  });

  // Get language preference of authenticated user
  app.get("/language", async (request, reply) => {
    const discordId = await getDiscordIdFromRequest(request);
    if (!discordId) {
      return reply.status(401).send({ error: "Non authentifié" });
    }

    const prisma = (request as any).prisma;
    const user = await prisma.dashboardUser.findUnique({
      where: { discordId },
      select: { language: true },
    });

    if (!user) {
      return reply.status(404).send({ error: "Utilisateur non trouvé" });
    }

    return { language: user.language };
  });

  // Update language preference of authenticated user
  const updateLanguageHandler = async (request: any, reply: any) => {
    const discordId = await getDiscordIdFromRequest(request);
    if (!discordId) {
      return reply.status(401).send({ error: "Non authentifié" });
    }

    const { language } = request.body as { language?: string };
    if (!language) {
      return reply.status(400).send({ error: "Langue requise" });
    }

    if (language !== "fr" && language !== "en") {
      return reply.status(400).send({ error: "Langue invalide. Les valeurs autorisées sont 'fr' ou 'en'." });
    }

    const prisma = request.prisma;
    const user = await prisma.dashboardUser.update({
      where: { discordId },
      data: { language },
      select: { language: true },
    });

    return { success: true, language: user.language };
  };

  app.put("/language", updateLanguageHandler);
  app.patch("/language", updateLanguageHandler);
}
