"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Plus,
  Trash2,
  Edit,
  X,
  RefreshCw,
  Settings,
  Check,
  Hash,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import { apiFetch, setAuthToken } from "@/lib/api";
import { useDashboardUser } from "@/lib/usePermissions";

type GuildRole = {
  id: string;
  discordRoleId: string | null;
  name: string;
  color: string;
  position: number;
  discordPermissions: string[];
  panelPermissions: string[];
};

const ALL_DISCORD_PERMISSIONS = [
  "KICK",
  "BAN",
  "MUTE",
  "MANAGE_CHANNELS",
  "MANAGE_ROLES",
  "MANAGE_MESSAGES",
  "VIEW_AUDIT_LOG",
  "MANAGE_MEMBERS",
];

const ALL_PANEL_PERMISSIONS = [
  "VIEW_LOGS",
  "MANAGE_GUILD",
  "MANAGE_MEMBERS",
  "MANAGE_ROLES",
];

export default function ConfigsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { data: session } = useSession();
  const { getGuildRole } = useDashboardUser();
  const userRole = getGuildRole(guildId) || "VIEWER";

  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"panel" | "discord">("panel");
  const [editingRole, setEditingRole] = useState<GuildRole | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GuildRole | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#99AAb5");
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Discord role creation
  const [showDiscordAddForm, setShowDiscordAddForm] = useState(false);
  const [newDiscordRoleName, setNewDiscordRoleName] = useState("");
  const [newDiscordRoleColor, setNewDiscordRoleColor] = useState("#99AAb5");
  const [newDiscordRolePermissions, setNewDiscordRolePermissions] = useState<string[]>([]);
  const [newDiscordPanelPermissions, setNewDiscordPanelPermissions] = useState<string[]>([]);

  const isOwner = userRole === "OWNER";

  useEffect(() => {
    if (session) {
      setAuthToken((session as any).apiToken ?? null);
    }
  }, [session]);

  useEffect(() => {
    if (guildId) {
      loadRoles();
    }
  }, [guildId]);

  const loadRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ roles: GuildRole[] }>(`/api/roles/${guildId}`);
      setRoles(data.roles || []);
    } catch (e: any) {
      console.error("Failed to load roles:", e);
      setError(e.message || "Erreur lors du chargement des rôles");
    }
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await apiFetch<{ roles: GuildRole[]; syncedCount: number }>(
        `/api/roles/${guildId}/sync`,
        { method: "POST" }
      );
      setRoles(data.roles);
    } catch (e) {
      console.error("Failed to sync roles:", e);
    }
    setSyncing(false);
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    setActionLoading("add");
    try {
      await apiFetch(`/api/roles/${guildId}`, {
        method: "POST",
        body: {
          name: newRoleName.trim(),
          color: newRoleColor,
          panelPermissions: newRolePermissions,
        },
      });
      setNewRoleName("");
      setNewRoleColor("#99AAb5");
      setNewRolePermissions([]);
      setShowAddForm(false);
      loadRoles();
    } catch (e) {
      console.error("Failed to add role:", e);
    }
    setActionLoading(null);
  };

  const handleAddDiscordRole = async () => {
    if (!newDiscordRoleName.trim()) return;
    setActionLoading("add-discord");
    try {
      await apiFetch(`/api/roles/${guildId}`, {
        method: "POST",
        body: {
          name: newDiscordRoleName.trim(),
          color: newDiscordRoleColor,
          discordRoleId: `manual-${Date.now()}`,
          discordPermissions: newDiscordRolePermissions,
          panelPermissions: newDiscordPanelPermissions,
        },
      });
      setNewDiscordRoleName("");
      setNewDiscordRoleColor("#99AAb5");
      setNewDiscordRolePermissions([]);
      setNewDiscordPanelPermissions([]);
      setShowDiscordAddForm(false);
      loadRoles();
    } catch (e) {
      console.error("Failed to add Discord role:", e);
    }
    setActionLoading(null);
  };

  const handleDeleteDiscordRole = async (roleId: string) => {
    setActionLoading(roleId);
    try {
      await apiFetch(`/api/roles/${roleId}`, { method: "DELETE" });
      loadRoles();
    } catch (e) {
      console.error("Failed to delete Discord role:", e);
    }
    setActionLoading(null);
  };

  const handleUpdateRole = async (role: GuildRole) => {
    setActionLoading(role.id);
    try {
      await apiFetch(`/api/roles/${role.id}`, {
        method: "PATCH",
        body: {
          name: role.name,
          color: role.color,
          discordPermissions: role.discordPermissions,
          panelPermissions: role.panelPermissions,
          position: role.position,
        },
      });
      setEditingRole(null);
      loadRoles();
    } catch (e) {
      console.error("Failed to update role:", e);
    }
    setActionLoading(null);
  };

  const handleDeleteRole = async (roleId: string) => {
    setActionLoading(roleId);
    try {
      await apiFetch(`/api/roles/${roleId}`, { method: "DELETE" });
      setConfirmDelete(null);
      loadRoles();
    } catch (e) {
      console.error("Failed to delete role:", e);
    }
    setActionLoading(null);
  };

  const handleMoveRole = async (roleId: string, direction: "up" | "down") => {
    const panelRoles = roles.filter((r) => !r.discordRoleId);
    const discordRoles = roles.filter((r) => r.discordRoleId);
    const currentList = activeTab === "panel" ? panelRoles : discordRoles;

    const currentIndex = currentList.findIndex((r) => r.id === roleId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= currentList.length) return;

    const targetRole = currentList[newIndex];
    const currentRole = currentList[currentIndex];

    setActionLoading(`move-${roleId}`);
    try {
      await apiFetch(`/api/roles/${currentRole.id}`, {
        method: "PATCH",
        body: { position: targetRole.position },
      });
      await apiFetch(`/api/roles/${targetRole.id}`, {
        method: "PATCH",
        body: { position: currentRole.position },
      });
      loadRoles();
    } catch (e) {
      console.error("Failed to move role:", e);
    }
    setActionLoading(null);
  };

  const togglePermission = (
    role: GuildRole,
    perm: string,
    type: "discord" | "panel",
    target: "panel" | "discord" | "newDiscord" | "new" = "new"
  ) => {
    if (target === "new") {
      setNewRolePermissions((prev) =>
        prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
      );
      return;
    }

    if (target === "newDiscord") {
      if (type === "discord") {
        setNewDiscordRolePermissions((prev) =>
          prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
        );
      } else {
        setNewDiscordPanelPermissions((prev) =>
          prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
        );
      }
      return;
    }

    if (!editingRole || editingRole.id !== role.id) return;

    const key = type === "discord" ? "discordPermissions" : "panelPermissions";
    const currentPerms = editingRole[key] as string[];

    const newPerms = currentPerms.includes(perm)
      ? currentPerms.filter((p) => p !== perm)
      : [...currentPerms, perm];

    setEditingRole({
      ...editingRole,
      [key]: newPerms,
    });
  };

  const canManageRoles = userRole === "OWNER" || userRole === "ADMIN";

  const panelRoles = roles
    .filter((r) => !r.discordRoleId)
    .sort((a, b) => b.position - a.position);
  const discordRoles = roles
    .filter((r) => r.discordRoleId)
    .sort((a, b) => b.position - a.position);

  // Default panel roles to create if none exist
  const defaultRoles = [
    { name: "Owner", color: "#9b59b6", permissions: ["VIEW_LOGS", "MANAGE_GUILD", "MANAGE_MEMBERS", "MANAGE_ROLES"] },
    { name: "Admin", color: "#e74c3c", permissions: ["VIEW_LOGS", "MANAGE_GUILD", "MANAGE_MEMBERS"] },
    { name: "Moderator", color: "#f1c40f", permissions: ["MANAGE_MEMBERS"] },
  ];

  const handleCreateDefaultRoles = async () => {
    setActionLoading("create-default");
    try {
      for (const role of defaultRoles) {
        await apiFetch(`/api/roles/${guildId}`, {
          method: "POST",
          body: {
            name: role.name,
            color: role.color,
            panelPermissions: role.permissions,
          },
        });
      }
      loadRoles();
    } catch (e) {
      console.error("Failed to create default roles:", e);
    }
    setActionLoading(null);
  };

  const currentRoles = activeTab === "panel" ? panelRoles : discordRoles;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/guild/${guildId}`}
          className="text-theme-secondary hover:text-white transition"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="w-12 h-12 rounded-xl bg-theme-tertiary flex items-center justify-center">
          <Settings className="w-6 h-6 text-discord" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurations</h1>
          <p className="text-theme-secondary text-sm">
            Gestion des rôles et permissions
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("panel")}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === "panel"
              ? "bg-discord text-white"
              : "bg-theme-tertiary text-theme-secondary hover:text-white"
          }`}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          Rôles Panel ({panelRoles.length})
        </button>
        {isOwner && (
          <button
            onClick={() => setActiveTab("discord")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "discord"
                ? "bg-discord text-white"
                : "bg-theme-tertiary text-theme-secondary hover:text-white"
            }`}
          >
            <Hash className="w-4 h-4 inline mr-2" />
            Rôles Discord ({discordRoles.length})
          </button>
        )}
        {activeTab === "discord" && isOwner && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="ml-auto px-4 py-2 rounded-lg font-medium bg-theme-tertiary text-theme-secondary hover:text-white transition flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Synchroniser
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-theme-secondary rounded-xl border border-theme-border p-4">
        {activeTab === "panel" && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-discord" />
              Rôles du Panel
            </h2>
            {canManageRoles && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-3 py-1.5 bg-discord hover:bg-discord-hover text-white rounded-lg text-sm font-medium transition flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Ajouter un rôle
              </button>
            )}
          </div>
        )}

        {activeTab === "discord" && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Hash className="w-5 h-5 text-discord" />
              Rôles Discord
            </h2>
            {isOwner && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDiscordAddForm(true)}
                  className="px-3 py-1.5 bg-discord hover:bg-discord-hover text-white rounded-lg text-sm font-medium transition flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-3 py-1.5 bg-theme-tertiary hover:bg-theme-border text-theme-secondary rounded-lg text-sm font-medium transition flex items-center gap-1"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  Sync
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "panel" && (
          <p className="text-theme-secondary text-sm mb-4">
            Créez des rôles pour organiser les permissions dans le dashboard.
            Ces rôles sont différents des rôles Discord.
          </p>
        )}

        {activeTab === "discord" && (
          <p className="text-theme-secondary text-sm mb-4">
            Ces rôles sont synchronisés avec les rôles du serveur Discord.
            Configurez les permissions Panel pour chaque rôle Discord.
          </p>
        )}

        {showDiscordAddForm && activeTab === "discord" && isOwner && (
          <div className="bg-theme-tertiary/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Nouveau rôle Discord</h3>
              <button
                onClick={() => {
                  setShowDiscordAddForm(false);
                  setNewDiscordRoleName("");
                  setNewDiscordRoleColor("#99AAb5");
                  setNewDiscordRolePermissions([]);
                  setNewDiscordPanelPermissions([]);
                }}
                className="text-theme-secondary hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-theme-secondary text-xs block mb-1">Nom du rôle</label>
                  <input
                    type="text"
                    value={newDiscordRoleName}
                    onChange={(e) => setNewDiscordRoleName(e.target.value)}
                    placeholder="Ex: Helper"
                    className="w-full bg-theme-primary border border-theme-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-discord"
                  />
                </div>
                <div>
                  <label className="text-theme-secondary text-xs block mb-1">Couleur</label>
                  <input
                    type="color"
                    value={newDiscordRoleColor}
                    onChange={(e) => setNewDiscordRoleColor(e.target.value)}
                    className="w-10 h-10 rounded border border-theme-border cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="text-theme-secondary text-xs block mb-1">Permissions Panel:</label>
                <div className="flex flex-wrap gap-1">
                  {ALL_PANEL_PERMISSIONS.map((perm) => (
                    <button
                      key={perm}
                      onClick={() => togglePermission({} as GuildRole, perm, "panel", "newDiscord")}
                      className={`px-2 py-1 rounded text-xs font-medium border transition ${
                        newDiscordPanelPermissions.includes(perm)
                          ? "bg-discord/20 text-discord border-discord/30"
                          : "bg-theme-tertiary text-theme-muted border-theme-border hover:text-theme-secondary"
                      }`}
                    >
                      {perm.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-theme-secondary text-xs block mb-1">Permissions Discord:</label>
                <div className="flex flex-wrap gap-1">
                  {ALL_DISCORD_PERMISSIONS.map((perm) => (
                    <button
                      key={perm}
                      onClick={() => togglePermission({} as GuildRole, perm, "discord", "newDiscord")}
                      className={`px-2 py-1 rounded text-xs font-medium border transition ${
                        newDiscordRolePermissions.includes(perm)
                          ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                          : "bg-theme-tertiary text-theme-muted border-theme-border hover:text-theme-secondary"
                      }`}
                    >
                      {perm.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddDiscordRole}
                  disabled={actionLoading === "add-discord" || !newDiscordRoleName.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Créer le rôle
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddForm && activeTab === "panel" && (
          <div className="bg-theme-tertiary/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Nouveau rôle Panel</h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewRoleName("");
                  setNewRoleColor("#99AAb5");
                  setNewRolePermissions([]);
                }}
                className="text-theme-secondary hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-theme-secondary text-xs block mb-1">
                    Nom du rôle
                  </label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Ex: Modérateur"
                    className="w-full bg-theme-primary border border-theme-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-discord"
                  />
                </div>
                <div>
                  <label className="text-theme-secondary text-xs block mb-1">
                    Couleur
                  </label>
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="w-10 h-10 rounded border border-theme-border cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="text-theme-secondary text-xs block mb-1">
                  Permissions Panel:
                </label>
                <div className="flex flex-wrap gap-1">
                  {ALL_PANEL_PERMISSIONS.map((perm) => (
                    <button
                      key={perm}
                      onClick={() => togglePermission({} as GuildRole, perm, "panel", "new")}
                      className={`px-2 py-1 rounded text-xs font-medium border transition ${
                        newRolePermissions.includes(perm)
                          ? "bg-discord/20 text-discord border-discord/30"
                          : "bg-theme-tertiary text-theme-muted border-theme-border hover:text-theme-secondary"
                      }`}
                    >
                      {perm.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddRole}
                  disabled={actionLoading === "add" || !newRoleName.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Créer le rôle
                </button>
              </div>
            </div>
          </div>
        )}

        {currentRoles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-theme-muted mb-4">
              {activeTab === "panel"
                ? "Aucun rôle panel configuré"
                : "Aucun rôle Discord configuré. Synchronisez pour importer les rôles."}
            </p>
            {activeTab === "panel" && canManageRoles && (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-discord hover:bg-discord-hover text-white rounded-lg text-sm font-medium transition inline-flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Créer un rôle personnalisé
                </button>
                <button
                  onClick={handleCreateDefaultRoles}
                  disabled={actionLoading === "create-default"}
                  className="px-4 py-2 bg-theme-tertiary hover:bg-theme-border text-theme-secondary rounded-lg text-sm font-medium transition inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Shield className="w-4 h-4" />
                  {actionLoading === "create-default" ? "Création..." : "Créer les rôles par défaut (Owner, Admin, Mod, Viewer)"}
                </button>
              </div>
            )}
            {activeTab === "discord" && canManageRoles && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-discord hover:bg-discord-hover text-white rounded-lg text-sm font-medium transition inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                Synchroniser avec Discord
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {currentRoles.map((role, index) => (
              <div
                key={role.id}
                className="bg-theme-tertiary/30 rounded-lg"
              >
                {editingRole?.id === role.id ? (
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="color"
                        value={editingRole.color}
                        onChange={(e) =>
                          setEditingRole({
                            ...editingRole,
                            color: e.target.value,
                          })
                        }
                        className="w-8 h-8 rounded cursor-pointer"
                        disabled={!!role.discordRoleId}
                        title={role.discordRoleId ? "Couleur géré par Discord" : "Changer la couleur"}
                      />
                      <input
                        type="text"
                        value={editingRole.name}
                        onChange={(e) =>
                          setEditingRole({
                            ...editingRole,
                            name: e.target.value,
                          })
                        }
                        className="flex-1 bg-theme-primary border border-theme-border rounded px-2 py-1 text-sm text-white"
                        disabled={!!role.discordRoleId}
                      />
                      {canManageRoles && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleUpdateRole(editingRole)}
                            disabled={actionLoading === role.id}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm text-white"
                          >
                            Sauvegarder
                          </button>
                          <button
                            onClick={() => setEditingRole(null)}
                            className="px-3 py-1 text-theme-secondary hover:text-white"
                          >
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>

                    {!role.discordRoleId && (
                      <div className="mb-3">
                        <span className="text-theme-secondary text-xs block mb-1">
                          Permissions Panel:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {ALL_PANEL_PERMISSIONS.map((perm) => (
                            <button
                              key={perm}
                              onClick={() => togglePermission(role, perm, "panel")}
                              className={`px-2 py-1 rounded text-xs font-medium border transition ${
                                editingRole.panelPermissions.includes(perm)
                                  ? "bg-discord/20 text-discord border-discord/30"
                                  : "bg-theme-tertiary text-theme-muted border-theme-border hover:text-theme-secondary"
                              }`}
                            >
                              {perm.replace(/_/g, " ")}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {role.discordRoleId && (
                      <div>
                        <span className="text-theme-secondary text-xs block mb-1">
                          Permissions Discord:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {ALL_DISCORD_PERMISSIONS.map((perm) => (
                            <button
                              key={perm}
                              onClick={() => togglePermission(role, perm, "discord")}
                              className={`px-2 py-1 rounded text-xs font-medium border transition ${
                                editingRole.discordPermissions.includes(perm)
                                  ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                                  : "bg-theme-tertiary text-theme-muted border-theme-border hover:text-theme-secondary"
                              }`}
                            >
                              {perm.replace(/_/g, " ")}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {canManageRoles && !role.discordRoleId && (
                        <div className="flex flex-col gap-0">
                          <button
                            onClick={() => handleMoveRole(role.id, "up")}
                            disabled={index === 0 || actionLoading === `move-${role.id}`}
                            className="p-0.5 text-theme-muted hover:text-white disabled:opacity-30"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleMoveRole(role.id, "down")}
                            disabled={index === currentRoles.length - 1 || actionLoading === `move-${role.id}`}
                            className="p-0.5 text-theme-muted hover:text-white disabled:opacity-30"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <div>
                        <span className="font-medium">{role.name}</span>
                        {role.discordRoleId && (
                          <span className="text-theme-muted text-xs ml-2">
                            (Discord)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {role.panelPermissions.map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-0.5 bg-discord/20 text-discord text-xs rounded"
                            title={`Panel: ${perm}`}
                          >
                            {perm.replace(/_/g, " ")}
                          </span>
                        ))}
                        {role.discordPermissions.map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs rounded"
                            title={`Discord: ${perm}`}
                          >
                            {perm.replace(/_/g, " ")}
                          </span>
                        ))}
                        {role.panelPermissions.length === 0 && role.discordPermissions.length === 0 && (
                          <span className="text-theme-muted text-xs">Aucune permission</span>
                        )}
                      </div>
                      {canManageRoles && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingRole({ ...role })}
                            className="p-1.5 text-theme-secondary hover:text-white"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {(!role.discordRoleId || (role.discordRoleId && role.discordRoleId.startsWith("manual-"))) && isOwner && (
                            <button
                              onClick={() => setConfirmDelete(role)}
                              className="p-1.5 text-theme-secondary hover:text-red-400"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-theme-secondary rounded-xl p-6 w-full max-w-md border border-theme-border">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Supprimer {confirmDelete.name} ?
            </h3>
            <p className="text-theme-secondary mb-4">
              Cette action est irréversible. Le rôle sera supprimé.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-theme-secondary hover:text-white transition"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteRole(confirmDelete.id)}
                disabled={actionLoading === confirmDelete.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium transition disabled:opacity-50"
              >
                {actionLoading === confirmDelete.id ? "..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}