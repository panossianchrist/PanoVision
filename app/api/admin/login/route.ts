import { z } from "zod";
import {
  apiHandler,
  attachSession,
  dummyPasswordHash,
  json,
  peerBucket,
  readJson,
  sameOrigin,
  verifyPassword,
} from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { ServiceError } from "@/lib/server/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return apiHandler(async () => {
    sameOrigin(request);
    const store = getStore();
    store.rateLimit(`login:peer:${peerBucket(request)}`, 10, 900000);
    store.rateLimit("login:global", 40, 900000);
    const { username, password } = await readJson(
      request,
      z
        .object({
          username: z.string().trim().min(1).max(100),
          password: z.string().min(1).max(256),
        })
        .strict(),
    );
    store.rateLimit(`login:user:${username.toLowerCase()}`, 8, 900000);
    const admin = store.admin(username.toLowerCase());
    const valid = verifyPassword(
      password,
      admin?.password_hash || dummyPasswordHash,
    );
    if (!admin || admin.disabled || !valid)
      throw new ServiceError(
        "INVALID_CREDENTIALS",
        401,
        "The sign-in details could not be verified.",
      );
    const session = store.createSession(admin.role, admin.id);
    store.audit(
      null,
      null,
      admin.id,
      "admin_login",
      null,
      null,
      "Authenticated administrator session",
    );
    const response = json({ ok: true });
    attachSession(response, session.token, session.seconds, true);
    return response;
  });
}
