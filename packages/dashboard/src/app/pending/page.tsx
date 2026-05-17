"use client";
import { useSession, signOut } from "next-auth/react";
import { Shield, Clock, LogOut } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function PendingPage() {
  const { data: session } = useSession();
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 bg-yellow-500/20 rounded-2xl flex items-center justify-center mb-6">
        <Clock className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
      </div>
      <h1 className="text-3xl font-extrabold mb-4">{t("pendingApproval")}</h1>
      <p className="text-theme-secondary mb-8 max-w-md">
        {t("pendingApprovalDesc1")}<span className="text-theme-primary font-medium">{session?.user?.name}</span>{t("pendingApprovalDesc2")}
      </p>
      <div className="bg-theme-secondary rounded-xl p-6 border border-theme-border max-w-md mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-discord" />
          {t("nextSteps")}
        </h2>
        <ul className="text-theme-secondary text-sm space-y-2 text-left">
          <li>• {t("pendingNextSteps1")}</li>
          <li>• {t("pendingNextSteps2")}</li>
          <li>• {t("pendingNextSteps3")}</li>
        </ul>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-theme-secondary hover:text-theme-primary text-sm flex items-center gap-2 transition"
      >
        <LogOut className="w-4 h-4" />
        {t("logout")}
      </button>
    </div>
  );
}