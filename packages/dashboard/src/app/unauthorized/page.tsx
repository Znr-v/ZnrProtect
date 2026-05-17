"use client";
import { useSession } from "next-auth/react";
import { Shield, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function UnauthorizedPage() {
  const { data: session } = useSession();
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6">
        <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-3xl font-extrabold mb-4">{t("accessDenied")}</h1>
      <p className="text-theme-secondary mb-8 max-w-md">
        {t("accessDeniedDesc1")}<span className="text-theme-primary font-medium">{session?.user?.name || "user"}</span>{t("accessDeniedDesc2")}
      </p>
      <div className="bg-theme-secondary rounded-xl p-6 border border-theme-border max-w-md">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-discord" />
          {t("whatToDo")}
        </h2>
        <ul className="text-theme-secondary text-sm space-y-2 text-left">
          <li>• {t("unauthorizedNextSteps1")}</li>
          <li>• {t("unauthorizedNextSteps2")}</li>
          <li>• {t("unauthorizedNextSteps3")}</li>
        </ul>
      </div>
    </div>
  );
}