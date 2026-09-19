"use client";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { company } from "@/lib/company";

export function HeroDisplay() {
  const t = useTranslations("home");
  const [paused, setPaused] = useState(false);
  return (
    <div className={`hero-display ${paused ? "is-paused" : ""}`}>
      <Image
        className="hero-environment"
        src={company.conceptImage}
        alt={t("conceptAlt")}
        fill
        priority
        sizes="100vw"
      />
      <div className="hero-display-shade" />
      <div className="display-signal" aria-label="PanoVision">
        <div className="display-signal-top">
          <span>{t("displayMedia")}</span>
          <span dir="ltr">08 SEC</span>
        </div>
        <strong>
          PANOVISION<span>.</span>
        </strong>
        <span className="display-tagline">{t("displayNetwork")}</span>
        <div className="display-scan" aria-hidden="true" />
        <div className="display-timeline" aria-hidden="true">
          <span />
        </div>
      </div>
      <div className="display-caption">
        <span className="micro">
          {t("concept")} / {t("displayFormat")}
        </span>
        <button
          type="button"
          className="icon-button"
          title={paused ? t("play") : t("pause")}
          aria-label={paused ? t("play") : t("pause")}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
      </div>
    </div>
  );
}
