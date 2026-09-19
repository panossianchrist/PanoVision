import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { emptyCampaign } from "../lib/validation.ts";
import {
  environment,
  isolatedStore,
  completed,
  processing,
  signal,
} from "./helpers/moderation.ts";
import {
  passwordHash,
  verifyPassword,
  boundedBody,
} from "../lib/server/http.ts";
import { POST as draft } from "../app/api/campaigns/draft/route.ts";
import { POST as upload } from "../app/api/creative/upload/route.ts";
import { GET as status } from "../app/api/creative/[id]/status/route.ts";
import { POST as submit } from "../app/api/campaign-request/route.ts";
import { POST as login } from "../app/api/admin/login/route.ts";
import { GET as queue } from "../app/api/admin/moderation/route.ts";
import { GET as preview } from "../app/api/admin/moderation/[id]/preview/route.ts";
import { POST as transition } from "../app/api/admin/campaigns/[id]/transition/route.ts";
import { POST as override } from "../app/api/admin/moderation/[id]/decision/route.ts";
import { decide } from "../lib/moderation/decision-engine.ts";
import { registerCustomer } from "../lib/server/accounts.ts";
import type { PanoStore } from "../lib/server/store.ts";
function customer(store: PanoStore) {
  return registerCustomer({name:"Synthetic person",company:"Synthetic company",email:`${randomUUID()}@example.com`,phone:"",country:"",role:"",language:"en",password:"Synthetic-password-for-tests-only"},store);
}
const origin = "http://127.0.0.1:4174";
const details = {
  ...emptyCampaign,
  company: "Synthetic company",
  contact: "Synthetic person",
  email: "synthetic@example.com",
  campaign: "Synthetic campaign",
};
function request(
  route: string,
  data?: unknown,
  cookie = "",
  extra: Record<string, string> = {},
) {
  return new Request(`${origin}${route}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
      ...extra,
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
function setup(t: Parameters<typeof isolatedStore>[0]) {
  const fixture = isolatedStore(t);
  environment(t, { PANO_APP_ORIGIN: origin, PANO_UPLOADS_ENABLED: "true" });
  const global = globalThis as typeof globalThis & {
    panoStore?: typeof fixture.store;
  };
  const previous = global.panoStore;
  global.panoStore = fixture.store;
  t.after(() => {
    global.panoStore = previous;
  });
  return fixture;
}

test("authenticated reviewers cannot override any decision through the API", async t => {
  const { store } = setup(t);
  const asset = completed(store, decide([signal({ uncertain: true })]));
  const reviewer = store.addAdmin("read-only-reviewer", "not-a-password", "reviewer");
  const session = store.createSession("reviewer", reviewer);
  for (const action of ["approve", "reject", "request_new"]) {
    const response = await override(request("/review", { action, revision: asset.revision, reason: "Synthetic review reason" }, `pano_admin=${session.token}`), { params: Promise.resolve({ id: asset.id }) });
    assert.equal(response.status, 403);
  }
  assert.equal(store.asset(asset.id)!.status, "manual_review");
});

test("unauthenticated admin endpoints and private previews are denied", async (t) => {
  setup(t);
  assert.equal((await queue(request("/api/admin/moderation"))).status, 401);
  assert.equal(
    (
      await preview(request("/api/admin/moderation/x/preview"), {
        params: Promise.resolve({ id: randomUUID() }),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await override(request("/review", {}), {
        params: Promise.resolve({ id: randomUUID() }),
      })
    ).status,
    401,
  );
});
test("drafts require an account and cross-site writes are rejected", async (t) => {
  const {store}=setup(t),user=customer(store);
  assert.equal((await draft(request("/api/campaigns/draft",{key:randomUUID(),details}))).status,401);
  const response = await draft(
    request("/api/campaigns/draft", { key: randomUUID(), details },`pano_customer=${user.token}`),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"),null);
  const denied = await draft(
    request("/api/campaigns/draft", { key: randomUUID(), details }, `pano_customer=${user.token}`, {
      Origin: "https://attacker.example",
    }),
  );
  assert.equal(denied.status, 403);
});
test("invalid campaign dates and extra approval fields are rejected", async (t) => {
  const {store}=setup(t),user=customer(store);
  for (const values of [
    { ...details, startDate: "2099-99-99" },
    { ...details, decision: "approved" },
  ])
    assert.equal(
      (await draft(request("/draft", { key: randomUUID(), details: values },`pano_customer=${user.token}`)))
        .status,
      400,
    );
});
test("raw uploads require an owned campaign and reject executable declarations", async (t) => {
  const { store } = setup(t);
  const user = customer(store);
  const campaign = store.createCampaign(user.ownerId, randomUUID(), details);
  const req = new Request(`${origin}/api/creative/upload`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: `pano_customer=${user.token}`,
      "Content-Type": "application/octet-stream",
      "X-File-Name": "file.exe",
      "X-File-Type": "application/octet-stream",
      "X-Campaign-Id": campaign.id,
      "Idempotency-Key": randomUUID(),
    },
    body: "safe synthetic fixture",
  });
  assert.equal((await upload(req)).status, 415);
});
test("status hides other customers' files and never exposes raw provider data", async (t) => {
  const { store } = setup(t);
  const first = customer(store),
    second = customer(store);
  const asset = completed(store, undefined, { owner: first.ownerId });
  const params = { params: Promise.resolve({ id: asset.id }) };
  assert.equal(
    (
      await status(
        request("/status", undefined, `pano_customer=${second.token}`),
        params,
      )
    ).status,
    404,
  );
  const response = await status(
    request("/status", undefined, `pano_customer=${first.token}`),
    params,
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.asset.canContinue, true);
  for (const key of [
    "findings",
    "reason_codes",
    "provider",
    "storage_key",
    "sha256",
  ])
    assert.equal(key in result.asset, false);
});
test("server blocks campaign submission while processing, regardless of customer claims", async (t) => {
  const { store } = setup(t);
  const user = customer(store);
  const { asset } = processing(store, { owner: user.ownerId });
  const response = await submit(
    request(
      "/submit",
      { campaignId: asset.campaign_id, assetId: asset.id, details },
      `pano_customer=${user.token}`,
    ),
  );
  assert.equal(response.status, 409);
});
test("admin passwords are salted hashes and reviewers cannot confirm payments", async (t) => {
  const { store } = setup(t);
  const password = "Synthetic-test-password-123";
  const hash = passwordHash(password);
  assert.notEqual(hash, passwordHash(password));
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("wrong", hash), false);
  assert.equal(verifyPassword(password, "corrupt hash"), false);
  const id = store.addAdmin("reviewer", hash, "reviewer"),
    session = store.createSession("reviewer", id);
  assert.equal(
    (await login(request("/login", { username: "reviewer", password }))).status,
    200,
  );
  assert.equal(
    (
      await transition(
        request(
          "/transition",
          { revision: 1, next: "paid", reason: "Synthetic audit note" },
          `pano_admin=${session.token}`,
        ),
        { params: Promise.resolve({ id: randomUUID() }) },
      )
    ).status,
    403,
  );
});
test("admin override is audited, with strict business attestations and stale-write protection", async (t) => {
  const { store } = setup(t);
  const id = store.addAdmin("admin", passwordHash("Synthetic-strong-password")),
    session = store.createSession("admin", id),
    cookie = `pano_admin=${session.token}`;
  const asset = completed(store, decide([signal({ uncertain: true })]));
  const params = { params: Promise.resolve({ id: asset.id }) };
  const action = {
    revision: asset.revision,
    action: "approve",
    reason: "Full synthetic review performed",
  };
  assert.equal(
    (await override(request("/review", action, cookie), params)).status,
    200,
  );
  assert.equal(
    (await override(request("/review", action, cookie), params)).status,
    409,
  );
  assert.ok(
    store
      .history(asset.id)
      .some((row) => row.actor_id === id && row.action === "admin_override"),
  );
  const campaign = store.submitCampaign(
    asset.campaign_id,
    asset.owner_id,
    asset.id,
    details,
  );
  const input = {
    revision: campaign.revision,
    next: "business_approved",
    reason: "All business checks verified",
  };
  const campaignParams = { params: Promise.resolve({ id: campaign.id }) };
  assert.equal(
    (await transition(request("/transition", input, cookie), campaignParams))
      .status,
    400,
  );
  assert.equal(
    (
      await transition(
        request(
          "/transition",
          {
            ...input,
            attestations: {
              availability: true,
              specifications: true,
              quote: true,
            },
          },
          cookie,
        ),
        campaignParams,
      )
    ).status,
    200,
  );
});
test("bounded JSON bodies reject false length and oversized payloads", async (t) => {
  setup(t);
  await assert.rejects(
    boundedBody(new Request(origin, { method: "POST", body: "12345" }), 4),
  );
  await assert.rejects(
    boundedBody(
      new Request(origin, {
        method: "POST",
        headers: { "content-length": "8" },
        body: "123",
      }),
      10,
    ),
  );
});
