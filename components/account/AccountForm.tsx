"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import type { CustomerProfile } from "@/lib/account-types";
import { safeReturnTo } from "@/lib/return-to";

export function AccountForm({
  initialMode = "login",
  returnTo = "/dashboard",
  onAuthenticated,
}: {
  initialMode?: "login" | "signup";
  returnTo?: string;
  onAuthenticated?: (profile: CustomerProfile) => void;
}) {
  const t = useTranslations("account"),
    extra = useTranslations("extras"),
    common = useTranslations("common"),
    locale = useLocale(),
    router = useRouter();
  const [mode, setMode] = useState(initialMode),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false),
    [error, setError] = useState("");
  const [values, setValues] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    country: "",
    role: "",
    password: "",
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/account/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { ...values, language: locale }
            : { email: values.email, password: values.password },
        ),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          body.error === "INVALID_CREDENTIALS"
            ? t("authFailed")
            : body.error === "ACCOUNT_UNAVAILABLE"
              ? t("unavailable")
              : body.error === "RATE_LIMIT"
                ? t("rateLimit")
                : common("required"),
        );
        return;
      }
      sessionStorage.removeItem("panoCampaignId");
      sessionStorage.removeItem("panoAssetId");
      document.cookie = `pano_language=${body.profile.language};path=/;max-age=31536000;samesite=lax${location.protocol === "https:" ? ";secure" : ""}`;
      if (onAuthenticated) onAuthenticated(body.profile);
      else router.replace(safeReturnTo(returnTo));
      router.refresh();
    } catch {
      setError(common("error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="account-form" onSubmit={submit}>
      <div className="account-form-heading">
        <LockKeyhole size={20} />
        <h2>{mode === "signup" ? common("signup") : common("login")}</h2>
      </div>
      <div className="field-grid">
        {(mode === "signup"
          ? ["name", "company", "email", "phone", "country", "role"]
          : ["email"]
        ).map((key) => (
          <div className="field" key={key}>
            <label htmlFor={`account-${key}`}>
              {key === "role" ? t("role") : common(key)}
            </label>
            <input
              id={`account-${key}`}
              name={key}
              type={
                key === "email" ? "email" : key === "phone" ? "tel" : "text"
              }
              required={["name", "company", "email"].includes(key)}
              maxLength={key === "email" ? 254 : key === "phone" ? 30 : 160}
              autoComplete={
                (
                  {
                    name: "name",
                    company: "organization",
                    email: "email",
                    phone: "tel",
                    country: "country-name",
                    role: "organization-title",
                  } as Record<string, string>
                )[key]
              }
              value={values[key as keyof typeof values]}
              onChange={(event) =>
                setValues({ ...values, [key]: event.target.value })
              }
            />
          </div>
        ))}
        <div className="field password-field">
          <label htmlFor="account-password">{common("password")}</label>
          <div>
            <input
              id="account-password"
              name="password"
              type={visible ? "text" : "password"}
              required
              minLength={mode === "signup" ? 15 : 1}
              maxLength={128}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={values.password}
              onChange={(event) =>
                setValues({ ...values, password: event.target.value })
              }
            />
            <button
              type="button"
              className="icon-button"
              aria-label={extra(visible?"hidePassword":"showPassword")}
              aria-pressed={visible}
              title={extra(visible?"hidePassword":"showPassword")}
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {mode === "signup" && <small>{t("passwordHelp")}</small>}
        </div>
      </div>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <button className="button" type="submit" disabled={busy}>
        {busy
          ? common("loading")
          : mode === "signup"
            ? common("signup")
            : common("login")}
        <ArrowUpRight size={17} />
      </button>
      <p className="account-switch">
        {mode === "signup" ? t("hasAccount") : t("noAccount")}{" "}
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError("");
          }}
        >
          {mode === "signup" ? common("login") : common("signup")}
        </button>
      </p>
      <p className="small muted">
        {t("private")} <Link href="/privacy">{common("privacy")}</Link>
      </p>
    </form>
  );
}
