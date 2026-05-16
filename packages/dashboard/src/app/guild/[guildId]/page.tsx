"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Shield, AlertTriangle, Users, Activity, Settings, X, Ban, Gavel, VolumeX, Volume2, CheckCircle, AlertCircle, Undo2, MessageSquare, ScrollText, User, Clock, Hash, AlertOctagon, Search, Filter, History } from "lucide-react";
import { apiFetch, setAuthToken } from "@/lib/api";
import { useDashboardUser } from "@/lib/usePermissions";
import { MentionSearch } from "@/components/MentionSearch";
import { StatCard } from "@/components/StatCard";

import { SeverityBadge } from "@/components/SeverityBadge";
type GuildData = {
  guild: {
    id: string;
    name: string;
    riskScore: number;
    lockdownActive: boolean;
    config: any;
    _count: { members: number; incidents: number; securityEvents: number; detectedLinks: number; detectedSecrets: number };
  };
};

type Incident = { id: string; title: string; severity: string; status: string; description?: string; createdAt: string; _count: { events: number; actions: number }; channelName?: string; events?: any[] };
type Event = { id: string; type: string; severity: string; actorId: string; actorName?: string; channelId: string; channelName?: string; description: string; metadata: any; createdAt: string };
type Member = { id: string; discordId: string; username: string; riskScore: number; quarantined: boolean; trusted: boolean; messageCount: number; warnCount: number; timedOutUntil?: string | null; avatar?: string | null; roleIds?: string[] };
type BotActionLog = { id: string; action: string; targetId?: string; targetName?: string; moderatorId?: string; moderatorName?: string; reason?: string; details?: any; createdAt: string };

type Tab = "overview" | "incidents" | "events" | "members" | "logs" | "config";

function MemberDetail({ member, onClose, logs, guildId, onUpdate }: { member: Member; onClose: () => void; logs: BotActionLog[]; guildId: string; onUpdate?: (m: Member) => void }) {
  const riskColor = member.riskScore >= 81 ? "text-red-400" : member.riskScore >= 61 ? "text-orange-400" : member.riskScore >= 31 ? "text-yellow-400" : "text-green-400";
  const isMuted = member.timedOutUntil && new Date(member.timedOutUntil) > new Date();
  const [detailView, setDetailView] = useState<"overview" | "mutes" | "kicks" | "bans" | "warns" | "events" | "risk" | "messages" | "roles">("overview");
  const [detailData, setDetailData] = useState<{ botLogs: BotActionLog[]; securityEvents: any[]; detectedLinks: any[]; riskScores: any; avatar?: string | null } | null>(null);
  const [messages, setMessages] = useState<any[] | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [roles, setRoles] = useState<{ id: string; name: string; color: string }[] | null>(null);
  const [userRolesList, setUserRolesList] = useState<{ id: string; name: string; color: string }[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [removingRole, setRemovingRole] = useState<string | null>(null);

  useEffect(() => {
    setDetailData(null);
    setMessages(null);
    setRoles(null);
    setDetailView("overview");
    setLoadingRoles(false);
    loadDetails();
  }, [member.discordId]);

  const loadDetails = async () => {
    const data = await apiFetch<{ member: Member; botLogs: BotActionLog[]; securityEvents: any[]; detectedLinks: any[]; riskScores: any; avatar?: string | null }>(`/api/members/${guildId}/${member.discordId}/details`);
    setDetailData(data);
  };

  const loadRoles = async (force = false) => {
    if (!force && roles && roles.length > 0) return;
    setLoadingRoles(true);
    try {
      const data = await apiFetch<{ roles: { id: string; name: string; color: string }[]; allRoles: { id: string; name: string; color: string }[] }>(`/api/members/${guildId}/${member.discordId}/roles`);
      setRoles(data.allRoles || []);
      setUserRolesList(data.roles || []);
    } catch (e) {
      console.error("Failed to load roles:", e);
    }
    setLoadingRoles(false);
  };

  const loadMessages = async () => {
    setLoadingMessages(true);
    try {
      const data = await apiFetch<{ messages: any[] }>(`/api/members/${guildId}/${member.discordId}/messages`);
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingMessages(false);
  };

  const handleViewChange = async (view: "overview" | "mutes" | "kicks" | "bans" | "events" | "risk" | "messages" | "roles") => {
    if (view !== "overview") await loadDetails();
    if (view === "messages") loadMessages();
    if (view === "roles") loadRoles(true);
    setDetailView(view);
  };

  const mutes = detailData?.botLogs.filter(l => l.action === "MUTE") || logs.filter(l => l.action === "MUTE");
  const bans = detailData?.botLogs.filter(l => l.action === "BAN") || logs.filter(l => l.action === "BAN");
  const kicks = detailData?.botLogs.filter(l => l.action === "KICK") || logs.filter(l => l.action === "KICK");

  const formatDuration = (endDate: string) => {
    const remaining = new Date(endDate).getTime() - Date.now();
    if (remaining <= 0) return "expiré";
    const minutes = Math.floor(remaining / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}min`;
    return `${minutes}min`;
  };

  const actionLabels: Record<string, string> = {
    MUTE: "🔇 Mute", UNMUTE: "🔊 Mute retiré", BAN: "🚫 Banni", UNBAN: "✅ Débanni",
    KICK: "👢 Exclu", TRUST_ADD: "✓ Fiable ajouté", TRUST_REMOVE: "✗ Fiable retiré",
    QUARANTINE: "⚠️ Quarantaine", CONFIG_CHANGE: "⚙️ Config", LOCKDOWN_ON: "🔒 Lockdown",
    ROLE_REMOVE: "🎭 Rôle retiré",
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      MUTE: "🔇", UNMUTE: "🔊", BAN: "🚫", UNBAN: "✅", KICK: "👢",
      TRUST_ADD: "✓", TRUST_REMOVE: "✗", QUARANTINE: "⚠️", LOCKDOWN_ON: "🔒", LOCKDOWN_OFF: "🔓",
      ROLE_REMOVE: "🎭",
    };
    return icons[action] || "📋";
  };

  const renderOverview = () => (
    <>
      <div className="space-y-2">
        <button onClick={() => handleViewChange("risk")} className="bg-dark-700/30 hover:bg-dark-700 rounded-lg p-3 w-full text-left transition">
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-400 text-xs uppercase tracking-wider">Score de risque</span>
            <span className={`text-xl font-bold ${riskColor}`}>{member.riskScore}/100</span>
          </div>
          <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${member.riskScore >= 61 ? "bg-red-500" : member.riskScore >= 31 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${member.riskScore}%` }} />
          </div>
        </button>

        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => handleViewChange("messages")} className="bg-dark-700/30 hover:bg-dark-700 rounded-lg p-2 text-center transition">
            <p className="text-gray-400 text-xs">Messages</p>
            <p className="font-bold text-lg">{member.messageCount}</p>
          </button>
          <button onClick={() => handleViewChange("mutes")} className="bg-dark-700/30 hover:bg-dark-700 rounded-lg p-2 text-center transition">
            <p className="text-gray-400 text-xs">Mutes</p>
            <p className={`font-bold text-lg ${mutes.length > 0 ? "text-yellow-400" : ""}`}>{mutes.length}</p>
          </button>
          <button onClick={() => handleViewChange("kicks")} className="bg-dark-700/30 hover:bg-dark-700 rounded-lg p-2 text-center transition">
            <p className="text-gray-400 text-xs">Kicks</p>
            <p className={`font-bold text-lg ${kicks.length > 0 ? "text-orange-400" : ""}`}>{kicks.length}</p>
          </button>
          <button onClick={() => handleViewChange("bans")} className="bg-dark-700/30 hover:bg-dark-700 rounded-lg p-2 text-center transition">
            <p className="text-gray-400 text-xs">Bans</p>
            <p className={`font-bold text-lg ${bans.length > 0 ? "text-red-400" : ""}`}>{bans.length}</p>
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-dark-700">
        <h4 className="text-sm font-medium mb-2">Statut</h4>
        <div className="flex flex-wrap gap-2">
          {isMuted ? (
            <button onClick={() => handleViewChange("mutes")} className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition">
              <VolumeX className="w-3 h-3" />
              Mute: <span className="font-bold">{formatDuration(member.timedOutUntil!)}</span>
            </button>
          ) : mutes.length > 0 ? (
            <button onClick={() => handleViewChange("mutes")} className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition">
              <VolumeX className="w-3 h-3" />
              {mutes.length} mute(s) passé(s)
            </button>
          ) : null}
          {member.quarantined && (
            <span className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <Ban className="w-3 h-3" /> Banni
            </span>
          )}
          {member.trusted && (
            <span className="bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Fiable
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-dark-700">
        <button onClick={() => handleViewChange("roles")} className="flex items-center justify-between w-full bg-dark-700/30 hover:bg-dark-700 rounded-lg p-3 transition text-left">
          <span className="text-gray-400 text-xs uppercase tracking-wider">Rôles</span>
          <span className="text-gray-500 text-sm">Voir →</span>
        </button>
      </div>

      {logs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-dark-700">
          <button onClick={() => handleViewChange("events")} className="text-sm font-medium mb-3 text-discord hover:underline">
            Voir tout l'historique ({logs.length} actions)
          </button>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {logs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs p-2 bg-dark-700/30 rounded-lg">
                <span className="text-lg">{getActionIcon(log.action)}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-200">{actionLabels[log.action] || log.action}</span>
                  {log.reason && <p className="text-gray-500 truncate">{log.reason}</p>}
                  <p className="text-gray-600 text-[10px]">{new Date(log.createdAt).toLocaleString("fr-FR")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderMutes = () => (
    <div className="space-y-3">
      <button onClick={() => setDetailView("overview")} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        ← Retour
      </button>
      <h4 className="font-medium">Historique des mutes</h4>
      {mutes.length === 0 ? (
        <p className="text-gray-500 text-sm">Aucun mute</p>
      ) : (
        mutes.map((mute) => (
          <div key={mute.id} className="bg-dark-700/30 rounded-lg p-3">
            <div className="flex justify-between items-start mb-2">
              <span className="text-yellow-400 font-medium">🔇 Mute</span>
              <span className="text-gray-500 text-xs">{new Date(mute.createdAt).toLocaleString("fr-FR")}</span>
            </div>
            {mute.details?.duration && (
              <p className="text-sm">Durée: {mute.details.duration} minute(s)</p>
            )}
            {mute.reason && (
              <p className="text-sm text-gray-400">Raison: {mute.reason}</p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Fin: <span title={new Date(mute.details?.endDate).toLocaleString("fr-FR")}>
                {mute.details?.endDate && new Date(mute.details.endDate) > new Date() 
                  ? `dans ${Math.ceil((new Date(mute.details.endDate).getTime() - Date.now()) / 60000)}min`
                  : "expiré"}
              </span>
            </p>
          </div>
        ))
      )}
    </div>
  );

  const renderKicks = () => (
    <div className="space-y-3">
      <button onClick={() => setDetailView("overview")} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        ← Retour
      </button>
      <h4 className="font-medium">Historique des kicks</h4>
      {kicks.length === 0 ? (
        <p className="text-gray-500 text-sm">Aucun kick</p>
      ) : (
        kicks.map((kick) => (
          <div key={kick.id} className="bg-dark-700/30 rounded-lg p-3">
            <div className="flex justify-between items-start mb-2">
              <span className="text-orange-400 font-medium">👢 Kick</span>
              <span className="text-gray-500 text-xs">{new Date(kick.createdAt).toLocaleString("fr-FR")}</span>
            </div>
            {kick.moderatorName && (
              <p className="text-sm">Par: {kick.moderatorName}</p>
            )}
            {kick.reason && (
              <p className="text-sm text-gray-400">Raison: {kick.reason}</p>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderBans = () => (
    <div className="space-y-3">
      <button onClick={() => setDetailView("overview")} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        ← Retour
      </button>
      <h4 className="font-medium">Historique des bans</h4>
      {bans.length === 0 ? (
        <p className="text-gray-500 text-sm">Aucun ban</p>
      ) : (
        bans.map((ban) => (
          <div key={ban.id} className="bg-dark-700/30 rounded-lg p-3">
            <div className="flex justify-between items-start mb-2">
              <span className="text-red-400 font-medium">🚫 Ban</span>
              <span className="text-gray-500 text-xs">{new Date(ban.createdAt).toLocaleString("fr-FR")}</span>
            </div>
            {ban.reason && <p className="text-sm text-gray-400">Raison: {ban.reason}</p>}
            {ban.details?.roleName && <p className="text-xs text-gray-500 mt-1">Rôle au moment du ban: {ban.details.roleName}</p>}
          </div>
        ))
      )}
    </div>
  );

  const renderWarns = () => (
    <div className="space-y-3">
      <button onClick={() => setDetailView("overview")} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        ← Retour
      </button>
      <h4 className="font-medium">Avertissements & Sanctions</h4>
      {detailData?.securityEvents.length === 0 && logs.filter(l => l.action === "MUTE").length === 0 ? (
        <p className="text-gray-500 text-sm">Aucun avertissement</p>
      ) : (
        <>
          {logs.filter(l => l.action === "MUTE").map((log) => (
            <div key={log.id} className="bg-dark-700/30 rounded-lg p-3 border-l-2 border-yellow-500">
              <div className="flex justify-between items-start mb-1">
                <span className="text-yellow-400 font-medium">🔇 Mute</span>
                <span className="text-gray-500 text-xs">{new Date(log.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              {log.reason && <p className="text-sm text-gray-400">{log.reason}</p>}
            </div>
          ))}
          {detailData?.securityEvents.map((event) => (
            <div key={event.id} className="bg-dark-700/30 rounded-lg p-3 border-l-2 border-red-500">
              <div className="flex justify-between items-start mb-1">
                <span className="text-red-400 font-medium">{event.type?.replace(/_/g, " ")}</span>
                <span className="text-gray-500 text-xs">{new Date(event.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <p className="text-sm text-gray-400">{event.description}</p>
              {event.metadata?.sanction && (
                <p className="text-xs text-red-400 mt-1">Sanction: {event.metadata.sanction}</p>
              )}
              {event.metadata?.messages?.length > 0 && (
                <div className="mt-2 bg-dark-900 rounded p-2">
                  <p className="text-gray-400 text-xs mb-1">Messages ({event.metadata.messages.length})</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {event.metadata.messages.map((msg: string, i: number) => (
                      <div key={i} className="text-xs text-gray-300 font-mono border-l-2 border-dark-700 pl-2">
                        {msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );


  const renderRisk = () => (
    <div className="space-y-3">
      <button onClick={() => setDetailView("overview")} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        ← Retour
      </button>
      <h4 className="font-medium">Détail du score de risque</h4>
      
      <div className="bg-dark-700/30 rounded-lg p-4 text-center">
        <p className="text-gray-400 text-sm">Score total</p>
        <p className={`text-3xl font-bold ${riskColor}`}>{member.riskScore}/100</p>
      </div>

      {detailData?.riskScores?.factors && (
        <div className="space-y-2">
          {Object.entries(detailData.riskScores.factors as Record<string, number>).map(([factor, value]) => (
            <div key={factor} className="flex justify-between items-center bg-dark-700/30 rounded-lg p-2">
              <span className="text-gray-400 text-sm capitalize">{factor.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className={`font-medium ${value > 20 ? "text-red-400" : value > 10 ? "text-yellow-400" : "text-green-400"}`}>
                {value} pts
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500 mt-4">
        <p>Le score est calculé à partir de :</p>
        <ul className="list-disc list-inside mt-1">
          <li>Âge du compte</li>
          <li>Nombre de messages</li>
          <li>Liens suspects partagés</li>
          <li>Avertissements reçus</li>
          <li>Comportement récent</li>
        </ul>
      </div>
    </div>
  );

  const handleRemoveRole = async (roleId: string, roleName: string) => {
    setRemovingRole(roleId);
    try {
      await apiFetch(`/api/guilds/${guildId}/members/${member.discordId}/roles`, {
        method: "POST",
        body: { action: "remove", roleId },
      });
      
      // Get updated member with new roleIds
      const details = await apiFetch<{ member: Member }>(`/api/members/${guildId}/${member.discordId}/details`);
      
      // Update parent state
      if (onUpdate && details.member) {
        onUpdate(details.member);
      }
      
      // Reload roles list
      await loadRoles(true);
    } catch (e) {
      console.error("Failed to remove role:", e);
    }
    setRemovingRole(null);
  };

  const [roleSearch, setRoleSearch] = useState("");
  const [showAddRole, setShowAddRole] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const userRoleIds = userRolesList.map(r => r.id);
  const availableRoles = (roles || []).filter(r => !userRoleIds.includes(r.id) && r.name.toLowerCase().includes(roleSearch.toLowerCase()));
  const userRoles = userRolesList;

  const renderRoles = () => (
    <div className="space-y-3">
      <button onClick={() => setDetailView("overview")} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        ← Retour
      </button>
      <h4 className="font-medium">Rôles du membre</h4>
      
      {loadingRoles && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-discord"></div>
          <span className="ml-2 text-gray-400 text-sm">Chargement...</span>
        </div>
      )}

      {!loadingRoles && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Rôles actuels ({userRoles.length})</span>
            <button 
              onClick={() => { setShowAddRole(true); setRoleSearch(""); }}
              className="text-xs bg-discord hover:bg-discord/80 px-2 py-1 rounded text-white transition"
            >
              + Ajouter
            </button>
          </div>

          {userRoles.length === 0 ? (
            <p className="text-gray-500 text-sm italic">Aucun rôle</p>
          ) : (
            <div className="space-y-2">
              {userRoles.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-dark-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="text-sm font-medium">@{r.name}</span>
                  </div>
                  <button
                    onClick={() => setConfirmRemove({ id: r.id, name: r.name })}
                    disabled={removingRole === r.id}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition"
                  >
                    {removingRole === r.id ? "..." : "Retirer"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddRole && (
            <div className="mt-4 pt-4 border-t border-dark-700">
              <input
                type="text"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Rechercher ou sélectionner un rôle..."
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 mb-2"
                autoFocus
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {availableRoles.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucun rôle disponible</p>
                ) : (
                  availableRoles.map(r => (
                    <button
                      key={r.id}
                      onClick={async () => {
                        setLoadingRoles(true);
                        try {
                          await apiFetch(`/api/guilds/${guildId}/members/${member.discordId}/roles`, {
                            method: "POST",
                            body: { action: "add", roleId: r.id }
                          });
                          
                          // Get updated member with new roleIds
                          const details = await apiFetch<{ member: Member }>(`/api/members/${guildId}/${member.discordId}/details`);
                          if (onUpdate && details.member) {
                            onUpdate(details.member);
                          }
                          
                          await loadRoles(true);
                        } catch (e) {
                          console.error(e);
                        }
                        setLoadingRoles(false);
                        setShowAddRole(false);
                        setRoleSearch("");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-700 rounded text-left"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-sm">@{r.name}</span>
                    </button>
                  ))
                )}
              </div>
              <button 
                onClick={() => { setShowAddRole(false); setRoleSearch(""); }}
                className="mt-2 text-xs text-gray-400 hover:text-white"
              >
                Annuler
              </button>
            </div>
          )}
        </>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-xl p-5 border border-dark-700 max-w-sm mx-4">
            <h4 className="font-bold text-lg mb-2">Confirmer</h4>
            <p className="text-gray-400 text-sm mb-4">
              Retirer le rôle <span style={{ color: roles?.find(r => r.id === confirmRemove.id)?.color }}>@{confirmRemove.name}</span> de <strong>{member.username}</strong> ?
            </p>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setConfirmRemove(null)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition"
              >
                Annuler
              </button>
              <button 
                onClick={async () => {
                  setConfirmRemove(null);
                  await handleRemoveRole(confirmRemove.id, confirmRemove.name);
                }}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 rounded text-white transition"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-3">
      <button onClick={() => setDetailView("overview")} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        ← Retour
      </button>
      <h4 className="font-medium">Messages récents</h4>
      
      {loadingMessages && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord"></div>
          <span className="ml-3 text-gray-400">Chargement des messages...</span>
        </div>
      )}

      {!loadingMessages && messages?.length === 0 && (
        <p className="text-gray-500 text-sm">Aucun message trouvé</p>
      )}

      {!loadingMessages && messages && messages.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="bg-dark-700/30 rounded-lg p-3">
              <div className="flex justify-between items-start mb-1">
                <span className="text-green-400 text-xs">#{msg.channelName}</span>
                <span className="text-gray-500 text-xs">{new Date(msg.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                {msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content || <em className="text-gray-500">[Message vide ou média]</em>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderEvents = () => (
    <div className="space-y-3">
      <button onClick={() => setDetailView("overview")} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        ← Retour
      </button>
      <h4 className="font-medium">Historique complet</h4>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="bg-dark-700/30 rounded-lg p-2 flex items-start gap-2">
            <span className="text-lg">{getActionIcon(log.action)}</span>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-200 text-sm">{actionLabels[log.action] || log.action}</span>
              {log.reason && <p className="text-gray-500 text-xs truncate">{log.reason}</p>}
              {log.details?.roleName && <p className="text-gray-500 text-xs truncate">Rôle: {log.details.roleName}</p>}
              <p className="text-gray-600 text-[10px]">{new Date(log.createdAt).toLocaleString("fr-FR")}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-4 h-fit max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-dark-700 flex-shrink-0 overflow-hidden">
            {detailData?.avatar ? (
              <img src={detailData.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-discord to-purple-600 flex items-center justify-center text-xl font-bold">
                {member.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg">{member.username}</h3>
            <p className="text-xs text-gray-500">ID: {member.discordId}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {detailView === "overview" && renderOverview()}
      {detailView === "mutes" && renderMutes()}
      {detailView === "kicks" && renderKicks()}
      {detailView === "bans" && renderBans()}
      {detailView === "warns" && renderWarns()}
      {detailView === "risk" && renderRisk()}
      {detailView === "roles" && renderRoles()}
      {detailView === "messages" && renderMessages()}
      {detailView === "events" && renderEvents()}
    </div>
  );
}

export default function GuildPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: session } = useSession();
  const { getGuildRole, loaded: roleLoaded } = useDashboardUser();
  const role = getGuildRole(guildId) || "VIEWER";
  
  const allTabs: { key: Tab; label: string; icon: React.ReactNode; roles: string[] }[] = [
    { key: "overview", label: "Vue d'ensemble", icon: <Shield className="w-4 h-4" />, roles: ["OWNER", "ADMIN"] },
    { key: "incidents", label: "Incidents", icon: <AlertTriangle className="w-4 h-4" />, roles: ["OWNER", "ADMIN"] },
    { key: "events", label: "Events", icon: <Activity className="w-4 h-4" />, roles: ["OWNER", "ADMIN"] },
    { key: "members", label: "Membres", icon: <Users className="w-4 h-4" />, roles: ["OWNER", "ADMIN", "MODERATOR"] },
    { key: "logs", label: "Logs", icon: <ScrollText className="w-4 h-4" />, roles: ["OWNER", "ADMIN"] },
    { key: "config", label: "Config", icon: <Settings className="w-4 h-4" />, roles: ["OWNER"] },
  ];
  const tabs = allTabs.filter(t => t.roles.includes(role));

  const [guild, setGuild] = useState<GuildData["guild"] | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [logs, setLogs] = useState<BotActionLog[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberActions, setMemberActions] = useState<BotActionLog[]>([]);
  const [tokenReady, setTokenReady] = useState(false);

  // Set auth token as soon as session is available
  useEffect(() => {
    const token = (session as any)?.apiToken;
    console.log("[DEBUG] session status:", session ? "present" : "null", "| apiToken:", token ? token.slice(0, 20) + "..." : "MISSING");
    if (token) {
      setAuthToken(token);
      setTokenReady(true);
    }
  }, [session]);

  // Auto-switch to first available tab if current is forbidden
  useEffect(() => {
    if (roleLoaded && tabs.length > 0 && !tabs.find(t => t.key === tab)) {
      setTab(tabs[0].key);
    }
  }, [roleLoaded, role, tab, tabs]);

  useEffect(() => {
    if (!tokenReady) return;
    console.log("[DEBUG] tokenReady, fetching guild", guildId, "and members");
    apiFetch<GuildData>(`/api/guilds/${guildId}`)
      .then((d) => { console.log("[DEBUG] guild response:", d); setGuild(d.guild); })
      .catch((e) => console.error("[DEBUG] guild fetch error:", e));
    apiFetch<{ members: Member[] }>(`/api/members/${guildId}?sort=riskScore&order=desc&limit=500`)
      .then((d) => { console.log("[DEBUG] members response: count=", d.members?.length, d); setMembers(d.members); })
      .catch((e) => console.error("[DEBUG] members fetch error:", e));
  }, [guildId, tokenReady]);

  useEffect(() => {
    if (!tokenReady) return;
    console.log("[DEBUG] tab changed to:", tab);
    if (tab === "incidents") {
      apiFetch<{ incidents: Incident[] }>(`/api/incidents/${guildId}`)
        .then((d) => { console.log("[DEBUG] incidents:", d); setIncidents(d.incidents); })
        .catch((e) => console.error("[DEBUG] incidents error:", e));
    }
    if (tab === "events") {
      setEventsLoading(true);
      apiFetch<{ events: Event[] }>(`/api/events/${guildId}`)
        .then((d) => { console.log("[DEBUG] events:", d); setEvents(d.events); setEventsLoading(false); })
        .catch((e) => console.error("[DEBUG] events error:", e));
    }
    if (tab === "members") {
      apiFetch<{ members: Member[] }>(`/api/members/${guildId}?sort=riskScore&order=desc&limit=500`)
        .then((d) => { console.log("[DEBUG] members (tab):", d); setMembers(d.members); })
        .catch((e) => console.error("[DEBUG] members (tab) error:", e));
    }
    if (tab === "logs") {
      apiFetch<{ logs: BotActionLog[] }>(`/api/logs/${guildId}`)
        .then((d) => { console.log("[DEBUG] logs:", d); setLogs(d.logs); })
        .catch((e) => console.error("[DEBUG] logs error:", e));
    }
  }, [tab, guildId, tokenReady]);

  useEffect(() => {
    if (!tokenReady) return;
    if (selectedMember) {
      apiFetch<{ logs: BotActionLog[] }>(`/api/logs/${guildId}?targetId=${selectedMember.discordId}`).then((d) => setMemberActions(d.logs));
    }
  }, [selectedMember, guildId, tokenReady]);

  useEffect(() => {
    if (!tokenReady) return;
    if (guild) apiFetch<GuildData>(`/api/guilds/${guildId}`).then((d) => setGuild(d.guild));
  }, [guildId, tokenReady]);

  if (!guild) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord" />
</div>
  );
}

function LogsTab({ logs, members = [] }: { logs: BotActionLog[]; members?: Member[] }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<BotActionLog | null>(null);

  const actionIcons: Record<string, React.ReactNode> = {
    BAN: <Ban className="w-4 h-4 text-red-400" />,
    KICK: <Gavel className="w-4 h-4 text-orange-400" />,
    MUTE: <VolumeX className="w-4 h-4 text-yellow-400" />,
    UNMUTE: <Volume2 className="w-4 h-4 text-green-400" />,
    UNBAN: <Undo2 className="w-4 h-4 text-green-400" />,
    TRUST_ADD: <CheckCircle className="w-4 h-4 text-green-400" />,
    TRUST_REMOVE: <X className="w-4 h-4 text-gray-400" />,
    LOCKDOWN_ON: <Shield className="w-4 h-4 text-red-400" />,
    LOCKDOWN_OFF: <Shield className="w-4 h-4 text-green-400" />,
    QUARANTINE: <AlertTriangle className="w-4 h-4 text-red-400" />,
    CONFIG_CHANGE: <Settings className="w-4 h-4 text-blue-400" />,
    ROLE_REMOVE: <X className="w-4 h-4 text-red-400" />,
  };

  const actionLabels: Record<string, string> = {
    BAN: "Banni",
    KICK: "Exclu",
    MUTE: "Mute",
    UNMUTE: "Mute retiré",
    UNBAN: "Débanni",
    TRUST_ADD: "Marqué fiable",
    TRUST_REMOVE: "Fiable retiré",
    LOCKDOWN_ON: "Lockdown activé",
    LOCKDOWN_OFF: "Lockdown désactivé",
    QUARANTINE: "Mis en quarantaine",
    CONFIG_CHANGE: "Config modifiée",
    ROLE_REMOVE: "Rôle retiré",
  };

  const actionFilters = [
    { key: "BAN", label: "Bans", color: "bg-red-500/20 text-red-400 border-red-500/30" },
    { key: "KICK", label: "Kicks", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    { key: "MUTE", label: "Mutes", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    { key: "UNMUTE", label: "Démutes", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    { key: "UNBAN", label: "Débans", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    { key: "QUARANTINE", label: "Quarantaine", color: "bg-red-500/20 text-red-400 border-red-500/30" },
    { key: "TRUST_ADD", label: "Fiable", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    { key: "CONFIG_CHANGE", label: "Config", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  ];

  const periodOptions = [
    { key: "all", label: "Tout" },
    { key: "today", label: "Aujourd'hui" },
    { key: "week", label: "7 jours" },
    { key: "month", label: "30 jours" },
  ];

  const filteredLogs = logs.filter(log => {
    const searchWithoutAt = search.replace(/^@/, "");
    const searchLower = searchWithoutAt.toLowerCase();
    const matchesSearch = !search || 
      log.reason?.toLowerCase().includes(searchLower) ||
      log.targetName?.toLowerCase().includes(searchLower) ||
      log.targetId?.includes(searchWithoutAt) ||
      log.moderatorName?.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      actionLabels[log.action]?.toLowerCase().includes(searchLower);

    const matchesAction = !actionFilter || log.action === actionFilter;

    let matchesPeriod = true;
    const logDate = new Date(log.createdAt);
    const now = new Date();
    if (periodFilter === "today") {
      matchesPeriod = logDate.toDateString() === now.toDateString();
    } else if (periodFilter === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesPeriod = logDate >= weekAgo;
    } else if (periodFilter === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      matchesPeriod = logDate >= monthAgo;
    }

    return matchesSearch && matchesAction && matchesPeriod;
  });

  const hasFilters = search || actionFilter || periodFilter !== "all";

  if (logs.length === 0) {
    return (
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-8 text-center">
        <ScrollText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">Aucune action enregistrée</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-4 space-y-4">
        <MentionSearch
          users={members}
          value={search}
          onChange={setSearch}
          placeholder="Rechercher dans les logs... (raison, utilisateur, @membre)"
        />

        <div className="flex flex-wrap gap-2">
          {actionFilters.map(filter => (
            <button
              key={filter.key}
              onClick={() => setActionFilter(actionFilter === filter.key ? null : filter.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                actionFilter === filter.key 
                  ? filter.color 
                  : "bg-dark-700 text-gray-400 border-dark-600 hover:bg-dark-600"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <div className="flex gap-1">
            {periodOptions.map(period => (
              <button
                key={period.key}
                onClick={() => setPeriodFilter(period.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  periodFilter === period.key
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-dark-700 text-gray-400 border border-dark-600 hover:bg-dark-600"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              onClick={() => { setSearch(""); setActionFilter(null); setPeriodFilter("all"); }}
              className="ml-auto text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{filteredLogs.length} résultat{filteredLogs.length !== 1 ? "s" : ""}</span>
        {hasFilters && filteredLogs.length === 0 && (
          <span className="text-yellow-500">Aucun résultat pour ces filtres</span>
        )}
      </div>

      <div className="space-y-2">
        {filteredLogs.map((log) => (
          <div 
            key={log.id} 
            onClick={() => setSelectedLog(log)}
            className="bg-dark-800 rounded-lg p-4 border border-dark-700 flex items-center gap-4 hover:border-dark-600 transition cursor-pointer"
          >
            <div className="p-2 bg-dark-700 rounded-lg">
              {actionIcons[log.action] || <Activity className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{actionLabels[log.action] || log.action}</span>
                {log.targetName && (
                  <span className="text-blue-400 text-sm">→ {log.targetName}</span>
                )}
                {log.action === "TRUST_ADD" && log.details?.trustedBy && (
                  <span className="text-green-400 text-xs">par {log.details.trustedBy}</span>
                )}
                {log.action === "TRUST_REMOVE" && log.details?.removedBy && (
                  <span className="text-gray-400 text-xs">par {log.details.removedBy}</span>
                )}
              </div>
              {log.reason && (
                <p className="text-gray-400 text-sm mt-1">📝 {log.reason}</p>
              )}
              {log.details?.roleName && (
                <p className="text-gray-400 text-sm">🎭 Rôle: {log.details.roleName}</p>
              )}
              {log.details?.previousDuration && (
                <p className="text-yellow-400 text-xs">Durée précédente: {log.details.previousDuration}min</p>
              )}
              {log.details?.newDuration && (
                <p className="text-green-400 text-xs">Nouvelle durée: {log.details.newDuration}min</p>
              )}
              {log.details?.lockdownEnabled !== undefined && (
                <p className="text-gray-400 text-xs">
                  {log.details.lockdownEnabled ? "🔒 Serveur verrouillé" : "🔓 Serveur déverrouillé"}
                </p>
              )}
              {log.details?.configKey && (
                <p className="text-blue-400 text-xs">⚙️ {log.details.configKey}: {log.details.configOldValue} → {log.details.configNewValue}</p>
              )}
              {log.action === "UNBAN" && log.details?.previousBanReason && (
                <p className="text-gray-500 text-xs mt-1">
                  <span className="line-through opacity-50">{log.details.previousBanReason}</span>
                </p>
              )}
              {log.moderatorName && (
                <p className="text-gray-500 text-xs mt-1">👤 Modérateur: {log.moderatorName}</p>
              )}
            </div>
            <span className="text-gray-500 text-sm">
              {new Date(log.createdAt).toLocaleString("fr-FR", { 
                day: "numeric", 
                month: "short", 
                hour: "2-digit", 
                minute: "2-digit" 
              })}
            </span>
          </div>
        ))}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setSelectedLog(null)}>
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-lg border border-dark-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                {actionIcons[selectedLog.action] || <Activity className="w-5 h-5" />}
                {actionLabels[selectedLog.action] || selectedLog.action}
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-gray-400 text-sm">Cible:</span>
                <p className="text-white">{selectedLog.targetName || selectedLog.targetId || "Inconnu"}</p>
              </div>
              {selectedLog.moderatorName && (
                <div>
                  <span className="text-gray-400 text-sm">Modérateur:</span>
                  <p className="text-white">{selectedLog.moderatorName}</p>
                </div>
              )}
              {selectedLog.reason && (
                <div>
                  <span className="text-gray-400 text-sm">Raison:</span>
                  <p className="text-white">{selectedLog.reason}</p>
                </div>
              )}
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <span className="text-gray-400 text-sm">Détails:</span>
                  <div className="bg-dark-900 rounded-lg p-3 mt-1 space-y-1">
                    {Object.entries(selectedLog.details).map(([key, value]) => {
                      if (key === "messages" && Array.isArray(value)) {
                        return (
                          <div key={key}>
                            <span className="text-gray-500 text-sm">{key}:</span>
                            <div className="mt-1 space-y-1">
                              {value.map((msg: string, i: number) => (
                                <p key={i} className="text-gray-400 text-xs bg-dark-800 rounded p-1.5 truncate">
                                  {msg}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <p key={key} className="text-gray-300 text-sm">
                          <span className="text-gray-500">{key}:</span> {String(value)}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <span className="text-gray-400 text-sm">Date:</span>
                <p className="text-white">{new Date(selectedLog.createdAt).toLocaleString("fr-FR")}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-gray-400 hover:text-white transition">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="w-14 h-14 rounded-2xl bg-dark-600 flex items-center justify-center text-xl font-bold">
          {guild.name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{guild.name}</h1>
            {guild.lockdownActive && (
              <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-sm font-medium animate-pulse">
                🔒 LOCKDOWN
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">
            {members.length} membres · {guild._count.securityEvents} events · {guild._count.incidents} incidents
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-dark-800 p-1 rounded-xl w-fit border border-dark-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? "bg-discord text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab guild={guild} onRefresh={() => apiFetch<GuildData>(`/api/guilds/${guildId}`).then((d) => setGuild(d.guild))} />}
      {tab === "incidents" && <IncidentsTab incidents={incidents} onSelect={setSelectedIncident} />}
      {tab === "events" && <EventsTab events={events} eventsLoading={eventsLoading} onSelect={setSelectedEvent} />}
      {tab === "members" && (
        <div className="flex gap-4">
          <div className="flex-1">
            <MembersTab 
              members={members} 
              guildId={guildId} 
              onRefresh={() => apiFetch<{ members: Member[] }>(`/api/members/${guildId}?sort=riskScore&order=desc&limit=500`).then((d) => setMembers(d.members))}
              setMembers={setMembers}
              selectedMember={selectedMember}
              onSelectMember={setSelectedMember}
            />
          </div>
          {selectedMember && (
            <div className="w-80">
              <MemberDetail member={selectedMember} onClose={() => setSelectedMember(null)} logs={memberActions} guildId={guildId} onUpdate={(updated) => setSelectedMember(updated)} />
            </div>
          )}
        </div>
      )}
      {tab === "logs" && <LogsTab logs={logs} members={members} />}
      {tab === "config" && <ConfigTab guild={guild} config={guild.config} onUpdate={() => apiFetch<GuildData>(`/api/guilds/${guildId}`).then((d) => setGuild(d.guild))} />}

      {selectedEvent && <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      {selectedIncident && <IncidentModal incident={selectedIncident} onClose={() => setSelectedIncident(null)} />}
    </div>
  );
}

function OverviewTab({ guild, onRefresh }: { guild: GuildData["guild"]; onRefresh: () => void }) {
  const riskColor = guild.riskScore >= 61 ? "red" : guild.riskScore >= 31 ? "yellow" : "green";

  const toggleLockdown = async () => {
    await apiFetch(`/api/guilds/${guild.id}/lockdown`, { method: "POST", body: { active: !guild.lockdownActive } });
    onRefresh();
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Score de risque" value={`${guild.riskScore}/100`} color={riskColor} />
        <StatCard label="Membres" value={guild._count.members} />
        <StatCard label="Incidents" value={guild._count.incidents} color={guild._count.incidents > 0 ? "yellow" : "green"} />
        <StatCard label="Events securite" value={guild._count.securityEvents} />
        <StatCard label="Liens phishing" value={guild._count.detectedLinks} color={guild._count.detectedLinks > 0 ? "red" : "green"} />
        <StatCard label="Secrets detectes" value={guild._count.detectedSecrets} color={guild._count.detectedSecrets > 0 ? "red" : "green"} />
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <p className="text-gray-400 text-xs uppercase mb-1">Lockdown</p>
          <div className="flex items-center justify-between">
            <span className={`font-bold ${guild.lockdownActive ? "text-red-400" : "text-green-400"}`}>
              {guild.lockdownActive ? "ACTIF" : "Inactif"}
            </span>
            <button
              onClick={toggleLockdown}
              className={`px-2 py-1 rounded text-xs font-medium ${guild.lockdownActive ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              {guild.lockdownActive ? "Desactiver" : "Activer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncidentsTab({ incidents, onSelect }: { incidents: Incident[]; onSelect: (i: Incident) => void }) {
  const statusIcon: Record<string, string> = {
    NEW: "🆕",
    IN_PROGRESS: "🔄",
    CONTAINED: "📦",
    RESOLVED: "✅",
    FALSE_POSITIVE: "❌",
  };

  if (incidents.length === 0) {
    return <p className="text-gray-500">Aucun incident.</p>;
  }

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-dark-700 text-gray-400 text-xs uppercase tracking-wider">
          <tr>
            <th className="py-3 px-4">Titre</th>
            <th className="py-3 px-4">Salon</th>
            <th className="py-3 px-4">Severite</th>
            <th className="py-3 px-4">Statut</th>
            <th className="py-3 px-4">Date</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id} className="border-b border-dark-700 hover:bg-dark-700/50 transition cursor-pointer" onClick={() => onSelect(i)}>
              <td className="py-3 px-4 font-medium text-sm">{i.title}</td>
              <td className="py-3 px-4 text-sm text-green-400">{i.channelName ? `#${i.channelName}` : "-"}</td>
              <td className="py-3 px-4"><SeverityBadge severity={i.severity as any} /></td>
              <td className="py-3 px-4 text-sm">{statusIcon[i.status] || ""} {i.status}</td>
              <td className="py-3 px-4 text-sm text-gray-400">{new Date(i.createdAt).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const typeLabels: Record<string, string> = {
    RAID_DETECTED: "Raid detecte",
    SPAM_DETECTED: "Spam detecte",
    PHISHING_LINK: "Lien de phishing",
    SECRET_LEAKED: "Secret fuite",
    PERMISSION_CHANGE: "Changement permission",
    ROLE_ESCALATION: "Escalation de roles",
    MASS_BAN: "Ban de masse",
    MASS_KICK: "Kick de masse",
    CHANNEL_DELETE: "Salon supprime",
    WEBHOOK_CREATED: "Webhook cree",
    CANARY_TRIGGERED: "Canary declenche",
    EMERGENCY_ACTIVATED: "Urgence activee",
    QUARANTINE_APPLIED: "Quarantaine appliquee",
    MODERATOR_ANOMALY: "Anomalie moderateur",
    SUSPICIOUS_JOIN: "Join suspect",
    INVITE_SUSPICIOUS: "Invite suspect",
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-dark-800 rounded-xl p-6 w-full max-w-lg border border-dark-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold">{typeLabels[event.type] || event.type}</h3>
            <p className="text-gray-400 text-sm">{event.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Severite</span>
            <SeverityBadge severity={event.severity as any} />
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Membre</span>
            <span className="text-sm font-medium text-blue-400">{event.actorName || event.actorId || "Inconnu"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Salon</span>
            <span className="text-sm font-medium text-green-400">{event.channelName || event.channelId || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Date</span>
            <span className="text-sm">{new Date(event.createdAt).toLocaleString("fr-FR")}</span>
          </div>
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="mt-4">
              <p className="text-gray-400 text-xs mb-2">DETAILS</p>
              {event.metadata.sanction && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
                  <p className="text-red-400 text-sm font-medium">Sanction: {event.metadata.sanction}</p>
                </div>
              )}
              {event.metadata.messages && event.metadata.messages.length > 0 && (
                <div className="bg-dark-900 rounded-lg p-3 mb-3">
                  <p className="text-gray-400 text-xs mb-2">Messages detectes ({event.metadata.messages.length})</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {event.metadata.messages.map((msg: string, i: number) => (
                      <div key={i} className="text-xs text-gray-300 font-mono border-l-2 border-dark-700 pl-2 py-1">
                        {msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <pre className="bg-dark-900 p-3 rounded text-xs overflow-x-auto text-green-400">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IncidentModal({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const [status, setStatus] = useState(incident.status);
  const [updating, setUpdating] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      await apiFetch(`/api/incidents/${incident.id}`, { method: "PATCH", body: { status: newStatus } });
      setStatus(newStatus);
    } catch (e) {
      console.error(e);
    }
    setUpdating(false);
  };

  const statusLabels: Record<string, string> = {
    NEW: "Nouveau",
    IN_PROGRESS: "En cours",
    CONTAINED: "Contenu",
    RESOLVED: "Résolu",
    FALSE_POSITIVE: "Faux positif",
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-dark-800 rounded-xl p-6 w-full max-w-2xl border border-dark-700 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold">{incident.title}</h3>
            {incident.channelName && <p className="text-gray-400 text-sm">Salon: #{incident.channelName}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Severite</span>
            <SeverityBadge severity={incident.severity as any} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Statut</span>
            <select
              value={status}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={updating}
              className="bg-dark-900 border border-dark-700 rounded px-3 py-1 text-sm"
            >
              <option value="NEW">Nouveau</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="CONTAINED">Contenu</option>
              <option value="RESOLVED">Résolu</option>
              <option value="FALSE_POSITIVE">Faux positif</option>
            </select>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Evenements</span>
            <span>{incident._count.events}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Actions</span>
            <span>{incident._count.actions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Cree le</span>
            <span className="text-sm">{new Date(incident.createdAt).toLocaleString("fr-FR")}</span>
          </div>
          {incident.description && (
            <div className="mt-4">
              <p className="text-gray-400 text-xs mb-2">DESCRIPTION</p>
              <p className="text-sm bg-dark-900 p-3 rounded">{incident.description}</p>
            </div>
          )}
          {incident.events && incident.events.length > 0 && (
            <div className="mt-4">
              <p className="text-gray-400 text-xs mb-2">DERNIERS EVENEMENTS</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {incident.events.slice(0, 5).map((e: any) => (
                  <div key={e.id} className="bg-dark-900 p-2 rounded text-xs">
                    <span className="font-medium">{e.type?.replace(/_/g, " ")}</span>
                    <span className="text-gray-400 ml-2">{e.actorName || e.actorId}</span>
                    <span className="text-gray-500 ml-2">{new Date(e.createdAt).toLocaleTimeString("fr-FR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventsTab({ events, eventsLoading, onSelect }: { events: Event[]; eventsLoading?: boolean; onSelect: (e: Event) => void }) {
  const typeEmoji: Record<string, string> = {
    RAID_DETECTED: "🚨",
    SPAM_DETECTED: "📢",
    PHISHING_LINK: "🔗",
    SECRET_LEAKED: "🔐",
    PERMISSION_CHANGE: "🔑",
    ROLE_ESCALATION: "⬆️",
    MASS_BAN: "🔨",
    MASS_KICK: "👢",
    CHANNEL_DELETE: "🗑️",
    WEBHOOK_CREATED: "🪝",
    CANARY_TRIGGERED: "🍯",
    EMERGENCY_ACTIVATED: "🆘",
    QUARANTINE_APPLIED: "🔒",
    MODERATOR_ANOMALY: "⚠️",
    SUSPICIOUS_JOIN: "👤",
    INVITE_SUSPICIOUS: "📨",
  };

  if (eventsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-discord border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-gray-400">Chargement des événements...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-gray-500">Aucun event de securite.</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((e) => (
        <div
          key={e.id}
          onClick={() => onSelect(e)}
          className="bg-dark-800 rounded-lg p-4 border border-dark-700 flex items-start gap-4 cursor-pointer hover:border-discord transition"
        >
          <span className="text-xl">{typeEmoji[e.type] || "📋"}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{e.type.replace(/_/g, " ")}</span>
              {e.actorName && <span className="text-xs text-blue-400">@{e.actorName.split('#')[0]}</span>}
              <SeverityBadge severity={e.severity as any} />
            </div>
            <p className="text-gray-400 text-sm">{e.description}</p>
            {e.metadata?.messages?.length > 0 && (
              <p className="text-xs text-yellow-500 mt-1">{e.metadata.messages.length} message(s) detecte(s)</p>
            )}
            {e.metadata?.sanction && (
              <p className="text-xs text-red-400 mt-1">Sanction: {e.metadata.sanction}</p>
            )}
            {e.channelName && <p className="text-xs text-green-500 mt-1">📍 #{e.channelName}</p>}
          </div>
          <span className="text-gray-500 text-xs">{new Date(e.createdAt).toLocaleString("fr-FR")}</span>
        </div>
      ))}
    </div>
  );
}

function MembersTab({ members, guildId, onRefresh, setMembers, selectedMember, onSelectMember }: { members: Member[]; guildId: string; onRefresh: () => void; setMembers?: (update: Member[] | ((prev: Member[]) => Member[])) => void; selectedMember?: Member | null; onSelectMember?: (m: Member | null) => void }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [muteModal, setMuteModal] = useState<Member | null>(null);
  const [muteForm, setMuteForm] = useState({ duration: 5, reason: "", sendDm: true });
  const [banModal, setBanModal] = useState<Member | null>(null);
  const [banForm, setBanForm] = useState({ reason: "", sendDm: true });
  const [kickModal, setKickModal] = useState<Member | null>(null);
  const [kickForm, setKickForm] = useState({ reason: "", sendDm: true });
  const [searchQuery, setSearchQuery] = useState("");
  const [showBannedOnly, setShowBannedOnly] = useState(false);
  const [showBanHistory, setShowBanHistory] = useState(false);
  const [bannedHistory, setBannedHistory] = useState<{ discordId: string; username: string; reason?: string; bannedAt: string; unbannedAt?: string; unbannedBy?: string }[]>([]);
  const [bannedMembers, setBannedMembers] = useState<Member[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "banned" | "unbanned">("all");
  const [historyDateFilter, setHistoryDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [bannedSearch, setBannedSearch] = useState("");
  const [filterRoles, setFilterRoles] = useState<{ id: string; name: string; color: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string; color: string }[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const loadMembers = () => {
    apiFetch<{ members: Member[] }>(`/api/members/${guildId}?sort=riskScore&order=desc&limit=500`).then((d) => {
      if (setMembers) setMembers(d.members);
    });
    apiFetch<{ members: Member[] }>(`/api/members/${guildId}?sort=riskScore&order=desc&limit=500&quarantined=true`).then((d) => {
      setBannedMembers(d.members);
    });
    apiFetch<{ history: any[] }>(`/api/logs/${guildId}/ban-history`).then((d) => {
      const formatted = d.history.map((h: any) => ({
        discordId: h.targetId || "",
        username: h.targetName || h.targetId || "Inconnu",
        reason: h.reason,
        bannedAt: h.action === "BAN" ? h.createdAt : undefined,
        unbannedAt: h.action === "UNBAN" ? h.createdAt : undefined,
        unbannedBy: h.moderatorName,
      }));
      setBannedHistory(formatted);
    });
  };

  useEffect(() => {
    loadMembers();
    const interval = setInterval(() => loadMembers(), 10000);
    return () => clearInterval(interval);
  }, [guildId]);

  // Recharger les membres quand on change les filtres de rôles pour avoir les derniers roleIds
  useEffect(() => {
    const timer = setTimeout(() => {
      loadMembers();
    }, 100);
    return () => clearTimeout(timer);
  }, [filterRoles.length]);

  useEffect(() => {
    apiFetch<{ roles: any[] }>(`/api/guilds/${guildId}/roles`).then(d => {
      if (d.roles) {
        setRoles(d.roles.map((r: any) => ({ id: r.id, name: r.name, color: r.color || "#99aab5" })));
      }
    }).catch(() => {});
  }, [guildId]);

  const filteredRoles = roles.filter(r => 
    !filterRoles.some(fr => fr.id === r.id) && 
    r.name.toLowerCase().includes(roleInput.replace("@", "").toLowerCase())
  );

  const addRole = (role: { id: string; name: string; color: string }) => {
    setFilterRoles([...filterRoles, role]);
    setRoleInput("");
    setShowRoleDropdown(false);
  };

  const removeRole = (roleId: string) => {
    setFilterRoles(filterRoles.filter(r => r.id !== roleId));
  };

  const displayMembers = showBannedOnly ? bannedMembers : members;
  const searchTerm = showBannedOnly ? bannedSearch : searchQuery;
  const isBannedView = showBannedOnly;
  
  const filteredMembers = displayMembers.filter(m => {
    const matchesSearch = !searchTerm || m.username.toLowerCase().includes(searchTerm.toLowerCase());
    const memberRoleIds = m.roleIds || [];
    
    // AND: le membre doit avoir TOUS les rôles sélectionnés (pas appliqué aux bannis)
    const matchesRoles = showBannedOnly || filterRoles.length === 0 || filterRoles.every(r => memberRoleIds.includes(r.id));
    
    return matchesSearch && matchesRoles;
  });

  const doAction = async (discordId: string, action: "ban" | "kick" | "timeout" | "unban" | "unmute" | "trust", data?: any) => {
    setActionLoading(discordId + action);
    setActionResult(null);
    
    if ((action === "kick" || action === "unban") && setMembers) {
      setMembers(prev => prev.filter(m => m.discordId !== discordId));
    }
    
    if (action === "ban") {
      const member = members.find(m => m.discordId === discordId);
      setBannedHistory(prev => [{
        discordId,
        username: member?.username || discordId,
        reason: data?.reason || "Banni depuis le dashboard",
        bannedAt: new Date().toISOString()
      }, ...prev]);
      apiFetch(`/api/logs/${guildId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "BAN",
          targetId: discordId,
          targetName: member?.username || discordId,
          reason: data?.reason || "Banni depuis le dashboard",
        }),
      });
    }
    
    if (action === "unban") {
      const member = members.find(m => m.discordId === discordId);
      setBannedHistory(prev => prev.map(h => 
        h.discordId === discordId 
          ? { ...h, unbannedAt: new Date().toISOString(), unbannedBy: h.username }
          : h
      ));
      apiFetch(`/api/logs/${guildId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "UNBAN",
          targetId: discordId,
          targetName: member?.username || discordId,
        }),
      });
    }
    
    try {
      let endpoint = "";
      let body = {};
      
      if (action === "trust") {
        endpoint = `/api/guilds/${guildId}/members/${discordId}/trust`;
        body = { trusted: data.trusted };
      } else if (action === "timeout") {
        endpoint = `/api/guilds/${guildId}/members/${discordId}/timeout`;
        body = { duration: data.duration, reason: data.reason, sendDm: data.sendDm };
      } else if (action === "unmute") {
        endpoint = `/api/guilds/${guildId}/members/${discordId}/unmute`;
        body = { sendDm: data?.sendDm ?? true };
      } else if (action === "ban") {
        endpoint = `/api/guilds/${guildId}/members/${discordId}/ban`;
        body = { reason: data.reason, sendDm: data.sendDm };
      } else if (action === "kick") {
        endpoint = `/api/guilds/${guildId}/members/${discordId}/kick`;
        body = { reason: data.reason, sendDm: data.sendDm };
      } else if (action === "unban") {
        endpoint = `/api/guilds/${guildId}/members/${discordId}/unban`;
      } else {
        endpoint = `/api/guilds/${guildId}/members/${discordId}/${action}`;
      }
      
      const res = await apiFetch(endpoint, { method: "POST", body });
      const actionMessages: Record<string, string> = {
        ban: "Membre banni",
        kick: "Membre exclu",
        timeout: "Membre muted",
        unban: "Membre débanni",
        unmute: "Mute retiré",
        trust: "Statut fiable modifié"
      };
      const message = actionMessages[action] || "Action réussie";
      setActionResult({ id: discordId, success: true, message });
      
      loadMembers();
    } catch (e: any) {
      console.error(e);
      setActionResult({ id: discordId, success: false, message: e.message || "Erreur" });
    }
    setActionLoading(null);
    setTimeout(() => setActionResult(null), 3000);
  };

  const handleMute = () => {
    if (!muteModal) return;
    doAction(muteModal.discordId, "timeout", muteForm);
    setMuteModal(null);
    setMuteForm({ duration: 5, reason: "", sendDm: true });
  };

  const handleBan = () => {
    if (!banModal) return;
    doAction(banModal.discordId, "ban", banForm);
    setBanModal(null);
    setBanForm({ reason: "", sendDm: true });
  };

  const handleKick = () => {
    if (!kickModal) return;
    doAction(kickModal.discordId, "kick", kickForm);
    setKickModal(null);
    setKickForm({ reason: "", sendDm: true });
  };

  if (members.length === 0) {
    return <p className="text-gray-500">Aucun membre.</p>;
  }

  return (
      <>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            {showBannedOnly ? (
              <>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                <input
                  type="text"
                  placeholder="Rechercher dans les bannis..."
                  value={bannedSearch}
                  onChange={(e) => setBannedSearch(e.target.value)}
                  className="w-full bg-theme-tertiary border border-theme-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:border-discord transition-colors"
                />
              </>
            ) : (
              <MentionSearch
                users={members}
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Rechercher un membre (ou @)..."
              />
            )}
          </div>
          <button
          onClick={() => { setShowBannedOnly(!showBannedOnly); setShowBanHistory(false); }}
          className={`px-3 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${showBannedOnly ? "bg-red-600 text-white" : "bg-dark-800 border border-dark-700 text-gray-400 hover:text-white"}`}
        >
          {showBannedOnly ? "✓ Bannis" : "Bannis"}
        </button>
        <button
          onClick={() => { setShowBanHistory(!showBanHistory); setShowBannedOnly(false); }}
          className={`px-3 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap flex items-center gap-1.5 ${showBanHistory ? "bg-purple-600 text-white" : "bg-dark-800 border border-dark-700 text-gray-400 hover:text-white"}`}
        >
          <History className="w-4 h-4" />
          {showBanHistory ? "✓ Historique" : "Historique"}
        </button>
        {roles.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {filterRoles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: `${role.color}20`, color: role.color }}
              >
                @{role.name}
                <button
                  onClick={() => removeRole(role.id)}
                  className="hover:bg-white/20 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="relative">
              <input
                type="text"
                value={roleInput}
                onChange={(e) => {
                  if (e.target.value.includes("@")) {
                    setRoleInput(e.target.value);
                    setShowRoleDropdown(true);
                  } else if (e.target.value === "") {
                    setRoleInput("");
                    setShowRoleDropdown(false);
                  }
                }}
                onFocus={() => setShowRoleDropdown(true)}
                onBlur={() => setTimeout(() => setShowRoleDropdown(false), 200)}
                placeholder="@Ajouter"
                className="w-32 bg-dark-800 border border-dark-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-discord"
              />
              {showRoleDropdown && roleInput.includes("@") && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                  {filteredRoles.length === 0 ? (
                    <p className="text-gray-500 text-sm p-2">Aucun rôle trouvé</p>
                  ) : (
                    filteredRoles.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => addRole(role)}
                        className="w-full text-left px-3 py-2 hover:bg-dark-700 flex items-center gap-2"
                      >
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: role.color }}
                        />
                        <span className="text-white text-sm">@{role.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <span className="text-gray-500 text-sm py-2 flex items-center gap-2">
          {filteredMembers.length} membre{filteredMembers.length !== 1 ? "s" : ""}
          {filterRoles.length > 0 && <span className="text-discord">• {displayMembers.length} total</span>}
          {!showBannedOnly && bannedMembers.length > 0 && (
            <span className="text-red-400">• {bannedMembers.length} banni(s)</span>
          )}
        </span>
      </div>

      {showBanHistory && (
        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden mb-4">
          <div className="p-4 border-b border-dark-700 space-y-3">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-medium text-purple-400">Historique des bannissements</h3>
              <span className="text-gray-500 text-xs">{bannedHistory.length} entrée(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Rechercher par pseudo ou raison..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg pl-10 pr-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <select
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value as any)}
                className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
              >
                <option value="all">Tous</option>
                <option value="banned">Bannis</option>
                <option value="unbanned">Débannis</option>
              </select>
              <select
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value as any)}
                className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
              >
                <option value="all">Toute la période</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">7 jours</option>
                <option value="month">30 jours</option>
              </select>
            </div>
          </div>
          {bannedHistory.length === 0 ? (
            <p className="text-gray-500 p-4 text-sm">Aucun historique de ban</p>
          ) : (
            <div className="divide-y divide-dark-700 max-h-96 overflow-y-auto">
              {bannedHistory.filter(h => {
                const matchesSearch = !historySearch || h.username.toLowerCase().includes(historySearch.toLowerCase()) || h.reason?.toLowerCase().includes(historySearch.toLowerCase());
                const matchesStatus = historyFilter === "all" || (historyFilter === "banned" && !h.unbannedAt) || (historyFilter === "unbanned" && h.unbannedAt);
                const hDate = new Date(h.bannedAt);
                const now = new Date();
                let matchesDate = true;
                if (historyDateFilter === "today") matchesDate = hDate.toDateString() === now.toDateString();
                else if (historyDateFilter === "week") matchesDate = hDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                else if (historyDateFilter === "month") matchesDate = hDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                return matchesSearch && matchesStatus && matchesDate;
              }).map((h, idx) => (
                <div key={h.discordId + idx} className="p-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-medium">
                    {h.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{h.username}</span>
                      {h.unbannedAt && (
                        <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">Débanni</span>
                      )}
                      {!h.unbannedAt && (
                        <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">Banni</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs">Raison: {h.reason}</p>
                    <p className="text-gray-500 text-xs">
                      Banni le {new Date(h.bannedAt).toLocaleString("fr-FR")}
                      {h.unbannedAt && ` • Débanni le ${new Date(h.unbannedAt).toLocaleString("fr-FR")}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!showBanHistory && <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-dark-700 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Membre</th>
              <th className="py-3 px-4">Risque</th>
              <th className="py-3 px-4">Msgs</th>
              <th className="py-3 px-4">Mute</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m) => {
              const riskColor =
                m.riskScore >= 81 ? "text-red-400" : m.riskScore >= 61 ? "text-orange-400" : m.riskScore >= 31 ? "text-yellow-400" : "text-green-400";
              const loading = actionLoading === m.discordId + "ban" || actionLoading === m.discordId + "kick" || actionLoading === m.discordId + "timeout" || actionLoading === m.discordId + "unmute" || actionLoading === m.discordId + "unban" || actionLoading === m.discordId + "trust";
              const result = actionResult?.id === m.discordId;
              const isMuted = m.timedOutUntil && new Date(m.timedOutUntil) > new Date();

              return (
                <tr 
                  key={m.id} 
                  className={`border-b border-dark-700 hover:bg-dark-700/50 transition cursor-pointer ${selectedMember?.discordId === m.discordId ? "bg-dark-700/50" : ""}`}
                  onClick={() => onSelectMember?.(m)}
                >
                  <td className="py-3 px-4 text-sm font-medium">{m.username}</td>
                  <td className="py-3 px-4">
                    <span className={`font-bold text-sm ${riskColor}`}>{m.riskScore}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-400">{m.messageCount}</td>
                  <td className="py-3 px-4 text-sm text-gray-400">{m.warnCount}</td>
                  <td className="py-3 px-4">
                    {isMuted && (() => {
                      const remaining = new Date(m.timedOutUntil!).getTime() - Date.now();
                      const minutes = Math.floor(remaining / 60000);
                      const hours = Math.floor(minutes / 60);
                      const days = Math.floor(hours / 24);
                      const duration = days > 0 ? `${days}j ${hours % 24}h` : hours > 0 ? `${hours}h ${minutes % 60}min` : `${minutes}min`;
                      return (
                        <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-xs mr-1">
                          Mute {duration}
                        </span>
                      );
                    })()}
                    {m.quarantined && <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs mr-1">Banni</span>}
                    {m.trusted && <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs">Fiable</span>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {result && (
                        <span className={`text-xs px-2 py-1 rounded ${actionResult?.success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {actionResult?.message}
                        </span>
                      )}
                      {!result && (
                        <div className="flex gap-1">
                          {isMuted ? (
                            <button
                              onClick={() => doAction(m.discordId, "unmute", { sendDm: true })}
                              disabled={loading || isBannedView}
                              className={`group relative p-2 rounded-lg text-xs transition-all ${isBannedView ? "bg-dark-700 text-gray-600 cursor-not-allowed" : "bg-green-600/80 hover:bg-green-600 hover:scale-105"}`}
                              title="Retirer le mute"
                            >
                              {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                                Retirer mute
                              </span>
                            </button>
                          ) : (
                            <button
                              onClick={() => { setMuteModal(m); setMuteForm({ duration: 5, reason: "", sendDm: true }); }}
                              disabled={loading || isBannedView}
                              className={`group relative p-2 rounded-lg text-xs transition-all ${isBannedView ? "bg-dark-700 text-gray-600 cursor-not-allowed" : "bg-yellow-600/80 hover:bg-yellow-600 hover:scale-105"}`}
                              title="Mute"
                            >
                              {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <VolumeX className="w-4 h-4" />
                              )}
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                                Mute
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => { setKickModal(m); setKickForm({ reason: "", sendDm: true }); }}
                            disabled={loading || isBannedView}
                            className={`group relative p-2 rounded-lg text-xs transition-all ${isBannedView ? "bg-dark-700 text-gray-600 cursor-not-allowed" : "bg-orange-600/80 hover:bg-orange-600 hover:scale-105"}`}
                            title="Exclure"
                          >
                            {loading ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Gavel className="w-4 h-4" />
                            )}
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                              Exclure
                            </span>
                          </button>
                          {m.quarantined ? (
                            <button
                              onClick={() => doAction(m.discordId, "unban")}
                              disabled={loading}
                              className="group relative p-2 bg-green-600/80 hover:bg-green-600 rounded-lg text-xs transition-all hover:scale-105"
                              title="Débannir"
                            >
                              {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <Undo2 className="w-4 h-4" />
                              )}
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                                Débannir
                              </span>
                            </button>
                          ) : (
                            <button
                              onClick={() => { setBanModal(m); setBanForm({ reason: "", sendDm: true }); }}
                              disabled={loading}
                              className="group relative p-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-xs transition-all hover:scale-105"
                              title="Bannir"
                            >
                              {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <Ban className="w-4 h-4" />
                              )}
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                                Bannir
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => doAction(m.discordId, "trust", { trusted: !m.trusted })}
                            disabled={loading || isBannedView}
                            className={`group relative p-2 rounded-lg text-xs transition-all ${isBannedView ? "bg-dark-700 text-gray-600 cursor-not-allowed" : m.trusted ? "bg-green-600 hover:bg-green-500 hover:scale-105" : "bg-gray-600 hover:bg-gray-500 hover:scale-105"}`}
                            title={m.trusted ? "Retirer fiable" : "Marquer fiable"}
                          >
                            {loading ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                              {m.trusted ? "Retirer fiable" : "Marquer fiable"}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      }

      {muteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setMuteModal(null)}>
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Mute {muteModal.username}</h3>
              <button onClick={() => setMuteModal(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Durée (minutes)</label>
                <select
                  value={muteForm.duration}
                  onChange={(e) => setMuteForm({ ...muteForm, duration: parseInt(e.target.value) })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2"
                >
                  <option value="1">1 minute</option>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 heure</option>
                  <option value="1440">24 heures</option>
                  <option value="10080">7 jours</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Raison</label>
                <input
                  type="text"
                  value={muteForm.reason}
                  onChange={(e) => setMuteForm({ ...muteForm, reason: e.target.value })}
                  placeholder="Reason..."
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendDm"
                  checked={muteForm.sendDm}
                  onChange={(e) => setMuteForm({ ...muteForm, sendDm: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="sendDm" className="text-sm">Envoyer un message privé</label>
              </div>
              <button
                onClick={handleMute}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                Confirmer le mute
              </button>
            </div>
          </div>
        </div>
      )}

      {banModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setBanModal(null)}>
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-red-400">Bannir {banModal.username}</h3>
              <button onClick={() => setBanModal(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Raison</label>
                <input
                  type="text"
                  value={banForm.reason}
                  onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })}
                  placeholder="Raison du bannissement..."
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="banSendDm"
                  checked={banForm.sendDm}
                  onChange={(e) => setBanForm({ ...banForm, sendDm: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="banSendDm" className="text-sm">Envoyer un message privé</label>
              </div>
              <button
                onClick={handleBan}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                Confirmer le bannissement
              </button>
            </div>
          </div>
        </div>
      )}

      {kickModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setKickModal(null)}>
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-orange-400">Exclure {kickModal.username}</h3>
              <button onClick={() => setKickModal(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Raison</label>
                <input
                  type="text"
                  value={kickForm.reason}
                  onChange={(e) => setKickForm({ ...kickForm, reason: e.target.value })}
                  placeholder="Raison de l'exclusion..."
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="kickSendDm"
                  checked={kickForm.sendDm}
                  onChange={(e) => setKickForm({ ...kickForm, sendDm: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="kickSendDm" className="text-sm">Envoyer un message privé</label>
              </div>
              <button
                onClick={handleKick}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                Confirmer l'exclusion
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConfigTab({ guild, config, onUpdate }: { guild: GuildData["guild"]; config: any; onUpdate: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);

  const toggleConfig = async (key: string, value: boolean) => {
    setLoading(key);
    await apiFetch(`/api/config/${guild.id}`, {
      method: "PATCH",
      body: { [key]: value },
    });
    onUpdate();
    setLoading(null);
  };

  const updateValue = async (key: string, value: number) => {
    await apiFetch(`/api/config/${guild.id}`, {
      method: "PATCH",
      body: { [key]: value },
    });
    onUpdate();
  };

  if (!config) return <p className="text-gray-500">Aucune configuration.</p>;

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
        <h3 className="font-semibold mb-4">🛡️ Anti-Raid</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Seuil de joins</span>
            <input
              type="number"
              value={config.raidJoinThreshold}
              onChange={(e) => updateValue("raidJoinThreshold", parseInt(e.target.value))}
              className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-20 text-right"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Fenetre (secondes)</span>
            <input
              type="number"
              value={config.raidJoinWindow}
              onChange={(e) => updateValue("raidJoinWindow", parseInt(e.target.value))}
              className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-20 text-right"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Auto-lockdown</span>
            <button
              onClick={() => toggleConfig("raidAutoLockdown", !config.raidAutoLockdown)}
              disabled={loading === "raidAutoLockdown"}
              className={`w-12 h-6 rounded-full transition ${config.raidAutoLockdown ? "bg-green-500" : "bg-dark-600"}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition ${config.raidAutoLockdown ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Age min compte (jours)</span>
            <input
              type="number"
              value={config.raidMinAccountAge}
              onChange={(e) => updateValue("raidMinAccountAge", parseInt(e.target.value))}
              className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-20 text-right"
            />
          </div>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
        <h3 className="font-semibold mb-4">📢 Anti-Spam</h3>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-2">Détection de flood (messages rapides)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex justify-between items-center bg-dark-900/50 rounded-lg p-3">
                <span className="text-gray-400 text-sm">Max messages / 1s</span>
                <input
                  type="number"
                  value={config.spamMaxMessages}
                  onChange={(e) => updateValue("spamMaxMessages", parseInt(e.target.value))}
                  className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-16 text-right text-sm"
                />
              </div>
              <div className="flex justify-between items-center bg-dark-900/50 rounded-lg p-3">
                <span className="text-gray-400 text-sm">Max messages / 10s</span>
                <input
                  type="number"
                  value={config.spamMaxMessages10s || 8}
                  onChange={(e) => updateValue("spamMaxMessages10s", parseInt(e.target.value))}
                  className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-16 text-right text-sm"
                />
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">Détection de répétition</p>
            <div className="flex justify-between items-center bg-dark-900/50 rounded-lg p-3">
              <span className="text-gray-400 text-sm">Messages identiques avant sanction</span>
              <input
                type="number"
                value={config.spamRepeatThreshold || 3}
                onChange={(e) => updateValue("spamRepeatThreshold", parseInt(e.target.value))}
                className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-16 text-right text-sm"
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">Détection de mentions</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex justify-between items-center bg-dark-900/50 rounded-lg p-3">
                <span className="text-gray-400 text-sm">Max mentions / message</span>
                <input
                  type="number"
                  value={config.spamMaxMentions}
                  onChange={(e) => updateValue("spamMaxMentions", parseInt(e.target.value))}
                  className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-16 text-right text-sm"
                />
              </div>
              <div className="flex justify-between items-center bg-dark-900/50 rounded-lg p-3">
                <span className="text-gray-400 text-sm">Max mentions / 10s</span>
                <input
                  type="number"
                  value={config.spamMaxMentions10s || 5}
                  onChange={(e) => updateValue("spamMaxMentions10s", parseInt(e.target.value))}
                  className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-16 text-right text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
        <h3 className="font-semibold mb-4">⚖️ Sanctions</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-dark-900/50 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">Durée du mute anti-spam</p>
              <p className="text-xs text-gray-500">Durée automatique quand le bot mute pour spam</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.spamMuteDuration || 5}
                onChange={(e) => updateValue("spamMuteDuration", parseInt(e.target.value))}
                className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-16 text-right text-sm"
              />
              <span className="text-gray-400 text-sm">min</span>
            </div>
          </div>
          <div className="flex justify-between items-center bg-dark-900/50 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">Suppression des messages</p>
              <p className="text-xs text-gray-500">Supprimer les messages du spammeur automatiquement</p>
            </div>
            <button
              onClick={() => toggleConfig("spamAutoDelete", config.spamAutoDelete !== false)}
              disabled={loading === "spamAutoDelete"}
              className={`w-12 h-6 rounded-full transition ${config.spamAutoDelete !== false ? "bg-green-500" : "bg-dark-600"}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition ${config.spamAutoDelete !== false ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
        <h3 className="font-semibold mb-4">🔗 Anti-Phishing</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Active</span>
            <button
              onClick={() => toggleConfig("phishingEnabled", !config.phishingEnabled)}
              disabled={loading === "phishingEnabled"}
              className={`w-12 h-6 rounded-full transition ${config.phishingEnabled ? "bg-green-500" : "bg-dark-600"}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition ${config.phishingEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
        <h3 className="font-semibold mb-4">🔐 Secret Scanner</h3>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Scan active</span>
          <button
            onClick={() => toggleConfig("secretScanEnabled", !config.secretScanEnabled)}
            disabled={loading === "secretScanEnabled"}
            className={`w-12 h-6 rounded-full transition ${config.secretScanEnabled ? "bg-green-500" : "bg-dark-600"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition ${config.secretScanEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
        <h3 className="font-semibold mb-4">🔒 Quarantaine</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Active</span>
            <button
              onClick={() => toggleConfig("quarantineEnabled", !config.quarantineEnabled)}
              disabled={loading === "quarantineEnabled"}
              className={`w-12 h-6 rounded-full transition ${config.quarantineEnabled ? "bg-green-500" : "bg-dark-600"}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition ${config.quarantineEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
        <h3 className="font-semibold mb-4">🤖 Scan Bots</h3>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Scanner les bots</span>
          <button
            onClick={() => toggleConfig("scanBots", !config.scanBots)}
            disabled={loading === "scanBots"}
            className={`w-12 h-6 rounded-full transition ${config.scanBots ? "bg-green-500" : "bg-dark-600"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition ${config.scanBots ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>
    </div>
  );
}