import type { Asset, PublicAsset } from "./types";
import { hasCurrentApproval } from "./eligibility";
export function publicAsset(
  asset: Asset,
  currentPolicyKey: string,
  current = true,
): PublicAsset {
  const reasons = JSON.parse(asset.reason_codes) as string[];
  let message = "Your creative is queued for checking.";
  if (asset.status === "processing")
    message =
      "We are checking your creative against PanoVision advertising guidelines.";
  if (asset.status === "manual_review")
    message = reasons.some(
      (reason) =>
        reason.startsWith("MODERATION_") || reason.startsWith("SECURITY_"),
    )
      ? "We couldn't complete the automated creative check. Your submission is in the manual review queue."
      : "This creative requires a manual review before it can be approved. Our team will review it against PanoVision advertising guidelines.";
  if (asset.status === "rejected")
    message =
      asset.rejection_kind === "technical"
        ? reasons.includes("TECHNICAL_VIDEO_DURATION")
          ? "Please upload an 8-second video."
          : "This file does not meet the display requirements. Please upload a valid JPEG, PNG, WebP, MP4 or WebM creative."
        : "This creative does not meet PanoVision advertising guidelines. Please upload a different creative.";
  if (asset.status === "failed")
    message = "The upload could not be completed. Please try again.";
  const canContinue =
    current && hasCurrentApproval(asset, currentPolicyKey);
  if (asset.status === "approved")
    message = canContinue
      ? "This creative passed PanoVision's content check and can continue to campaign review. Availability, screen specifications, pricing and final business approval are still required."
      : "This creative needs a new review before it can continue. Please upload it again.";
  return {
    id: asset.id,
    campaignId: asset.campaign_id,
    version: asset.version,
    status: asset.status,
    stage: asset.stage,
    decision: asset.decision,
    rejectionKind: asset.rejection_kind,
    message,
    canContinue,
    filename: asset.original_filename,
  };
}
