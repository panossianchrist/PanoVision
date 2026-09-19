import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import { isolatedStore, environment, completed } from "./helpers/moderation.ts";
import {
  customerCampaign,
  customerCampaigns,
  customerProfile,
  registerCustomer,
  signupSchema,
  updateProfile,
} from "../lib/server/accounts.ts";
import { POST, GET } from "../app/api/account/[action]/route.ts";
import { GET as report } from "../app/api/account/campaigns/[id]/report/route.ts";
import { GET as creative } from "../app/api/account/campaigns/[id]/creative/route.ts";
import { GET as campaignGet } from "../app/api/account/campaigns/[id]/route.ts";
import { POST as draft } from "../app/api/campaigns/draft/route.ts";
import { emptyCampaign } from "../lib/validation.ts";
import { safeReturnTo } from "../lib/return-to.ts";
import {
  requestEmailChange,
  confirmEmailChange,
} from "../lib/server/email-change.ts";
import type { AccountMail } from "../lib/server/account-mail.ts";
const origin = "http://127.0.0.1:4174";
const profile = {
  name: "Synthetic Owner",
  company: "Synthetic Company",
  email: "owner@example.com",
  phone: "+961 70 123 456",
  country: "Lebanon",
  role: "Owner",
  language: "en" as const,
};
const password = "Synthetic-test-passphrase-2468";
const details = {
  ...emptyCampaign,
  company: profile.company,
  contact: profile.name,
  email: profile.email,
  campaign: "Synthetic campaign",
};
function setup(t: TestContext) {
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
function request(action: string, data?: unknown, token = "", source = origin) {
  return new Request(`${origin}/api/account/${action}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Origin: source,
      "Content-Type": "application/json",
      Cookie: `pano_customer=${token}`,
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
const context = (action: string) => ({ params: Promise.resolve({ action }) });
function token(response: Response) {
  return response.headers.get("set-cookie")!.split(";")[0].split("=")[1];
}

test("signup stores a salted password and company-scoped HttpOnly session", async (t) => {
  const { store } = setup(t);
  const response = await POST(
    request("signup", { ...profile, password }),
    context("signup"),
  );
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=strict/i);
  const body = await response.json();
  assert.deepEqual(body.profile, profile);
  assert.equal("password_hash" in body.profile, false);
  const row = store.db.prepare("SELECT * FROM customers").get()!;
  assert.match(String(row.password_hash), /^scrypt:/);
  assert.notEqual(row.password_hash, password);
  const session = store.session(token(response), "customer")!;
  assert.ok(session.user_id);
  assert.notEqual(session.owner_id, session.user_id);
  assert.equal(customerCampaigns(session).length, 0);
  assert.equal(customerProfile(session).company, profile.company);
});
test("signup validates lengths, language, email, international phone and rejects role injection", (t) => {
  setup(t);
  assert.equal(signupSchema.safeParse({ ...profile, password }).success, true);
  for (const bad of [
    { password: "short" },
    { email: "broken" },
    { language: "invalid" },
    { phone: "javascript:alert(1)" },
    { admin: true },
    { companyId: randomUUID() },
  ])
    assert.equal(
      signupSchema.safeParse({ ...profile, password, ...bad }).success,
      false,
    );
});
test("sign-in rotates tokens, preserves company ownership, rejects wrong passwords and logout revokes", async (t) => {
  const { store } = setup(t),
    created = registerCustomer({ ...profile, password });
  const wrong = await POST(
    request("login", { email: profile.email, password: "incorrect" }),
    context("login"),
  );
  assert.equal(wrong.status, 401);
  const response = await POST(
    request(
      "login",
      { email: profile.email.toUpperCase(), password },
      created.token,
    ),
    context("login"),
  );
  assert.equal(response.status, 200);
  assert.equal(store.session(created.token, "customer"), undefined);
  const newToken = token(response),
    session = store.session(newToken, "customer")!;
  assert.equal(session.owner_id, created.ownerId);
  assert.notEqual(newToken, created.token);
  assert.equal(
    (await POST(request("logout", {}, newToken), context("logout"))).status,
    200,
  );
  assert.equal(store.session(newToken, "customer"), undefined);
});
test("account mutations reject cross-site requests, extra fields and duplicate accounts", async (t) => {
  setup(t);
  assert.equal(
    (
      await POST(
        request(
          "signup",
          { ...profile, password },
          "",
          "https://attacker.example",
        ),
        context("signup"),
      )
    ).status,
    403,
  );
  registerCustomer({ ...profile, password });
  assert.equal(
    (await POST(request("signup", { ...profile, password }), context("signup")))
      .status,
    409,
  );
  assert.equal(
    (
      await POST(
        request("login", { email: profile.email, password, role: "admin" }),
        context("login"),
      )
    ).status,
    400,
  );
});
test("company ownership protects campaign details, JSON reports, media and all draft writes", async (t) => {
  const { store } = setup(t),
    first = registerCustomer({ ...profile, password }),
    second = registerCustomer({
      ...profile,
      email: "second@example.com",
      password,
    });
  const session = store.session(first.token, "customer")!,
    other = store.session(second.token, "customer")!;
  const row = store.createCampaign(first.ownerId, randomUUID(), details),
    params = { params: Promise.resolve({ id: row.id }) };
  assert.equal(customerCampaigns(other).length, 0);
  assert.throws(() => customerCampaign(row.id, other), { code: "NOT_FOUND" });
  for (const handler of [campaignGet, report, creative]) {
    assert.equal(
      (await handler(request("campaign", undefined, second.token), params))
        .status,
      404,
    );
    assert.equal((await handler(request("campaign"), params)).status, 401);
  }
  const response = await report(
    request("campaign", undefined, first.token),
    params,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  const body = await response.json();
  assert.equal(JSON.stringify(body).includes("password"), false);
  assert.equal(customerCampaign(row.id, session).evidence.length, 0);
  assert.equal(
    (
      await draft(
        request(
          "draft",
          { campaignId: row.id, key: randomUUID(), details },
          second.token,
        ),
      )
    ).status,
    404,
  );
  const anonymous = store.createSession("customer");
  assert.equal(
    (
      await draft(
        request("draft", { key: randomUUID(), details }, anonymous.token),
      )
    ).status,
    401,
  );
});
test("disabled customers and removed memberships lose access immediately", async (t) => {
  const { store } = setup(t),
    created = registerCustomer({ ...profile, password }),
    session = store.session(created.token, "customer")!;
  store.db
    .prepare("UPDATE customers SET disabled=1 WHERE id=?")
    .run(session.user_id!);
  assert.equal(store.session(created.token, "customer"), undefined);
  assert.equal(
    (await GET(request("me", undefined, created.token), context("me"))).status,
    401,
  );
  store.db
    .prepare("UPDATE customers SET disabled=0 WHERE id=?")
    .run(session.user_id!);
  store.db
    .prepare("DELETE FROM company_memberships WHERE user_id=?")
    .run(session.user_id!);
  assert.equal(store.session(created.token, "customer"), undefined);
});
test("profile updates are private, transactional and limited by company role", (t) => {
  const { store } = setup(t),
    created = registerCustomer({ ...profile, password }),
    session = store.session(created.token, "customer")!;
  const changed = updateProfile(session, {
    ...profile,
    name: "Updated Name",
    company: "Updated Company",
    language: "fr",
  });
  assert.equal(changed.company, "Updated Company");
  assert.equal(changed.language, "fr");
  assert.throws(
    () =>
      updateProfile(session, { ...changed, email: "unverified@example.com" }),
    { code: "EMAIL_CHANGE_REQUIRES_VERIFICATION" },
  );
  store.db
    .prepare("UPDATE company_memberships SET role='member' WHERE user_id=?")
    .run(session.user_id!);
  assert.throws(
    () =>
      updateProfile(session, {
        ...changed,
        name: "Must roll back",
        company: "Unauthorized rename",
      }),
    { code: "FORBIDDEN" },
  );
  assert.equal(customerProfile(session).name, "Updated Name");
});
test("password changes require reauthentication and revoke every older customer session", async (t) => {
  const { store } = setup(t),
    created = registerCustomer({ ...profile, password }),
    session = store.session(created.token, "customer")!,
    other = store.createSession("customer", session.user_id!);
  assert.equal(
    (
      await POST(
        request(
          "password",
          { currentPassword: "wrong", password: "Replacement-test-passphrase" },
          created.token,
        ),
        context("password"),
      )
    ).status,
    401,
  );
  const response = await POST(
    request(
      "password",
      { currentPassword: password, password: "Replacement-test-passphrase" },
      created.token,
    ),
    context("password"),
  );
  assert.equal(response.status, 200);
  assert.equal(store.session(created.token, "customer"), undefined);
  assert.equal(store.session(other.token, "customer"), undefined);
  assert.ok(store.session(token(response), "customer"));
  assert.equal(
    (
      await POST(
        request("login", { email: profile.email, password }),
        context("login"),
      )
    ).status,
    401,
  );
});
test("login throttles repeated failures without revealing whether an email exists", async (t) => {
  setup(t);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await POST(
          request("login", { email: "missing@example.com", password }),
          context("login"),
        )
      ).status,
      401,
    );
  assert.equal(
    (
      await POST(
        request("login", { email: "missing@example.com", password }),
        context("login"),
      )
    ).status,
    429,
  );
});
test("private creative preview verifies stored bytes and does not bypass media security", async (t) => {
  const { store } = setup(t),
    created = registerCustomer({ ...profile, password });
  const asset = completed(store, undefined, { owner: created.ownerId }),
    params = { params: Promise.resolve({ id: asset.campaign_id }) };
  const response = await creative(
    request("creative", undefined, created.token),
    params,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.equal(response.headers.get("content-type"), "image/webp");
  store.db.prepare("UPDATE assets SET restricted=1 WHERE id=?").run(asset.id);
  assert.notEqual(
    (await creative(request("creative", undefined, created.token), params))
      .status,
    200,
  );
});
test("playback evidence cannot reference a different campaign or be edited after verification", (t) => {
  const { store } = setup(t),
    asset = completed(store),
    other = store.createCampaign("other", randomUUID(), details);
  const insert = store.db.prepare(
    "INSERT INTO proof_of_play VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  const args = [
    randomUUID(),
    asset.campaign_id,
    asset.id,
    "synthetic-screen",
    "Synthetic screen",
    "Beirut",
    Date.now(),
    1,
    "manual",
    null,
    "Synthetic evidence only",
    "admin",
    Date.now(),
  ];
  assert.throws(
    () =>
      insert.run(
        ...args.map((value, index) => (index === 1 ? other.id : value)),
      ),
    /INVALID_PLAYBACK_EVIDENCE/,
  );
  insert.run(...args);
  assert.throws(
    () => store.db.prepare("UPDATE proof_of_play SET play_count=100").run(),
    /PROOF_IMMUTABLE/,
  );
  assert.throws(
    () => store.db.prepare("DELETE FROM proof_of_play").run(),
    /PROOF_IMMUTABLE/,
  );
});
test("cancellation permanently blocks publication and draft mutations", (t) => {
  const { store } = setup(t),
    asset = completed(store),
    campaign = store.campaign(asset.campaign_id)!;
  store.db
    .prepare(
      "INSERT INTO campaign_completion VALUES(?,'cancelled','admin',?,?)",
    )
    .run(campaign.id, Date.now(), "Synthetic customer cancellation");
  assert.equal(
    store.canCreativeGoLive(store.campaign(campaign.id)!, asset),
    false,
  );
  assert.throws(() => store.publishableMedia(campaign.id), {
    code: "CAMPAIGN_GATE_BLOCKED",
  });
  assert.throws(
    () => store.updateDraft(campaign.id, campaign.owner_id, details),
    { code: "CAMPAIGN_LOCKED" },
  );
  assert.throws(
    () =>
      store.reserveUpload(
        campaign.owner_id,
        campaign.id,
        randomUUID(),
        "new.png",
        "image/png",
        "image",
      ),
    { code: "CAMPAIGN_LOCKED" },
  );
});
test("post-login redirects cannot escape the app or open unrelated routes", () => {
  for (const value of [
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "/api/admin",
    "/contact",
  ])
    assert.equal(safeReturnTo(value), "/dashboard");
  assert.equal(
    safeReturnTo("/start-campaign?city=Beirut"),
    "/start-campaign?city=Beirut",
  );
  assert.equal(safeReturnTo("/dashboard/abc"), "/dashboard/abc");
});
test("email changes require two mailbox codes, rotate sessions and cannot be replayed", async (t) => {
  const { store } = setup(t),
    created = registerCustomer({ ...profile, password }),
    session = store.session(created.token, "customer")!,
    mail: AccountMail[] = [];
  const challenge = await requestEmailChange(
    session,
    "changed@example.com",
    password,
    async (message) => {
      mail.push(message);
    },
  );
  assert.equal(mail.length, 2);
  assert.deepEqual(
    mail.map((item) => item.to),
    [profile.email, "changed@example.com"],
  );
  assert.equal(customerProfile(session).email, profile.email);
  const oldCode = mail[0].text.match(/\b\d{8}\b/)![0],
    newCode = mail[1].text.match(/\b\d{8}\b/)![0];
  const record = store.db
    .prepare("SELECT * FROM email_changes WHERE id=?")
    .get(challenge.challengeId)!;
  assert.notEqual(record.old_hash, oldCode);
  assert.equal(String(record.old_hash).length, 64);
  assert.equal("oldCode" in challenge, false);
  assert.throws(
    () =>
      confirmEmailChange(session, challenge.challengeId, oldCode, "not-valid"),
    { code: "EMAIL_CODE_INVALID" },
  );
  const updated = confirmEmailChange(
    session,
    challenge.challengeId,
    oldCode,
    newCode,
  );
  assert.equal(store.session(created.token, "customer"), undefined);
  const current = store.session(updated.token, "customer")!;
  assert.equal(customerProfile(current).email, "changed@example.com");
  assert.equal(current.owner_id, session.owner_id);
  assert.throws(
    () => confirmEmailChange(current, challenge.challengeId, oldCode, newCode),
    { code: "EMAIL_CHANGE_EXPIRED" },
  );
});
test("email changes reject other owners, failed reauthentication and exhausted codes", async (t) => {
  const { store } = setup(t),
    created = registerCustomer({ ...profile, password }),
    session = store.session(created.token, "customer")!,
    other = registerCustomer({
      ...profile,
      email: "other@example.com",
      password,
    }),
    mail: AccountMail[] = [];
  await assert.rejects(
    requestEmailChange(
      session,
      "changed@example.com",
      "wrong",
      async (message) => {
        mail.push(message);
      },
    ),
    { code: "INVALID_CREDENTIALS" },
  );
  assert.equal(mail.length, 0);
  const challenge = await requestEmailChange(
    session,
    "changed@example.com",
    password,
    async (message) => {
      mail.push(message);
    },
  );
  const oldCode = mail[0].text.match(/\b\d{8}\b/)![0],
    newCode = mail[1].text.match(/\b\d{8}\b/)![0];
  assert.throws(
    () =>
      confirmEmailChange(
        store.session(other.token, "customer")!,
        challenge.challengeId,
        oldCode,
        newCode,
      ),
    { code: "EMAIL_CHANGE_EXPIRED" },
  );
  for (let i = 0; i < 5; i++)
    assert.throws(
      () =>
        confirmEmailChange(
          session,
          challenge.challengeId,
          "invalid",
          "invalid",
        ),
      { code: "EMAIL_CODE_INVALID" },
    );
  assert.throws(
    () => confirmEmailChange(session, challenge.challengeId, oldCode, newCode),
    { code: "EMAIL_CHANGE_EXPIRED" },
  );
  assert.equal(customerProfile(session).email, profile.email);
});
test("failed email delivery and expired challenges never change the account address", async (t) => {
  const { store } = setup(t),
    created = registerCustomer({ ...profile, password }),
    session = store.session(created.token, "customer")!;
  await assert.rejects(
    requestEmailChange(session, "changed@example.com", password, async () => {
      throw new Error("Synthetic mail failure");
    }),
  );
  assert.equal(
    store.db.prepare("SELECT count(*) AS n FROM email_changes").get()!.n,
    0,
  );
  assert.equal(customerProfile(session).email, profile.email);
  const mail: AccountMail[] = [];
  const challenge = await requestEmailChange(
    session,
    "changed@example.com",
    password,
    async (message) => {
      mail.push(message);
    },
  );
  store.db.prepare("UPDATE email_changes SET expires_at=0").run();
  assert.throws(
    () =>
      confirmEmailChange(
        session,
        challenge.challengeId,
        mail[0].text.match(/\b\d{8}\b/)![0],
        mail[1].text.match(/\b\d{8}\b/)![0],
      ),
    { code: "EMAIL_CHANGE_EXPIRED" },
  );
});
test("password rotation invalidates pending email changes", async (t) => {
  const { store } = setup(t),
    created = registerCustomer({ ...profile, password }),
    session = store.session(created.token, "customer")!;
  await requestEmailChange(
    session,
    "changed@example.com",
    password,
    async () => {},
  );
  const response = await POST(
    request(
      "password",
      { currentPassword: password, password: "Replacement-test-passphrase" },
      created.token,
    ),
    context("password"),
  );
  assert.equal(response.status, 200);
  assert.equal(
    store.db.prepare("SELECT count(*) AS n FROM email_changes").get()!.n,
    0,
  );
});
test("email-change API fails closed without SMTP configuration and never exposes codes", async (t) => {
  setup(t);
  environment(t, {
    SMTP_HOST: undefined,
    SMTP_USER: undefined,
    SMTP_PASSWORD: undefined,
    SMTP_FROM: undefined,
  });
  const created = registerCustomer({ ...profile, password });
  const response = await POST(
    request(
      "email-change",
      { email: "changed@example.com", password },
      created.token,
    ),
    context("email-change"),
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, "EMAIL_NOT_CONFIGURED");
  assert.equal("challengeId" in body, false);
  assert.equal(
    (
      await POST(
        request("email-confirm", {
          challengeId: randomUUID(),
          oldCode: "12345678",
          newCode: "12345678",
        }),
        context("email-confirm"),
      )
    ).status,
    401,
  );
});
