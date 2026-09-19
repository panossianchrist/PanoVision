"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { DisplayScreen, type FaceArtName, type ScreenFace } from "./DisplayScreen";
import { useScrollProgress } from "@/lib/motion";

// Values match the campaign form's occasion options, so the selection carries straight through.
const occasions: { key: string; art: FaceArtName }[] = [
  { key: "Birthday", art: "burst" },
  { key: "Proposal", art: "rings" },
  { key: "Launch", art: "chevrons" },
  { key: "Celebration", art: "pixels" },
  { key: "Custom", art: "grid" },
];
const durations = ["5", "10", "custom"] as const;

export function SpecialOccasions() {
  const t = useTranslations("special");
  const common = useTranslations("common");
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [minutes, setMinutes] = useState<(typeof durations)[number]>("5");
  useScrollProgress(root, "pass");

  const faces: ScreenFace[] = occasions.map(({ key, art }) => ({
    id: key,
    tag: t(`faces.${key}.tag`),
    lines: [t(`faces.${key}.a`), t(`faces.${key}.b`)],
    art,
  }));
  const chosen = occasions[index].key;
  const clock = minutes === "custom" ? t("custom").toUpperCase() : `${minutes.padStart(2, "0")}:00`;

  return (
    <section id="special-occasions" className="pv-special" ref={root}>
      <div className="pv-special-beam" aria-hidden="true" />
      <div className="pv-special-inner">
        <header className="pv-special-head">
          <p className="micro">{common("special")}</p>
          <h2>
            <span>{t("t1")}</span>
            <span>{t("t2")}</span>
          </h2>
          <p className="pv-special-lead">{t("description")}</p>
        </header>

        <div className="pv-special-stage">
          <DisplayScreen faces={faces} active={index} running={false} label={t("screenLabel")}>
            <span className="pv-tag pv-tag-tl">{t("previewTag")}</span>
            <span className="pv-tag pv-tag-tr" dir="ltr">
              {clock}
            </span>
            <span className="pv-tag pv-tag-bl">
              <i className="pv-dot" /> {t("demo")}
            </span>
          </DisplayScreen>
        </div>

        <div className="pv-special-controls">
          <fieldset className="pv-choice">
            <legend className="micro">{t("question")}</legend>
            <div className="pv-chips">
              {occasions.map(({ key }, position) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={position === index}
                  onClick={() => setIndex(position)}
                >
                  {key === "Custom" ? t("Other") : t(key)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="pv-choice">
            <legend className="micro">{t("duration")}</legend>
            <div className="pv-segment">
              {durations.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={minutes === value}
                  onClick={() => setMinutes(value)}
                >
                  {value === "custom" ? t("custom") : value === "5" ? t("five") : t("ten")}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="small pv-special-note">{t("note")}</p>
          <div className="pv-special-actions">
            <Link
              className="pv-button"
              href={`/start-campaign?type=special&occasion=${chosen}&minutes=${minutes}`}
            >
              <span>{t("cta")}</span>
              <ArrowUpRight size={18} />
            </Link>
            <Link className="pv-link-quiet" href="/how-it-works">
              {common("how")}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
