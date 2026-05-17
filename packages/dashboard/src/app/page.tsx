"use client";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { Shield, Lock, AlertTriangle, Users, Activity, ChevronRight, Zap } from "lucide-react";
import Link from "next/link";
import { apiFetch, setAuthToken } from "@/lib/api";
import { useDashboardUser } from "@/lib/usePermissions";
import { StatCard } from "@/components/StatCard";

type Guild = { id: string; name: string; riskScore: number; lockdownActive: boolean; _count: { members: number; incidents: number; securityEvents: number } };
type Stats = { guilds: number; members: number; events24h: number; events7d: number; openIncidents: number; highRiskMembers: number; phishingLinks: number; secretsDetected: number };

export default function Home() {
  const { data: session, status } = useSession();
  const { hasAccess, loaded, guilds: userGuilds, getGuildRole } = useDashboardUser();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (session) {
      setAuthToken((session as any).apiToken ?? null);
    }
  }, [session]);

  useEffect(() => {
    if (loaded && hasAccess) {
      apiFetch<{ guilds: Guild[] }>("/api/guilds").then((d) => setGuilds(d.guilds));
      apiFetch<Stats>("/api/stats").then(setStats);
    }
  }, [loaded, hasAccess]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-discord border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        {/* Hero */}
        <div className="relative mb-8">
          <div className="w-20 h-20 bg-discord rounded-2xl flex items-center justify-center shadow-discord mx-auto">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-[var(--bg-primary)] animate-pulse" />
        </div>

        <h1 className="text-4xl font-extrabold mb-3 tracking-tight">
          Security Bot
          <span className="text-discord"> Dashboard</span>
        </h1>
        <p className="text-theme-secondary mb-8 max-w-md text-base leading-relaxed">
          Surveillez, analysez et protégez vos serveurs Discord en temps réel.
        </p>

        <button
          onClick={() => signIn("discord")}
          className="inline-flex items-center gap-3 bg-discord hover:bg-discord-hover text-white px-7 py-3.5 rounded-xl text-base font-semibold transition shadow-discord hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.043.03.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Connexion avec Discord
        </button>

        {/* Feature grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
          <Feature icon={<Shield className="w-5 h-5" />} title="Anti-Raid" desc="Détection intelligente des raids et lockdown automatique." color="blue" />
          <Feature icon={<Zap className="w-5 h-5" />} title="Anti-Phishing" desc="Analyse de liens, typosquatting et punycode en temps réel." color="yellow" />
          <Feature icon={<Lock className="w-5 h-5" />} title="Secret Scanner" desc="Détection de tokens, clés API et secrets dans les messages." color="red" />
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-discord border-t-transparent" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-[var(--danger-subtle)] rounded-2xl flex items-center justify-center mb-5">
          <Lock className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Accès non autorisé</h1>
        <p className="text-theme-secondary mb-6 max-w-sm text-sm leading-relaxed">
          Votre compte est connecté mais vous n'avez accès à aucun serveur. Contactez un administrateur.
        </p>
        <div className="bg-theme-secondary rounded-xl p-5 border border-theme-border max-w-sm w-full text-left">
          <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Que faire ?</p>
          <ul className="text-theme-secondary text-sm space-y-2">
            <li className="flex items-start gap-2"><span className="text-discord mt-0.5">•</span> Demandez à un administrateur de vous ajouter au dashboard</li>
            <li className="flex items-start gap-2"><span className="text-discord mt-0.5">•</span> Un administrateur doit vous assigner des permissions sur un serveur</li>
          </ul>
        </div>
      </div>
    );
  }

  const riskColor = (score: number) => score >= 61 ? "red" : score >= 31 ? "yellow" : "green";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-theme-secondary text-sm mt-0.5">
            {guilds.length} serveur{guilds.length !== 1 ? "s" : ""} surveillé{guilds.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Serveurs"        value={stats.guilds}          color="blue" />
          <StatCard label="Membres"         value={stats.members.toLocaleString("fr-FR")} />
          <StatCard label="Events (24h)"    value={stats.events24h}       color={stats.events24h > 10 ? "yellow" : "green"} />
          <StatCard label="Incidents ouverts" value={stats.openIncidents} color={stats.openIncidents > 0 ? "red" : "green"} />
          <StatCard label="Membres à risque"  value={stats.highRiskMembers} color={stats.highRiskMembers > 0 ? "red" : "green"} />
          <StatCard label="Phishing (7j)"   value={stats.phishingLinks}   color={stats.phishingLinks > 0 ? "yellow" : "green"} />
          <StatCard label="Secrets (7j)"    value={stats.secretsDetected} color={stats.secretsDetected > 0 ? "red" : "green"} />
          <StatCard label="Events (7j)"     value={stats.events7d} />
        </div>
      )}

      {/* Guild list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-theme-primary">Vos serveurs</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {guilds.map((g) => (
          <div
            key={g.id}
            className="group bg-theme-secondary rounded-xl border border-theme-border hover:border-discord/40 transition-all duration-150 shadow-sm hover:shadow-md overflow-hidden"
          >
            {/* Lockdown banner */}
            {g.lockdownActive && (
              <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                <span className="text-red-400 text-xs font-semibold tracking-wide">LOCKDOWN ACTIF</span>
              </div>
            )}

            <div className="p-4">
              <Link href={`/guild/${g.id}`} className="flex items-center gap-3 mb-3">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-xl bg-theme-tertiary flex items-center justify-center text-base font-bold text-discord group-hover:bg-discord/10 transition shrink-0">
                  {g.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm truncate">{g.name}</h3>
                    {/* Risk dot */}
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      g.riskScore >= 61 ? "bg-red-400" :
                      g.riskScore >= 31 ? "bg-yellow-400" : "bg-green-400"
                    }`} />
                  </div>
                  <p className="text-theme-muted text-xs mt-0.5">
                    {g._count.members} membres · {g._count.incidents} incidents
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-discord group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-theme-border">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-theme-muted" />
                  <span className="text-theme-muted text-xs">{g._count.securityEvents} events</span>
                </div>
                {getGuildRole(g.id) === "OWNER" && (
                  <Link
                    href="/admin"
                    className="text-xs text-theme-secondary hover:text-discord transition flex items-center gap-1"
                  >
                    <Shield className="w-3 h-3" />
                    Gérer le staff
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}

        {guilds.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-theme-tertiary rounded-2xl flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-theme-muted" />
            </div>
            <p className="text-theme-secondary font-medium">Aucun serveur accessible</p>
            <p className="text-theme-muted text-sm mt-1">Contactez un administrateur pour obtenir des accès.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Feature({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: "blue" | "yellow" | "red" }) {
  const colors = {
    blue:   { bg: "bg-discord/10",         icon: "text-discord"    },
    yellow: { bg: "bg-yellow-500/10",       icon: "text-yellow-600 dark:text-yellow-400" },
    red:    { bg: "bg-red-500/10",          icon: "text-red-600 dark:text-red-400"    },
  };
  const c = colors[color];
  return (
    <div className="bg-theme-secondary rounded-xl p-5 border border-theme-border text-left hover:border-theme-subtle transition">
      <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center mb-3 ${c.icon}`}>
        {icon}
      </div>
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-theme-secondary text-xs leading-relaxed">{desc}</p>
    </div>
  );
}
