import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { apiFetch, setAuthToken } from "./api";

export type DashboardRole = "OWNER" | "ADMIN" | "MODERATOR" | "VIEWER";

export type GuildPerm = {
  guildId: string;
  guildName: string;
  role: DashboardRole;
  permissions: string[];
};

export function useDashboardUser() {
  const { data: session, status } = useSession();
  const [userInfo, setUserInfo] = useState<{
    approved: boolean;
    loaded: boolean;
    guilds: GuildPerm[];
  }>({ approved: false, loaded: false, guilds: [] });

  const loadUser = useCallback(async () => {
    const token = (session as any)?.apiToken;
    if (!token) return;

    setAuthToken(token);
    try {
      const data = await apiFetch<{ approved: boolean; guilds: GuildPerm[] }>(`/api/auth/me`);

      setUserInfo({
        approved: data.approved,
        loaded: true,
        guilds: data.guilds || [],
      });
    } catch (err: any) {
      if (err.message === "Non authentifié") {
        setTimeout(loadUser, 500);
      }
    }
  }, [session]);

  useEffect(() => {
    if (status === "authenticated" && session && !userInfo.loaded) {
      loadUser();
    }
  }, [status, session, userInfo.loaded, loadUser]);

  const getGuildRole = (guildId: string): DashboardRole | null => {
    const g = userInfo.guilds.find((x) => x.guildId === guildId);
    return g?.role || null;
  };

  const getGuildPerms = (guildId: string): string[] => {
    const g = userInfo.guilds.find((x) => x.guildId === guildId);
    return g?.permissions || [];
  };

  const isOwnerOf = (guildId: string) => getGuildRole(guildId) === "OWNER";
  const isAdminOf = (guildId: string) => {
    const role = getGuildRole(guildId);
    return role === "OWNER" || role === "ADMIN";
  };
  const isModeratorOf = (guildId: string) => getGuildRole(guildId) === "MODERATOR";

  const accessibleGuilds = userInfo.guilds.filter(g => g.role !== "VIEWER" || g.permissions.length > 0);
  const hasAnyGuild = accessibleGuilds.length > 0;

  return {
    approved: userInfo.approved,
    loaded: userInfo.loaded,
    guilds: accessibleGuilds,
    hasAccess: hasAnyGuild,
    discordId: (session as any)?.discordId,
    apiToken: (session as any)?.apiToken,
    getGuildRole,
    getGuildPerms,
    isOwnerOf,
    isAdminOf,
    isModeratorOf,
  };
}
