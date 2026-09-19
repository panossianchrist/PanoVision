"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, RefreshCw } from "lucide-react";
export function AccountActions() {
  const t = useTranslations("common"),
    extra = useTranslations("extras"),
    router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  return (
    <div className="account-actions">
      <button
        type="button"
        className="icon-button"
        aria-label={extra("refresh")}
        title={extra("refresh")}
        onClick={() => router.refresh()}
      >
        <RefreshCw size={16} />
      </button>
      <button
        type="button"
        className="text-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            const response = await fetch("/api/account/logout", {
              method: "POST",
            });
            if (!response.ok) throw new Error();
            sessionStorage.removeItem("panoCampaignId");
            sessionStorage.removeItem("panoAssetId");
            router.replace("/login");
            router.refresh();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogOut size={16} />
        {t("logout")}
      </button>
      {error && <span role="alert">{t("error")}</span>}
    </div>
  );
}
