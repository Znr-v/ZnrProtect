"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Shield, Trash2, Edit, X, Settings, Search, UserPlus, Check } from "lucide-react";
import { MentionSearch } from "@/components/MentionSearch";
import { apiFetch, setAuthToken } from "@/lib/api";
import { useDashboardUser, DashboardRole } from "@/lib/usePermissions";

type User = {
  id: string;
  discordId: string;
  username: string;
  avatar?: string | null;
  role: DashboardRole;
  approved: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
};

type SearchResult = {
  discordId: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
  discriminator?: string;
  alreadyInDashboard: boolean;
  existingRole?: string;
};

type GuildPermission = {
  guildId: string;
  guildName: string;
  permissions: string[];
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const { approved, loaded, hasAccess, guilds } = useDashboardUser();
  const router = useRouter();

  // Check if user is OWNER of at least one guild (since global OWNER gets OWNER on all guilds)
  const isGlobalOwner = guilds.some(g => g.role === "OWNER");

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissions, setPermissions] = useState<GuildPermission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [tableRoleFilter, setTableRoleFilter] = useState<"ALL" | DashboardRole>("ALL");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [addRole, setAddRole] = useState<DashboardRole>("VIEWER");
  const [showAddForm, setShowAddForm] = useState(false);

  const filteredUsers = users.filter(u => {
    const searchVal = searchQuery.replace(/^@/, "").toLowerCase();
    const matchesSearch = !searchQuery || 
      u.username.toLowerCase().includes(searchVal) || 
      u.discordId.includes(searchVal);
    const matchesRole = tableRoleFilter === "ALL" || u.role === tableRoleFilter;
    return matchesSearch && matchesRole;
  });

  useEffect(() => {
    if (session) {
      setAuthToken((session as any).apiToken ?? null);
    }
  }, [session]);

  useEffect(() => {
    if (loaded) {
      if (!session) {
        router.push("/");
      } else if (!approved) {
        router.push("/pending");
      } else if (!hasAccess || !isGlobalOwner) {
        router.push("/unauthorized");
      }
    }
  }, [loaded, session, approved, hasAccess, isGlobalOwner, router]);

  useEffect(() => {
    if (approved && hasAccess) {
      loadData();
    }
  }, [approved, hasAccess]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<User[]>("/api/admin/users");
      setUsers(data);
    } catch (e) {
      console.error("Failed to load users:", e);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const data = await apiFetch<SearchResult | { users: SearchResult[] }>("/api/admin/users/search", {
        method: "POST",
        body: { query: searchQuery.trim() },
      });
      if ("users" in data) {
        setSearchError(`${data.users.length} utilisateur(s) trouvé(s)`);
      } else {
        setSearchResult(data);
      }
    } catch (e: any) {
      setSearchError(e.message || "Utilisateur non trouvé");
    }
    setSearchLoading(false);
  };

  const handleAddUser = async () => {
    if (!searchResult) return;
    setActionLoading("add");
    try {
      await apiFetch("/api/admin/users/add", {
        method: "POST",
        body: { discordId: searchResult.discordId, role: addRole },
      });
      setSearchResult(null);
      setSearchQuery("");
      setShowAddForm(false);
      loadData();
    } catch (e: any) {
      setSearchError(e.message);
    }
    setActionLoading(null);
  };

  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: User, role: DashboardRole } | null>(null);

  const handleUpdateRole = async (user: User, roleToSet: string) => {
    setActionLoading(user.id);
    try {
      await apiFetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        body: { role: roleToSet },
      });
      setPendingRoleChange(null);
      loadData();
    } catch (e: any) {
      console.error("Failed to update role:", e);
    }
    setActionLoading(null);
  };

  const handleRoleSelect = (user: User, newSelectedRole: string) => {
    if (newSelectedRole === user.role) return;
    if (newSelectedRole === "OWNER") {
      setPendingRoleChange({ user, role: "OWNER" });
    } else {
      handleUpdateRole(user, newSelectedRole);
    }
  };

  const handleDelete = async (userId: string) => {
    setActionLoading(userId);
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      setConfirmDelete(null);
      loadData();
    } catch (e) {
      console.error("Failed to delete:", e);
    }
    setActionLoading(null);
  };

  const handleShowPermissions = async (user: User) => {
    setSelectedUser(user);
    setShowPermissions(true);
    setLoadingPermissions(true);
    try {
      const data = await apiFetch<{ permissions: GuildPermission[] }>(`/api/admin/users/${user.id}/permissions`);
      setPermissions(data.permissions);
    } catch (e) {
      console.error("Failed to load permissions:", e);
    }
    setLoadingPermissions(false);
  };

  const handleUpdatePermissions = async (guildId: string, perms: string[]) => {
    if (!selectedUser) return;
    try {
      await apiFetch(`/api/admin/users/${selectedUser.id}/permissions`, {
        method: "PUT",
        body: { guildId, permissions: perms },
      });
      const data = await apiFetch<{ permissions: GuildPermission[] }>(`/api/admin/users/${selectedUser.id}/permissions`);
      setPermissions(data.permissions);
    } catch (e) {
      console.error("Failed to update permissions:", e);
    }
  };

  const availableRolesForAdd: DashboardRole[] = ["ADMIN", "MODERATOR", "VIEWER"];
  const availableRolesForEdit: DashboardRole[] = ["OWNER", "ADMIN", "MODERATOR", "VIEWER"];

  const ROLE_HIERARCHY: Record<string, number> = {
    VIEWER: 0,
    MODERATOR: 1,
    ADMIN: 2,
    OWNER: 3,
  };

  const canModifyUser = (targetRole: DashboardRole) => {
    return ROLE_HIERARCHY["OWNER"] > ROLE_HIERARCHY[targetRole];
  };

  const roleColors: Record<DashboardRole, string> = {
    OWNER: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
    MODERATOR: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    VIEWER: "bg-gray-500/20 text-theme-secondary border-gray-500/30",
  };

  if (status === "loading" || !loaded || !hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-theme-secondary hover:text-white transition">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="w-12 h-12 rounded-xl bg-theme-tertiary flex items-center justify-center">
          <Shield className="w-6 h-6 text-discord" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Administration</h1>
          <p className="text-theme-secondary text-sm">Gestion des utilisateurs et permissions</p>
        </div>
      </div>

      {/* Search section */}
      <div className="bg-theme-secondary rounded-xl border border-theme-border p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-discord" />
          Rechercher ou ajouter un utilisateur
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <MentionSearch
              users={users}
              value={searchQuery}
              onChange={setSearchQuery}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Rechercher (@pseudo) ou ID Discord pour ajouter..."
            />
          </div>
          <select
            value={tableRoleFilter}
            onChange={(e) => setTableRoleFilter(e.target.value as any)}
            className="bg-theme-primary border border-theme-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-discord"
          >
            <option value="ALL">Tous les rôles</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MODERATOR">Modérateur</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className="bg-discord hover:bg-discord-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Search className="w-4 h-4" />
            Chercher / Ajouter
          </button>
        </div>

        {searchError && (
          <p className="text-yellow-400 text-sm mt-2">{searchError}</p>
        )}

        {searchResult && (
          <div className="mt-4 bg-theme-primary rounded-lg p-4 border border-theme-border">
            <div className="flex items-center gap-4">
              {searchResult.avatar ? (
                <img src={searchResult.avatar} alt="" className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-theme-tertiary flex items-center justify-center text-xl font-bold">
                  {(searchResult.username || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <div className="font-medium">{searchResult.globalName || searchResult.username}</div>
                <div className="text-theme-secondary text-sm">@{searchResult.username}</div>
                <div className="text-theme-muted text-xs font-mono">{searchResult.discordId}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as DashboardRole)}
                  className="bg-theme-tertiary border border-theme-border rounded px-3 py-1.5 text-sm"
                >
                  {availableRolesForAdd.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddUser}
                  disabled={actionLoading === "add"}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium transition disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Users list header & filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-discord" />
          Membres du Staff
        </h2>
      </div>

      {/* Users list */}
      <div className="bg-theme-secondary rounded-xl border border-theme-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-theme-muted">Aucun utilisateur trouvé</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-theme-tertiary text-theme-secondary text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Utilisateur</th>
                <th className="py-3 px-4">Rôle</th>
                <th className="py-3 px-4">Dernière connexion</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-theme-border hover:bg-theme-tertiary/30 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-theme-tertiary flex items-center justify-center text-lg font-bold">
                          {(user.username || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{user.username || "Utilisateur"}</div>
                        <div className="text-theme-muted text-xs font-mono">{user.discordId}</div>
                      </div>
                    </div>
                  </td>
                    <td className="py-3 px-4">
                      {canModifyUser(user.role) ? (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleSelect(user, e.target.value)}
                          disabled={actionLoading === user.id}
                          className={`px-2 py-1 rounded text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-discord ${roleColors[user.role]} appearance-none cursor-pointer`}
                        >
                          {availableRolesForEdit.map(r => (
                            <option key={r} value={r} className="bg-theme-secondary text-theme-primary">
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${roleColors[user.role]}`}>
                          {user.role}
                        </span>
                      )}
                    </td>
                  <td className="py-3 px-4 text-theme-secondary text-sm">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("fr-FR") : "-"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canModifyUser(user.role) && (
                          <>
                            <button
                              onClick={() => handleShowPermissions(user)}
                              className="p-2 text-theme-secondary hover:text-white transition"
                              title="Permissions"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(user)}
                              className="p-2 text-theme-secondary hover:text-red-400 transition"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Role Change (Owner Transfer) confirmation */}
      {pendingRoleChange && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-theme-secondary rounded-xl p-6 w-full max-w-md border border-theme-border">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Transférer la couronne ?
            </h3>
            <p className="text-theme-secondary mb-4">
              Attention, il ne peut y avoir qu'un seul <strong>OWNER</strong>. 
              Si vous nommez <strong>{pendingRoleChange.user.username}</strong> comme OWNER, vous serez automatiquement rétrogradé au rang d'ADMIN et perdrez la gestion du staff.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPendingRoleChange(null)} className="px-4 py-2 text-theme-secondary hover:text-white transition">
                Annuler
              </button>
              <button
                onClick={() => handleUpdateRole(pendingRoleChange.user, pendingRoleChange.role)}
                disabled={actionLoading === pendingRoleChange.user.id}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium transition disabled:opacity-50"
              >
                {actionLoading === pendingRoleChange.user.id ? "..." : "Confirmer le transfert"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-theme-secondary rounded-xl p-6 w-full max-w-md border border-theme-border">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Supprimer {confirmDelete.username} ?
            </h3>
            <p className="text-theme-secondary mb-4">Cette action est irréversible.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-theme-secondary hover:text-white transition">
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={actionLoading === confirmDelete.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium transition disabled:opacity-50"
              >
                {actionLoading === confirmDelete.id ? "..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions modal */}
      {showPermissions && selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-theme-secondary rounded-xl p-6 w-full max-w-2xl border border-theme-border max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-discord" />
                  Permissions de {selectedUser.username}
                </h3>
                <p className="text-theme-secondary text-sm">Gérer les permissions par serveur</p>
              </div>
              <button onClick={() => setShowPermissions(false)} className="text-theme-secondary hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingPermissions ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord" />
              </div>
            ) : permissions.length === 0 ? (
              <p className="text-theme-muted text-center py-8">Aucun serveur trouvé</p>
            ) : (
              <div className="space-y-4">
                {permissions.map((perm) => (
                  <div key={perm.guildId} className="bg-theme-tertiary/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{perm.guildName}</span>
                      <span className="text-theme-muted text-xs">{perm.guildId}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["VIEW_LOGS", "MANAGE_GUILD", "MANAGE_MEMBERS", "MANAGE_ROLES"].map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            const newPerms = perm.permissions.includes(p)
                              ? perm.permissions.filter((x) => x !== p)
                              : [...perm.permissions, p];
                            handleUpdatePermissions(perm.guildId, newPerms);
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium border transition ${
                            perm.permissions.includes(p)
                              ? "bg-discord/20 text-discord border-discord/30"
                              : "bg-theme-tertiary text-theme-muted border-theme-border hover:text-theme-secondary"
                          }`}
                        >
                          {p.replace(/_/g, " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
