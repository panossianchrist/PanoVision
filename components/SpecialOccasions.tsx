import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Reveal } from "./Reveal";

export function SpecialOccasions() {
  const t = useTranslations("special"),
    common = useTranslations("common");
  return (
    <section id="special-occasions" className="special-section section-space">
      <div className="container">
        <Reveal>
          <span className="section-index">{common("special")}</span>
          <h2>{t("title")}</h2>
        </Reveal>
        <div className="special-content">
          <div>
            <p className="lead">{t("description")}</p>
            <div className="occasion-options">
              {[
                "Birthday",
                "Proposal",
                "Congratulations",
                "Opening",
                "Launch",
                "Event",
                "Celebration",
                "Custom",
              ].map((occasion) => (
                <Link
                  key={occasion}
                  href={`/start-campaign?type=special&occasion=${occasion}`}
                >
                  {t(occasion)}
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </div>
          </div>
          <div className="special-booking">
            <div className="special-durations">
              <Link href="/start-campaign?type=special&minutes=5">
                <strong>05</strong>
                <span>{t("five")}</span>
              </Link>
              <Link href="/start-campaign?type=special&minutes=10">
                <strong>10</strong>
                <span>{t("ten")}</span>
              </Link>
              <Link href="/start-campaign?type=special&minutes=custom">
                <strong>+</strong>
                <span>{t("custom")}</span>
              </Link>
            </div>
            <p className="small">{t("note")}</p>
            <Link className="button" href="/start-campaign?type=special">
              {t("cta")}
              <ArrowUpRight size={17} />
            </Link>
            <Link className="text-link" href="/how-it-works">
              {common("how")}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
