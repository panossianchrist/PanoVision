import { createHash } from "node:crypto";
import { moderationRules, policyVersion } from "../../config/moderation-policy";
export function activePolicy() {
  const version = process.env.PANO_MODERATION_POLICY_VERSION || policyVersion;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ rules: moderationRules, pipeline: "integrity-evidence-v2" }))
    .digest("hex")
    .slice(0, 16);
  return { rules: moderationRules, version, key: `${version}:${fingerprint}` };
}
