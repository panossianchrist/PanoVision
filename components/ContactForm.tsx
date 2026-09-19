"use client";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import { isEmail } from "@/lib/validation";
import { downloadRequest } from "@/lib/download";
import { company } from "@/lib/company";
import { useTranslations } from "next-intl";

export function ContactForm() {
  const t=useTranslations("contactPage"), common=useTranslations("common");
  const [values, setValues] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prepared, setPrepared] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!values.name.trim()) found.name = common("required");
    if (!isEmail(values.email)) found.email = common("required");
    if (!values.message.trim()) found.message = common("required");
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`contact-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setPrepared(true);
  }
  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      <div className="demo-banner">
        <p>{t("local")}</p>
      </div>
      <div className="field-grid">
        {(["name", "company", "email", "phone"] as const).map((name) => (
          <div
            className={`field ${errors[name] ? "has-error" : ""}`}
            key={name}
          >
            <label htmlFor={`contact-${name}`}>
              {common(name)}
              {["name", "email"].includes(name) && (
                <span className="required"> *</span>
              )}
            </label>
            <input
              id={`contact-${name}`}
              name={name}
              type={
                name === "email" ? "email" : name === "phone" ? "tel" : "text"
              }
              autoComplete={
                name === "company"
                  ? "organization"
                  : name === "phone"
                    ? "tel"
                    : name
              }
              required={["name", "email"].includes(name)}
              value={values[name]}
              maxLength={254}
              aria-invalid={!!errors[name]}
              aria-describedby={errors[name] ? `${name}-error` : undefined}
              onChange={(event) => {
                setValues({ ...values, [name]: event.target.value });
                setErrors({ ...errors, [name]: "" });
                setPrepared(false);
              }}
            />
            {errors[name] && (
              <span className="field-error" id={`${name}-error`}>
                {errors[name]}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className={`field ${errors.message ? "has-error" : ""}`}>
        <label htmlFor="contact-message">
          {t("message")} <span className="required">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          maxLength={5000}
          value={values.message}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          onChange={(event) => {
            setValues({ ...values, message: event.target.value });
            setPrepared(false);
            setErrors({ ...errors, message: "" });
          }}
        />
        {errors.message && (
          <span className="field-error" id="message-error">
            {errors.message}
          </span>
        )}
      </div>
      {prepared && (
        <div className="prepared-request" role="status">
          <div>
            <h3>{t("prepared")}</h3>
            <a className="text-link" href={`mailto:${company.email}?subject=${encodeURIComponent(`PanoVision / ${values.company || values.name}`)}&body=${encodeURIComponent(`${values.name}\n${values.company}\n${values.email}\n${values.phone}\n\n${values.message}`)}`}>{t("send")}<ArrowUpRight size={16}/></a>
            <button
              className="text-link"
              type="button"
              onClick={() =>
                downloadRequest("PanoVision-message.json", {
                  status: "prepared-locally-not-sent",
                  ...values,
                })
              }
            >
              <Download size={16} />
              {t("download")}
            </button>
          </div>
        </div>
      )}
      <button className="button" type="submit">
        {t("prepare")} <ArrowUpRight size={18} />
      </button>
    </form>
  );
}
