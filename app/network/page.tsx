import type { Metadata } from "next";
import { NetworkSection } from "@/components/NetworkSection";
import { CampaignCTA } from "@/components/CampaignCTA";
import { getTranslations } from "next-intl/server";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("networkPage"),
    common = await getTranslations("common");
  return { title: common("network"), description: t("intro") };
}
export default async function NetworkPage() {
  const t = await getTranslations("networkPage"),
    home = await getTranslations("home"),
    map = await getTranslations("map");
  return (
    <>
      <section className="page-intro container">
        <span className="eyebrow">
          <span className="status-dot" />
          {home("building")}
        </span>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </section>
      <section className="container network-page-explorer">
        <NetworkSection full />
      </section>
      <section className="container source-note" id="map-sources">
        <h2>{map("sources")}</h2>
        <p>
          {t("geometry")}{" "}
          <a href="https://www.geoboundaries.org/api/current/gbOpen/LBN/ADM0/">
            geoBoundaries gbOpen ADM0
          </a>{" "}
          /{" "}
          <a href="https://www.geoboundaries.org/api/current/gbOpen/LBN/ADM1/">
            ADM1
          </a>{" "}
          {t("geometryNote")}{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
          {t("coordinates")}{" "}
          <a href="https://download.geonames.org/export/dump/">
            GeoNames Lebanon
          </a>
          , CC BY 4.0. {t("context")}
        </p>
      </section>
      <CampaignCTA />
    </>
  );
}
