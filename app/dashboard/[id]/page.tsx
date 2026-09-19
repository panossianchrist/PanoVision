import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ArrowUpRight, MonitorCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { accountPageSession } from "@/lib/server/account-page";
import { customerCampaign } from "@/lib/server/accounts";
import { ServiceError } from "@/lib/server/errors";
import { locations } from "@/data/locations";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await accountPageSession(`/dashboard/${id}`);
  const t = await getTranslations("account"),
    common = await getTranslations("common"),
    map = await getTranslations("map"),
    locale = await getLocale();
  let campaign;
  try {
    campaign = customerCampaign(id, session);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  const details = campaign.details;
  const date = (value: number) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Beirut",
    }).format(value);
  const areas = Array.isArray(details.selectedCities)
    ? (details.selectedCities as string[])
    : [];
  const screens = Array.isArray(details.selectedScreens)
    ? (details.selectedScreens as string[])
    : [];
  return (
    <>
      <header className="dashboard-heading">
        <span className="eyebrow">{t("campaign")}</span>
        <h1>{campaign.name}</h1>
        <span className={`campaign-status status-${campaign.businessStatus}`}>
          {t(`statuses.${campaign.businessStatus}`)}
        </span>
      </header>
      <div className="campaign-detail-layout">
        <div>
          <section className="detail-section">
            <h2>{t("locations")}</h2>
            <div className="selection-chips">
              {areas.map((city) => (
                <span key={city}>
                  {map.has(`cityNames.${city}`)
                    ? map(`cityNames.${city}`)
                    : city}
                </span>
              ))}
            </div>
            <p>{String(details.city || details.region || "")}</p>
            {screens.map((screen) => (
              <p key={screen}>
                {locations.find((item) => item.id === screen)?.name || screen}
              </p>
            ))}
            <p className="small">{map("availability")}</p>
            <h3>{t("dates")}</h3>
            <p>
              {String(details.startDate || common("pending"))} /{" "}
              {String(details.endDate || common("pending"))}
              {details.preferredTime
                ? ` / ${String(details.preferredTime)}`
                : ""}
            </p>
          </section>
          <section className="detail-section">
            <h2>{t("creative")}</h2>
            {campaign.creative ? (
              <>
                <h3>{campaign.creative.filename}</h3>
                <span className="campaign-status">
                  {t(`statuses.${campaign.creative.status}`)}
                </span>
                {campaign.creative.previewAvailable ? (
                  <div className="customer-creative">
                    {campaign.creative.mediaType === "image" ? (
                      // Authenticated media must not enter the public image cache.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/account/campaigns/${id}/creative`}
                        alt={campaign.creative.filename}
                      />
                    ) : (
                      <video
                        controls
                        playsInline
                        muted
                        preload="metadata"
                        src={`/api/account/campaigns/${id}/creative`}
                      />
                    )}
                  </div>
                ) : (
                  <p>{t("previewUnavailable")}</p>
                )}
              </>
            ) : (
              <p>{t("noCreative")}</p>
            )}
            <p className="small">{t("moderationNote")}</p>
            {["draft", "paused"].includes(campaign.businessStatus) && (
              <Link className="text-link" href={`/start-campaign?draft=${id}`}>
                {t("editDraft")}
                <ArrowUpRight size={16} />
              </Link>
            )}
          </section>
        </div>
        <aside>
          <section className="detail-section">
            <h2>{t("quote")}</h2>
            {campaign.quote ? (
              <>
                <strong className="quote-amount">
                  {new Intl.NumberFormat(locale, {
                    style: "currency",
                    currency: campaign.quote.currency,
                  }).format(campaign.quote.amount)}
                </strong>
                <p>{campaign.quote.notes}</p>
              </>
            ) : (
              <p>{t("noQuote")}</p>
            )}
            <dl className="network-status">
              <div>
                <dt>{t("paymentStatus")}</dt>
                <dd>{t(campaign.paymentStatus)}</dd>
              </div>
              <div>
                <dt>{t("scheduleStatus")}</dt>
                <dd>{t(campaign.scheduleStatus)}</dd>
              </div>
            </dl>
            <p className="small">{t("paymentNote")}</p>
          </section>
        </aside>
      </div>
      <section className="detail-section proof-section">
        <div className="proof-heading">
          <h2>{t("proof")}</h2>
          <a
            className="text-link"
            href={`/api/account/campaigns/${id}/report`}
            download
          >
            <Download size={17} />
            {common("download")}
          </a>
        </div>
        {campaign.evidence.length ? (
          <div className="proof-events">
            {campaign.evidence.map((event) => (
              <article key={event.id}>
                <h3>
                  {event.screenName} / {event.city}
                </h3>
                <time dateTime={new Date(event.playedAt).toISOString()}>
                  {date(event.playedAt)}
                </time>
                <p>{event.creativeName}</p>
                {event.playCount !== null && (
                  <p>
                    {t("playCount")}: {event.playCount}
                  </p>
                )}
                <span className="micro">{t(event.source)}</span>
                <p>{event.notes}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="proof-empty">
            <MonitorCheck size={27} />
            <div>
              <h3>{t("noProof")}</h3>
              <p>{t("proofText")}</p>
            </div>
          </div>
        )}
        <p className="small">{t("proofNote")}</p>
      </section>
    </>
  );
}
