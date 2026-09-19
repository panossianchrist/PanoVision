"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useScrollProgress } from "@/lib/motion";

const steps = ["Explore", "Build", "Upload", "Preview", "Review", "Quote", "Live", "Verify"] as const;

/** Small original glyphs, drawn once when a step first becomes active. */
function Glyph({ name }: { name: (typeof steps)[number] }) {
  const p = { pathLength: 1 } as const;
  return (
    <svg viewBox="0 0 24 24" className="pv-glyph" aria-hidden="true">
      {name === "Explore" && (
        <>
          <circle cx="12" cy="12" r="3" {...p} />
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" {...p} />
        </>
      )}
      {name === "Build" && (
        <>
          <path d="M4 7h16M4 12h16M4 17h16" {...p} />
          <circle cx="9" cy="7" r="2" {...p} />
          <circle cx="15" cy="12" r="2" {...p} />
          <circle cx="8" cy="17" r="2" {...p} />
        </>
      )}
      {name === "Upload" && (
        <>
          <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" {...p} />
        </>
      )}
      {name === "Preview" && (
        <>
          <rect x="3" y="5" width="18" height="12" rx="1.5" {...p} />
          <path d="M10.5 9.2v4.6l4-2.3zM8 20h8" {...p} />
        </>
      )}
      {name === "Review" && (
        <>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" {...p} />
          <circle cx="12" cy="12" r="3" {...p} />
        </>
      )}
      {name === "Quote" && (
        <>
          <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" {...p} />
        </>
      )}
      {name === "Live" && (
        <>
          <circle cx="12" cy="12" r="2" {...p} />
          <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" {...p} />
        </>
      )}
      {name === "Verify" && (
        <>
          <circle cx="12" cy="12" r="9" {...p} />
          <path d="m7.5 12.5 3 3 6-7" {...p} />
        </>
      )}
    </svg>
  );
}

/**
 * How it works as one continuous path. The progress line fills as you scroll, the current step
 * lights, and a fictional creative moves through Upload -> Preview -> Review in the demo panel.
 */
export function FlowTimeline() {
  const t = useTranslations("workflow");
  const f = useTranslations("flow");
  const list = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(0);
  useScrollProgress(list, "center");

  useEffect(() => {
    const items = list.current?.querySelectorAll<HTMLLIElement>("li[data-step]");
    if (!items) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.step);
          setActive(index);
          setReached((value) => Math.max(value, index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pv-flow-grid">
      <div className="pv-steps" ref={list}>
        <span className="pv-steps-track" aria-hidden="true" />
        <span className="pv-steps-fill" aria-hidden="true" />
        <span className="pv-steps-dot" aria-hidden="true" />
        <ol>
        {steps.map((step, index) => (
          <li
            key={step}
            data-step={index}
            data-active={index === active}
            data-done={index < active}
            data-seen={index <= reached}
          >
            <span className="pv-step-node" aria-hidden="true" />
            <span className="pv-step-glyph">
              <Glyph name={step} />
            </span>
            <span className="pv-step-num">{String(index + 1).padStart(2, "0")}</span>
            <h3>{t(step)}</h3>
            <p>{t(`${step}Text`)}</p>
          </li>
        ))}
        </ol>
      </div>

      <div className="pv-demo" data-step={active} role="img" aria-label={f("demoLabel")}>
        <div className="pv-demo-screen">
          <i className="pv-demo-corner pv-demo-corner-a" />
          <i className="pv-demo-corner pv-demo-corner-b" />
          <div className="pv-demo-glass">
            <span className="pv-demo-idle">{f("idle")}</span>
            <div className="pv-tile">
              <span className="pv-tile-tag">{f("tileTag")}</span>
              <b>{f("tileA")}</b>
              <b>{f("tileB")}</b>
              <i className="pv-tile-art" />
            </div>
            <i className="pv-demo-scan" />
          </div>
        </div>
        <div className="pv-demo-dropzone">
          <span>{f("drop")}</span>
        </div>
        <p className="pv-demo-status">
          <i className="pv-dot" />
          <span key={active}>{f(`status${active}`)}</span>
        </p>
        <p className="pv-demo-note">{f("demoNote")}</p>
      </div>
    </div>
  );
}
