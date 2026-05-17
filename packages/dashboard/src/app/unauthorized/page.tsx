"use client";
import { useSession } from "next-auth/react";
import { Shield, XCircle } from "lucide-react";

export default function UnauthorizedPage() {
  const { data: session } = useSession();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6">
        <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-3xl font-extrabold mb-4">Accès refusé</h1>
        <p className="text-theme-secondary mb-8 max-w-md">
        Vous êtes connecté en tant que <span className="text-theme-primary font-medium">{session?.user?.name || "utilisateur"}</span>, 
        mais vous n'avez pas les permissions nécessaires pour accéder à cette page.
      </p>
      <div className="bg-theme-secondary rounded-xl p-6 border border-theme-border max-w-md">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-discord" />
          Que faire ?
        </h2>
        <ul className="text-theme-secondary text-sm space-y-2 text-left">
          <li>• Vérifiez que vous avez le bon rôle</li>
          <li>•Contactez un administrateur du bot</li>
          <li>• Demandez les permissions requises</li>
        </ul>
      </div>
    </div>
  );
}