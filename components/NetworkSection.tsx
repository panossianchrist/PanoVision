"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, X, Check, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LebanonNetworkMap, MapAttribution } from "./LebanonNetworkMap";
import { locations } from "@/data/locations";
import {
  campaignUrl,
  cities,
  cleanSelection,
  emptySelection,
  toggleCity,
  toggleScreen,
  type LocationSelection,
} from "@/lib/selection";
import { pricing } from "@/config/pricing";

let memorySelection = "";
function subscribeSelection(listener: () => void) {
  window.addEventListener("pano-map-selection", listener);
  return () => window.removeEventListener("pano-map-selection", listener);
}
function selectionSnapshot() {
  try {
    return sessionStorage.getItem("panoMapSelection") || memorySelection;
  } catch {
    return memorySelection;
  }
}
const serverSnapshot = () => "";

export function NetworkSection({ full = false }: { full?: boolean }) {
  const t = useTranslations("map"),
    common = useTranslations("common"),
    estimate = useTranslations("estimate"),
    extra = useTranslations("extras"),
    locale = useLocale();
  const snapshot = useSyncExternalStore(
    subscribeSelection,
    selectionSnapshot,
    serverSnapshot,
  );
  const selection = useMemo(() => {
    try {
      const saved = JSON.parse(snapshot || "null");
      if (saved && Array.isArray(saved.cities) && Array.isArray(saved.screens))
        return cleanSelection(saved);
    } catch {
      /* Invalid optional preferences are ignored. */
    }
    return emptySelection;
  }, [snapshot]);
  const [focused, setFocused] = useState("");
  const [screen, setScreen] = useState("");
  const update = (next: LocationSelection) => {
    memorySelection = JSON.stringify(next);
    try {
      sessionStorage.setItem("panoMapSelection", memorySelection);
    } catch {
      /* Selection still works without storage. */
    }
    window.dispatchEvent(new Event("pano-map-selection"));
  };
  const onCity = (name: string) => {
    setFocused(name);
    setScreen("");
    update(toggleCity(selection, name));
  };
  const onScreen = (id: string) => {
    setScreen(id);
    const item = locations.find((location) => location.id === id);
    setFocused(item?.city || "");
    update(toggleScreen(selection, id));
  };
  const activeScreen = locations.find((location) => location.id === screen);
  const available = locations.filter(
    (location) => !focused || location.city === focused,
  );
  const currency = activeScreen?.currency || pricing.currency;
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(
      amount,
    );
  return (
    <div className={`network-explorer ${full ? "full-explorer" : ""}`}>
      <div className="network-geography">
        <LebanonNetworkMap
          selection={selection}
          onCity={onCity}
          onScreen={onScreen}
        />
        <MapAttribution />
      </div>
      <div className="network-sidebar">
        <div className="explorer-heading">
          <h3>{t("pick")}</h3>
          <span className="micro" dir="ltr">
            LB / 961
          </span>
        </div>
        <p className="small">{t("availability")}</p>
        <div className="city-options" aria-label={t("pick")}>
          {cities.map((city) => (
            <button
              type="button"
              key={city.name}
              aria-pressed={selection.cities.includes(city.name)}
              onClick={() => onCity(city.name)}
            >
              <span className="city-checkbox">
                {selection.cities.includes(city.name) && <Check size={12} />}
              </span>
              {t(`cityNames.${city.name}`)}
            </button>
          ))}
        </div>
        <div className="selection-summary" aria-live="polite">
          <span className="micro muted">{t("selected")}</span>
          <div className="selection-chips">
            {selection.cities.map((city) => (
              <span key={city}>
                {t(`cityNames.${city}`)}
                <button
                  type="button"
                  aria-label={common("remove", {
                    name: t(`cityNames.${city}`),
                  })}
                  onClick={() => update(toggleCity(selection, city))}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            {selection.screens.map((id) => (
              <span key={id}>
                {locations.find((item) => item.id === id)?.name}
                <button
                  type="button"
                  aria-label={common("remove", {
                    name: locations.find((item) => item.id === id)?.name || "",
                  })}
                  onClick={() => update(toggleScreen(selection, id))}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <strong>{t("count", { count: selection.cities.length })}</strong>
          {!!selection.screens.length && (
            <span>{t("screenCount", { count: selection.screens.length })}</span>
          )}
        </div>
        <div className="network-result">
          <h3>
            {activeScreen?.name ||
              (focused ? t(`cityNames.${focused}`) : t("noSelection"))}
          </h3>
          {focused && (
            <dl className="network-status">
              <div>
                <dt>{t("interest")}</dt>
                <dd>
                  {selection.cities.includes(focused) ||
                  (screen && selection.screens.includes(screen))
                    ? t("chosen")
                    : common("none")}
                </dd>
              </div>
              <div>
                <dt>{t("status")}</dt>
                <dd>{t("review")}</dd>
              </div>
              <div>
                <dt>{t("creative")}</dt>
                <dd>
                  {activeScreen
                    ? [
                        activeScreen.supportsImage ? common("image") : "",
                        activeScreen.supportsVideo ? common("video") : "",
                      ]
                        .filter(Boolean)
                        .join(" / ") || common("pending")
                    : t("formats")}
                </dd>
              </div>
            </dl>
          )}
          {activeScreen && (
            <dl className="network-status">
              <div>
                <dt>{t("operator")}</dt>
                <dd>{activeScreen.operator || common("pending")}</dd>
              </div>
              <div>
                <dt>{extra("region")}</dt>
                <dd>
                  {activeScreen.city} / {activeScreen.region}
                </dd>
              </div>
              <div>
                <dt>{extra("screenStatus")}</dt>
                <dd>{extra(activeScreen.status)}</dd>
              </div>
              <div>
                <dt>{t("dimensions")}</dt>
                <dd>
                  {activeScreen.screenWidth && activeScreen.screenHeight
                    ? `${activeScreen.screenWidth} × ${activeScreen.screenHeight}`
                    : common("pending")}
                </dd>
              </div>
              <div>
                <dt>{t("booking")}</dt>
                <dd>{activeScreen.bookingTypes.join(" / ")}</dd>
              </div>
              {/^[A-Z]{3}$/.test(currency) &&
                typeof activeScreen.baseDailyPrice === "number" &&
                Number.isFinite(activeScreen.baseDailyPrice) &&
                activeScreen.baseDailyPrice > 0 && (
                  <div>
                    <dt>{extra("dayRate")}</dt>
                    <dd>{money(activeScreen.baseDailyPrice)}</dd>
                  </div>
                )}
              {/^[A-Z]{3}$/.test(currency) &&
                typeof activeScreen.baseWeeklyPrice === "number" &&
                Number.isFinite(activeScreen.baseWeeklyPrice) &&
                activeScreen.baseWeeklyPrice > 0 && (
                  <div>
                    <dt>{extra("weekRate")}</dt>
                    <dd>{money(activeScreen.baseWeeklyPrice)}</dd>
                  </div>
                )}
            </dl>
          )}
          {available.length ? (
            <div className="screen-options">
              {available.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  aria-pressed={selection.screens.includes(location.id)}
                  onClick={() => onScreen(location.id)}
                >
                  <MapPin size={16} />
                  {location.name}
                  <span>
                    {selection.screens.includes(location.id) ? (
                      <Check size={16} />
                    ) : (
                      "+"
                    )}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="small muted">
              {focused ? t("empty") : t("expanded")}
            </p>
          )}
        </div>
        <p className="small estimate-note">{estimate("pending")}</p>
        <div className="network-actions">
          <Link className="button" href={campaignUrl(selection)}>
            {t("plan")}
            <ArrowUpRight size={17} />
          </Link>
          <button
            type="button"
            className="text-link"
            disabled={!selection.cities.length && !selection.screens.length}
            onClick={() => {
              update(emptySelection);
              setFocused("");
              setScreen("");
            }}
          >
            {common("clear")}
          </button>
        </div>
      </div>
    </div>
  );
}
