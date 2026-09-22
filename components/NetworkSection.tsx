"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, X, Check, MonitorPlay } from "lucide-react";
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
import { formatCoordinate } from "@/lib/geo";
import { useReducedMotion } from "@/lib/motion";
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
    locale = useLocale(),
    router = useRouter(),
    reduced = useReducedMotion();
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
  const [launching, setLaunching] = useState(false);
  const launchTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(launchTimer.current), []);
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
  const count = selection.cities.length;
  const hasSelection = count > 0 || selection.screens.length > 0;
  const url = campaignUrl(selection);
  const plan = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      !hasSelection ||
      reduced ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button !== 0
    )
      return;
    event.preventDefault();
    setLaunching(true);
    launchTimer.current = window.setTimeout(() => router.push(url), 640);
  };

  return (
    <div
      className={`pv-net ${full ? "is-full" : ""}`}
      data-launching={launching}
    >
      <div className="pv-net-stage">
        <LebanonNetworkMap
          selection={selection}
          onCity={onCity}
          onScreen={onScreen}
        />
        <MapAttribution />
      </div>

      <aside className="pv-reach" aria-label={t("reach")}>
        <header className="pv-reach-head">
          <span className="micro">{t("reach")}</span>
          <span className="micro" dir="ltr">
            LB / 961
          </span>
        </header>

        <div className="pv-reach-count">
          <output className="pv-count-num" aria-live="polite" key={count}>
            {String(count).padStart(2, "0")}
          </output>
          <span>{t("reachAreas", { count })}</span>
        </div>

        <p className="small pv-reach-note">{t("availability")}</p>

        <div className="city-options" role="group" aria-label={t("pick")}>
          {cities.map((city) => {
            const on = selection.cities.includes(city.name);
            return (
              <button
                type="button"
                key={city.name}
                aria-pressed={on}
                onClick={() => onCity(city.name)}
              >
                <span className="city-checkbox" aria-hidden="true">
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                {t(`cityNames.${city.name}`)}
                <span className="pv-city-geo" dir="ltr" aria-hidden="true">
                  {formatCoordinate(city.longitude, city.latitude)}
                </span>
              </button>
            );
          })}
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
                  <X size={13} />
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
                  <X size={13} />
                </button>
              </span>
            ))}
            {!hasSelection && (
              <span className="pv-chip-empty">{t("noSelection")}</span>
            )}
          </div>
          {!!selection.screens.length && (
            <strong className="pv-screens-count">
              {t("screenCount", { count: selection.screens.length })}
            </strong>
          )}
        </div>

        <dl className="pv-facts">
          <div>
            <dt>{t("factType")}</dt>
            <dd>{t("factTypeValue")}</dd>
          </div>
          <div>
            <dt>{t("factScreens")}</dt>
            <dd>{t("review")}</dd>
          </div>
          <div>
            <dt>{t("factPrice")}</dt>
            <dd>{t("factPriceValue")}</dd>
          </div>
        </dl>

        <div className="pv-screenlayer">
          <div className="pv-screenlayer-head">
            <MonitorPlay size={15} />
            <span className="micro">{t("screens")}</span>
            <h3>
              {activeScreen?.name || (focused ? t(`cityNames.${focused}`) : "")}
            </h3>
          </div>
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
                <dt>{t("creative")}</dt>
                <dd>
                  {[
                    activeScreen.supportsImage ? common("image") : "",
                    activeScreen.supportsVideo ? common("video") : "",
                  ]
                    .filter(Boolean)
                    .join(" / ") || common("pending")}
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
                  <MonitorPlay size={15} />
                  {location.name}
                  <span>
                    {selection.screens.includes(location.id) ? (
                      <Check size={15} />
                    ) : (
                      t("screen")
                    )}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="small pv-screenlayer-empty">
              {focused ? t("empty") : t("expanded")}
            </p>
          )}
        </div>

        <p className="small estimate-note">{estimate("pending")}</p>
        <div className="network-actions">
          <Link className="pv-button" href={url} onClick={plan}>
            <span>{t("plan")}</span>
            <ArrowUpRight size={17} />
          </Link>
          <button
            type="button"
            className="pv-clear"
            disabled={!hasSelection}
            onClick={() => {
              update(emptySelection);
              setFocused("");
              setScreen("");
            }}
          >
            {common("clear")}
          </button>
        </div>
      </aside>
    </div>
  );
}
