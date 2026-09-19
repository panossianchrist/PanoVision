import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { completed, processing, isolatedStore, findingSignal, signal, imageMetadata, serviceError } from "./helpers/moderation.ts";
import { decide } from "../lib/moderation/decision-engine.ts";
import { assetDirectory, originalPath } from "../lib/media/storage.ts";
import { digest } from "../lib/media/integrity.ts";
import { activePolicy } from "../lib/moderation/policy.ts";

const reason = "Synthetic authorized audit decision";
const details = { creativeType: "Image" };

test("direct SQL scheduling rechecks actual file bytes as well as database hashes", t => {
  const { store } = isolatedStore(t);
  const asset = completed(store);
  let campaign = store.submitCampaign(asset.campaign_id, asset.owner_id, asset.id, details);
  for (const state of ["business_approved", "paid"] as const)
    campaign = store.transitionCampaign(campaign.id, campaign.revision, state, "admin", reason);
  writeFileSync(originalPath(asset.id), Buffer.alloc(16, 99));
  assert.throws(() => store.db.prepare("UPDATE campaigns SET business_status='scheduled',schedule_confirmed_at=1 WHERE id=?").run(campaign.id), /MEDIA_INTEGRITY_FAILED/);
});

for (const state of ["processing", "manual_review", "rejected"] as const) {
  test(`payment flags cannot publish a ${state} creative`, t => {
    const { store } = isolatedStore(t);
    const asset = state === "processing" ? processing(store).asset : completed(store, state === "rejected" ? decide([findingSignal("THREATS", .99)]) : decide([signal({ uncertain: true })]));
    for (const next of ["paid", "scheduled", "live"]) {
      assert.throws(() => store.db.prepare("UPDATE campaigns SET business_status=?,business_approved_at=1,availability_approved_at=1,specifications_approved_at=1,quote_approved_at=1,payment_confirmed_at=1,schedule_confirmed_at=1 WHERE id=?").run(next, asset.campaign_id), /CREATIVE_NOT_APPROVED|APPROVAL_EVIDENCE_REQUIRED/);
    }
    assert.equal(store.campaign(asset.campaign_id)!.business_status, "draft");
  });
}

test("status request rate buckets are durable and block excess requests", t => {
  const { store } = isolatedStore(t);
  for (let i = 0; i < 120; i++) store.rateLimit("status:synthetic", 120, 60000);
  assert.throws(() => store.rateLimit("status:synthetic", 120, 60000), serviceError("RATE_LIMIT", 429));
});

for (const target of ["source", "preview", "missing source", "missing preview"]) {
  test(`same-size tampering or missing ${target} revokes approval and pauses a live campaign`, t => {
    const { store } = isolatedStore(t);
    const asset = completed(store);
    let campaign = store.submitCampaign(asset.campaign_id, asset.owner_id, asset.id, details);
    for (const next of ["business_approved", "paid", "scheduled", "live"] as const)
      campaign = store.transitionCampaign(campaign.id, campaign.revision, next, "admin", reason);
    const snapshot = store.publishableMedia(campaign.id);
    assert.equal(digest(snapshot.bytes), snapshot.sha256);
    const file = target.includes("preview") ? path.join(assetDirectory(asset.id), "preview.webp") : originalPath(asset.id);
    if (target.startsWith("missing")) unlinkSync(file);
    else writeFileSync(file, Buffer.alloc(target === "source" ? 16 : 17, 98));
    assert.throws(() => store.publishableMedia(campaign.id), serviceError("MEDIA_INTEGRITY_FAILED"));
    assert.equal(store.campaign(campaign.id)!.business_status, "paused");
    assert.equal(store.asset(asset.id)!.status, "manual_review");
    assert.equal(store.asset(asset.id)!.security_valid, 0);
    assert.throws(() => store.override(asset.id, store.asset(asset.id)!.revision, "approved", "admin", reason), serviceError("SECURITY_REVIEW_REQUIRED"));
  });
}

for (const next of ["submit", "scheduled", "live"] as const) {
  test(`tampered bytes fail the independent ${next} gate`, t => {
    const { store } = isolatedStore(t);
    const asset = completed(store);
    let campaign = store.campaign(asset.campaign_id)!;
    if (next !== "submit") {
      campaign = store.submitCampaign(campaign.id, asset.owner_id, asset.id, details);
      for (const state of ["business_approved", "paid", ...(next === "live" ? ["scheduled" as const] : [])] as const)
        campaign = store.transitionCampaign(campaign.id, campaign.revision, state, "admin", reason);
    }
    writeFileSync(originalPath(asset.id), Buffer.alloc(16, 98));
    assert.throws(() => next === "submit"
      ? store.submitCampaign(campaign.id, asset.owner_id, asset.id, details)
      : store.transitionCampaign(campaign.id, campaign.revision, next, "admin", reason), serviceError("MEDIA_INTEGRITY_FAILED"));
    assert.equal(store.asset(asset.id)!.approval_id, null);
  });
}

test("database rejects forged approval without durable matching evidence", t => {
  const { store } = isolatedStore(t);
  const asset = completed(store, decide([findingSignal("EXPLICIT_NUDITY", .99)]));
  assert.throws(() => store.db.prepare("UPDATE assets SET status='approved',decision='approved',revision=revision+1 WHERE id=?").run(asset.id), /APPROVAL_EVIDENCE_REQUIRED/);
  assert.throws(() => store.db.prepare("UPDATE campaigns SET business_status='live',business_approved_at=1,availability_approved_at=1,specifications_approved_at=1,quote_approved_at=1,payment_confirmed_at=1,schedule_confirmed_at=1 WHERE id=?").run(asset.campaign_id), /APPROVAL_EVIDENCE_REQUIRED|CREATIVE_NOT_APPROVED/);
});

test("revoked automated proof cannot be replayed after rejection", t => {
  const { store } = isolatedStore(t);
  const asset = completed(store);
  store.override(asset.id, asset.revision, "rejected", "admin", reason);
  assert.throws(() => store.db.prepare("UPDATE assets SET status='approved',decision='approved',approval_id=?,revision=revision+1 WHERE id=?").run(asset.approval_id, asset.id), /APPROVAL_EVIDENCE_REQUIRED/);
});

test("file identity and original moderation/audit records cannot be silently edited", t => {
  const { store } = isolatedStore(t);
  const asset = completed(store);
  for (const field of ["sha256", "preview_sha256", "storage_key", "original_filename", "version", "file_size", "owner_id", "campaign_id"])
    assert.throws(() => store.db.prepare(`UPDATE assets SET ${field}=? WHERE id=?`).run("changed", asset.id), /ASSET_IDENTITY_IMMUTABLE/);
  for (const table of ["moderation_results", "audit_events"]) {
    assert.throws(() => store.db.prepare(`DELETE FROM ${table} WHERE asset_id=?`).run(asset.id), /IMMUTABLE_EVIDENCE/);
    assert.throws(() => store.db.prepare(`UPDATE ${table} SET asset_sha256='changed' WHERE asset_id=?`).run(asset.id), /IMMUTABLE_EVIDENCE/);
  }
});

test("approval proof includes the exact sanitized preview hash", t => {
  const { store } = isolatedStore(t);
  const asset = completed(store);
  const proof = store.db.prepare("SELECT asset_sha256,preview_sha256 FROM moderation_results WHERE id=?").get(asset.approval_id);
  assert.equal(proof!.asset_sha256, asset.sha256);
  assert.equal(proof!.preview_sha256, asset.preview_sha256);
});

test("database failure after moderation rolls back approval, evidence and completed job", t => {
  const { store } = isolatedStore(t);
  const { asset, job } = processing(store);
  store.markSecurity(job, true, imageMetadata);
  store.db.exec("CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON audit_events WHEN NEW.action='automated_decision' BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END");
  assert.throws(() => store.completeJob(job, decide([signal()]), "mock", [], Date.now()), /synthetic write failure/);
  assert.equal(store.asset(asset.id)!.status, "processing");
  assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM moderation_results WHERE asset_id=?").get(asset.id)!.n, 0);
  assert.equal(store.ownsJob(job), true);
});

test("reviewer, disabled and nonexistent actors cannot override or publish through services", t => {
  const { store } = isolatedStore(t);
  const asset = completed(store, decide([signal({ uncertain: true })]));
  const reviewer = store.addAdmin("actual-reviewer", "not-login", "reviewer");
  const disabled = store.addAdmin("disabled-admin", "not-login", "admin");
  store.db.prepare("UPDATE admins SET disabled=1 WHERE id=?").run(disabled);
  for (const actor of [reviewer, disabled, "customer"]) {
    assert.throws(() => store.override(asset.id, asset.revision, "approved", actor, reason), serviceError("FORBIDDEN", 403));
    assert.throws(() => store.transitionCampaign(asset.campaign_id, 1, "live", actor, reason), serviceError("FORBIDDEN", 403));
  }
  const approved = store.override(asset.id, asset.revision, "approved", "admin", reason);
  const evidence = store.history(asset.id).find(row => row.action === "admin_override")!;
  assert.equal(evidence.asset_sha256, asset.sha256);
  assert.equal(evidence.policy_key, activePolicy().key);
  assert.equal(evidence.policy_version, activePolicy().version);
  assert.equal(approved.automated_decision, "manual_review");
});

test("lease token is bound to its asset, not merely to a job id", t => {
  const { store } = isolatedStore(t);
  const first = processing(store);
  const second = processing(store);
  const forged = { ...first.job, asset_id: second.asset.id };
  assert.equal(store.ownsJob(forged), false);
  assert.equal(store.heartbeat(forged), false);
  assert.throws(() => store.markSecurity(forged, true, imageMetadata), serviceError("LEASE_LOST"));
  assert.equal(store.completeJob(forged, decide([signal()]), "mock", [], Date.now()), false);
  assert.equal(store.asset(second.asset.id)!.status, "processing");
});

test("a missing job or partial worker cannot create a completed approval", t => {
  const { store } = isolatedStore(t);
  const { asset, job } = processing(store);
  store.markSecurity(job, true, imageMetadata);
  store.db.prepare("DELETE FROM jobs WHERE id=?").run(job.id);
  assert.equal(store.completeJob(job, decide([signal()]), "mock", [], Date.now()), false);
  assert.equal(store.asset(asset.id)!.status, "processing");
  assert.throws(() => store.submitCampaign(asset.campaign_id, asset.owner_id, asset.id, details), serviceError("CREATIVE_NOT_APPROVED"));
});

test("dispatch rechecks revocation after reading bytes and before returning them", t => {
  const { store } = isolatedStore(t);
  const asset = completed(store);
  let campaign = store.submitCampaign(asset.campaign_id, asset.owner_id, asset.id, details);
  for (const state of ["business_approved", "paid", "scheduled", "live"] as const)
    campaign = store.transitionCampaign(campaign.id, campaign.revision, state, "admin", reason);
  const read = store.verifiedMedia.bind(store);
  t.mock.method(store, "verifiedMedia", (id: string) => {
    const bytes = read(id);
    store.override(id, store.asset(id)!.revision, "rejected", "admin", reason);
    return bytes;
  });
  assert.throws(() => store.publishableMedia(campaign.id), serviceError("CAMPAIGN_GATE_BLOCKED"));
});
