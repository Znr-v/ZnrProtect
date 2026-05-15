"use client";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { Shield, AlertTriangle, Users, Activity } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { StatCard } from "@/components/StatCard";

type Guild = { id: string; name: string; riskScore: number; lockdownActive: boolean; _count: { members: number; incidents: number; securityEvents: number } };
type Stats = { guilds: number; members: number; events24h: number; events7d: number; openIncidents: number; highRiskMembers: number; phishingLinks: number; secretsDetected: number };

export default function Home() {
  const { data: session, status } = useSession();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (session) {
      apiFetch<{ guilds: Guild[] }>("/api/guilds").then((d) => setGuilds(d.guilds));
      apiFetch<Stats>("/api/stats").then(setStats);
    }
  }, [session]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-discord rounded-2xl flex items-center justify-center mb-6">
          <Shield className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold mb-4">Security Bot Dashboard</h1>
        <p className="text-gray-400 mb-8 max-w-md">
          Gere la securite de tes serveurs Discord depuis une interface moderne.
        </p>
        <button
          onClick={() => signIn("discord")}
          className="bg-discord hover:bg-indigo-600 text-white px-8 py-3 rounded-xl text-lg font-semibold transition shadow-lg shadow-discord/20"
        >
          Connexion avec Discord
        </button>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
          <Feature icon="🛡️" title="Anti-Raid" desc="Detection intelligente des raids et lockdown automatique." />
          <Feature icon="🔍" title="Anti-Phishing" desc="Analyse de liens, detection de typosquatting et punycode." />
          <Feature icon="🔐" title="Secret Scanner" desc="Detection de tokens, cles API et secrets dans les messages." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Serveurs" value={stats.guilds} color="blue" />
          <StatCard label="Membres" value={stats.members.toLocaleString()} />
          <StatCard label="Events (24h)" value={stats.events24h} color={stats.events24h > 10 ? "yellow" : "green"} />
          <StatCard label="Incidents ouverts" value={stats.openIncidents} color={stats.openIncidents > 0 ? "red" : "green"} />
          <StatCard label="Membres a risque" value={stats.highRiskMembers} color={stats.highRiskMembers > 0 ? "red" : "green"} />
          <StatCard label="Phishing (7j)" value={stats.phishingLinks} color={stats.phishingLinks > 0 ? "yellow" : "green"} />
          <StatCard label="Secrets (7j)" value={stats.secretsDetected} color={stats.secretsDetected > 0 ? "red" : "green"} />
          <StatCard label="Events (7j)" value={stats.events7d} />
        </div>
      )}

      <h2 className="text-lg font-semibold mb-4 text-gray-300">Tes serveurs</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {guilds.map((g) => (
          <Link
            key={g.id}
            href={`/guild/${g.id}`}
            className="bg-dark-800 rounded-xl p-5 border border-dark-700 hover:border-discord/50 transition flex items-center gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-dark-600 flex items-center justify-center text-lg font-bold group-hover:bg-discord/20 transition">
              {g.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{g.name}</h3>
                {g.lockdownActive && (
                  <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">LOCKDOWN</span>
                )}
              </div>
              <p className="text-gray-400 text-sm">
                {g._count.members} membres &middot; {g._count.incidents} incidents
              </p>
            </div>
            <span className="text-gray-500 group-hover:text-white transition">&rarr;</span>
          </Link>
        ))}
        {guilds.length === 0 && (
          <p className="text-gray-500 col-span-3">Aucun serveur. Le bot doit etre present sur au moins un de tes serveurs.</p>
        )}
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-gray-400 text-sm">{desc}</p>
    </div>
  );
}
