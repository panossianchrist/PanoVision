import { apiHandler, json, requireAdmin } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { activePolicy } from "@/lib/moderation/policy";
import type { Asset } from "@/lib/moderation/types";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return apiHandler(() => {
    const admin = requireAdmin(request),
      store = getStore();
    store.rateLimit(`queue:${admin.user_id}`, 120, 60000);
    const query = new URL(request.url).searchParams,
      status = query.get("status") || "manual_review",
      page = Number(query.get("page") || 0);
    const rows = store.reviewQueue(status, page) as unknown as (Asset & {
      details: string;
      business_status: string;
      current_asset_id: string;
      campaign_revision: number;
    })[];
    return json({
      items: rows.map((asset) => {
        const secure =
          !!asset.scan_passed &&
          !!asset.security_valid &&
          !asset.restricted &&
          !asset.purged &&
          !asset.purge_pending &&
          asset.expires_at > Date.now();
        return {
          id: asset.id,
          campaignId: asset.campaign_id,
          filename: asset.original_filename,
          version: asset.version,
          createdAt: asset.created_at,
          status: asset.status,
          decision: asset.decision,
          automatedDecision: asset.automated_decision,
          rejectionKind: asset.rejection_kind,
          reasonCodes: JSON.parse(asset.reason_codes),
          policyVersion: asset.policy_version,
          provider: asset.provider,
          priority: asset.priority,
          mediaType: asset.media_type,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
          fileSize: asset.file_size,
          scanPassed: !!asset.scan_passed,
          securityValid: !!asset.security_valid,
          restricted: !!asset.restricted,
          purged: !!asset.purged,
          revision: asset.revision,
          details: JSON.parse(asset.details),
          businessStatus: asset.business_status,
          campaignRevision: asset.campaign_revision,
          isCurrent: asset.id === asset.current_asset_id,
          previewAvailable:
            secure &&
            ["approved", "rejected", "manual_review"].includes(asset.status),
          canApprove:
            admin.role === "admin" &&
            secure &&
            asset.rejection_kind !== "technical" &&
            asset.policy_key === activePolicy().key,
          history: store.history(asset.id),
        };
      }),
      metrics: store.metrics(),
    });
  });
}
