import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { company } from "@/lib/company";

export function CampaignCTA() {
  const t = useTranslations("cta"), common = useTranslations("common");
  return (
    <section className="campaign-cta pv-cta">
      <div className="pv-cta-beam" aria-hidden="true" />
      <div className="container">
        <span className="micro">{t("label")}</span>
        <h2>
          <span>{t("t1")}</span>
          <span>{t("t2")}</span>
        </h2>
        <div className="pv-cta-row">
          <p>{t("text")}</p>
          <div className="actions">
            <Link className="pv-button" href="/start-campaign">
              <span>{common("start")}</span>
              <ArrowUpRight size={18} />
            </Link>
            <a className="pv-link-quiet" href={`mailto:${company.email}`}>
              <span dir="ltr">{company.email}</span>
              <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
