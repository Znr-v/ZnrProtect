import { FastifyInstance } from "fastify";
import {
  getDiscordIdFromRequest,
  requirePermission,
  DASHBOARD_PERMISSIONS,
  logAudit,
} from "../lib/permissions";

export async function roleRoutes(app: FastifyInstance) {
  // Get all roles for a guild
  app.get("/:guildId", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    // Check if user has access to the guild (any dashboard permission)
    try {
      await requirePermission(
        prisma,
        discordId,
        guildId,
        DASHBOARD_PERMISSIONS.VIEW_LOGS
      );
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    const roles = await prisma.guildRole.findMany({
      where: { guildId },
      orderBy: { position: "desc" },
    });

    return { roles };
  });

  // Create a new role
  app.post("/:guildId", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const body = request.body as {
      name: string;
      color?: string;
      discordRoleId?: string;
      discordPermissions?: string[];
      panelPermissions?: string[];
    };
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(
        prisma,
        discordId,
        guildId,
        DASHBOARD_PERMISSIONS.MANAGE_ROLES
      );
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    if (!body.name) {
      return reply.status(400).send({ error: "Le nom du rôle est requis" });
    }

    if (body.discordRoleId && body.panelPermissions && body.panelPermissions.length > 0) {
      return reply.status(400).send({ error: "Les rôles Discord ne peuvent pas avoir de permissions panel" });
    }

    const existingRole = await prisma.guildRole.findUnique({
      where: {
        guildId_name: {
          guildId,
          name: body.name,
        },
      },
    });

    if (existingRole) {
      return reply.status(400).send({ error: "Un rôle avec ce nom existe déjà" });
    }

    const maxPositionRole = await prisma.guildRole.findFirst({
      where: { guildId },
      orderBy: { position: "desc" },
    });

    const role = await prisma.guildRole.create({
      data: {
        guildId,
        name: body.name,
        color: body.color || "#99AAb5",
        discordRoleId: body.discordRoleId || null,
        discordPermissions: body.discordPermissions || [],
        panelPermissions: body.panelPermissions || [],
        position: (maxPositionRole?.position || 0) + 1,
      },
    });

    await logAudit(prisma, discordId!, "ROLE_CREATE", {
      guildId,
      targetId: role.id,
      metadata: { roleName: body.name },
    });

    return { role };
  });

  // Update a role (permissions, color, name, position)
  app.patch("/:roleId", async (request, reply) => {
    const { roleId } = request.params as { roleId: string };
    const body = request.body as {
      name?: string;
      color?: string;
      discordPermissions?: string[];
      panelPermissions?: string[];
      position?: number;
    };
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    const existingRole = await prisma.guildRole.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      return reply.status(404).send({ error: "Rôle introuvable" });
    }

    try {
      await requirePermission(
        prisma,
        discordId,
        existingRole.guildId,
        DASHBOARD_PERMISSIONS.MANAGE_ROLES
      );
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    if (existingRole.discordRoleId && body.panelPermissions && body.panelPermissions.length > 0) {
      return reply.status(400).send({ error: "Les rôles Discord ne peuvent pas avoir de permissions panel" });
    }

    const role = await prisma.guildRole.update({
      where: { id: roleId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.color && { color: body.color }),
        ...(body.discordPermissions && {
          discordPermissions: body.discordPermissions,
        }),
        ...(body.panelPermissions && {
          panelPermissions: body.panelPermissions,
        }),
        ...(typeof body.position === "number" && { position: body.position }),
      },
    });

    await logAudit(prisma, discordId!, "ROLE_UPDATE", {
      guildId: existingRole.guildId,
      targetId: roleId,
      metadata: { changes: Object.keys(body) },
    });

    return { role };
  });

  // Delete a role
  app.delete("/:roleId", async (request, reply) => {
    const { roleId } = request.params as { roleId: string };
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    const existingRole = await prisma.guildRole.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      return reply.status(404).send({ error: "Rôle introuvable" });
    }

    try {
      await requirePermission(
        prisma,
        discordId,
        existingRole.guildId,
        DASHBOARD_PERMISSIONS.MANAGE_ROLES
      );
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    await prisma.guildRole.delete({ where: { id: roleId } });

    await logAudit(prisma, discordId!, "ROLE_DELETE", {
      guildId: existingRole.guildId,
      targetId: roleId,
      metadata: { roleName: existingRole.name },
    });

    return { success: true };
  });

  // Sync roles with Discord server roles
  app.post("/:guildId/sync", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const prisma = (request as any).prisma;
    const client = (request as any).client;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(
        prisma,
        discordId,
        guildId,
        DASHBOARD_PERMISSIONS.MANAGE_ROLES
      );
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    const discordGuild = await client.guilds.fetch(guildId);
    if (!discordGuild) {
      return reply.status(404).send({ error: "Serveur Discord introuvable" });
    }

    const discordRoles = await discordGuild.roles.fetch();

    const maxPositionRole = await prisma.guildRole.findFirst({
      where: { guildId },
      orderBy: { position: "desc" },
    });
    let position = (maxPositionRole?.position || 0) + 1;

    const syncedRoles = [];

    for (const [, discordRole] of discordRoles) {
      if (discordRole.name === "@everyone") continue;

      const existingRole = await prisma.guildRole.findUnique({
        where: {
          guildId_discordRoleId: {
            guildId,
            discordRoleId: discordRole.id,
          },
        },
      });

      if (existingRole) {
        await prisma.guildRole.update({
          where: { id: existingRole.id },
          data: {
            name: discordRole.name,
            color: discordRole.hexColor || "#99AAb5",
            position: discordRole.position,
          },
        });
        syncedRoles.push(existingRole.id);
      } else {
        const newRole = await prisma.guildRole.create({
          data: {
            guildId,
            discordRoleId: discordRole.id,
            name: discordRole.name,
            color: discordRole.hexColor || "#99AAb5",
            position: discordRole.position,
            discordPermissions: [],
            panelPermissions: [],
          },
        });
        syncedRoles.push(newRole.id);
      }
      position++;
    }

    await logAudit(prisma, discordId!, "ROLES_SYNC", {
      guildId,
      metadata: { syncedCount: syncedRoles.length },
    });

    return {
      success: true,
      syncedCount: syncedRoles.length,
      roles: await prisma.guildRole.findMany({
        where: { guildId },
        orderBy: { position: "desc" },
      }),
    };
  });
}