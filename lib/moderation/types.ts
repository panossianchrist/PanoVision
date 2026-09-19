export const ModerationDecision = {
  APPROVED: "approved",
  REJECTED: "rejected",
  MANUAL_REVIEW: "manual_review",
} as const;
export type ModerationDecision =
  (typeof ModerationDecision)[keyof typeof ModerationDecision];
export type UploadStatus =
  | "uploading"
  | "uploaded"
  | "processing"
  | "approved"
  | "rejected"
  | "manual_review"
  | "failed";
export type Stage =
  | "uploaded"
  | "security"
  | "validating"
  | "visual"
  | "text"
  | "audio"
  | "policy"
  | "complete";
export type Finding = {
  category: string;
  confidence: number;
  source: "visual" | "text" | "audio";
  timestamp?: number;
};
export type ProviderSignal = {
  findings: Finding[];
  uncertain: boolean;
  textComplete: boolean;
  visibleText?: string;
  requestIds: string[];
  errors?: string[];
};
export interface ModerationProvider {
  readonly name: string;
  moderateImage(image: Uint8Array): Promise<ProviderSignal>;
  moderateVideoFrame(
    image: Uint8Array,
    timestamp: number,
  ): Promise<ProviderSignal>;
  moderateText(
    text: string,
    source?: "text" | "audio",
  ): Promise<ProviderSignal>;
  transcribeAudio(audio: Uint8Array): Promise<string>;
}
export type PolicyDecision = {
  decision: ModerationDecision;
  reasonCodes: string[];
  findings: Finding[];
  critical: boolean;
  priority: "high" | "normal" | "low";
  rejectionKind: "content" | "technical" | null;
};
export type MediaMetadata = {
  mediaType: "image" | "video";
  mimeType: string;
  width: number;
  height: number;
  duration: number | null;
  frameRate: number | null;
  hasAudio: boolean;
};
export type Asset = {
  id: string;
  campaign_id: string;
  owner_id: string;
  version: number;
  original_filename: string;
  storage_key: string;
  mime_type: string;
  file_size: number;
  sha256: string | null;
  scanned_sha256: string | null;
  preview_sha256: string | null;
  approval_id: string | null;
  media_type: "image" | "video";
  duration: number | null;
  width: number | null;
  height: number | null;
  status: UploadStatus;
  stage: Stage;
  decision: ModerationDecision | null;
  automated_decision: ModerationDecision | null;
  rejection_kind: "content" | "technical" | null;
  policy_key: string | null;
  policy_version: string | null;
  reason_codes: string;
  findings: string;
  provider: string | null;
  scan_passed: number;
  security_valid: number;
  restricted: number;
  purged: number;
  purge_pending: number;
  priority: "high" | "normal" | "low";
  created_at: number;
  completed_at: number | null;
  expires_at: number;
  revision: number;
};
export type PublicAsset = {
  id: string;
  campaignId: string;
  version: number;
  status: UploadStatus;
  stage: Stage;
  decision: ModerationDecision | null;
  rejectionKind: "content" | "technical" | null;
  message: string;
  canContinue: boolean;
  filename: string;
};
