import { getTranslations } from "next-intl/server";
import { company } from "@/lib/company";
export async function LegalNotice({ kind }: { kind: "privacy" | "terms" }) {
  const t = await getTranslations("legal"),
    common = await getTranslations("common");
  const sections =
    kind === "privacy"
      ? [
          "accounts",
          "campaigns",
          "contact",
          "access",
          "processing",
          "storage",
          "retention",
          "services",
        ]
      : ["network", "requests", "formats", "preview", "launch"];
  return (
    <article className="container legal-page">
      <span className="eyebrow">{t("label")}</span>
      <h1>{common(kind)}</h1>
      <div className="demo-banner">
        <span className="micro">{t("draft")}</span>
        <p>{t("notice")}</p>
      </div>
      {sections.map((key) => (
        <section key={key}>
          <h2>{t(`${kind}.${key}.heading`)}</h2>
          <p>{t(`${kind}.${key}.text`)}</p>
          {key === "processing" && (
            <p>
              <a
                href="https://developers.openai.com/api/docs/guides/your-data"
                lang="en"
              >
                OpenAI data controls
              </a>
            </p>
          )}
        </section>
      ))}
      <p>
        {common("contact")}:{" "}
        <a href={`mailto:${company.email}`} dir="ltr">
          {company.email}
        </a>
      </p>
    </article>
  );
}
