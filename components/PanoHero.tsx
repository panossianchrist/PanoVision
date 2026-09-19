"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { DisplayScreen, type ScreenFace } from "./DisplayScreen";
import { useInView, usePointerDepth, useReducedMotion } from "@/lib/motion";
import { company } from "@/lib/company";

const CYCLE_MS = 4800;

// Deterministic fragments (same on server and client) that resolve into the logo's pixel cloud.
const fragments = (() => {
  let seed = 90210;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const palette = ["#0694f5", "#0060e6", "#7fc7ff", "#3aa8ff", "#e8f4ff"];
  return Array.from({ length: 38 }, (_, i) => ({
    left: 27 + random() * 17,
    top: 12 + random() * 74,
    size: 0.55 + random() * 1.15,
    fx: -22 + random() * 12,
    fy: (random() - 0.5) * 16,
    delay: 300 + random() * 420,
    color: palette[i % palette.length],
  }));
})();

export function PanoHero() {
  const t = useTranslations("hero");
  const home = useTranslations("home");
  const common = useTranslations("common");
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  // Cycling stops when the hero is off screen, the tab is hidden, or the visitor pauses it.
  const running = visible && !paused;
  usePointerDepth(root);
  useInView(root, setVisible);
  useEffect(() => {
    if (reduced || !running) return;
    const timer = setInterval(() => setActive((value) => (value + 1) % 4), CYCLE_MS);
    return () => clearInterval(timer);
  }, [reduced, running]);

  const faces: ScreenFace[] = [
    { id: "brand", tag: t("tag1"), lines: [t("f1a"), t("f1b")], art: "streaks" },
    { id: "seen", tag: t("tag2"), lines: [t("f2a"), t("f2b")], art: "pixels" },
    { id: "seconds", tag: t("tag3"), lines: [t("f3a"), t("f3b")], art: "timer" },
    { id: "reach", tag: t("tag4"), lines: [t("f4a"), t("f4b")], art: "network" },
  ];

  return (
    <section className="pv-hero" ref={root} data-running={running && !reduced}>
      <div className="pv-hero-bg" aria-hidden="true">
        <div className="pv-bg-light" />
        <div className="pv-bg-grid" />
        <div className="pv-bg-scan" />
        <div className="pv-bg-marks">
          <span>33.89°N</span>
          <span>35.50°E</span>
        </div>
      </div>

      <div className="pv-hero-inner">
        <div className="pv-hero-brand">
          <div className="pv-logo">
            <Image
              className="pv-logo-img"
              src="/brand/panovision-logo-hero.webp"
              alt={`PanoVision. ${common("tagline")}`}
              width={1500}
              height={274}
              priority
              sizes="(max-width: 720px) 86vw, 560px"
            />
            <span className="pv-logo-shine" aria-hidden="true" />
            <span className="pv-logo-edge" aria-hidden="true" />
            <span className="pv-logo-frags" aria-hidden="true">
              {fragments.map((fragment, index) => (
                <i
                  key={index}
                  style={
                    {
                      left: `${fragment.left}%`,
                      top: `${fragment.top}%`,
                      width: `${fragment.size}cqw`,
                      height: `${fragment.size}cqw`,
                      background: fragment.color,
                      "--fx": `${fragment.fx}cqw`,
                      "--fy": `${fragment.fy}cqw`,
                      animationDelay: `${fragment.delay}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </span>
          </div>
          <ul className="pv-hero-index">
            <li>
              <b>01</b> {t("index1")}
            </li>
            <li>
              <b>02</b> {t("index2")}
            </li>
            <li>
              <b>03</b> {t("index3")}
            </li>
          </ul>
        </div>

        <h1 className="pv-hero-title">
          <span className="pv-line">
            <span>{home("hero1")}</span>
          </span>
          <span className="pv-line">
            <span>{home("hero2")}</span>
          </span>
        </h1>

        <div className="pv-hero-side">
          <p>{home("description")}</p>
          <div className="pv-hero-cta">
            <Link className="pv-button" href="/start-campaign">
              <span>{common("start")}</span>
              <ArrowUpRight size={18} />
            </Link>
            <a className="pv-button pv-button-ghost" href="#network">
              <span>{home("explore")}</span>
              <ArrowUpRight size={18} />
            </a>
          </div>
        </div>

        <div className="pv-hero-stage">
          <DisplayScreen
            faces={faces}
            active={reduced ? 0 : active}
            running={running && !reduced}
            cycleMs={CYCLE_MS}
            powerOn="load"
            label={t("screenLabel")}
          >
            <span className="pv-tag pv-tag-tl">{t("format")}</span>
            <span className="pv-tag pv-tag-tr">{t("media")}</span>
            <span className="pv-tag pv-tag-bl">
              <i className="pv-dot" /> {t("building")}
            </span>
            <span className="pv-tag pv-tag-br">{t("ready")}</span>
            <span className="pv-tag pv-tag-demo">{t("demo")}</span>
          </DisplayScreen>
          {!reduced && (
            <button
              type="button"
              className="pv-pause"
              aria-label={paused ? home("play") : home("pause")}
              title={paused ? home("play") : home("pause")}
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
            </button>
          )}
        </div>
      </div>

      <div className="pv-hero-foot">
        <span>{company.name} / {common("lebanon")}</span>
        <a href="#road" className="pv-cue" aria-label={common("about")}>
          <ArrowDown size={16} />
        </a>
        <span>{home("pilot")}</span>
      </div>
    </section>
  );
}
