import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getDiscordIdFromRequest, logAudit, DASHBOARD_PERMISSIONS, DashboardPermission } from "../lib/permissions";

async function requireAdmin(request: FastifyRequest, reply: FastifyReply, prisma: any) {
  const discordId = await getDiscordIdFromRequest(request);
  if (!discordId) {
    return reply.status(401).send({ error: "Non authentifié" });
  }

  const user = await prisma.dashboardUser.findUnique({
    where: { discordId },
  });

  if (!user || !user.approved) {
    return reply.status(403).send({ error: "Utilisateur non approuvé" });
  }

  if (user.role !== "OWNER") {
    return reply.status(403).send({ error: "Accès owner requis" });
  }

  return user;
}

const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

function canModifyUser(actorRole: string, targetRole: string): boolean {
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

export async function adminAuthRoutes(app: FastifyInstance) {
  // Search Discord user by username or ID
  app.post("/users/search", async (request, reply) => {
    const adminUser = await requireAdmin(request, reply, (request as any).prisma);
    if (adminUser instanceof Function) return adminUser;

    const client = (request as any).client;
    const { query } = request.body as { query: string };

    if (!query) {
      return reply.status(400).send({ error: "Recherche requise" });
    }

    // Try to fetch by Discord ID first
    if (/^\d{17,20}$/.test(query)) {
      try {
        const user = await client.users.fetch(query);
        const existingUser = await (request as any).prisma.dashboardUser.findUnique({
          where: { discordId: user.id },
        });

        return {
          discordId: user.id,
          username: user.username,
          globalName: user.globalName,
          avatar: user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : null,
          discriminator: user.discriminator,
          alreadyInDashboard: !!existingUser,
          existingRole: existingUser?.role,
        };
      } catch (e) {
        return reply.status(404).send({ error: "Utilisateur Discord non trouvé" });
      }
    }

    // Search by username - try to find in existing dashboard users first
    const prisma = (request as any).prisma;
    const existingUsers = await prisma.dashboardUser.findMany({
      where: {
        username: { contains: query, mode: "insensitive" },
      },
      take: 10,
    });

    if (existingUsers.length > 0) {
      return {
        users: existingUsers.map(u => ({
          discordId: u.discordId,
          username: u.username,
          avatar: u.avatar,
          alreadyInDashboard: true,
          existingRole: u.role,
        })),
      };
    }

    return reply.status(404).send({ error: "Utilisateur non trouvé. Utilisez l'ID Discord pour une recherche exacte." });
  });

  // Add a Discord user to dashboard
  app.post("/users/add", async (request, reply) => {
    const adminUser = await requireAdmin(request, reply, (request as any).prisma);
    if (adminUser instanceof Function) return adminUser;

    const { discordId, role } = request.body as { discordId: string; role: string };
    if (!discordId) {
      return reply.status(400).send({ error: "Discord ID requis" });
    }

    const prisma = (request as any).prisma;
    const client = (request as any).client;

    // Check if already exists
    const existing = await prisma.dashboardUser.findUnique({
      where: { discordId },
    });
    if (existing) {
      return reply.status(400).send({ error: "Utilisateur déjà dans le dashboard" });
    }

    // Get Discord user info
    let discordUser: any = null;
    try {
      discordUser = await client.users.fetch(discordId);
    } catch (e) {
      return reply.status(404).send({ error: "Utilisateur Discord non trouvé" });
    }

    const allowedRoles = adminUser.role === "OWNER"
      ? ["ADMIN", "MODERATOR", "VIEWER"]
      : ["MODERATOR", "VIEWER"];

    if (!allowedRoles.includes(role)) {
      return reply.status(400).send({ error: "Rôle non autorisé" });
    }

    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
      : null;

    const newUser = await prisma.dashboardUser.create({
      data: {
        discordId,
        username: discordUser.username || discordUser.globalName || "Utilisateur",
        avatar,
        role: role as any,
        approved: true,
        approvedBy: adminUser.discordId,
      },
    });

    // Assign default permissions on all guilds
    const guilds = await prisma.guild.findMany({ select: { id: true } });
    const defaultPerms = role === "OWNER"
      ? ["VIEW_LOGS", "MANAGE_GUILD", "MANAGE_MEMBERS", "MANAGE_ROLES"]
      : role === "ADMIN" || role === "MODERATOR"
        ? ["MANAGE_MEMBERS", "VIEW_LOGS"]
        : [];

    await Promise.all(
      guilds.map((g) =>
        prisma.dashboardGuildPermission.create({
          data: {
            userId: newUser.id,
            guildId: g.id,
            permissions: defaultPerms,
          },
        })
      )
    );

    return {
      id: newUser.id,
      discordId: newUser.discordId,
      username: newUser.username,
      avatar: newUser.avatar,
      role: newUser.role,
      approved: newUser.approved,
    };
  });

  // Get all users
  app.get("/users", async (request, reply) => {
    const adminUser = await requireAdmin(request, reply, (request as any).prisma);
    if (adminUser instanceof Function) return adminUser;

    const prisma = (request as any).prisma;
    const users = await prisma.dashboardUser.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        guildPermissions: true,
      },
    });

    return users.map(u => ({
      id: u.id,
      discordId: u.discordId,
      username: u.username,
      avatar: u.avatar,
      role: u.role,
      approved: u.approved,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    }));
  });

  // Get pending users
  app.get("/users/pending", async (request, reply) => {
    const adminUser = await requireAdmin(request, reply, (request as any).prisma);
    if (adminUser instanceof Function) return adminUser;

    const prisma = (request as any).prisma;
    const users = await prisma.dashboardUser.findMany({
      where: { approved: false },
      orderBy: { createdAt: "desc" },
    });

    return users.map(u => ({
      id: u.id,
      discordId: u.discordId,
      username: u.username,
      avatar: u.avatar,
      createdAt: u.createdAt,
    }));
  });

  // Approve user
  app.post("/users/:userId/approve", async (request, reply) => {
    const adminUser = await requireAdmin(request, reply, (request as any).prisma);
    if (adminUser instanceof Function) return adminUser;

    const { userId } = request.params as { userId: string };
    const { role } = request.body as { role: string };

    const prisma = (request as any).prisma;

    // Determine allowed roles based on admin's role
    const allowedRoles = adminUser.role === "OWNER" 
      ? ["ADMIN", "MODERATOR", "VIEWER"]
      : ["MODERATOR", "VIEWER"];

    if (!allowedRoles.includes(role)) {
      return reply.status(400).send({ error: "Rôle non autorisé" });
    }

    const targetUser = await prisma.dashboardUser.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: "Utilisateur non trouvé" });
    }

    const updated = await prisma.dashboardUser.update({
      where: { id: userId },
      data: {
        approved: true,
        approvedBy: adminUser.discordId,
        role: role as any,
      },
    });

    await logAudit(prisma, adminUser.discordId, "USER_APPROVE", {
      targetId: userId,
      metadata: { role, targetDiscordId: targetUser.discordId },
    });

    return {
      id: updated.id,
      discordId: updated.discordId,
      username: updated.username,
      role: updated.role,
      approved: updated.approved,
    };
  });

  // Reject user
  app.post("/users/:userId/reject", async (request, reply) => {
    const adminUser = await requireAdmin(request, reply, (request as any).prisma);
    if (adminUser instanceof Function) return adminUser;

    const { userId } = request.params as { userId: string };

    const prisma = (request as any).prisma;
    const targetUser = await prisma.dashboardUser.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: "Utilisateur non trouvé" });
    }

    // Delete user (cascade will remove permissions)
    await prisma.dashboardUser.delete({
      where: { id: userId },
    });

    await logAudit(prisma, adminUser.discordId, "USER_REJECT", {
      targetId: userId,
      metadata: { targetDiscordId: targetUser.discordId },
    });

    return { success: true };
  });

  // Update user role
  app.patch("/users/:userId/role", async (request, reply) => {
    const adminUser = await requireAdmin(request, reply, (request as any).prisma);
    if (adminUser instanceof Function) return adminUser;

    const { userId } = request.params as { userId: string };
    const { role } = request.body as { role: string };

    const prisma = (request as any).prisma;
    const targetUser = await prisma.dashboardUser.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: "Utilisateur non trouvé" });
    }

    // Prevent modification of users with equal or higher role
    if (!canModifyUser(adminUser.role, targetUser.role)) {
      return reply.status(403).send({ error: "Impossible de modifier un utilisateur avec un rôle égal ou supérieur" });
    }

    // Prevent modification of OWNER by non-OWNER
    if (targetUser.role === "OWNER" && adminUser.role !== "OWNER") {
      return reply.status(403).send({ error: "Impossible de modifier un OWNER" });
    }

    // Prevent downgrade of last OWNER
    if (targetUser.role === "OWNER" && role !== "OWNER") {
      const ownerCount = await prisma.dashboardUser.count({
        where: { role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return reply.status(400).send({ error: "Impossible de rétrograder le dernier OWNER" });
      }
    }

    // Determine allowed roles based on admin's role
    const allowedRoles = adminUser.role === "OWNER"
      ? ["OWNER", "ADMIN", "MODERATOR", "VIEWER"]
      : ["ADMIN", "MODERATOR", "VIEWER"];

    if (!allowedRoles.includes(role)) {
      return reply.status(400).send({ error: "Rôle non autorisé" });
    }

    // Protect OWNER role limit
    if (role === "OWNER") {
      // Demote current owner(s) to ADMIN
      await prisma.dashboardUser.updateMany({
        where: { role: "OWNER", id: { not: userId } },
        data: { role: "ADMIN" },
      });
      // Demote their dashboard permissions too
      await prisma.dashboardGuildPermission.updateMany({
        where: { role: "OWNER", userId: { not: userId } },
        data: { role: "ADMIN" },
      });
    }

    const updated = await prisma.dashboardUser.update({
      where: { id: userId },
      data: { role: role as any },
    });

    if (role === "OWNER") {
      await prisma.dashboardGuildPermission.updateMany({
        where: { userId },
        data: { role: "OWNER", permissions: ["VIEW_LOGS", "MANAGE_GUILD", "MANAGE_MEMBERS", "MANAGE_ROLES"] },
      });
    }

    await logAudit(prisma, adminUser.discordId, "USER_ROLE_CHANGE", {
      targetId: userId,
      metadata: { oldRole: targetUser.role, newRole: role },
    });

    return {
      id: updated.id,
      discordId: updated.discordId,
      role: updated.role,
    };
  });

  // Delete user
  app.delete("/users/:userId", async (request, reply) => {
    const adminUser = await requireAdmin(request, reply, (request as any).prisma);
    if (adminUser instanceof Function) return adminUser;

    const { userId } = request.params as { userId: string };

    const prisma = (request as any).prisma;
    const targetUser = await prisma.dashboardUser.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: "Utilisateur non trouvé" });
    }

    // Prevent deletion of users with equal or higher role
    if (!canModifyUser(adminUser.role, targetUser.role)) {
      return reply.status(403).send({ error: "Impossible de supprimer un utilisateur avec un rôle égal ou supérieur" });
    }

    // Prevent deletion of OWNER
    if (targetUser.role === "OWNER") {
      return reply.status(403).send({ error: "Impossible de supprimer un OWNER" });
    }

    // Prevent deletion of last OWNER
    if (targetUser.role === "OWNER") {
      const ownerCount = await prisma.dashboardUser.count({
        where: { role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return reply.status(400).send({ error: "Impossible de supprimer le dernier OWNER" });
      }
    }

    await prisma.dashboardUser.delete({
      where: { id: userId },
    });

    await logAudit(prisma, adminUser.discordId, "USER_DELETE", {
      targetId: userId,
      metadata: { targetDiscordId: targetUser.discordId },
    });

    return { success: true };
  });

  // Get user permissions
  app.get("/users/:userId/permissions", async (request, reply) => {
    const adminUser = await requireAdmin(request, reply, (request as any).prisma);
    if (adminUser instanceof Function) return adminUser;

    const { userId } = request.params as { userId: string };

    const prisma = (request as any).prisma;
    const targetUser = await prisma.dashboardUser.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: "Utilisateur non trouvé" });
    }

    // Get all guilds
    const guilds = await prisma.guild.findMany({
      select: { id: true, name: true },
    });

    // Get user permissions for each guild
    const permissions = await Promise.all(
      guilds.map(async (guild) => {
        const gp = await prisma.dashboardGuildPermission.findUnique({
          where: {
            userId_guildId: {
              userId,
              guildId: guild.id,
            },
          },
        });
        return {
          guildId: guild.id,
          guildName: guild.name,
          permissions: gp?.permissions || [],
        };
      })
    );

    return { permissions };
  });

  // Update user permissions
  app.put("/users/:userId/permissions", async (request, reply) => {
    const adminUser = await requireAdmin(request, reply, (request as any).prisma);
    if (adminUser instanceof Function) return adminUser;

    const { userId } = request.params as { userId: string };
    const { guildId, permissions } = request.body as { guildId: string; permissions: string[] };

    const prisma = (request as any).prisma;
    const targetUser = await prisma.dashboardUser.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: "Utilisateur non trouvé" });
    }

    // Prevent permission changes for users with equal or higher role
    if (!canModifyUser(adminUser.role, targetUser.role)) {
      return reply.status(403).send({ error: "Impossible de modifier les permissions d'un utilisateur avec un rôle égal ou supérieur" });
    }

    // Validate permissions
    const validPermissions = Object.values(DASHBOARD_PERMISSIONS);
    const invalidPerms = permissions.filter(p => !validPermissions.includes(p as DashboardPermission));
    if (invalidPerms.length > 0) {
      return reply.status(400).send({ error: "Permissions invalides" });
    }

    // Upsert guild permission
    await prisma.dashboardGuildPermission.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      create: {
        userId,
        guildId,
        permissions,
      },
      update: {
        permissions,
      },
    });

    await logAudit(prisma, adminUser.discordId, "USER_PERMISSIONS_UPDATE", {
      guildId,
      targetId: userId,
      metadata: { permissions },
    });

    return { success: true };
  });
}