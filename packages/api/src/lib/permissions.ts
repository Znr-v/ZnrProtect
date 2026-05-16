import { FastifyRequest } from "fastify";
import { jwtVerify } from "jose";

export const DASHBOARD_PERMISSIONS = {
  VIEW_LOGS: "VIEW_LOGS",
  MANAGE_GUILD: "MANAGE_GUILD",
  MANAGE_MEMBERS: "MANAGE_MEMBERS",
  MANAGE_ROLES: "MANAGE_ROLES",
} as const;

export type DashboardPermission =
  typeof DASHBOARD_PERMISSIONS[keyof typeof DASHBOARD_PERMISSIONS];

export async function getDiscordIdFromRequest(
  request: FastifyRequest
): Promise<string | null> {
  const auth = request.headers.authorization;

  if (!auth?.startsWith("Bearer ")) return null;

  try {
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || ""
    );

    const { payload } = await jwtVerify(auth.slice(7), secret);

    return (payload.discordId as string) || null;
  } catch {
    return null;
  }
}

export async function hasPermission(
  prisma: any,
  discordId: string,
  guildId: string,
  permission: DashboardPermission
): Promise<boolean> {
  const user = await prisma.dashboardUser.findUnique({
    where: { discordId },
  });

  if (!user || !user.approved) return false;

  // Global OWNER always has all permissions
  if (user.role === "OWNER") return true;

  if (user.role === "ADMIN" && (permission === "MANAGE_MEMBERS" || permission === "VIEW_LOGS")) {
    return true;
  }

  if (user.role === "MODERATOR" && (permission === "MANAGE_MEMBERS")) {
    return true;
  }

  const gp = await prisma.dashboardGuildPermission.findUnique({
    where: {
      userId_guildId: {
        userId: user.id,
        guildId,
      },
    },
  });

  if (!gp) return false;

  // We already checked user.role above, but just in case gp.role is higher
  if (gp.role === "OWNER") {
    return true;
  }

  if (gp.role === "ADMIN" && (permission === "MANAGE_MEMBERS" || permission === "VIEW_LOGS")) {
    return true;
  }

  if (gp.role === "MODERATOR" && (permission === "MANAGE_MEMBERS")) {
    return true;
  }

  return gp?.permissions?.includes(permission) || false;
}

export async function getGuildRole(
  prisma: any,
  discordId: string,
  guildId: string
): Promise<string | null> {
  const user = await prisma.dashboardUser.findUnique({
    where: { discordId },
  });

  if (!user || !user.approved) return null;

  // Since we don't have a UI for per-guild roles, the global role is the main source of truth
  return user.role;
}

export async function requirePermission(
  prisma: any,
  discordId: string | undefined,
  guildId: string,
  permission: DashboardPermission
) {
  if (!discordId) {
    throw new Error("Non authentifié");
  }

  const allowed = await hasPermission(
    prisma,
    discordId,
    guildId,
    permission
  );

  if (!allowed) {
    throw new Error("Permission insuffisante");
  }
}

export async function requireGuildAccess(
  prisma: any,
  discordId: string | undefined,
  guildId: string
) {
  if (!discordId) {
    throw new Error("Non authentifié");
  }

  const user = await prisma.dashboardUser.findUnique({
    where: { discordId },
  });

  if (!user || !user.approved) {
    throw new Error("Permission insuffisante");
  }

  const gp = await prisma.dashboardGuildPermission.findUnique({
    where: {
      userId_guildId: {
        userId: user.id,
        guildId,
      },
    },
  });

  if (!gp || (user.role === "VIEWER" && (!gp.permissions || gp.permissions.length === 0))) {
    throw new Error("Permission insuffisante");
  }

  return gp;
}

export async function logAudit(
  prisma: any,
  actorId: string,
  action: string,
  data: {
    guildId?: string;
    targetId?: string;
    metadata?: any;
  }
) {
  await prisma.dashboardAuditLog
    .create({
      data: {
        actorId,
        guildId: data.guildId,
        action,
        targetId: data.targetId,
        metadata: data.metadata,
      },
    })
    .catch((e) => console.error("Audit log error:", e));
}
