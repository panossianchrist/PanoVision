import type { Asset } from "./types";

// Metadata gate shared by customer UI and server. Publishing also verifies bytes
// and durable evidence in PanoStore.canCreativeGoLive().
export function hasCurrentApproval(asset: Asset, policyKey: string, now = Date.now()) {
  return asset.status === "approved" && asset.decision === "approved" &&
    asset.policy_key === policyKey && asset.scan_passed === 1 &&
    asset.security_valid === 1 && asset.restricted === 0 && asset.purged === 0 &&
    asset.purge_pending === 0 && asset.expires_at > now &&
    !!asset.approval_id && !!asset.sha256 && asset.scanned_sha256 === asset.sha256;
}
