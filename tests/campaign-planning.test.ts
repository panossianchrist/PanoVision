import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  campaignUrl,
  cleanSelection,
  selectionFromParams,
  toggleCity,
  toggleScreen,
} from "../lib/selection.ts";
import { campaignScreenIds, estimateCampaign } from "../lib/pricing.ts";
import { pricing, type PricingConfig } from "../config/pricing.ts";
import { locations, type ScreenLocation } from "../data/locations.ts";
import { campaignSchema } from "../lib/server/campaign-schema.ts";
import { emptyCampaign, validateCampaignStep } from "../lib/validation.ts";
import { company, whatsappLink } from "../lib/company.ts";
import { screenRatio } from "../lib/creative-preview.ts";
const screen: ScreenLocation = {
  id: "synthetic-screen",
  name: "Synthetic screen",
  city: "Beirut",
  region: "Beirut",
  latitude: 33.89,
  longitude: 35.5,
  status: "live",
  videoDuration: 8,
  supportsImage: true,
  supportsVideo: true,
  bookingTypes: ["Daily", "Weekly", "Special occasion"],
  baseDailyPrice: 10,
  baseWeeklyPrice: 60,
  specialEventPrices: { "5": 20, "10": 30, "15": 40 },
  currency: "USD",
};
const config: PricingConfig = {
  currency: "USD",
  areas: {
    Beirut: {
      daily: 100,
      weekly: 600,
      special: { "5": 200, "10": 300, "15": 400 },
    },
    Tripoli: { daily: 50, weekly: 300, special: { "5": 100, "10": 150 } },
  },
  packages: [],
  multiLocationDiscount: null,
};
const input = {
  cities: ["Beirut"],
  screens: [],
  booking: "Daily",
  startDate: "2027-01-01",
  endDate: "2027-01-03",
};
test("city multi-selection preserves prior choices and removing one leaves the others", () => {
  let selection = { cities: [] as string[], screens: [] as string[] };
  for (const city of ["Beirut", "Jounieh", "Tripoli"])
    selection = toggleCity(selection, city);
  assert.deepEqual(selection.cities, ["Beirut", "Jounieh", "Tripoli"]);
  assert.deepEqual(toggleCity(selection, "Jounieh").cities, [
    "Beirut",
    "Tripoli",
  ]);
});
test("selection URL round-trips, deduplicates and discards unknown inventory", () => {
  const selection = { cities: ["Beirut", "Tripoli"], screens: [] };
  const url = campaignUrl(selection, true);
  assert.deepEqual(
    selectionFromParams(new URL(url, "https://example.com").searchParams),
    selection,
  );
  assert.match(url, /type=special/);
  assert.deepEqual(
    selectionFromParams(
      new URLSearchParams(
        "city=Beirut&city=Beirut&city=Invented&screen=not-real",
      ),
    ),
    { cities: ["Beirut"], screens: [] },
  );
});
test("choosing a real screen removes its whole-city selection without losing other cities", () => {
  const selection = toggleScreen(
    { cities: ["Beirut", "Tripoli"], screens: [] },
    screen.id,
    [screen],
  );
  assert.deepEqual(selection, { cities: ["Tripoli"], screens: [screen.id] });
  assert.deepEqual(
    cleanSelection({ cities: ["Beirut"], screens: [screen.id] }, [screen]),
    { cities: ["Beirut"], screens: [] },
  );
});
test("unconfigured production inventory and pricing never produce a zero or invented price", () => {
  assert.deepEqual(locations, []);
  assert.equal(pricing.currency, "");
  assert.equal(estimateCampaign(input).status, "pending");
  assert.equal(estimateCampaign({ ...input, cities: [] }).status, "pending");
  assert.equal(
    estimateCampaign({ ...input, cities: [], screens: ["unknown"] }, config, [
      screen,
    ]).status,
    "pending",
  );
});
test("daily and weekly estimates use inclusive dates and configured rates", () => {
  assert.deepEqual(estimateCampaign(input, config), {
    status: "estimated",
    total: 300,
    currency: "USD",
    units: 3,
    period: "day",
    discountPercent: 0,
  });
  assert.deepEqual(
    estimateCampaign(
      { ...input, booking: "Weekly", endDate: "2027-01-08" },
      config,
    ),
    {
      status: "estimated",
      total: 1200,
      currency: "USD",
      units: 2,
      period: "week",
      discountPercent: 0,
    },
  );
  assert.equal(
    estimateCampaign({ ...input, endDate: input.startDate }, config).status,
    "estimated",
  );
});
test("invalid, reversed, missing and normalized calendar dates cannot produce estimates", () => {
  for (const bad of [
    { startDate: "" },
    { endDate: "" },
    { endDate: "2026-12-31" },
    { startDate: "2027-02-30" },
    { startDate: "2027-99-99" },
  ])
    assert.equal(
      estimateCampaign({ ...input, ...bad }, config).status,
      "pending",
    );
});
test("special occasion estimates require an exact configured duration", () => {
  for (const [minutes, total] of [
    [5, 200],
    [10, 300],
    [15, 400],
  ])
    assert.deepEqual(
      estimateCampaign(
        { ...input, booking: "Special occasion", specialMinutes: minutes },
        config,
      ),
      {
        status: "estimated",
        total,
        currency: "USD",
        units: 1,
        period: "event",
        discountPercent: 0,
      },
    );
  for (const minutes of [0, 6, -1, 1.5, Infinity, 1441])
    assert.equal(
      estimateCampaign(
        { ...input, booking: "Special occasion", specialMinutes: minutes },
        config,
      ).status,
      "pending",
    );
});
test("missing rates, invalid amounts and mixed currencies block an estimate", () => {
  for (const amount of [null, undefined, 0, -1, NaN, Infinity])
    assert.equal(
      estimateCampaign(input, {
        ...config,
        areas: { Beirut: { daily: amount } },
      }).status,
      "pending",
    );
  assert.equal(
    estimateCampaign(
      { ...input, screens: [screen.id], cities: ["Tripoli"] },
      config,
      [{ ...screen, currency: "EUR" }],
    ).status,
    "pending",
  );
  assert.equal(
    estimateCampaign({ ...input, screens: [screen.id] }, config, [screen])
      .status,
    "pending",
  );
});
test("packages deduplicate screens and apply only the larger configured discount", () => {
  const packageConfig = {
    ...config,
    packages: [
      {
        id: "synthetic-package",
        name: "Synthetic package",
        screenIds: [screen.id],
        discountPercent: 10,
      },
    ],
    multiLocationDiscount: { minimumLocations: 2, percent: 15 },
  };
  assert.deepEqual(
    estimateCampaign(
      {
        ...input,
        cities: [],
        screens: [screen.id],
        packageId: "synthetic-package",
      },
      packageConfig,
      [screen],
    ),
    {
      status: "estimated",
      total: 27,
      currency: "USD",
      units: 3,
      period: "day",
      discountPercent: 10,
    },
  );
  assert.deepEqual(
    estimateCampaign(
      {
        ...input,
        cities: ["Tripoli"],
        screens: [screen.id],
        packageId: "synthetic-package",
      },
      packageConfig,
      [screen],
    ),
    {
      status: "estimated",
      total: 153,
      currency: "USD",
      units: 3,
      period: "day",
      discountPercent: 15,
    },
  );
  assert.equal(
    estimateCampaign({ ...input, packageId: "unknown" }, packageConfig, [
      screen,
    ]).status,
    "pending",
  );
});
test("special occasions need a date, Beirut time and bounded numeric custom minutes", () => {
  const values = {
    ...emptyCampaign,
    campaignType: "Special occasion",
    duration: "Custom",
    customDuration: "15 minutes",
  };
  assert.ok(validateCampaignStep(3, values).customDuration);
  assert.ok(validateCampaignStep(3, values).startDate);
  assert.ok(validateCampaignStep(3, values).preferredTime);
  assert.deepEqual(
    validateCampaignStep(3, {
      ...values,
      customDuration: "15",
      startDate: "2099-01-01",
      preferredTime: "18:30",
    }),
    {},
  );
  assert.deepEqual(
    validateCampaignStep(2, {
      ...emptyCampaign,
      locationPreference: "Area / region",
      selectedCities: ["Beirut"],
    }),
    {},
  );
});
test("server accepts real city selections but rejects fabricated screens and approval data", () => {
  const values = {
    ...emptyCampaign,
    company: "Test",
    contact: "Test",
    email: "test@example.com",
    campaign: "Test",
    selectedCities: ["Beirut", "Tripoli"],
  };
  assert.equal(campaignSchema.safeParse(values).success, true);
  for (const change of [
    { selectedCities: ["Beirut", "Beirut"] },
    { selectedCities: ["Invented"] },
    { selectedScreens: ["invented"] },
    { selectedLocation: "invented" },
    { approved: true },
    { packageId: "invented" },
  ])
    assert.equal(
      campaignSchema.safeParse({ ...values, ...change }).success,
      false,
    );
});
test("contacts are canonical and WhatsApp is absent until a valid number is configured", () => {
  assert.equal(company.email, "panovision@gmail.com");
  assert.equal(company.instagram, "https://www.instagram.com/PanoVisionlb/");
  assert.equal(whatsappLink("en"), null);
  for (const value of [
    "",
    "Add phone number",
    "javascript:alert(1)",
    "00123",
    "123",
    "+96170123456?x=y",
  ])
    assert.equal(whatsappLink("en", value), null);
  const url = new URL(whatsappLink("fr", "+961 (70) 123-456")!);
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.pathname, "/96170123456");
  assert.match(url.searchParams.get("text")!, /PanoVision/);
});
test("English, French and Arabic provide identical translation keys", () => {
  function keys(value: Record<string, unknown>, prefix = ""): string[] {
    return Object.entries(value)
      .flatMap(([key, item]) =>
        typeof item === "object"
          ? keys(item as Record<string, unknown>, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      )
      .sort();
  }
  const messages = ["en", "fr", "ar"].map((locale) =>
    JSON.parse(
      readFileSync(
        new URL(`../messages/${locale}.json`, import.meta.url),
        "utf8",
      ),
    ),
  );
  assert.deepEqual(keys(messages[0]), keys(messages[1]));
  assert.deepEqual(keys(messages[0]), keys(messages[2]));
});
test("configured screen dimensions preserve landscape and portrait orientation", () => {
  assert.equal(
    screenRatio({ ...screen, screenWidth: 3840, screenHeight: 640 }),
    6,
  );
  assert.equal(
    screenRatio({ ...screen, screenWidth: 1080, screenHeight: 1920 }),
    9 / 16,
  );
  assert.equal(screenRatio({ ...screen, aspectRatio: "9:16" }), 9 / 16);
  assert.equal(
    screenRatio({
      ...screen,
      screenWidth: -1,
      screenHeight: 0,
      aspectRatio: "invalid",
    }),
    16 / 5,
  );
});
test("estimates round to the configured currency's minor unit", () => {
  const result = estimateCampaign(
    { ...input, endDate: input.startDate },
    { ...config, currency: "KWD", areas: { Beirut: { daily: 1.2344 } } },
  );
  assert.equal(result.status, "estimated");
  if (result.status === "estimated") assert.equal(result.total, 1.234);
  const yen = estimateCampaign(
    { ...input, endDate: input.startDate },
    { ...config, currency: "JPY", areas: { Beirut: { daily: 100.7 } } },
  );
  assert.equal(yen.status, "estimated");
  if (yen.status === "estimated") assert.equal(yen.total, 101);
});

test("package previews and estimates share a deduplicated screen selection", () => {
  const config: PricingConfig = {
    ...pricing,
    packages: [
      {
        id: "test-package",
        name: "Test only",
        screenIds: ["screen-a", "screen-b"],
      },
    ],
  };
  assert.deepEqual(
    campaignScreenIds(
      { screens: ["screen-a", "screen-c"], packageId: "test-package" },
      config,
    ),
    ["screen-a", "screen-c", "screen-b"],
  );
  assert.deepEqual(
    campaignScreenIds({ screens: [], packageId: "missing" }, config),
    [],
  );
});
