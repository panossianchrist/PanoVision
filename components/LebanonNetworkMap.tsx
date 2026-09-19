"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import Panzoom, { type PanzoomObject } from "@panzoom/panzoom";
import { useTranslations } from "next-intl";
import Link from "next/link";
import map from "@/data/lebanon-map.json";
import { seaPath } from "@/data/lebanon-sea";
import { locations } from "@/data/locations";
import type { LocationSelection } from "@/lib/selection";
import {
  buildLinks,
  formatCoordinate,
  frameCities,
  graticule,
  project,
  unproject,
  view,
} from "@/lib/geo";
import { useFinePointer, useReducedMotion } from "@/lib/motion";

export const mapRegions = map.regions.map((region) => region.name);

const WEST = ["Beirut", "Jounieh", "Byblos", "Tripoli", "Saida", "Tyre"];
const SECONDARY = ["Jounieh", "Byblos", "Nabatieh"];
const MIN_SCALE = 1;
const MAX_SCALE = 6;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

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
  const reduced = useReducedMotion();
  const fine = useFinePointer();
  const viewport = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const signal = useRef<SVGCircleElement>(null);
  const readout = useRef<HTMLOutputElement>(null);
  const controls = useRef<PanzoomObject | null>(null);
  const zoomed = useRef(false);
  const frameId = useRef(0);
  const previous = useRef<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [compact, setCompact] = useState(false);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef(0);

  const cities = selection.cities;
  const links = useMemo(() => buildLinks(cities), [cities]);

  const stop = () => {
    if (frameId.current) cancelAnimationFrame(frameId.current);
    frameId.current = 0;
  };

  // Camera: eased move to a target framing, written through Panzoom so drag/wheel stay in sync.
  const flyTo = (target: { scale: number; x: number; y: number }, animate = true) => {
    const panzoom = controls.current;
    const element = scene.current;
    if (!panzoom || !element || !element.offsetWidth) return;
    stop();
    const k = element.offsetWidth / view.width;
    const goal = {
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, target.scale)),
      x: element.offsetWidth / 2 - (target.x - view.x) * k,
      y: element.offsetHeight / 2 - (target.y - view.y) * k,
    };
    const from = { scale: panzoom.getScale(), ...panzoom.getPan() };
    const apply = (s: number, x: number, y: number) => {
      panzoom.zoom(s, { animate: false, force: true });
      panzoom.pan(x, y, { animate: false, force: true });
    };
    if (!animate || reduced) {
      apply(goal.scale, goal.x, goal.y);
      return;
    }
    const start = performance.now();
    const duration = 620;
    const step = (now: number) => {
      const e = easeOut(Math.min(1, (now - start) / duration));
      apply(
        from.scale + (goal.scale - from.scale) * e,
        from.x + (goal.x - from.x) * e,
        from.y + (goal.y - from.y) * e,
      );
      frameId.current = e < 1 ? requestAnimationFrame(step) : 0;
    };
    frameId.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const element = scene.current;
    const frame = viewport.current;
    if (!element || !frame) return;
    const panzoom = Panzoom(element, {
      minScale: MIN_SCALE,
      maxScale: MAX_SCALE,
      contain: "outside",
      step: 0.35,
      panOnlyWhenZoomed: true,
      touchAction: "pan-y",
      cursor: "default",
      handleStartEvent: (event) => {
        if (zoomed.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
    });
    controls.current = panzoom;
    const update = () => {
      const scale = panzoom.getScale();
      element.style.setProperty("--k", (1 / scale).toFixed(4));
      element.dataset.scale = scale.toFixed(2);
      setZoom(scale);
      const isZoomed = scale > 1.02;
      if (isZoomed !== zoomed.current) {
        zoomed.current = isZoomed;
        panzoom.setOptions({
          touchAction: isZoomed ? "none" : "pan-y",
          cursor: isZoomed ? "grab" : "default",
        });
      }
    };
    element.addEventListener("panzoomchange", update);
    update();
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        stop();
        panzoom.zoomWithWheel(event);
      } else {
        // Plain scrolling always moves the page; hint how to zoom.
        setHint(true);
        window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setHint(false), 1400);
      }
    };
    frame.addEventListener("wheel", wheel, { passive: false });
    const observer = new ResizeObserver(([entry]) =>
      setCompact(entry.contentRect.width < 520),
    );
    observer.observe(frame);
    return () => {
      stop();
      window.clearTimeout(hintTimer.current);
      frame.removeEventListener("wheel", wheel);
      element.removeEventListener("panzoomchange", update);
      observer.disconnect();
      panzoom.destroy();
      controls.current = null;
    };
  }, []);

  // React to selection: frame it gently, and send one signal along a newly created link.
  const key = cities.join("|");
  useEffect(() => {
    const before = previous.current;
    previous.current = cities;
    if (key === before.join("|")) return;
    if (cities.length) flyTo(frameCities(cities));
    else flyTo({ scale: 1, x: view.x + view.width / 2, y: view.y + view.height / 2 });
    const added = cities.find((name) => !before.includes(name));
    const link = added ? links.find((item) => item.to === added) : null;
    const dot = signal.current;
    const path = link
      ? svg.current?.querySelector<SVGPathElement>(`[data-link="${CSS.escape(link.id)}"]`)
      : null;
    if (!dot || !path || reduced) return;
    const total = path.getTotalLength();
    const start = performance.now();
    const duration = 700;
    let raf = 0;
    const run = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const point = path.getPointAtLength(total * easeOut(p));
      dot.setAttribute("cx", point.x.toFixed(1));
      dot.setAttribute("cy", point.y.toFixed(1));
      dot.style.opacity = String(Math.sin(Math.PI * Math.min(1, p * 1.08)));
      if (p < 1) raf = requestAnimationFrame(run);
      else dot.style.opacity = "0";
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const changeZoom = (factor: number) => {
    const panzoom = controls.current;
    if (!panzoom) return;
    stop();
    panzoom.zoom(Math.min(MAX_SCALE, Math.max(MIN_SCALE, panzoom.getScale() * factor)), {
      animate: !reduced,
      force: true,
    });
  };
  const reset = () => flyTo({ scale: 1, x: view.x + view.width / 2, y: view.y + view.height / 2 });

  const onPointerMove = (event: React.PointerEvent) => {
    if (!fine || !readout.current || !svg.current) return;
    const matrix = svg.current.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const [lon, lat] = unproject(point.x, point.y);
    readout.current.textContent = formatCoordinate(lon, lat);
  };

  const soon = zoom >= 2.2 && locations.length === 0;
  const many = cities.length > 5;

  return (
    <div className="pv-map" data-map="lebanon">
      <div className="pv-map-frame">
      <div
        className="map-viewport"
        dir="ltr"
        tabIndex={0}
        role="group"
        aria-label={t("title")}
        ref={viewport}
        onPointerMove={onPointerMove}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const directions: Record<string, [number, number]> = {
            ArrowLeft: [40, 0],
            ArrowRight: [-40, 0],
            ArrowUp: [0, 40],
            ArrowDown: [0, -40],
          };
          if (directions[event.key] && zoom > 1) {
            event.preventDefault();
            stop();
            const [x, y] = directions[event.key];
            controls.current?.pan(x, y, { relative: true, force: true });
          }
          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            changeZoom(1.5);
          }
          if (event.key === "-") {
            event.preventDefault();
            changeZoom(1 / 1.5);
          }
          if (event.key === "0" || event.key === "Escape") reset();
        }}
      >
        <div ref={scene} className="map-scene" data-scale="1.00">
          <svg
            ref={svg}
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            className="geographic-map"
            aria-labelledby={`${id}-title ${id}-description`}
          >
            <title id={`${id}-title`}>{t("title")}</title>
            <desc id={`${id}-description`}>{t("description")}</desc>
            <defs>
              <linearGradient
                id={`${id}-sea`}
                gradientUnits="userSpaceOnUse"
                x1="-20"
                y1="0"
                x2="330"
                y2="0"
              >
                <stop offset="0" stopColor="#010a1a" />
                <stop offset="1" stopColor="#053058" />
              </linearGradient>
              <linearGradient id={`${id}-land`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#0f2946" />
                <stop offset="1" stopColor="#071a30" />
              </linearGradient>
              <clipPath id={`${id}-clip`}>
                <path d={seaPath} />
              </clipPath>
              <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="9" />
              </filter>
              <filter id={`${id}-blur-s`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.2" />
              </filter>
              <filter id={`${id}-topo`} x="0" y="0" width="100%" height="100%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.011 0.017"
                  numOctaves="3"
                  seed="11"
                />
                <feColorMatrix
                  values="0 0 0 0 0.36  0 0 0 0 0.66  0 0 0 0 0.95  2.4 0 0 0 -0.86"
                />
                <feComponentTransfer>
                  <feFuncA type="discrete" tableValues="0 0.55 0 0.55 0 0.55 0 0.55" />
                </feComponentTransfer>
                <feComposite in2="SourceAlpha" operator="in" />
              </filter>
              <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1="0" y1="16" x2="0" y2="130">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="1" stopColor="#fff" stopOpacity="1" />
              </linearGradient>
              <mask id={`${id}-seafade`} maskUnits="userSpaceOnUse" x="-400" y="-120" width="1200" height="920">
                <rect x="-400" y="-120" width="1200" height="920" fill={`url(#${id}-fade)`} />
              </mask>
              <radialGradient id={`${id}-halo`}>
                <stop offset="0" stopColor="#0694f5" stopOpacity=".55" />
                <stop offset="1" stopColor="#0694f5" stopOpacity="0" />
              </radialGradient>
            </defs>

            <path className="pv-sea" d={seaPath} fill={`url(#${id}-sea)`} mask={`url(#${id}-seafade)`} />
            <g clipPath={`url(#${id}-clip)`} className="pv-coast-glow">
              <path d={map.nationalPath} filter={`url(#${id}-blur)`} className="pv-glow-wide" />
              <path d={map.nationalPath} filter={`url(#${id}-blur-s)`} className="pv-glow-tight" />
            </g>

            <path className="country-land" d={map.nationalPath} style={{ fill: `url(#${id}-land)` }} />
            <path
              className="pv-topo"
              d={map.nationalPath}
              filter={`url(#${id}-topo)`}
              fill="#fff"
            />
            {map.regions.map((region) => (
              <path key={region.id} className="governorate" d={region.path}>
                <title>{region.name}</title>
              </path>
            ))}
            <path className="country-border" d={map.nationalPath} />

            <g className="pv-graticule" aria-hidden="true">
              {graticule.meridians.map((line) => (
                <g key={line.label}>
                  <line x1={line.x} x2={line.x} y1={view.y} y2={view.y + view.height} />
                  <text x={line.x + 4} y={view.y + view.height - 6}>
                    {line.label}
                  </text>
                </g>
              ))}
              {graticule.parallels.map((line) => (
                <g key={line.label}>
                  <line x1={view.x} x2={view.x + view.width} y1={line.y} y2={line.y} />
                  <text x={view.x + 6} y={line.y - 5}>
                    {line.label}
                  </text>
                </g>
              ))}
            </g>

            <text x="52" y="248" className="sea-label" transform="rotate(-72,52,248)">
              {t("mediterranean")}
            </text>
            <text x="470" y="150" className="neighbor-label">
              {t("syria")}
            </text>

            <g className={`pv-links ${many ? "is-many" : ""}`}>
              {links.map((link) => (
                <g key={link.id}>
                  <path className="pv-link-glow" d={link.d} pathLength="1" />
                  <path className="pv-link" data-link={link.id} d={link.d} pathLength="1" />
                </g>
              ))}
            </g>
            <circle ref={signal} className="pv-signal" r="3.4" cx="0" cy="0" />

            {map.cities.map((city) => {
              const selected = cities.includes(city.name);
              const order = cities.indexOf(city.name) + 1;
              const west = WEST.includes(city.name);
              const side = west ? -1 : 1;
              const hidden = compact && zoom < 1.6 && SECONDARY.includes(city.name);
              return (
                <g
                  key={city.geonamesId}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={t(`cityNames.${city.name}`)}
                  className={`city-marker selectable-city panzoom-exclude ${selected ? "is-selected" : ""}`}
                  style={{ transform: `translate(${city.x}px, ${city.y}px) scale(var(--k, 1))` }}
                  onClick={() => onCity(city.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onCity(city.name);
                    }
                  }}
                >
                  <circle className="city-hit" r="24" />
                  {selected && (
                    <>
                      <circle className="pv-halo" r="34" style={{ fill: `url(#${id}-halo)` }} />
                      <circle className="city-ripple" r="10" />
                      <circle className="city-ripple pv-ripple-late" r="10" />
                    </>
                  )}
                  <circle className="city-ring" r="7.5" />
                  <circle className="city-dot" r="3" />
                  <g className={hidden ? "pv-label is-hidden" : "pv-label"}>
                    <text x={side * 18} y="4" textAnchor={west ? "end" : "start"}>
                      {t(`cityNames.${city.name}`)}
                    </text>
                    <text
                      className="pv-city-coords"
                      x={side * 18}
                      y="17"
                      textAnchor={west ? "end" : "start"}
                    >
                      {selected ? `${String(order).padStart(2, "0")} · ` : ""}
                      {formatCoordinate(city.longitude, city.latitude)}
                    </text>
                  </g>
                </g>
              );
            })}

            {zoom >= 1.6 &&
              locations.map((location) => {
                const [x, y] = project(location.longitude, location.latitude);
                const picked = selection.screens.includes(location.id);
                return (
                  <g
                    key={location.id}
                    className={`screen-pin panzoom-exclude ${picked ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${location.name}, ${location.city}`}
                    aria-pressed={picked}
                    style={{ transform: `translate(${x}px, ${y}px) scale(var(--k, 1))` }}
                    onClick={() => onScreen(location.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onScreen(location.id);
                      }
                    }}
                  >
                    <circle className="pin-target" r="18" />
                    <rect x="-7" y="-5" width="14" height="10" rx="1.5" />
                    <path d="M-3 8H3" />
                    <title>{location.name}</title>
                  </g>
                );
              })}
          </svg>
        </div>

        <div className="pv-map-hud pv-map-hud-tl" aria-hidden="true">
          <span>{t("title")}</span>
        </div>
        <div className="pv-map-hud pv-map-hud-tr" aria-hidden="true">
          <span className="pv-north">N</span>
          <output ref={readout} dir="ltr">
            {formatCoordinate(35.86, 33.85)}
          </output>
        </div>
        <p className="pv-map-hint" data-show={hint} aria-hidden="true">
          {t("hint")}
        </p>
        {soon && (
          <div className="pv-map-soon" role="status">
            <span className="pv-dot" />
            <p>{t("screensSoon")}</p>
          </div>
        )}
      </div>

      <div className="map-controls pv-map-controls" role="group" aria-label={t("controls")}>
        <button
          type="button"
          className="pv-ctl"
          title={t("zoomIn")}
          aria-label={t("zoomIn")}
          disabled={zoom >= MAX_SCALE - 0.01}
          onClick={() => changeZoom(1.5)}
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          className="pv-ctl"
          title={t("zoomOut")}
          aria-label={t("zoomOut")}
          disabled={zoom <= MIN_SCALE + 0.01}
          onClick={() => changeZoom(1 / 1.5)}
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          className="pv-ctl"
          title={t("reset")}
          aria-label={t("reset")}
          onClick={reset}
        >
          <RotateCcw size={15} />
        </button>
        <output className="pv-zoom" dir="ltr">
          {zoom.toFixed(1)}×
        </output>
      </div>
      </div>
      <p className="pv-map-legend">
        <span className="legend-dot" />
        {t("cityLegend")}
      </p>
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
