import type { Metadata } from "next";
import { CampaignWizard } from "@/components/campaign/CampaignWizard";
import { getTranslations } from "next-intl/server";
import { selectionFromParams } from "@/lib/selection";
import { optionalAccountSession } from "@/lib/server/account-page";
import { customerProfile } from "@/lib/server/accounts";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common"),
    campaign = await getTranslations("campaign");
  return { title: t("start"), description: campaign("intro") };
}
export default async function StartCampaign({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      query.append(key, item);
  }
  const session = await optionalAccountSession();
  const t = await getTranslations("campaign"),
    common = await getTranslations("common");
  return (
    <>
      <section className="page-intro container campaign-intro">
        <span className="eyebrow">{common("start")}</span>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </section>
      <section className="container campaign-page">
        <CampaignWizard
          initialRegion={query.get("region") || ""}
          initialLocation={query.get("location") || ""}
          initialSelection={selectionFromParams(query)}
          initialSpecial={query.get("type") === "special"}
          initialOccasion={query.get("occasion") || ""}
          initialMinutes={query.get("minutes") || ""}
          initialDraft={query.get("draft") || ""}
          initialProfile={session ? customerProfile(session) : null}
        />
      </section>
    </>
  );
}
