"use client";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type { CampaignValues } from "@/lib/validation";
import type { PublicAsset } from "@/lib/moderation/types";
import { useTranslations } from "next-intl";

const stages: Record<string, string> = {
  uploaded: "Queued for checking",
  security: "Running file security checks",
  validating: "Validating creative specifications",
  visual: "Reviewing visual content",
  text: "Checking advertisement text",
  audio: "Checking audio content",
  policy: "Applying campaign guidelines",
  complete: "Review complete",
};
async function responseJson(response: Response) {
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.message ||
        "The creative check could not be started. Please try again.",
    );
  return body;
}

export function CreativeModeration({
  file,
  values,
  campaignId,
  onCampaign,
  onResult,
  initialAsset = null,
}: {
  file: File | null;
  values: CampaignValues;
  campaignId: string;
  onCampaign: (id: string) => void;
  onResult: (asset: PublicAsset | null) => void;
  initialAsset?: PublicAsset | null;
}) {
  const t = useTranslations("moderation");
  const [asset, setAsset] = useState<PublicAsset | null>(initialAsset);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const key = useRef("");
  const draftKey = useRef("");
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const assetId = asset?.id,
    assetStatus = asset?.status;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (
      !assetId ||
      !assetStatus ||
      ["approved", "rejected", "failed"].includes(assetStatus)
    )
      return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const body = await responseJson(
          await fetch(`/api/creative/${assetId}/status`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        );
        if (!controller.signal.aborted) {
          setAsset(body.asset);
          onResult(body.asset);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted)
          setError(
            t("error"),
          );
      } finally {
        if (!controller.signal.aborted)
          timer = setTimeout(
            poll,
            assetStatus === "manual_review" ? 10000 : 2500,
          );
      }
    }
    timer = setTimeout(poll, 1500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [assetId, assetStatus, onResult, t]);
  async function start() {
    if (!file || inFlight.current) return;
    inFlight.current = true;
    setUploading(true);
    setError("");
    onResult(null);
    key.current ||= crypto.randomUUID();
    draftKey.current ||= crypto.randomUUID();
    try {
      const draft = await responseJson(
        await fetch("/api/campaigns/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: draftKey.current,
            ...(campaignId ? { campaignId } : {}),
            details: values,
          }),
        }),
      );
      if (!mounted.current) return;
      onCampaign(draft.campaignId);
      sessionStorage.setItem("panoCampaignId", draft.campaignId);
      const result = await responseJson(
        await fetch("/api/creative/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name),
            "X-File-Type": file.type,
            "X-Campaign-Id": draft.campaignId,
            "Idempotency-Key": key.current,
          },
          body: file,
        }),
      );
      if (!mounted.current) return;
      setAsset(result.asset);
      onResult(result.asset);
      sessionStorage.setItem("panoAssetId", result.asset.id);
    } catch {
      if (mounted.current)
        setError(
          t("error"),
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setUploading(false);
    }
  }
  async function refresh() {
    if (!asset) return;
    try {
      const body = await responseJson(
        await fetch(`/api/creative/${asset.id}/status`, { cache: "no-store" }),
      );
      setAsset(body.asset);
      onResult(body.asset);
      setError("");
    } catch {
      setError(t("error"));
    }
  }
  const title = asset?.canContinue
    ? t("passed")
    : asset?.status === "approved"
      ? t("newCheck")
      : asset?.status === "rejected"
        ? asset.rejectionKind === "technical"
          ? t("technical")
          : t("rejected")
        : asset?.status === "manual_review"
          ? t("review")
          : asset?.status === "failed"
            ? t("failed")
            : t("checking");
  const messageKey = asset?.status === "approved" ? (asset.canContinue ? "approved" : "stale")
    : asset?.status === "manual_review" ? "manual"
    : asset?.status === "rejected" ? (asset.rejectionKind === "technical" ? "technical" : "rejected")
    : asset?.status === "failed" ? "failed" : asset?.status === "processing" ? "processing" : "queued";
  const Icon = asset?.canContinue
    ? CheckCircle2
    : asset?.status === "rejected"
      ? TriangleAlert
      : Clock3;
  return (
    <div className="creative-moderation">
      {!asset && !uploading && (
        <>
          <p className="inline-note">
            {t("private")} <Link href="/privacy">{t("privacy")}</Link>.
          </p>
          <button
            className="button button-outline"
            type="button"
            disabled={!file}
            onClick={start}
          >
            <ShieldCheck size={17} />
            {t("upload")}
          </button>
        </>
      )}
      {uploading && (
        <div className="moderation-result processing" role="status">
          <RefreshCw size={22} />
          <div>
            <h3>{t("uploading")}</h3>
            <p>{t("transfer")}</p>
          </div>
        </div>
      )}
      {asset && (
        <div
          className={`moderation-result ${asset.canContinue ? "approved" : asset.status}`}
          role="status"
        >
          <Icon size={23} />
          <div>
            <h3>{title}</h3>
            <p>{t(`messages.${messageKey}`)}</p>
            {["uploaded", "processing", "uploading"].includes(asset.status) && (
              <span className="micro">
                {stages[asset.stage] ? t(`stages.${asset.stage}`) : t("checking")}
              </span>
            )}
            {!asset.canContinue &&
              ["rejected", "manual_review", "failed", "approved"].includes(
                asset.status,
              ) && (
                <div className="moderation-actions">
                  <button
                    className="text-link"
                    type="button"
                    onClick={() =>
                      document.getElementById("creative-file")?.click()
                    }
                  >
                    {t("different")}
                  </button>
                  <Link className="text-link" href="/contact">
                    {t("contact")}
                  </Link>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t("refresh")}
                    title={t("refresh")}
                    onClick={refresh}
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              )}
          </div>
        </div>
      )}
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
