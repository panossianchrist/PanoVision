import assert from "node:assert/strict";
import { test } from "node:test";
import {
  moderationRules,
  type PolicyRule,
} from "../config/moderation-policy.ts";
import {
  decide,
  technicalDecision,
} from "../lib/moderation/decision-engine.ts";
import { findingSignal, signal } from "./helpers/moderation.ts";

test("complete safe signals approve without granting business approval", () => {
  assert.deepEqual(decide([signal(), signal()]), {
    decision: "approved",
    reasonCodes: [],
    findings: [],
    critical: false,
    priority: "normal",
    rejectionKind: null,
  });
});

for (const [category, rule] of Object.entries(moderationRules)) {
  test(`${category}: review and rejection boundaries follow the configured policy`, () => {
    assert.equal(
      decide([findingSignal(category, rule.reviewThreshold - 0.00001)])
        .decision,
      "approved",
    );
    const review = decide([findingSignal(category, rule.reviewThreshold)]);
    assert.equal(review.decision, "manual_review");
    assert.deepEqual(review.reasonCodes, [category]);
    assert.equal(review.critical, !!rule.critical);
    assert.equal(
      decide([findingSignal(category, rule.rejectThreshold - 0.00001)])
        .decision,
      "manual_review",
    );
    const high = decide([findingSignal(category, rule.rejectThreshold)]);
    assert.equal(
      high.decision,
      rule.action === "reject" ? "rejected" : "manual_review",
    );
    assert.equal(
      high.rejectionKind,
      rule.action === "reject" ? "content" : null,
    );
  });
}

test("missing, uncertain, incomplete, and failed checks require review", () => {
  assert.deepEqual(decide([]).reasonCodes, ["MODERATION_INCOMPLETE"]);
  for (const partial of [
    { uncertain: true },
    { textComplete: false },
    { errors: ["MODERATION_PROVIDER_UNAVAILABLE"] },
  ]) {
    assert.equal(decide([signal(partial)]).decision, "manual_review");
  }
  const failure = decide([signal()], ["SECURITY_SCANNER_UNAVAILABLE"]);
  assert.equal(failure.decision, "manual_review");
  assert.equal(failure.priority, "high");
});

for (const confidence of [NaN, Infinity, -Infinity, -0.01, 1.01]) {
  test(`invalid confidence ${confidence} fails closed`, () => {
    const result = decide([findingSignal("THREATS", confidence)]);
    assert.equal(result.decision, "manual_review");
    assert.deepEqual(result.reasonCodes, ["MODERATION_INVALID_RESULT"]);
    assert.deepEqual(result.findings, []);
  });
}

test("unknown categories require review and do not become accepted findings", () => {
  const result = decide([findingSignal("UNKNOWN_TEST_CATEGORY", 1)]);
  assert.equal(result.decision, "manual_review");
  assert.deepEqual(result.reasonCodes, ["MODERATION_UNKNOWN_CATEGORY"]);
  assert.deepEqual(result.findings, []);
});

test("one violating frame rejects among safe frames, regardless of ordering or failures", () => {
  const violation = findingSignal("PROHIBITED_GOODS", 0.95);
  violation.findings[0].timestamp = 7.5;
  for (const signals of [
    [...Array.from({ length: 16 }, () => signal()), violation],
    [violation, signal()],
  ]) {
    const result = decide(signals, [
      "MODERATION_TIMEOUT",
      "MODERATION_TIMEOUT",
    ]);
    assert.equal(result.decision, "rejected");
    assert.deepEqual(result.reasonCodes, [
      "PROHIBITED_GOODS",
      "MODERATION_TIMEOUT",
    ]);
    assert.deepEqual(result.findings, violation.findings);
    assert.equal(result.rejectionKind, "content");
  }
});

test("critical concern at review threshold is restricted even without a hard rejection", () => {
  for (const confidence of [0.3, 0.9]) {
    const result = decide([findingSignal("SEXUAL_CONTENT_MINORS", confidence)]);
    assert.equal(result.critical, true);
    assert.equal(result.priority, "high");
    assert.equal(
      result.decision,
      confidence < 0.9 ? "manual_review" : "rejected",
    );
  }
  assert.equal(
    decide([findingSignal("SEXUAL_CONTENT_MINORS", 0.29)]).critical,
    false,
  );
});

test("reasons deduplicate while preserving evidence from different sources", () => {
  const first = findingSignal("THREATS", 0.95);
  const second = findingSignal("THREATS", 1);
  second.findings[0].source = "audio";
  const result = decide(
    [first, second],
    ["MANUAL_POLICY_REVIEW", "MANUAL_POLICY_REVIEW"],
  );
  assert.deepEqual(result.reasonCodes, ["THREATS", "MANUAL_POLICY_REVIEW"]);
  assert.equal(result.findings.length, 2);
});

test("injected allow rules retain evidence without requiring review", () => {
  const rules: Record<string, PolicyRule> = {
    ...moderationRules,
    TEST_ALLOWED: {
      action: "allow",
      description: "Synthetic rule",
      reviewThreshold: 0.2,
      rejectThreshold: 0.8,
    },
  };
  const result = decide([findingSignal("TEST_ALLOWED", 1)], [], rules);
  assert.equal(result.decision, "approved");
  assert.deepEqual(result.reasonCodes, []);
  assert.equal(result.findings.length, 1);
});

test("incomplete rules and disabled critical handling never automatically approve", () => {
  for (const rules of [{}, { ...moderationRules, SEXUAL_CONTENT_MINORS: { ...moderationRules.SEXUAL_CONTENT_MINORS, critical: false } }]) {
    assert.equal(decide([signal()], [], rules).decision, "manual_review");
    const critical = decide([findingSignal("SEXUAL_CONTENT_MINORS", .99)], [], rules);
    assert.equal(critical.critical, true);
    assert.notEqual(critical.decision, "approved");
  }
});

test("technical rejection remains distinct from a content rejection", () => {
  assert.deepEqual(technicalDecision("TECHNICAL_VIDEO_DURATION"), {
    decision: "rejected",
    reasonCodes: ["TECHNICAL_VIDEO_DURATION"],
    findings: [],
    critical: false,
    priority: "low",
    rejectionKind: "technical",
  });
});
