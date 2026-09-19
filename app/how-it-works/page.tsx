import type { Metadata } from "next";
import { Workflow } from "@/components/Workflow";
import { CampaignCTA } from "@/components/CampaignCTA";
import { Clock3, Monitor } from "lucide-react";
import { getTranslations } from "next-intl/server";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("howPage"),
    common = await getTranslations("common");
  return { title: common("how"), description: t("intro") };
}
export default async function HowItWorksPage() {
  const t = await getTranslations("howPage");
  return (
    <>
      <section className="page-intro container">
        <span className="eyebrow">{t("label")}</span>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </section>
      <section className="container process-page">
        <Workflow detailed />
      </section>
      <section className="specification-band section-space">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-index">{t("specs")}</span>
              <h2>{t("format")}</h2>
            </div>
          </div>
          <div className="specification-grid">
            <div>
              <Clock3 size={26} />
              <span className="big-number">
                08<span>s</span>
              </span>
              <h3>{t("video")}</h3>
              <p>{t("videoText")}</p>
            </div>
            <div>
              <Monitor size={26} />
              <h3>{t("dimensions")}</h3>
              <p>{t("dimensionsText")}</p>
            </div>
            <div>
              <span className="micro blue">{t("options")}</span>
              <h3>{t("moment")}</h3>
              <p>{t("momentText")}</p>
            </div>
          </div>
        </div>
      </section>
      <CampaignCTA />
    </>
  );
}
