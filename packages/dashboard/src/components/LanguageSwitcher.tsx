"use client";
import { useI18n } from "@/lib/i18n";

import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  // Client component for language switching
  // Uses the i18n hook defined in the project (useI18n)
  const { language, setLanguage } = useI18n();

  const toggle = () => setLanguage(language === "fr" ? "en" : "fr");

  return (
    <button aria-label={language === "fr" ? "Switch to English" : "Passer en Français"}
      onClick={toggle}
      className="p-2 text-sm font-semibold tracking-wide rounded-lg transition hover:bg-theme-tertiary flex items-center gap-1.5"
      title={language === "fr" ? "Switch to English" : "Passer en Français"}
    >
      <Globe className="w-5 h-5 text-theme-secondary" />

    </button>
  );
}
