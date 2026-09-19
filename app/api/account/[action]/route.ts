import { createHash } from "node:crypto";
import { z } from "zod";
import {
  apiHandler,
  attachSession,
  CUSTOMER_COOKIE,
  dummyPasswordHash,
  json,
  peerBucket,
  readJson,
  sameOrigin,
  tokenFrom,
  verifyPassword,
  passwordHash,
} from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { ServiceError } from "@/lib/server/errors";
import {
  requestEmailChange,
  confirmEmailChange,
} from "@/lib/server/email-change";
import {
  customerCampaigns,
  customerProfile,
  findCustomer,
  profileSchema,
  registerCustomer,
  requireAccount,
  signupSchema,
  updateProfile,
} from "@/lib/server/accounts";
export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, { params }: Context) {
  return apiHandler(async () => {
    const { action } = await params,
      session = requireAccount(request);
    if (action === "me") return json({ profile: customerProfile(session) });
    if (action === "campaigns")
      return json({ campaigns: customerCampaigns(session) });
    throw new ServiceError("NOT_FOUND", 404);
  });
}
export async function POST(request: Request, { params }: Context) {
  return apiHandler(async () => {
    sameOrigin(request);
    const { action } = await params,
      store = getStore();
    store.rateLimit(`account:peer:${peerBucket(request)}`, 80, 3600000);
    if (action === "logout") {
      store.revokeSession(tokenFrom(request, CUSTOMER_COOKIE));
      const response = json({ ok: true });
      attachSession(response, "", 0);
      return response;
    }
    if (action === "signup") {
      store.rateLimit(`signup:${peerBucket(request)}`, 8, 3600000);
      const data = await readJson(request, signupSchema),
        created = registerCustomer(data);
      store.revokeSession(tokenFrom(request, CUSTOMER_COOKIE));
      const response = json(
        { profile: customerProfile(store.session(created.token, "customer")!) },
        201,
      );
      attachSession(response, created.token, created.seconds);
      return response;
    }
    if (action === "login") {
      const data = await readJson(
        request,
        z
          .object({
            email: z
              .email()
              .max(254)
              .transform((value) => value.toLowerCase()),
            password: z.string().min(1).max(128),
          })
          .strict(),
      );
      store.rateLimit(
        `login:${createHash("sha256").update(data.email).digest("hex")}`,
        10,
        900000,
      );
      const user = findCustomer(data.email);
      const matches = verifyPassword(
        data.password,
        user?.password_hash || dummyPasswordHash,
      );
      if (!user || user.disabled || !matches)
        throw new ServiceError(
          "INVALID_CREDENTIALS",
          401,
          "Email or password is incorrect.",
        );
      store.revokeSession(tokenFrom(request, CUSTOMER_COOKIE));
      const created = store.createSession("customer", user.id),
        response = json({
          profile: customerProfile(store.session(created.token, "customer")!),
        });
      attachSession(response, created.token, created.seconds);
      return response;
    }
    const session = requireAccount(request);
    if (action === "email-change") {
      const data = await readJson(
        request,
        z
          .object({
            email: z
              .email()
              .max(254)
              .transform((value) => value.toLowerCase()),
            password: z.string().min(1).max(128),
          })
          .strict(),
      );
      return json(
        await requestEmailChange(session, data.email, data.password),
        202,
      );
    }
    if (action === "email-confirm") {
      const data = await readJson(
        request,
        z
          .object({
            challengeId: z.uuid(),
            oldCode: z.string().regex(/^\d{8}$/),
            newCode: z.string().regex(/^\d{8}$/),
          })
          .strict(),
      );
      const created = confirmEmailChange(
          session,
          data.challengeId,
          data.oldCode,
          data.newCode,
        ),
        response = json({
          profile: customerProfile(store.session(created.token, "customer")!),
        });
      attachSession(response, created.token, created.seconds);
      return response;
    }
    if (action === "profile")
      return json({
        profile: updateProfile(session, await readJson(request, profileSchema)),
      });
    if (action === "password") {
      const data = await readJson(
        request,
        z
          .object({
            currentPassword: z.string().min(1).max(128),
            password: z.string().min(15).max(128),
          })
          .strict(),
      );
      store.rateLimit(`password:${session.user_id}`, 5, 900000);
      const user = findCustomer(customerProfile(session).email)!;
      if (!verifyPassword(data.currentPassword, user.password_hash))
        throw new ServiceError("INVALID_CREDENTIALS", 401);
      const hashed = passwordHash(data.password);
      const created = store.transaction(() => {
        store.db
          .prepare("UPDATE customers SET password_hash=? WHERE id=?")
          .run(hashed, session.user_id!);
        store.db
          .prepare("DELETE FROM sessions WHERE user_id=? AND role='customer'")
          .run(session.user_id!);
        store.db
          .prepare("DELETE FROM email_changes WHERE user_id=?")
          .run(session.user_id!);
        return store.createSession("customer", session.user_id!);
      });
      const response = json({ ok: true });
      attachSession(response, created.token, created.seconds);
      return response;
    }
    throw new ServiceError("NOT_FOUND", 404);
  });
}
