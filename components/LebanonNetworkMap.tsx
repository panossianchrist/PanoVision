"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Hand, Plus, Minus, RotateCcw } from "lucide-react";
import Panzoom, { type PanzoomObject } from "@panzoom/panzoom";
import { useTranslations } from "next-intl";
import Link from "next/link";
import map from "@/data/lebanon-map.json";
import { locations } from "@/data/locations";
import type { LocationSelection } from "@/lib/selection";

export const mapRegions = map.regions.map((region) => region.name);
function project(longitude: number, latitude: number) {
  const rad = Math.PI / 180;
  return [
    map.projection.translate[0] + map.projection.scale * longitude * rad,
    map.projection.translate[1] -
      map.projection.scale *
        Math.log(Math.tan(Math.PI / 4 + (latitude * rad) / 2)),
  ];
}

export function LebanonNetworkMap({
  selection,
  onCity,
  onScreen,
}: {
  selection: LocationSelection;
  onCity: (name: string) => void;
  onScreen: (id: string) => void;
}) {
  const t = useTranslations("map");
  const id = useId();
  const scene = useRef<HTMLDivElement>(null);
  const controls = useRef<PanzoomObject | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panEnabled, setPanEnabled] = useState(false);
  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    const panzoom = Panzoom(element, {
      minScale: 1,
      maxScale: 4,
      contain: "outside",
      step: 0.3,
      disablePan: true,
      disableZoom: true,
      touchAction: "pan-y",
      cursor: "default",
      handleStartEvent: () => {},
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 180,
    });
    controls.current = panzoom;
    const update = () => setZoom(panzoom.getScale());
    element.addEventListener("panzoomchange", update);
    return () => {
      element.removeEventListener("panzoomchange", update);
      panzoom.destroy();
      controls.current = null;
    };
  }, []);
  useEffect(() => {
    controls.current?.setOptions({
      disablePan: !panEnabled,
      disableZoom: !panEnabled,
      touchAction: panEnabled ? "none" : "pan-y",
      cursor: panEnabled ? "grab" : "default",
      handleStartEvent: (event) => {
        if (panEnabled) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
    });
  }, [panEnabled]);
  const changeZoom = (direction: number) => {
    controls.current?.zoom(Math.max(1, Math.min(4, zoom + direction * 0.4)), {
      force: true,
      animate: true,
    });
  };
  return (
    <div className="network-map interactive-map" data-map="lebanon">
      <div className="map-topline">
        <span className="micro">{t("title")}</span>
        <span className="map-north" dir="ltr">
          N ↑
        </span>
      </div>
      <div
        className="map-viewport"
        dir="ltr"
        tabIndex={0}
        role="group"
        aria-label={t("title")}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const directions: Record<string, [number, number]> = {
            ArrowLeft: [35, 0],
            ArrowRight: [-35, 0],
            ArrowUp: [0, 35],
            ArrowDown: [0, -35],
          };
          if (directions[event.key] && zoom > 1) {
            event.preventDefault();
            const [x, y] = directions[event.key];
            controls.current?.pan(x, y, { relative: true, force: true });
          }
          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            changeZoom(1);
          }
          if (event.key === "-") {
            event.preventDefault();
            changeZoom(-1);
          }
          if (event.key === "Escape") setPanEnabled(false);
        }}
      >
        <div ref={scene} className="map-scene" data-scale={zoom.toFixed(2)}>
          <svg
            viewBox="0 0 600 680"
            className="geographic-map"
            aria-labelledby={`${id}-title ${id}-description`}
          >
            <title id={`${id}-title`}>{t("title")}</title>
            <desc id={`${id}-description`}>{t("description")}</desc>
            <defs>
              <pattern
                id={`${id}-grid`}
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M60 0H0V60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect
              width="600"
              height="680"
              fill={`url(#${id}-grid)`}
              className="map-grid"
            />
            <path className="country-land" d={map.nationalPath} />
            {map.regions.map((region) => (
              <path key={region.id} className="governorate" d={region.path}>
                <title>{region.name}</title>
              </path>
            ))}
            <path className="country-border" d={map.nationalPath} />
            {map.cities.map((city) => {
              const selected = selection.cities.includes(city.name);
              const west = [
                "Beirut",
                "Jounieh",
                "Byblos",
                "Tripoli",
                "Saida",
                "Tyre",
              ].includes(city.name);
              return (
                <g
                  key={city.geonamesId}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={t(`cityNames.${city.name}`)}
                  className={`city-marker selectable-city panzoom-exclude ${selected ? "is-selected" : ""}`}
                  onClick={() => onCity(city.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onCity(city.name);
                    }
                  }}
                >
                  <circle className="city-hit" cx={city.x} cy={city.y} r="18" />
                  {selected && (
                    <circle
                      key="ripple"
                      className="city-ripple"
                      cx={city.x}
                      cy={city.y}
                      r="13"
                    />
                  )}
                  <circle
                    className="city-ring"
                    cx={city.x}
                    cy={city.y}
                    r={selected ? 9 : 6}
                  />
                  <circle
                    className="city-dot"
                    cx={city.x}
                    cy={city.y}
                    r={selected ? 4.8 : 3.4}
                  />
                  <text
                    x={city.x + (west ? -16 : 16)}
                    y={city.y + 4}
                    textAnchor={west ? "end" : "start"}
                    className={
                      ["Jounieh", "Byblos", "Nabatieh"].includes(city.name) &&
                      zoom < 1.6
                        ? "secondary-city-label"
                        : ""
                    }
                  >
                    {t(`cityNames.${city.name}`)}
                  </text>
                </g>
              );
            })}
            {zoom >= 1.6 &&
              locations.map((location) => {
                const [x, y] = project(location.longitude, location.latitude);
                return (
                  <g
                    key={location.id}
                    className={`screen-pin panzoom-exclude ${selection.screens.includes(location.id) ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${location.name}, ${location.city}`}
                    aria-pressed={selection.screens.includes(location.id)}
                    onClick={() => onScreen(location.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onScreen(location.id);
                      }
                    }}
                  >
                    <circle className="pin-target" cx={x} cy={y} r="17" />
                    <rect x={x - 5} y={y - 4} width="10" height="8" rx="1" />
                    <title>{location.name}</title>
                  </g>
                );
              })}
            <text
              x="64"
              y="325"
              className="sea-label"
              transform="rotate(-65,64,325)"
            >
              {t("mediterranean")}
            </text>
            <text x="435" y="415" className="neighbor-label">
              {t("syria")}
            </text>
          </svg>
        </div>
      </div>
      <div className="map-controls">
        <button
          type="button"
          className="icon-button"
          title={t("zoomIn")}
          aria-label={t("zoomIn")}
          disabled={zoom >= 3.99}
          onClick={() => changeZoom(1)}
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          title={t("zoomOut")}
          aria-label={t("zoomOut")}
          disabled={zoom <= 1.01}
          onClick={() => changeZoom(-1)}
        >
          <Minus size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          title={t("pan")}
          aria-label={t("pan")}
          aria-pressed={panEnabled}
          onClick={() => setPanEnabled((value) => !value)}
        >
          <Hand size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          title={t("reset")}
          aria-label={t("reset")}
          onClick={() => {
            controls.current?.reset({ force: true });
            setPanEnabled(false);
          }}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <div className="map-bottomline">
        <span>
          <span className="legend-dot" />
          {t("cityLegend")}
        </span>
        <output dir="ltr">{zoom.toFixed(1)}×</output>
      </div>
    </div>
  );
}
export function MapAttribution() {
  const t = useTranslations("map");
  return (
    <p className="map-attribution">
      {t("geography")}:{" "}
      <a
        href="https://www.geoboundaries.org/api/current/gbOpen/LBN/ADM1/"
        target="_blank"
        rel="noreferrer"
      >
        geoBoundaries
      </a>{" "}
      /{" "}
      <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
        GeoNames
      </a>{" "}
      · <Link href="/network#map-sources">{t("sources")}</Link>
    </p>
  );
}
