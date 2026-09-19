import assert from "node:assert/strict";
import { test } from "node:test";
import { moderationRules } from "../config/moderation-policy.ts";
import {
  decide,
  technicalDecision,
} from "../lib/moderation/decision-engine.ts";
import { activePolicy } from "../lib/moderation/policy.ts";
import { publicAsset } from "../lib/moderation/messages.ts";
import type { Asset } from "../lib/moderation/types.ts";
import {
  completed,
  findingSignal,
  imageMetadata,
  isolatedStore,
  processing,
  reserve,
  serviceError,
  signal,
} from "./helpers/moderation.ts";

const reason = "Synthetic reviewer decision for this test";
const approved = () => decide([signal()]);
const review = () => decide([signal({ uncertain: true })]);

test("analytics distinguish content rejections from technical rejections",t=>{const {store}=isolatedStore(t);completed(store,technicalDecision("TECHNICAL_INVALID_IMAGE"));completed(store,decide([findingSignal("EXPLICIT_NUDITY",.99)]));const metrics=store.metrics();assert.equal(metrics.rejectionKinds.find(row=>row.kind==="technical")!.count,1);assert.equal(metrics.rejectionKinds.find(row=>row.kind==="content")!.count,1);});

test("policy change during a job cannot stamp an old check as a new approval",t=>{const {store}=isolatedStore(t);const {asset,job}=processing(store);store.markSecurity(job,true,imageMetadata);process.env.PANO_MODERATION_POLICY_VERSION="CHANGED_DURING_JOB";assert.throws(()=>store.completeJob(job,approved(),"mock",[],Date.now()),serviceError("POLICY_CHANGED"));assert.equal(store.asset(asset.id)!.status,"processing");});
test("expired lease cannot commit or renew itself",t=>{const {store}=isolatedStore(t);const {asset,job}=processing(store);store.markSecurity(job,true,imageMetadata);store.db.prepare("UPDATE jobs SET lease_until=1 WHERE id=?").run(job.id);assert.equal(store.heartbeat(job),false);assert.equal(store.completeJob(job,approved(),"mock",[],Date.now()),false);assert.equal(store.asset(asset.id)!.status,"processing");});
test("purge reservation blocks an approval racing with retention",t=>{const {store}=isolatedStore(t);const asset=completed(store,review());store.db.prepare("UPDATE assets SET expires_at=1 WHERE id=?").run(asset.id);assert.equal(store.beginPurge(asset.id),true);const current=store.asset(asset.id)!;assert.equal(current.purge_pending,1);assert.throws(()=>store.override(asset.id,current.revision,"approved","reviewer",reason),serviceError("SECURITY_REVIEW_REQUIRED"));store.markPurged(asset.id);assert.equal(store.asset(asset.id)!.purged,1);});
test("database refuses campaigns inserted directly into live",t=>{const {store}=isolatedStore(t);assert.throws(()=>store.db.prepare("INSERT INTO campaigns(id,owner_id,idempotency_key,details,business_status,created_at,updated_at) VALUES('bypass','owner','key','{}','live',0,0)").run(),/CAMPAIGN_MUST_START_DRAFT/);});

test("campaign and upload idempotency is scoped to owners and creates one version and audit event", (t) => {
  const { store } = isolatedStore(t);
  const campaign = store.createCampaign("owner", "draft-key", {
    company: "First",
    creativeType: "Image",
  });
  assert.deepEqual(
    store.createCampaign("owner", "draft-key", {
      company: "First",
      creativeType: "Image",
    }),
    campaign,
  );
  assert.throws(
    () => store.createCampaign("owner", "draft-key", { company: "Changed" }),
    serviceError("IDEMPOTENCY_CONFLICT"),
  );
  assert.notEqual(
    store.createCampaign("other", "draft-key", {}).id,
    campaign.id,
  );
  const first = store.reserveUpload(
    "owner",
    campaign.id,
    "upload-key",
    "synthetic.png",
    "image/png",
    "image",
  );
  const replay = store.reserveUpload(
    "owner",
    campaign.id,
    "upload-key",
    "synthetic.png",
    "image/png",
    "image",
  );
  assert.throws(
    () =>
      store.reserveUpload(
        "owner",
        campaign.id,
        "upload-key",
        "different.png",
        "image/png",
        "image",
      ),
    serviceError("IDEMPOTENCY_CONFLICT"),
  );
  assert.equal(first.existing, false);
  assert.equal(replay.existing, true);
  assert.deepEqual(replay.asset, first.asset);
  assert.equal(store.history(first.asset.id).length, 1);
  assert.equal(store.campaign(campaign.id)!.revision, 2);
  const otherCampaign = store.createCampaign("owner", "other-draft", {});
  assert.throws(
    () =>
      reserve(store, {
        owner: "owner",
        campaignId: otherCampaign.id,
        key: "upload-key",
      }),
    serviceError("IDEMPOTENCY_CONFLICT"),
  );
  assert.equal(store.campaign(otherCampaign.id)!.current_asset_id, null);
  assert.notEqual(
    reserve(store, { owner: "other", key: "upload-key" }).id,
    first.asset.id,
  );
});

test("ownership checks hide assets and campaigns and prevent cross-owner mutation", (t) => {
  const { store } = isolatedStore(t);
  const asset = reserve(store);
  assert.equal(store.asset(asset.id, "other"), undefined);
  assert.equal(store.campaign(asset.campaign_id, "other"), undefined);
  assert.throws(
    () => reserve(store, { owner: "other", campaignId: asset.campaign_id }),
    serviceError("NOT_FOUND", 404),
  );
  assert.throws(
    () => store.updateDraft(asset.campaign_id, "other", {}),
    serviceError("NOT_FOUND", 404),
  );
  assert.throws(
    () => store.submitCampaign(asset.campaign_id, "other", asset.id, {}),
    serviceError("CURRENT_CREATIVE_REQUIRED"),
  );
});

test("three outstanding uploads are allowed per owner, with retries exempt from the limit", (t) => {
  const { store } = isolatedStore(t);
  const first = reserve(store, { key: "retry" });
  reserve(store);
  reserve(store);
  assert.throws(() => reserve(store), serviceError("UPLOAD_BUSY", 429));
  assert.equal(
    reserve(store, { campaignId: first.campaign_id, key: "retry" }).id,
    first.id,
  );
  assert.ok(reserve(store, { owner: "other" }));
  store.failUpload(first.id, "UPLOAD_INTERRUPTED");
  assert.ok(reserve(store));
});

test("upload finalization is atomic and queues exactly one durable job", (t) => {
  const { store } = isolatedStore(t);
  const asset = reserve(store);
  store.finishUpload(asset.id, 123, "b".repeat(64));
  assert.equal(store.asset(asset.id)!.status, "uploaded");
  assert.equal(store.asset(asset.id)!.file_size, 123);
  assert.equal(store.asset(asset.id)!.sha256, "b".repeat(64));
  assert.throws(
    () => store.finishUpload(asset.id, 999, "a".repeat(64)),
    serviceError("UPLOAD_CONFLICT"),
  );
  store.failUpload(asset.id, "LATE_FAILURE");
  assert.equal(store.asset(asset.id)!.status, "uploaded");
  assert.equal(
    store.db
      .prepare("SELECT COUNT(*) AS n FROM jobs WHERE asset_id=?")
      .get(asset.id)!.n,
    1,
  );
  const failed = reserve(store);
  store.failUpload(failed.id, "UPLOAD_INTERRUPTED");
  assert.equal(store.asset(failed.id)!.status, "failed");
  assert.equal(store.asset(failed.id)!.stage, "complete");
  assert.throws(
    () => store.finishUpload(failed.id, 10, "a".repeat(64)),
    serviceError("UPLOAD_CONFLICT"),
  );
  assert.equal(
    store.db
      .prepare("SELECT COUNT(*) AS n FROM jobs WHERE asset_id=?")
      .get(failed.id)!.n,
    0,
  );
});

test("database failure rolls back both upload status and job creation", (t) => {
  const { store } = isolatedStore(t);
  const asset = reserve(store);
  store.db.exec(
    "CREATE TRIGGER test_job_failure BEFORE INSERT ON jobs BEGIN SELECT RAISE(ABORT,'synthetic database failure'); END",
  );
  assert.throws(
    () => store.finishUpload(asset.id, 16, "a".repeat(64)),
    /synthetic database failure/,
  );
  assert.equal(store.asset(asset.id)!.status, "uploading");
  assert.equal(store.asset(asset.id)!.file_size, 0);
  assert.equal(store.claimJob(), undefined);
});

test("queued and leased jobs survive connection restarts and cannot be double claimed", (t) => {
  const fixture = isolatedStore(t);
  const asset = reserve(fixture.store);
  fixture.store.finishUpload(asset.id, 16, "a".repeat(64));
  fixture.close(fixture.store);
  const firstConnection = fixture.open();
  const job = firstConnection.claimJob()!;
  assert.equal(job.attempts, 1);
  assert.equal(job.asset_id, asset.id);
  const secondConnection = fixture.open();
  assert.equal(secondConnection.claimJob(), undefined);
  assert.equal(secondConnection.ownsJob(job), true);
  fixture.close(firstConnection);
  assert.equal(secondConnection.claimJob(), undefined);
  secondConnection.db
    .prepare("UPDATE jobs SET lease_until=0 WHERE id=?")
    .run(job.id);
  const reclaimed = secondConnection.claimJob()!;
  assert.equal(reclaimed.id, job.id);
  assert.equal(reclaimed.attempts, 2);
  assert.notEqual(reclaimed.lease_token, job.lease_token);
  assert.equal(secondConnection.ownsJob(job), false);
  assert.equal(secondConnection.heartbeat(job), false);
  assert.throws(
    () => secondConnection.stage(job, "policy"),
    serviceError("LEASE_LOST"),
  );
  assert.throws(
    () => secondConnection.markSecurity(job, true, imageMetadata),
    serviceError("LEASE_LOST"),
  );
  assert.equal(
    secondConnection.completeJob(job, approved(), "mock", [], Date.now()),
    false,
  );
  secondConnection.db
    .prepare("UPDATE jobs SET lease_until=? WHERE id=?")
    .run(Date.now() + 10000, job.id);
  assert.equal(secondConnection.heartbeat(reclaimed), true);
  assert.ok(
    Number(
      secondConnection.db
        .prepare("SELECT lease_until FROM jobs WHERE id=?")
        .get(job.id)!.lease_until,
    ) > Date.now(),
  );
  secondConnection.markSecurity(reclaimed, true, imageMetadata);
  assert.equal(
    secondConnection.completeJob(reclaimed, approved(), "mock", [], Date.now()),
    true,
  );
  assert.equal(secondConnection.claimJob(), undefined);
});

test("jobs claim oldest queued work first and completion is idempotent", (t) => {
  const { store } = isolatedStore(t);
  const first = reserve(store);
  const second = reserve(store);
  store.finishUpload(second.id, 16, "a".repeat(64));
  store.finishUpload(first.id, 16, "a".repeat(64));
  store.db
    .prepare("UPDATE jobs SET created_at=1 WHERE asset_id=?")
    .run(first.id);
  store.db
    .prepare("UPDATE jobs SET created_at=2 WHERE asset_id=?")
    .run(second.id);
  const job = store.claimJob()!;
  assert.equal(job.asset_id, first.id);
  store.stage(job, "visual");
  assert.equal(store.asset(first.id)!.stage, "visual");
  store.markSecurity(job, true, imageMetadata);
  const ids = Array.from({ length: 200 }, (_, i) => `mock-${i}`);
  assert.equal(
    store.completeJob(job, approved(), "mock", ids, Date.now() - 100),
    true,
  );
  const asset = store.asset(first.id)!;
  assert.equal(store.completeJob(job, review(), "mock", [], Date.now()), false);
  assert.deepEqual(store.asset(first.id), asset);
  const results = store.db
    .prepare("SELECT * FROM moderation_results WHERE asset_id=?")
    .all(first.id);
  assert.equal(results.length, 1);
  assert.equal(JSON.parse(String(results[0].request_ids)).length, 160);
  assert.equal(
    store.history(first.id).filter((row) => row.action === "automated_decision")
      .length,
    1,
  );
  assert.equal(store.heartbeat(job), false);
  assert.equal(store.claimJob()!.asset_id, second.id);
});

for (const gate of [
  "scan_passed",
  "security_valid",
  "restricted",
  "purged",
] as const) {
  test(`automated approval cannot bypass ${gate}`, (t) => {
    const { store } = isolatedStore(t);
    const { asset, job } = processing(store);
    store.markSecurity(job, true, imageMetadata);
    store.db
      .prepare(`UPDATE assets SET ${gate}=? WHERE id=?`)
      .run(gate === "restricted" || gate === "purged" ? 1 : 0, asset.id);
    assert.throws(
      () => store.completeJob(job, approved(), "mock", [], Date.now()),
      serviceError("APPROVAL_BLOCKED"),
    );
    assert.equal(store.asset(asset.id)!.status, "processing");
    assert.equal(store.ownsJob(job), true);
    assert.equal(
      store.db.prepare("SELECT COUNT(*) AS n FROM moderation_results").get()!.n,
      0,
    );
  });
}

test("failed security can complete as manual review but cannot continue", (t) => {
  const { store } = isolatedStore(t);
  const { asset, job } = processing(store);
  store.markSecurity(job, false);
  assert.equal(store.completeJob(job, review(), "mock", [], Date.now()), true);
  const result = store.asset(asset.id)!;
  assert.equal(result.security_valid, 0);
  assert.equal(publicAsset(result, activePolicy().key).canContinue, false);
});

const blockedAssets: Array<[string, Partial<Asset>]> = [
  ["uploading", { status: "uploading" }],
  ["uploaded", { status: "uploaded" }],
  ["processing", { status: "processing" }],
  ["manual review", { status: "manual_review" }],
  ["rejected", { status: "rejected" }],
  ["failed", { status: "failed" }],
  ["missing decision", { decision: null }],
  ["rejected decision", { decision: "rejected" }],
  ["missing scan", { scan_passed: 0 }],
  ["invalid security", { security_valid: 0 }],
  ["restricted", { restricted: 1 }],
  ["purged", { purged: 1 }],
  ["expired", { expires_at: 1 }],
  ["stale policy", { policy_key: "old-policy" }],
];

for (const [name, changes] of blockedAssets) {
  test(`campaign and public continuation gates block ${name}`, (t) => {
    const { store } = isolatedStore(t);
    const asset = completed(store);
    const fields = Object.keys(changes);
    if (name === "rejected decision" || name === "missing decision") {
      assert.throws(() => store.db.prepare("UPDATE assets SET decision=? WHERE id=?").run(changes.decision!, asset.id), /APPROVAL_EVIDENCE_REQUIRED/);
      return;
    }
    store.db
      .prepare(
        `UPDATE assets SET ${fields.map((key) => `${key}=?`).join(",")} WHERE id=?`,
      )
      .run(...Object.values(changes), asset.id);
    assert.throws(
      () =>
        store.submitCampaign(asset.campaign_id, asset.owner_id, asset.id, {}),
      serviceError("CREATIVE_NOT_APPROVED"),
    );
    assert.equal(
      publicAsset(store.asset(asset.id)!, activePolicy().key).canContinue,
      false,
    );
    assert.throws(
      () =>
        store.db
          .prepare(
            "UPDATE campaigns SET business_status='requested' WHERE id=?",
          )
          .run(asset.campaign_id),
      /CREATIVE_NOT_APPROVED/,
    );
    assert.equal(store.campaign(asset.campaign_id)!.business_status, "draft");
  });
}

test("content approval requires separate business, payment and scheduling transitions", (t) => {
  const { store } = isolatedStore(t);
  const asset = completed(store);
  assert.equal(publicAsset(asset, activePolicy().key).canContinue, true);
  assert.equal(store.campaign(asset.campaign_id)!.business_status, "draft");
  let campaign = store.submitCampaign(
    asset.campaign_id,
    asset.owner_id,
    asset.id,
    { company: "Synthetic", creativeType: "Image" },
  );
  assert.equal(campaign.business_status, "requested");
  assert.equal(campaign.business_approved_at, null);
  assert.throws(
    () =>
      store.transitionCampaign(
        campaign.id,
        campaign.revision,
        "paid",
        "admin",
        reason,
      ),
    serviceError("INVALID_TRANSITION"),
  );
  assert.throws(
    () =>
      store.transitionCampaign(
        campaign.id,
        campaign.revision - 1,
        "business_approved",
        "admin",
        reason,
      ),
    serviceError("STALE_CAMPAIGN"),
  );
  assert.throws(
    () =>
      store.transitionCampaign(
        campaign.id,
        campaign.revision,
        "business_approved",
        "admin",
        "short",
      ),
    serviceError("REASON_REQUIRED", 400),
  );
  for (const [status, error] of [
    ["business_approved", "BUSINESS_REVIEW_REQUIRED"],
    ["paid", "PAYMENT_REQUIRED"],
    ["scheduled", "SCHEDULING_REQUIRED"],
  ]) {
    assert.throws(
      () =>
        store.db
          .prepare("UPDATE campaigns SET business_status=? WHERE id=?")
          .run(status, campaign.id),
      new RegExp(error),
    );
    campaign = store.transitionCampaign(
      campaign.id,
      campaign.revision,
      status as "business_approved" | "paid" | "scheduled",
      "admin",
      reason,
    );
    assert.equal(campaign.business_status, status);
  }
  campaign = store.transitionCampaign(
    campaign.id,
    campaign.revision,
    "live",
    "admin",
    reason,
  );
  assert.equal(campaign.business_status, "live");
  assert.ok(
    campaign.business_approved_at &&
      campaign.payment_confirmed_at &&
      campaign.schedule_confirmed_at,
  );
  assert.throws(
    () => store.submitCampaign(campaign.id, asset.owner_id, asset.id, {}),
    serviceError("CAMPAIGN_LOCKED"),
  );
  assert.throws(
    () => store.updateDraft(campaign.id, asset.owner_id, {}),
    serviceError("CAMPAIGN_LOCKED"),
  );
});

test("database trigger rechecks creative eligibility at later business transitions", (t) => {
  const { store } = isolatedStore(t);
  const asset = completed(store);
  const campaign = store.submitCampaign(
    asset.campaign_id,
    asset.owner_id,
    asset.id,
    { creativeType: "Image" },
  );
  store.db.prepare("UPDATE assets SET expires_at=1 WHERE id=?").run(asset.id);
  assert.throws(
    () =>
      store.transitionCampaign(
        campaign.id,
        campaign.revision,
        "business_approved",
        "admin",
        reason,
      ),
    serviceError("STALE_CAMPAIGN"),
  );
  assert.equal(store.campaign(campaign.id)!.business_status, "paused");
  assert.throws(
    () =>
      store.db
        .prepare("UPDATE campaigns SET business_status='live' WHERE id=?")
        .run(campaign.id),
    /CREATIVE_NOT_APPROVED/,
  );
});

test("new creative versions clear business approvals and make earlier approved versions ineligible", (t) => {
  const { store } = isolatedStore(t);
  const old = completed(store);
  let campaign = store.submitCampaign(old.campaign_id, old.owner_id, old.id, {
    creativeType: "Image",
  });
  for (const status of [
    "business_approved",
    "paid",
    "scheduled",
    "live",
  ] as const) {
    campaign = store.transitionCampaign(
      campaign.id,
      campaign.revision,
      status,
      "admin",
      reason,
    );
  }
  const next = reserve(store, { campaignId: campaign.id });
  assert.equal(next.version, 2);
  campaign = store.campaign(campaign.id)!;
  assert.equal(campaign.current_asset_id, next.id);
  assert.equal(campaign.business_status, "draft");
  assert.equal(campaign.business_approved_at, null);
  assert.equal(campaign.payment_confirmed_at, null);
  assert.equal(campaign.schedule_confirmed_at, null);
  assert.throws(
    () => store.submitCampaign(campaign.id, old.owner_id, old.id, {}),
    serviceError("CURRENT_CREATIVE_REQUIRED"),
  );
  assert.equal(publicAsset(old, activePolicy().key, false).canContinue, false);
});

test("an old in-flight job cannot replace the current creative version", (t) => {
  const { store } = isolatedStore(t);
  const { asset, job } = processing(store);
  const current = reserve(store, { campaignId: asset.campaign_id });
  store.markSecurity(job, true, imageMetadata);
  assert.equal(
    store.completeJob(job, approved(), "mock", [], Date.now()),
    true,
  );
  assert.equal(store.campaign(asset.campaign_id)!.current_asset_id, current.id);
  assert.throws(
    () => store.submitCampaign(asset.campaign_id, asset.owner_id, asset.id, {}),
    serviceError("CURRENT_CREATIVE_REQUIRED"),
  );
});

test("human override preserves automated evidence and records actor, reason and both decisions", (t) => {
  const { store } = isolatedStore(t);
  const asset = completed(store, decide([findingSignal("POLITICAL", 0.8)]));
  const overridden = store.override(
    asset.id,
    asset.revision,
    "approved",
    "reviewer",
    `  ${reason}  `,
  );
  assert.equal(overridden.status, "approved");
  assert.equal(overridden.automated_decision, "manual_review");
  assert.equal(overridden.findings, asset.findings);
  assert.equal(overridden.revision, asset.revision + 1);
  const audit = store
    .history(asset.id)
    .find((row) => row.action === "admin_override")!;
  assert.equal(audit.actor_id, "reviewer");
  assert.equal(audit.original_decision, "manual_review");
  assert.equal(audit.final_decision, "approved");
  assert.equal(audit.reason, reason);
  assert.equal(
    store.db
      .prepare("SELECT decision FROM moderation_results WHERE asset_id=?")
      .get(asset.id)!.decision,
    "manual_review",
  );
  assert.throws(
    () =>
      store.override(asset.id, asset.revision, "rejected", "reviewer", reason),
    serviceError("STALE_REVIEW"),
  );
});

test("overrides require a reviewable state and an adequate reason", (t) => {
  const { store } = isolatedStore(t);
  const pending = reserve(store);
  assert.throws(
    () =>
      store.override(
        pending.id,
        pending.revision,
        "approved",
        "reviewer",
        reason,
      ),
    serviceError("NOT_REVIEWABLE"),
  );
  store.failUpload(pending.id, "TEST_UPLOAD_FAILED");
  const asset = completed(store, review());
  for (const invalid of [" ", "short", "a".repeat(1001)]) {
    assert.throws(
      () =>
        store.override(
          asset.id,
          asset.revision,
          "approved",
          "reviewer",
          invalid,
        ),
      serviceError("REASON_REQUIRED", 400),
    );
  }
  assert.equal(store.asset(asset.id)!.revision, asset.revision);
});

for (const [name, changes] of blockedAssets
  .filter(([, changes]) => !changes.status && !("decision" in changes))
  .concat([["technical rejection", { rejection_kind: "technical" }]])) {
  test(`human approval cannot bypass ${name}`, (t) => {
    const { store } = isolatedStore(t);
    const asset = completed(store, review());
    store.db
      .prepare(
        `UPDATE assets SET ${Object.keys(changes)
          .map((key) => `${key}=?`)
          .join(",")} WHERE id=?`,
      )
      .run(...Object.values(changes), asset.id);
    assert.throws(
      () =>
        store.override(
          asset.id,
          asset.revision,
          "approved",
          "reviewer",
          reason,
        ),
      serviceError("SECURITY_REVIEW_REQUIRED"),
    );
    assert.equal(store.asset(asset.id)!.status, "manual_review");
  });
}

test("rejecting a current approved creative pauses its campaign and clears all business approvals", (t) => {
  const { store } = isolatedStore(t);
  const asset = completed(store);
  let campaign = store.submitCampaign(
    asset.campaign_id,
    asset.owner_id,
    asset.id,
    { creativeType: "Image" },
  );
  for (const status of [
    "business_approved",
    "paid",
    "scheduled",
    "live",
  ] as const)
    campaign = store.transitionCampaign(
      campaign.id,
      campaign.revision,
      status,
      "admin",
      reason,
    );
  const result = store.override(
    asset.id,
    asset.revision,
    "rejected",
    "reviewer",
    reason,
    true,
  );
  campaign = store.campaign(campaign.id)!;
  assert.equal(campaign.business_status, "paused");
  assert.equal(campaign.business_approved_at, null);
  assert.equal(campaign.payment_confirmed_at, null);
  assert.equal(campaign.schedule_confirmed_at, null);
  assert.equal(result.automated_decision, "approved");
  assert.deepEqual(JSON.parse(result.reason_codes), ["NEW_CREATIVE_REQUESTED"]);
  assert.ok(
    store
      .history(asset.id)
      .some((row) => row.action === "request_new_creative"),
  );
});

for (const change of ["version", "fingerprint"] as const) {
  test(`policy ${change} changes invalidate old approvals and pause active campaigns on reopen`, (t) => {
    const fixture = isolatedStore(t);
    const asset = completed(fixture.store);
    fixture.store.submitCampaign(asset.campaign_id, asset.owner_id, asset.id, {
      creativeType: "Image",
    });
    const oldPolicy = activePolicy();
    if (change === "version")
      process.env.PANO_MODERATION_POLICY_VERSION = "TEST_POLICY_V2";
    else {
      const previous = moderationRules.POLITICAL;
      t.after(() => {
        moderationRules.POLITICAL = previous;
      });
      moderationRules.POLITICAL = { ...previous, reviewThreshold: 0.31 };
    }
    assert.notEqual(activePolicy().key, oldPolicy.key);
    if (change === "fingerprint")
      assert.equal(activePolicy().version, oldPolicy.version);
    assert.equal(publicAsset(asset, activePolicy().key).canContinue, false);
    assert.throws(
      () =>
        fixture.store.submitCampaign(
          asset.campaign_id,
          asset.owner_id,
          asset.id,
          {},
        ),
      serviceError("CREATIVE_NOT_APPROVED"),
    );
    assert.throws(
      () =>
        fixture.store.override(
          asset.id,
          asset.revision,
          "approved",
          "reviewer",
          reason,
        ),
      serviceError("SECURITY_REVIEW_REQUIRED"),
    );
    fixture.close(fixture.store);
    const reopened = fixture.open();
    assert.equal(
      reopened.campaign(asset.campaign_id)!.business_status,
      "paused",
    );
    assert.equal(
      reopened.db
        .prepare("SELECT value FROM settings WHERE key='active_policy'")
        .get()!.value,
      activePolicy().key,
    );
    assert.equal(reopened.asset(asset.id)!.policy_key, oldPolicy.key);
  });
}

test("critical results expire immediately, receive priority, and cannot be overridden to approval", (t) => {
  const { store } = isolatedStore(t);
  const asset = completed(
    store,
    decide([findingSignal("SEXUAL_CONTENT_MINORS", 0.3)]),
  );
  assert.equal(asset.status, "manual_review");
  assert.equal(asset.restricted, 1);
  assert.equal(asset.priority, "high");
  assert.ok(asset.expires_at <= Date.now());
  assert.throws(
    () =>
      store.override(asset.id, asset.revision, "approved", "reviewer", reason),
    serviceError("SECURITY_REVIEW_REQUIRED"),
  );
  store.markPurged(asset.id);
  assert.equal(store.asset(asset.id)!.purged, 1);
});

test("review queue prioritizes critical concerns and rejects arbitrary filters", (t) => {
  const { store } = isolatedStore(t);
  completed(store, technicalDecision("TECHNICAL_INVALID_IMAGE"));
  completed(store, review());
  const critical = completed(
    store,
    decide([findingSignal("SEXUAL_CONTENT_MINORS", 0.3)]),
  );
  assert.equal(store.reviewQueue()[0].id, critical.id);
  assert.equal(store.reviewQueue().length, 2);
  assert.equal(store.reviewQueue("all").length, 3);
  assert.throws(
    () => store.reviewQueue("invalid' OR 1=1"),
    serviceError("INVALID_FILTER", 400),
  );
});

test("technical rejections remain ineligible after an intermediate manual-review override", (t) => {
  const { store } = isolatedStore(t);
  const asset = completed(store, technicalDecision("TECHNICAL_INVALID_IMAGE"));
  const reviewed = store.override(
    asset.id,
    asset.revision,
    "manual_review",
    "reviewer",
    reason,
  );
  assert.throws(
    () =>
      store.override(
        asset.id,
        reviewed.revision,
        "approved",
        "reviewer",
        reason,
      ),
    serviceError("SECURITY_REVIEW_REQUIRED"),
  );
});
