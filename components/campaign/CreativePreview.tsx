"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Scan,
  Maximize,
} from "lucide-react";
import type { ScreenLocation } from "@/data/locations";
import { screenRatio } from "@/lib/creative-preview";
export function CreativePreview({
  file,
  screens = [],
}: {
  file: File;
  screens?: ScreenLocation[];
}) {
  const t = useTranslations("preview"),
    [url, setUrl] = useState(""),
    [fit, setFit] = useState<"contain" | "cover">("contain"),
    [selected, setSelected] = useState(""),
    [metadata, setMetadata] = useState<{
      width: number;
      height: number;
      duration?: number;
    } | null>(null),
    [error, setError] = useState(false),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(true);
  const video = useRef<HTMLVideoElement>(null),
    isVideo = file.type.startsWith("video/"),
    screen = screens.find((item) => item.id === selected) || screens[0],
    ratio = screenRatio(screen);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const frame = requestAnimationFrame(() => {
      setUrl(objectUrl);
      setMetadata(null);
      setError(false);
      setPlaying(false);
    });
    return () => {
      cancelAnimationFrame(frame);
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);
  const mismatch = metadata
    ? Math.abs(metadata.width / metadata.height - ratio) / ratio > 0.04
    : false;
  return (
    <section className="creative-preview" aria-label={t("title")}>
      <div className="preview-heading">
        <div>
          <span className="micro blue">{t("concept")}</span>
          <h3>{t("title")}</h3>
        </div>
        <div className="preview-fit" role="group" aria-label={t("title")}>
          <button
            type="button"
            aria-pressed={fit === "contain"}
            title={t("fit")}
            onClick={() => setFit("contain")}
          >
            <Scan size={15} />
            {t("fit")}
          </button>
          <button
            type="button"
            aria-pressed={fit === "cover"}
            title={t("fill")}
            onClick={() => setFit("cover")}
          >
            <Maximize size={15} />
            {t("fill")}
          </button>
        </div>
      </div>
      {screens.length > 1 && (
        <select
          aria-label={t("screen")}
          value={screen?.id}
          onChange={(event) => setSelected(event.target.value)}
        >
          {screens.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      )}
      <div className="preview-environment">
        <div
          className="preview-display"
          style={{
            aspectRatio: ratio,
            maxWidth: `min(100%, ${480 * ratio}px)`,
          }}
        >
          {url &&
            !error &&
            (isVideo ? (
              <video
                ref={video}
                src={url}
                muted={muted}
                playsInline
                preload="metadata"
                style={{ objectFit: fit }}
                onLoadedMetadata={(event) => {
                  const element = event.currentTarget;
                  setMetadata({
                    width: element.videoWidth,
                    height: element.videoHeight,
                    duration: element.duration,
                  });
                }}
                onError={() => setError(true)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />
            ) : (
              /* Local blob previews are not uploaded to an image optimizer. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={file.name}
                style={{ objectFit: fit }}
                onLoad={(event) =>
                  setMetadata({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                }
                onError={() => setError(true)}
              />
            ))}
          {error && <p role="alert">{t("unreadable")}</p>}
        </div>
        <div className="preview-stand" />
        <span className="micro">PANOVISION / {t("concept")}</span>
      </div>
      {isVideo && (
        <div className="video-controls">
          <button
            className="icon-button"
            type="button"
            title={playing ? t("pause") : t("play")}
            aria-label={playing ? t("pause") : t("play")}
            onClick={() => {
              if (playing) video.current?.pause();
              else void video.current?.play().catch(() => setError(true));
            }}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button
            className="icon-button"
            type="button"
            title={t("restart")}
            aria-label={t("restart")}
            onClick={() => {
              if (video.current) {
                video.current.currentTime = 0;
                void video.current.play().catch(() => setError(true));
              }
            }}
          >
            <RotateCcw size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            title={muted ? t("unmute") : t("mute")}
            aria-label={muted ? t("unmute") : t("mute")}
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>
      )}
      <h4 className="micro">{t("check")}</h4>
      <dl className="creative-check">
        <div>
          <dt>{t("resolution")}</dt>
          <dd dir="ltr">
            {metadata ? `${metadata.width} × ${metadata.height}` : "—"}
          </dd>
        </div>
        {isVideo && (
          <div>
            <dt>{t("duration")}</dt>
            <dd dir="ltr">{metadata?.duration?.toFixed(1) || "—"} s</dd>
          </div>
        )}
        <div>
          <dt>{t("format")}</dt>
          <dd>{file.type.split("/")[1].toUpperCase()}</dd>
        </div>
        <div>
          <dt>{t("screen")}</dt>
          <dd>
            {screen
              ? `${screen.name} / ${screen.screenWidth && screen.screenHeight ? `${screen.screenWidth} × ${screen.screenHeight}` : screen.aspectRatio || t("pending")}`
              : t("pending")}
          </dd>
        </div>
      </dl>
      {mismatch && (
        <p className="preview-warning" role="status">
          {t("crop")}
        </p>
      )}
      <p className="small">{t("note")}</p>
      <p className="micro muted">{t("local")}</p>
    </section>
  );
}
