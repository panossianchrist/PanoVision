"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useInView, usePointerDepth } from "@/lib/motion";

export type FaceArtName =
  | "streaks"
  | "pixels"
  | "timer"
  | "network"
  | "rings"
  | "burst"
  | "chevrons"
  | "grid";
export type ScreenFace = {
  id: string;
  tag: string;
  lines: [string, string];
  art: FaceArtName;
};

/** Original PanoVision artwork for the display faces. Decorative only. */
function FaceArt({ name }: { name: FaceArtName }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.4 };
  switch (name) {
    case "streaks":
      return (
        <svg viewBox="0 0 200 100" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              className="pv-art-streak"
              style={{ animationDelay: `${i * 90}ms` }}
              d={`M${-20 + i * 6} ${88 - i * 13} C 70 ${70 - i * 12}, 130 ${44 - i * 7}, 230 ${12 - i * 3}`}
              {...stroke}
              strokeWidth={1.2 + (i % 3) * 0.5}
            />
          ))}
        </svg>
      );
    case "pixels":
      return (
        <svg viewBox="0 0 200 100" aria-hidden="true">
          {Array.from({ length: 34 }, (_, i) => {
            const col = i % 9;
            const row = Math.floor(i / 9);
            const size = 3 + ((i * 7) % 5);
            return (
              <rect
                key={i}
                className="pv-art-pixel"
                style={{ animationDelay: `${(i % 12) * 60}ms` }}
                x={70 + col * 14 + ((i * 5) % 6)}
                y={12 + row * 20 + ((i * 3) % 9)}
                width={size}
                height={size}
                fill="currentColor"
                opacity={0.35 + ((i * 13) % 6) / 10}
              />
            );
          })}
        </svg>
      );
    case "timer":
      return (
        <svg viewBox="0 0 200 100" aria-hidden="true">
          <circle cx="150" cy="50" r="34" {...stroke} opacity=".28" />
          <circle
            className="pv-art-arc"
            cx="150"
            cy="50"
            r="34"
            {...stroke}
            strokeWidth="2.4"
            pathLength="1"
            strokeDasharray="1"
            transform="rotate(-90 150 50)"
          />
          <text x="150" y="60" textAnchor="middle" className="pv-art-num">
            08
          </text>
        </svg>
      );
    case "network":
      return (
        <svg viewBox="0 0 200 100" aria-hidden="true">
          <path
            className="pv-art-link"
            d="M92 66 L130 30 L168 58 L146 84 M130 30 L176 22"
            {...stroke}
            opacity=".7"
          />
          {[
            [92, 66],
            [130, 30],
            [168, 58],
            [146, 84],
            [176, 22],
          ].map(([x, y], i) => (
            <circle
              key={i}
              className="pv-art-node"
              style={{ animationDelay: `${i * 110}ms` }}
              cx={x}
              cy={y}
              r={i === 1 ? 5 : 3.4}
              fill="currentColor"
            />
          ))}
        </svg>
      );
    case "rings":
      return (
        <svg viewBox="0 0 200 100" aria-hidden="true">
          {[14, 28, 44, 62].map((r, i) => (
            <circle
              key={r}
              className="pv-art-ring"
              style={{ animationDelay: `${i * 120}ms` }}
              cx="152"
              cy="52"
              r={r}
              {...stroke}
              opacity={0.75 - i * 0.14}
            />
          ))}
          <circle cx="152" cy="52" r="4" fill="currentColor" />
        </svg>
      );
    case "burst":
      return (
        <svg viewBox="0 0 200 100" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const r1 = 14 + (i % 2) * 6;
            const r2 = 40 + (i % 3) * 9;
            return (
              <line
                key={i}
                className="pv-art-ray"
                style={{ animationDelay: `${(i % 4) * 80}ms` }}
                x1={152 + Math.cos(a) * r1}
                y1={52 + Math.sin(a) * r1}
                x2={152 + Math.cos(a) * r2}
                y2={52 + Math.sin(a) * r2}
                {...stroke}
              />
            );
          })}
        </svg>
      );
    case "chevrons":
      return (
        <svg viewBox="0 0 200 100" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              className="pv-art-chevron"
              style={{ animationDelay: `${i * 140}ms` }}
              d={`M118 ${78 - i * 22} L152 ${52 - i * 22} L186 ${78 - i * 22}`}
              {...stroke}
              strokeWidth="2.2"
            />
          ))}
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 200 100" aria-hidden="true">
          {Array.from({ length: 45 }, (_, i) => (
            <circle
              key={i}
              cx={72 + (i % 9) * 15}
              cy={16 + Math.floor(i / 9) * 17}
              r={1.6 + ((i * 5) % 4) * 0.4}
              fill="currentColor"
              opacity={0.3 + ((i * 7) % 5) / 8}
            />
          ))}
        </svg>
      );
  }
}

type Props = {
  faces: ScreenFace[];
  active: number;
  /** "load": power on immediately (hero). "view": power on when scrolled into view. */
  powerOn?: "load" | "view";
  running?: boolean;
  /** Milliseconds per face; only used for the progress bar. */
  cycleMs?: number;
  label: string;
  children?: ReactNode;
  className?: string;
};

/**
 * A PanoVision digital roadside display: bezel, LED texture, power-on, wipe transitions and a
 * pointer-responsive glare. The faces are fictional PanoVision messages, never customer creative.
 */
export function DisplayScreen({
  faces,
  active,
  powerOn = "view",
  running = true,
  cycleMs = 4600,
  label,
  children,
  className = "",
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  usePointerDepth(root);
  const onView = useCallback((visible: boolean) => {
    if (visible) setSeen(true);
  }, []);
  useInView(root, onView);
  const live = powerOn === "load" || seen;
  return (
    <div
      ref={root}
      className={`pv-screen ${className}`}
      data-live={live}
      data-running={running}
      role="img"
      aria-label={label}
    >
      <div className="pv-screen-body">
        <div className="pv-screen-frame">
          <i className="pv-corner pv-corner-a" />
          <i className="pv-corner pv-corner-b" />
          <i className="pv-corner pv-corner-c" />
          <i className="pv-corner pv-corner-d" />
          <div className="pv-screen-glass">
            {faces.map((face, index) => (
              <div
                key={face.id}
                className="pv-face"
                data-active={index === active}
                aria-hidden="true"
              >
                <div className="pv-face-art">
                  <FaceArt name={face.art} />
                </div>
                <p className="pv-face-tag">{face.tag}</p>
                <p className="pv-face-copy">
                  <span>{face.lines[0]}</span>
                  <span>{face.lines[1]}</span>
                </p>
              </div>
            ))}
            <i className="pv-screen-led" />
            <i className="pv-screen-scan" />
            <i className="pv-screen-glare" />
            <i
              key={active}
              className="pv-screen-timer"
              style={{ animationDuration: `${cycleMs}ms` }}
            />
          </div>
        </div>
        <div className="pv-screen-plate" />
      </div>
      {children}
    </div>
  );
}
