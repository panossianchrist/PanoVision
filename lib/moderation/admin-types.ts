import type { CampaignValues } from "../validation";
import type { ModerationDecision, UploadStatus } from "./types";

export type ReviewItem = {
  id: string;
  campaignId: string;
  filename: string;
  version: number;
  createdAt: number;
  status: UploadStatus;
  decision: ModerationDecision | null;
  automatedDecision: ModerationDecision | null;
  rejectionKind: "content" | "technical" | null;
  reasonCodes: string[];
  policyVersion: string | null;
  provider: string | null;
  priority: string;
  mediaType: "image" | "video";
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number;
  scanPassed: boolean;
  securityValid: boolean;
  restricted: boolean;
  purged: boolean;
  revision: number;
  details: CampaignValues;
  businessStatus: string;
  campaignRevision: number;
  isCurrent: boolean;
  previewAvailable: boolean;
  canApprove: boolean;
  history: {
    actor_id: string;
    action: string;
    original_decision: string | null;
    final_decision: string | null;
    reason: string;
    created_at: number;
  }[];
};
export type ReviewQueue = {
  items: ReviewItem[];
  metrics: {
    rejectionKinds:{kind:"content"|"technical";count:number}[];
    counts: { status: string; count: number }[];
    averageProcessingMs: { milliseconds: number | null };
    failures: { count: number };
  };
};
