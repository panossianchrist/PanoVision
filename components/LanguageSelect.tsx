"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

export function LanguageSelect() {
  const locale = useLocale(),
    t = useTranslations("common"),
    router = useRouter();
  return (
    <label className="language-select">
      <Languages size={16} aria-hidden="true" />
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(event) => {
          document.cookie = `pano_language=${event.target.value};path=/;max-age=31536000;samesite=lax${location.protocol === "https:" ? ";secure" : ""}`;
          router.refresh();
        }}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="fr" lang="fr">
          Français
        </option>
        <option value="ar" lang="ar">
          العربية
        </option>
      </select>
    </label>
  );
}
