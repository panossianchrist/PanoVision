"use client";
import Image from "next/image";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { usePointerDepth, useScrollProgress } from "@/lib/motion";

// Corners of the elevated display inside the 1536 x 1024 concept image (measured from the file).
const SCREEN = "192,266 1190,89 1190,268 192,388";

/**
 * "Built to be seen": a cinematic product reveal. The graded concept image opens from a slot,
 * the display brightens, and thin annotation lines draw toward it as the section scrolls.
 * The label CONCEPT VISUAL is always visible: this is an illustration, not a real location.
 */
export function ConceptReveal() {
  const t = useTranslations("home");
  const c = useTranslations("concept");
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useScrollProgress(root, "sticky");
  usePointerDepth(stage);
  return (
    <section className="pv-concept" ref={root} aria-labelledby="concept-title">
      <div className="pv-concept-sticky">
        <div className="pv-concept-stage" ref={stage}>
          <div className="pv-concept-media">
            <div className="pv-concept-plate">
              <Image
                className="pv-concept-img"
                src="/images/panovision-concept-enhanced.webp"
                alt={t("conceptAlt")}
                width={1536}
                height={1024}
                sizes="100vw"
              />
              <div className="pv-concept-vignette" />
              <svg
                className="pv-concept-overlay"
                viewBox="0 0 1536 1024"
                preserveAspectRatio="xMidYMin slice"
                aria-hidden="true"
              >
                <defs>
                  <radialGradient id="pv-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0" stopColor="#5fb2ff" stopOpacity=".9" />
                    <stop offset=".55" stopColor="#1f7dff" stopOpacity=".32" />
                    <stop offset="1" stopColor="#0060e6" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="pv-screen-sheen" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#7fc7ff" stopOpacity="0" />
                    <stop offset=".5" stopColor="#d6ecff" stopOpacity=".6" />
                    <stop offset="1" stopColor="#7fc7ff" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="pv-screen-clip">
                    <polygon points={SCREEN} />
                  </clipPath>
                </defs>
                <ellipse className="pv-screen-glow" cx="690" cy="250" rx="820" ry="300" />
                <g clipPath="url(#pv-screen-clip)">
                  <rect
                    className="pv-screen-sweep"
                    x="-300"
                    y="0"
                    width="260"
                    height="1024"
                    fill="url(#pv-screen-sheen)"
                    transform="skewX(-18)"
                  />
                </g>
                <polygon className="pv-screen-edge" points={SCREEN} />

                <g className="pv-note pv-note-1">
                  <path d="M192 266 L166 214 L520 214" pathLength="1" />
                  <circle cx="192" cy="266" r="5" />
                  <text x="166" y="200">
                    <tspan>01 </tspan>
                    {c("note1")}
                  </text>
                </g>
                <g className="pv-note pv-note-2">
                  <path d="M860 756 L980 756" pathLength="1" />
                  <circle cx="860" cy="756" r="5" />
                  <text x="996" y="761">
                    <tspan>02 </tspan>
                    {c("note2")}
                  </text>
                </g>
                <g className="pv-note pv-note-3">
                  <path d="M1190 268 L1256 330 L1500 330" pathLength="1" />
                  <circle cx="1190" cy="268" r="5" />
                  <text x="1256" y="316">
                    <tspan>03 </tspan>
                    {c("note3")}
                  </text>
                </g>
              </svg>
            </div>
            <span className="pv-concept-tag pv-concept-tag-inline">{t("concept")}</span>
          </div>

          <ul className="pv-concept-notes">
            {(["note1", "note2", "note3"] as const).map((key, index) => (
              <li key={key}>
                <b>0{index + 1}</b>
                {c(key)}
              </li>
            ))}
          </ul>

          <div className="pv-concept-copy">
            <p className="micro">{t("screenIndex")}</p>
            <h2 id="concept-title">
              <span>{c("l1")}</span>
              <span>{c("l2")}</span>
            </h2>
            <p className="pv-concept-text">{t("screenText")}</p>
          </div>

          <span className="pv-concept-tag">{t("concept")}</span>
          <p className="pv-concept-caption">{t("conceptNote")}</p>
        </div>
      </div>
    </section>
  );
}
