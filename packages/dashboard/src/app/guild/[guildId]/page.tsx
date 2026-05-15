"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, AlertTriangle, Users, Activity, Settings, X, Ban, Gavel, VolumeX, Volume2, CheckCircle, AlertCircle, Undo2, MessageSquare, ScrollText } from "lucide-react";
import { apiFetch } from "@/lib/api";
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
type Member = { id: string; discordId: string; username: string; riskScore: number; quarantined: boolean; trusted: boolean; messageCount: number; warnCount: number; timedOutUntil?: string | null };
type BotActionLog = { id: string; action: string; targetId?: string; targetName?: string; moderatorId?: string; moderatorName?: string; reason?: string; details?: any; createdAt: string };

type Tab = "overview" | "incidents" | "events" | "members" | "logs" | "config";

export default function GuildPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [guild, setGuild] = useState<GuildData["guild"] | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [logs, setLogs] = useState<BotActionLog[]>([]);

  useEffect(() => {
    apiFetch<GuildData>(`/api/guilds/${guildId}`).then((d) => setGuild(d.guild));
  }, [guildId]);

  useEffect(() => {
    if (tab === "incidents") {
      apiFetch<{ incidents: Incident[] }>(`/api/incidents/${guildId}`).then((d) => setIncidents(d.incidents));
    }
    if (tab === "events") {
      apiFetch<{ events: Event[] }>(`/api/events/${guildId}`).then((d) => setEvents(d.events));
    }
    if (tab === "members") {
      apiFetch<{ members: Member[] }>(`/api/members/${guildId}?sort=riskScore&order=desc`).then((d) => setMembers(d.members));
    }
    if (tab === "logs") {
      apiFetch<{ logs: BotActionLog[] }>(`/api/logs/${guildId}`).then((d) => setLogs(d.logs));
    }
  }, [tab, guildId]);

  useEffect(() => {
    if (guild) apiFetch<GuildData>(`/api/guilds/${guildId}`).then((d) => setGuild(d.guild));
  }, [guildId]);

  if (!guild) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord" />
</div>
  );
}

function LogsTab({ logs }: { logs: BotActionLog[] }) {
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
  };

  if (logs.length === 0) {
    return (
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-8 text-center">
        <ScrollText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">Aucune action enregistrée</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="bg-dark-800 rounded-lg p-4 border border-dark-700 flex items-center gap-4 hover:border-dark-600 transition">
          <div className="p-2 bg-dark-700 rounded-lg">
            {actionIcons[log.action] || <Activity className="w-4 h-4" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{actionLabels[log.action] || log.action}</span>
              {log.targetName && (
                <span className="text-blue-400 text-sm">{log.targetName}</span>
              )}
            </div>
            {log.reason && (
              <p className="text-gray-400 text-sm">📝 {log.reason}</p>
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
  );
}

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Vue d'ensemble", icon: <Shield className="w-4 h-4" /> },
    { key: "incidents", label: "Incidents", icon: <AlertTriangle className="w-4 h-4" /> },
    { key: "events", label: "Events", icon: <Activity className="w-4 h-4" /> },
    { key: "members", label: "Membres", icon: <Users className="w-4 h-4" /> },
    { key: "logs", label: "Logs", icon: <ScrollText className="w-4 h-4" /> },
    { key: "config", label: "Config", icon: <Settings className="w-4 h-4" /> },
  ];

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
            {guild._count.members} membres · {guild._count.securityEvents} events · {guild._count.incidents} incidents
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
      {tab === "events" && <EventsTab events={events} onSelect={setSelectedEvent} />}
      {tab === "members" && <MembersTab members={members} guildId={guildId} onRefresh={() => apiFetch<{ members: Member[] }>(`/api/members/${guildId}?sort=riskScore&order=desc`).then((d) => setMembers(d.members))} />}
      {tab === "logs" && <LogsTab logs={logs} />}
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
              <p className="text-gray-400 text-xs mb-2">METADATA</p>
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

function EventsTab({ events, onSelect }: { events: Event[]; onSelect: (e: Event) => void }) {
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
            {e.channelName && <p className="text-xs text-green-500 mt-1">📍 #{e.channelName}</p>}
          </div>
          <span className="text-gray-500 text-xs">{new Date(e.createdAt).toLocaleString("fr-FR")}</span>
        </div>
      ))}
    </div>
  );
}

function MembersTab({ members, guildId, onRefresh }: { members: Member[]; guildId: string; onRefresh: () => void }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [muteModal, setMuteModal] = useState<Member | null>(null);
  const [muteForm, setMuteForm] = useState({ duration: 5, reason: "", sendDm: true });

  const doAction = async (discordId: string, action: "ban" | "kick" | "timeout" | "unban" | "unmute" | "trust", data?: any) => {
    setActionLoading(discordId + action);
    setActionResult(null);
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
      } else if (action === "unban") {
        endpoint = `/api/guilds/${guildId}/members/${discordId}/unban`;
      } else {
        endpoint = `/api/guilds/${guildId}/members/${discordId}/${action}`;
      }
      
      const res = await apiFetch(endpoint, { method: "POST", body });
      setActionResult({ id: discordId, success: true, message: res.message || "Action réussie" });
      
      if (action === "kick") {
        setMembers(prev => prev.filter(m => m.discordId !== discordId));
      } else {
        onRefresh();
      }
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

  if (members.length === 0) {
    return <p className="text-gray-500">Aucun membre.</p>;
  }

  return (
    <>
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-dark-700 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Membre</th>
              <th className="py-3 px-4">Risque</th>
              <th className="py-3 px-4">Msgs</th>
              <th className="py-3 px-4">Warns</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const riskColor =
                m.riskScore >= 81 ? "text-red-400" : m.riskScore >= 61 ? "text-orange-400" : m.riskScore >= 31 ? "text-yellow-400" : "text-green-400";
              const loading = actionLoading === m.discordId + "ban" || actionLoading === m.discordId + "kick" || actionLoading === m.discordId + "timeout" || actionLoading === m.discordId + "unmute" || actionLoading === m.discordId + "unban" || actionLoading === m.discordId + "trust";
              const result = actionResult?.id === m.discordId;
              const isMuted = m.timedOutUntil && new Date(m.timedOutUntil) > new Date();

              return (
                <tr key={m.id} className="border-b border-dark-700 hover:bg-dark-700/50 transition">
                  <td className="py-3 px-4 text-sm font-medium">{m.username}</td>
                  <td className="py-3 px-4">
                    <span className={`font-bold text-sm ${riskColor}`}>{m.riskScore}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-400">{m.messageCount}</td>
                  <td className="py-3 px-4 text-sm text-gray-400">{m.warnCount}</td>
                  <td className="py-3 px-4">
                    {isMuted && (
                      <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-xs mr-1">
                        Mute {Math.ceil((new Date(m.timedOutUntil!).getTime() - Date.now()) / 60000)}min
                      </span>
                    )}
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
                              disabled={loading}
                              className="group relative p-2 bg-green-600/80 hover:bg-green-600 rounded-lg text-xs transition-all hover:scale-105"
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
                              disabled={loading}
                              className="group relative p-2 bg-yellow-600/80 hover:bg-yellow-600 rounded-lg text-xs transition-all hover:scale-105"
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
                            onClick={() => doAction(m.discordId, "kick")}
                            disabled={loading}
                            className="group relative p-2 bg-orange-600/80 hover:bg-orange-600 rounded-lg text-xs transition-all hover:scale-105"
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
                              onClick={() => doAction(m.discordId, "ban")}
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
                            disabled={loading}
                            className={`group relative p-2 rounded-lg text-xs transition-all hover:scale-105 ${m.trusted ? "bg-green-600 hover:bg-green-500" : "bg-gray-600 hover:bg-gray-500"}`}
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
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Max messages</span>
            <input
              type="number"
              value={config.spamMaxMessages}
              onChange={(e) => updateValue("spamMaxMessages", parseInt(e.target.value))}
              className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-20 text-right"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Fenetre (secondes)</span>
            <input
              type="number"
              value={config.spamWindow}
              onChange={(e) => updateValue("spamWindow", parseInt(e.target.value))}
              className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-20 text-right"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Max mentions</span>
            <input
              type="number"
              value={config.spamMaxMentions}
              onChange={(e) => updateValue("spamMaxMentions", parseInt(e.target.value))}
              className="bg-dark-900 border border-dark-700 rounded px-2 py-1 w-20 text-right"
            />
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