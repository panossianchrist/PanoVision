"use client";
import { useLocale, useTranslations } from "next-intl";
import { campaignScreenIds, estimateCampaign } from "@/lib/pricing";
import type { CampaignValues } from "@/lib/validation";
export function CampaignEstimate({ values }: { values: CampaignValues }) {
  const t = useTranslations("estimate"),
    locale = useLocale();
  const estimate = estimateCampaign({
    cities: values.selectedCities || [],
    screens: values.selectedScreens || [],
    booking: values.campaignType,
    startDate: values.startDate,
    endDate: values.endDate,
    specialMinutes:
      values.duration === "Custom"
        ? Number(values.customDuration)
        : values.duration === "10 minutes"
          ? 10
          : 5,
    packageId: values.packageId,
  });
  return (
    <section className="campaign-estimate" aria-live="polite">
      <h3>{t("title")}</h3>
      <dl>
        <div>
          <dt>{t("areas")}</dt>
          <dd>
            {new Intl.NumberFormat(locale).format(
              values.selectedCities?.length || 0,
            )}
          </dd>
        </div>
        <div>
          <dt>{t("screens")}</dt>
          <dd>
            {new Intl.NumberFormat(locale).format(
              campaignScreenIds({
                screens: values.selectedScreens || [],
                packageId: values.packageId,
              }).length,
            )}
          </dd>
        </div>
      </dl>
      {estimate.status === "estimated" ? (
        <>
          <strong className="estimate-total">
            {new Intl.NumberFormat(locale, {
              style: "currency",
              currency: estimate.currency,
            }).format(estimate.total)}
          </strong>
          <p>{t(estimate.period, { count: estimate.units })}</p>
          {estimate.discountPercent > 0 && (
            <p className="small">
              {t("discount", { percent: estimate.discountPercent })}
            </p>
          )}
          <p className="small">{t("only")}</p>
        </>
      ) : (
        <p className="small">
          {t(estimate.reason === "dates" ? "dates" : "unconfigured")}
        </p>
      )}
    </section>
  );
}
