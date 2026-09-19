import {
  moderationRules,
  type PolicyRule,
} from "../../config/moderation-policy";
import type { Finding, PolicyDecision, ProviderSignal } from "./types";
const requiredCategories = Object.keys(moderationRules);

export function decide(
  signals: ProviderSignal[],
  systemReasons: string[] = [],
  rules: Record<string, PolicyRule> = moderationRules,
): PolicyDecision {
  const findings: Finding[] = [];
  const rejectReasons = new Set<string>();
  const reviewReasons = new Set(systemReasons);
  let critical = false;
  if (
    requiredCategories.some(category => !Object.hasOwn(rules, category)) ||
    rules.SEXUAL_CONTENT_MINORS?.critical !== true ||
    Object.values(rules).some(
      (rule) =>
        !["allow", "reject", "manual_review"].includes(rule.action) ||
        !Number.isFinite(rule.reviewThreshold) ||
        !Number.isFinite(rule.rejectThreshold) ||
        rule.reviewThreshold < 0 ||
        rule.rejectThreshold > 1 ||
        rule.reviewThreshold > rule.rejectThreshold,
    )
  )
    reviewReasons.add("MODERATION_INVALID_POLICY");
  if (!signals.length) reviewReasons.add("MODERATION_INCOMPLETE");
  for (const signal of signals) {
    for (const error of signal.errors || []) reviewReasons.add(error);
    if (signal.uncertain || !signal.textComplete)
      reviewReasons.add("MANUAL_POLICY_REVIEW");
    for (const finding of signal.findings) {
      if (
        !Number.isFinite(finding.confidence) ||
        finding.confidence < 0 ||
        finding.confidence > 1
      ) {
        reviewReasons.add("MODERATION_INVALID_RESULT");
        continue;
      }
      const rule = rules[finding.category];
      // The critical child-safety floor cannot be disabled by an edited policy.
      if (finding.category === "SEXUAL_CONTENT_MINORS" && finding.confidence >= 0.3) {
        critical = true;
        reviewReasons.add(finding.category);
      }
      if (!rule) {
        reviewReasons.add("MODERATION_UNKNOWN_CATEGORY");
        continue;
      }
      if (finding.confidence < rule.reviewThreshold) continue;
      findings.push(finding);
      if (rule.critical) {critical = true;reviewReasons.add(finding.category);}
      if (
        rule.action === "reject" &&
        finding.confidence >= rule.rejectThreshold
      )
        rejectReasons.add(finding.category);
      else if (rule.action !== "allow") reviewReasons.add(finding.category);
    }
  }
  // A single hard violation wins, even if another stage failed or many frames passed.
  const decision = rejectReasons.size
    ? "rejected"
    : reviewReasons.size
      ? "manual_review"
      : "approved";
  return {
    decision,
    reasonCodes: [...new Set([...rejectReasons, ...reviewReasons])],
    findings,
    critical,
    priority:
      critical ||
      systemReasons.length ||
      signals.some((signal) => signal.errors?.length)
        ? "high"
        : "normal",
    rejectionKind: decision === "rejected" ? "content" : null,
  };
}

export function technicalDecision(reason: string): PolicyDecision {
  return {
    decision: "rejected",
    reasonCodes: [reason],
    findings: [],
    critical: false,
    priority: "low",
    rejectionKind: "technical",
  };
}
