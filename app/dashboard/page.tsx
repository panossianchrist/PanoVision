import Link from "next/link";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { accountPageSession } from "@/lib/server/account-page";
import { customerCampaigns, customerProfile } from "@/lib/server/accounts";
export default async function DashboardPage() {
  const session = await accountPageSession(),
    profile = customerProfile(session),
    campaigns = customerCampaigns(session),
    t = await getTranslations("account"),
    common = await getTranslations("common"),
    locale = await getLocale();
  const counts = {
    active: campaigns.filter((item) =>
      ["requested", "business_approved", "paid", "scheduled", "live"].includes(
        item.businessStatus,
      ),
    ).length,
    review: campaigns.filter(
      (item) =>
        item.businessStatus === "requested" ||
        ["manual_review", "processing", "uploaded"].includes(
          item.creative?.status || "",
        ),
    ).length,
    payment: campaigns.filter(
      (item) =>
        item.quote &&
        item.paymentStatus === "pending" &&
        !["cancelled", "completed"].includes(item.businessStatus),
    ).length,
    scheduled: campaigns.filter((item) => item.businessStatus === "scheduled")
      .length,
    live: campaigns.filter((item) => item.businessStatus === "live").length,
    completed: campaigns.filter((item) => item.businessStatus === "completed")
      .length,
  };
  return (
    <>
      <header className="dashboard-heading">
        <span className="eyebrow">{profile.company}</span>
        <h1>{t("overview")}</h1>
      </header>
      <dl className="dashboard-metrics">
        {Object.entries(counts).map(([key, value]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{new Intl.NumberFormat(locale).format(value)}</dd>
          </div>
        ))}
      </dl>
      {campaigns.length ? (
        <div className="campaign-list">
          <h2>{t("all")}</h2>
          {campaigns.map((campaign) => (
            <Link
              className="campaign-list-row"
              key={campaign.id}
              href={`/dashboard/${campaign.id}`}
            >
              <div>
                <strong>{campaign.name}</strong>
                <span>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeZone: "Asia/Beirut",
                  }).format(campaign.updatedAt)}
                </span>
              </div>
              <span
                className={`campaign-status status-${campaign.businessStatus}`}
              >
                {t(`statuses.${campaign.businessStatus}`)}
              </span>
              <span className="creative-status">
                {campaign.creative
                  ? t(`statuses.${campaign.creative.status}`)
                  : t("noCreative")}
              </span>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="dashboard-empty">
          <FolderOpen size={35} />
          <h2>{t("emptyTitle")}</h2>
          <p>{t("emptyText")}</p>
          <Link className="button" href="/start-campaign">
            {common("start")}
            <ArrowUpRight size={17} />
          </Link>
        </div>
      )}
    </>
  );
}
