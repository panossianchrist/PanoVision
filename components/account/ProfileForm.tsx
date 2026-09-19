"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Save, KeyRound } from "lucide-react";
import type { CustomerProfile } from "@/lib/account-types";
import { EmailChangeForm } from "./EmailChangeForm";
export function ProfileForm({
  profile,
  emailReady = false,
}: {
  profile: CustomerProfile;
  emailReady?: boolean;
}) {
  const [values, setValues] = useState(profile),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    password: "",
  });
  const t = useTranslations("account"),
    common = useTranslations("common"),
    router = useRouter();
  async function send(event: FormEvent, kind: "profile" | "password") {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/account/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "profile" ? values : passwords),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(
          body.error === "EMAIL_CHANGE_REQUIRES_VERIFICATION"
            ? t("emailNote")
            : body.error === "INVALID_CREDENTIALS"
              ? t("authFailed")
              : common("required"),
        );
        return;
      }
      setMessage(kind === "profile" ? common("saved") : t("passwordChanged"));
      if (kind === "profile") {
        document.cookie = `pano_language=${values.language};path=/;max-age=31536000;samesite=lax`;
        router.refresh();
      } else setPasswords({ currentPassword: "", password: "" });
    } catch {
      setMessage(common("error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-layout">
      <form onSubmit={(event) => send(event, "profile")}>
        <h2>{t("companyProfile")}</h2>
        <div className="field-grid">
          {(
            ["name", "company", "email", "phone", "country", "role"] as const
          ).map((key) => (
            <div className="field" key={key}>
              <label htmlFor={`profile-${key}`}>
                {key === "role" ? t("role") : common(key)}
              </label>
              <input
                id={`profile-${key}`}
                type={
                  key === "email" ? "email" : key === "phone" ? "tel" : "text"
                }
                required={["name", "company", "email"].includes(key)}
                readOnly={key === "email"}
                maxLength={key === "email" ? 254 : key === "phone" ? 30 : 160}
                value={values[key]}
                onChange={(event) =>
                  setValues({ ...values, [key]: event.target.value })
                }
              />
            </div>
          ))}
          <div className="field">
            <label htmlFor="profile-language">{common("language")}</label>
            <select
              id="profile-language"
              value={values.language}
              onChange={(event) =>
                setValues({
                  ...values,
                  language: event.target.value as CustomerProfile["language"],
                })
              }
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </div>
        <button className="button" disabled={busy}>
          <Save size={17} />
          {common("save")}
        </button>
      </form>
      <form onSubmit={(event) => send(event, "password")}>
        <h2>{t("changePassword")}</h2>
        <div className="form-stack">
          {(["currentPassword", "password"] as const).map((key) => (
            <div className="field" key={key}>
              <label htmlFor={`change-${key}`}>
                {t(key === "password" ? "newPassword" : "currentPassword")}
              </label>
              <input
                id={`change-${key}`}
                type="password"
                autoComplete={
                  key === "password" ? "new-password" : "current-password"
                }
                required
                minLength={key === "password" ? 15 : 1}
                maxLength={128}
                value={passwords[key]}
                onChange={(event) =>
                  setPasswords({ ...passwords, [key]: event.target.value })
                }
              />
            </div>
          ))}
        </div>
        <p className="small">{t("passwordHelp")}</p>
        <button className="button button-outline" disabled={busy}>
          <KeyRound size={17} />
          {t("changePassword")}
        </button>
      </form>
      <EmailChangeForm
        enabled={emailReady}
        onChanged={(email) => setValues((previous) => ({ ...previous, email }))}
      />
      {message && (
        <p role="status" className="profile-status">
          {message}
        </p>
      )}
    </div>
  );
}
