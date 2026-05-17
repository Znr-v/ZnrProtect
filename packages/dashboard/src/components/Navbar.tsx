"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { Shield } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="bg-theme-secondary border-b border-theme-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-discord rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold">Security Bot</span>
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="w-px h-6 bg-theme-tertiary" />
          {session ? (
            <>
              <Link href="/" className="text-sm text-theme-secondary hover:text-theme-primary transition">
                Serveurs
              </Link>
              <div className="flex items-center gap-2">
                {session.user?.image && (
                  <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
                )}
                <span className="text-sm font-medium">{session.user?.name}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-theme-secondary hover:text-red-400 text-sm transition"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn("discord")}
              className="bg-discord hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Connexion avec Discord
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
