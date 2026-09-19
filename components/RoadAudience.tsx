"use client";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useScrollProgress } from "@/lib/motion";

/**
 * "The road is the audience": oversized type that resolves line by line as the section
 * scrolls. Progress is a single CSS variable (--p); the CSS turns it into position and colour.
 * Without JavaScript or with reduced motion, --p stays 1 and everything is fully visible.
 */
export function RoadAudience() {
  const t = useTranslations("road");
  const home = useTranslations("home");
  const root = useRef<HTMLElement>(null);
  useScrollProgress(root, "sticky");
  return (
    <section className="pv-road" id="road" ref={root}>
      <div className="pv-road-sticky">
        <p className="pv-road-index micro">{home("perspective")}</p>
        <h2 className="pv-road-title">
          <span className="pv-rl pv-rl-1">{t("l1")}</span>
          <span className="pv-rl pv-rl-2">{t("l2")}</span>
          <span className="pv-rl pv-rl-3">
            <span>{t("l3")}</span>
          </span>
        </h2>
        <div className="pv-road-support">
          <p className="pv-road-lead">{home("different")}</p>
          <p>{home("intro")}</p>
          <ul>
            <li>{home("elevated")}</li>
            <li>{home("placement")}</li>
            <li>{home("digitalProcess")}</li>
          </ul>
        </div>
        <svg className="pv-road-lines" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 300 L520 40" />
          <path d="M1200 300 L680 40" />
          <path className="pv-road-dash" d="M600 300 L600 40" pathLength="100" />
        </svg>
      </div>
    </section>
  );
}
