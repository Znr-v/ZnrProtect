"use client";
import { useSession, signOut } from "next-auth/react";
import { Shield, Clock, LogOut } from "lucide-react";

export default function PendingPage() {
  const { data: session } = useSession();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 bg-yellow-500/20 rounded-2xl flex items-center justify-center mb-6">
        <Clock className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
      </div>
      <h1 className="text-3xl font-extrabold mb-4">En attente d'approbation</h1>
        <p className="text-theme-secondary mb-8 max-w-md">
        Votre compte Discord (<span className="text-theme-primary font-medium">{session?.user?.name}</span>) 
        est connecté, mais vous n'avez pas encore accès au dashboard.
      </p>
      <div className="bg-theme-secondary rounded-xl p-6 border border-theme-border max-w-md mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-discord" />
          Prochaines étapes
        </h2>
        <ul className="text-theme-secondary text-sm space-y-2 text-left">
          <li>• Un administrateur doit valider votre accès</li>
          <li>• Vous recevrez accès une fois votre demande acceptée</li>
          <li>• Cette page s'actualisera automatiquement</li>
        </ul>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-theme-secondary hover:text-theme-primary text-sm flex items-center gap-2 transition"
      >
        <LogOut className="w-4 h-4" />
        Se déconnecter
      </button>
    </div>
  );
}