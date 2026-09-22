"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const languages = [
  ["en", "EN", "English"],
  ["fr", "FR", "Français"],
  ["ar", "AR", "العربية"],
] as const;

/** Compact segmented language control: EN / FR / AR. */
export function LanguageSelect() {
  const locale = useLocale(),
    t = useTranslations("common"),
    router = useRouter();
  return (
    <div className="pv-lang" role="group" aria-label={t("language")}>
      {languages.map(([code, short, name]) => (
        <button
          key={code}
          type="button"
          lang={code}
          title={name}
          aria-label={name}
          aria-pressed={locale === code}
          onClick={() => {
            if (locale === code) return;
            document.cookie = `pano_language=${code};path=/;max-age=31536000;samesite=lax${location.protocol === "https:" ? ";secure" : ""}`;
            router.refresh();
          }}
        >
          {short}
        </button>
      ))}
    </div>
  );
}
