import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { PanoHero } from "@/components/PanoHero";
import { RoadAudience } from "@/components/RoadAudience";
import { NetworkSection } from "@/components/NetworkSection";
import { ConceptReveal } from "@/components/ConceptReveal";
import { WhyRows } from "@/components/WhyRows";
import { FlowTimeline } from "@/components/FlowTimeline";
import { SpecialOccasions } from "@/components/SpecialOccasions";
import { CampaignCTA } from "@/components/CampaignCTA";
import { Reveal } from "@/components/Reveal";

export default function Home() {
  const t = useTranslations("home"),
    n = useTranslations("network");
  return (
    <>
      <PanoHero />
      <RoadAudience />

      <section className="pv-network" id="network">
        <div className="pv-wrap">
          <Reveal className="pv-sec-head">
            <p className="micro pv-label">
              <i className="pv-dot" /> {n("label")}
            </p>
            <h2 className="pv-display">
              <span>{n("l1")}</span>
              <span>{n("l2")}</span>
            </h2>
            <p className="pv-sec-support">{n("support")}</p>
          </Reveal>
          <NetworkSection />
        </div>
      </section>

      <ConceptReveal />

      <section className="pv-why">
        <div className="pv-wrap">
          <Reveal className="pv-sec-head">
            <p className="micro pv-label">{t("why")}</p>
            <h2 className="pv-display">{t("whyTitle")}</h2>
            <p className="pv-sec-support">{t("whyText")}</p>
          </Reveal>
          <WhyRows />
        </div>
      </section>

      <section className="pv-flow" id="workflow">
        <div className="pv-wrap">
          <Reveal className="pv-sec-head pv-sec-head-split">
            <div>
              <p className="micro pv-label">{t("workflowIndex")}</p>
              <h2 className="pv-display">{t("workflowTitle")}</h2>
            </div>
            <Link className="pv-link-quiet" href="/how-it-works">
              {t("fullProcess")} <ArrowUpRight size={15} />
            </Link>
          </Reveal>
          <FlowTimeline />
          <div className="pv-format">
            <span className="pv-format-num">08</span>
            <span className="pv-format-unit">{t("format")}</span>
            <p>{t("specs")}</p>
            <span className="micro">{t("approval")}</span>
          </div>
        </div>
      </section>

      <SpecialOccasions />

      <section className="pv-about" id="about">
        <div className="pv-wrap pv-about-grid">
          <Reveal>
            <p className="micro pv-label">{t("aboutIndex")}</p>
            <h2 className="pv-display pv-display-md">{t("aboutTitle")}</h2>
          </Reveal>
          <Reveal className="pv-about-copy">
            <p className="pv-about-lead">{t("rooted")}</p>
            <p>{t("aboutText")}</p>
            <p>{t("ambition")}</p>
            <Link className="pv-link-quiet" href="/contact">
              {t("talk")} <ArrowUpRight size={15} />
            </Link>
          </Reveal>
        </div>
      </section>

      <CampaignCTA />
    </>
  );
}
