import { pricing, type PricingConfig, type Rates } from "../config/pricing";
import { locations, type ScreenLocation } from "../data/locations";
import type { LocationSelection } from "./selection";

export type EstimateInput = LocationSelection & {
  booking: string;
  startDate?: string;
  endDate?: string;
  specialMinutes?: number;
  packageId?: string;
};
export type Estimate =
  | { status: "pending"; reason: "inventory" | "dates" | "rates" | "currency" }
  | {
      status: "estimated";
      total: number;
      currency: string;
      units: number;
      period: "day" | "week" | "event";
      discountPercent: number;
    };

export function campaignScreenIds(
  input: { screens: string[]; packageId?: string },
  config: PricingConfig = pricing,
) {
  const selectedPackage = config.packages.find(
    (item) => item.id === input.packageId,
  );
  return [
    ...new Set([...input.screens, ...(selectedPackage?.screenIds || [])]),
  ];
}

export function estimateCampaign(
  input: EstimateInput,
  config: PricingConfig = pricing,
  inventory: ScreenLocation[] = locations,
): Estimate {
  const pending = (
    reason: "inventory" | "dates" | "rates" | "currency",
  ): Estimate => ({ status: "pending", reason });
  const selectedPackage = input.packageId
    ? config.packages.find((item) => item.id === input.packageId)
    : undefined;
  if (input.packageId && !selectedPackage) return pending("inventory");
  const screenIds = campaignScreenIds(input, config);
  const screens = screenIds.map((id) =>
    inventory.find((screen) => screen.id === id),
  );
  if (
    screens.some((screen) => !screen) ||
    screens.some((screen) => input.cities.includes(screen!.city))
  )
    return pending("inventory");
  const rates: Rates[] = [...new Set(input.cities)].map(
    (city) => config.areas[city] || {},
  );
  rates.push(
    ...screens.map((screen) => ({
      daily: screen!.baseDailyPrice,
      weekly: screen!.baseWeeklyPrice,
      special: screen!.specialEventPrices,
      currency: screen!.currency,
    })),
  );
  if (!rates.length) return pending("inventory");
  let units = 1;
  const period =
    input.booking === "Daily"
      ? "day"
      : input.booking === "Weekly"
        ? "week"
        : "event";
  if (!["Daily", "Weekly", "Special occasion"].includes(input.booking))
    return pending("rates");
  if (period !== "event") {
    const start = Date.parse(`${input.startDate}T00:00:00Z`),
      end = Date.parse(`${input.endDate}T00:00:00Z`);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end < start ||
      new Date(start).toISOString().slice(0, 10) !== input.startDate ||
      new Date(end).toISOString().slice(0, 10) !== input.endDate
    )
      return pending("dates");
    const days = (end - start) / 86400000 + 1;
    units = period === "week" ? Math.ceil(days / 7) : days;
    if (units > 3660) return pending("dates");
  } else if (
    !Number.isSafeInteger(input.specialMinutes) ||
    input.specialMinutes! < 1 ||
    input.specialMinutes! > 1440
  )
    return pending("dates");
  const currencies = new Set(
    rates.map((rate) => rate.currency || config.currency),
  );
  const currency = [...currencies][0];
  if (currencies.size !== 1 || !/^[A-Z]{3}$/.test(currency))
    return pending("currency");
  const amounts = rates.map((rate) =>
    period === "day"
      ? rate.daily
      : period === "week"
        ? rate.weekly
        : rate.special?.[String(input.specialMinutes)],
  );
  if (
    amounts.some(
      (amount) =>
        typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0,
    )
  )
    return pending("rates");
  const multi = config.multiLocationDiscount;
  const discount = Math.max(
    selectedPackage?.discountPercent || 0,
    multi && rates.length >= multi.minimumLocations ? multi.percent : 0,
  );
  if (!Number.isFinite(discount) || discount < 0 || discount >= 100)
    return pending("rates");
  const fractionDigits = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits!;
  const factor = 10 ** fractionDigits;
  const total =
    Math.round(
      amounts.reduce<number>((sum, amount) => sum + amount!, 0) *
        units *
        (1 - discount / 100) *
        factor,
    ) / factor;
  if (
    !Number.isFinite(total) ||
    total <= 0 ||
    total > Number.MAX_SAFE_INTEGER / factor
  )
    return pending("rates");
  return {
    status: "estimated",
    total,
    currency,
    units,
    period,
    discountPercent: discount,
  };
}
