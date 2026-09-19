import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
export function CampaignCTA() {
  const t = useTranslations("cta"), common = useTranslations("common");
  return (
    <section className="campaign-cta section-space">
      <div className="container">
        <span className="micro">{t("label")}</span>
        <div className="cta-layout">
          <h2>
            {t("title")}
          </h2>
          <div>
            <p>{t("text")}</p>
            <div className="actions">
              <Link className="button" href="/start-campaign">
                {common("start")} <ArrowUpRight size={18} />
              </Link>
              <Link className="text-link" href="/contact">
                {common("contact")} <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
