"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
export function EmailChangeForm({
  enabled,
  onChanged,
}: {
  enabled: boolean;
  onChanged: (email: string) => void;
}) {
  const t = useTranslations("emailChange"),
    account = useTranslations("account"),
    common = useTranslations("common"),
    router = useRouter();
  const [fields, setFields] = useState({
      email: "",
      password: "",
      oldCode: "",
      newCode: "",
    }),
    [challengeId, setChallengeId] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !enabled) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/account/${challengeId ? "email-confirm" : "email-change"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            challengeId
              ? {
                  challengeId,
                  oldCode: fields.oldCode,
                  newCode: fields.newCode,
                }
              : { email: fields.email, password: fields.password },
          ),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        const keys: Record<string, string> = {
          EMAIL_NOT_CONFIGURED: "unconfigured",
          EMAIL_DELIVERY_FAILED: "delivery",
          EMAIL_CODE_INVALID: "invalid",
          EMAIL_CHANGE_EXPIRED: "expired",
        };
        setMessage(
          keys[body.error]
            ? t(keys[body.error])
            : body.error === "INVALID_CREDENTIALS"
              ? account("authFailed")
              : body.error === "ACCOUNT_UNAVAILABLE"
                ? account("unavailable")
                : body.error === "RATE_LIMIT"
                  ? account("rateLimit")
                  : common("error"),
        );
        return;
      }
      if (challengeId) {
        onChanged(body.profile.email);
        setChallengeId("");
        setFields({ email: "", password: "", oldCode: "", newCode: "" });
        setMessage(t("done"));
        router.refresh();
      } else {
        setChallengeId(body.challengeId);
        setFields((previous) => ({ ...previous, password: "" }));
        setMessage(t("sent"));
      }
    } catch {
      setMessage(common("error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="email-change-form" onSubmit={submit}>
      <h2>{t("title")}</h2>
      <p className="small">{enabled ? t("notice") : t("unconfigured")}</p>
      {enabled && (
        <>
          <div className="form-stack">
            {(challengeId ? ["oldCode", "newCode"] : ["email", "password"]).map(
              (key) => (
                <div className="field" key={key}>
                  <label htmlFor={`email-change-${key}`}>
                    {key === "email"
                      ? t("newEmail")
                      : key === "password"
                        ? account("currentPassword")
                        : t(key)}
                  </label>
                  <input
                    id={`email-change-${key}`}
                    required
                    autoComplete={
                      key === "password"
                        ? "current-password"
                        : key === "email"
                          ? "email"
                          : "one-time-code"
                    }
                    type={
                      key === "email"
                        ? "email"
                        : key === "password"
                          ? "password"
                          : "text"
                    }
                    inputMode={key.endsWith("Code") ? "numeric" : undefined}
                    pattern={key.endsWith("Code") ? "[0-9]{8}" : undefined}
                    minLength={key.endsWith("Code") ? 8 : undefined}
                    maxLength={
                      key.endsWith("Code") ? 8 : key === "email" ? 254 : 128
                    }
                    value={fields[key as keyof typeof fields]}
                    onChange={(event) =>
                      setFields({ ...fields, [key]: event.target.value })
                    }
                  />
                </div>
              ),
            )}
          </div>
          <button className="button button-outline" disabled={busy}>
            <MailCheck size={17} />
            {busy ? common("loading") : challengeId ? t("confirm") : t("send")}
          </button>
          {challengeId && (
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                setChallengeId("");
                setFields((previous) => ({
                  ...previous,
                  oldCode: "",
                  newCode: "",
                }));
                setMessage("");
              }}
            >
              {t("retry")}
            </button>
          )}
        </>
      )}
      {message && (
        <p className="form-alert" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
