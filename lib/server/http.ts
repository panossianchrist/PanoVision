import "server-only";
import {
  timingSafeEqual,
  scryptSync,
  randomBytes,
  createHash,
} from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore, type Session } from "./store";
import { serverConfig } from "./config";
import { ServiceError } from "./errors";

export const CUSTOMER_COOKIE = "pano_customer";
export const ADMIN_COOKIE = "pano_admin";
export function tokenFrom(request: Request, name: string) {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}
export function requireCustomer(request: Request) {
  const session = getStore().session(
    tokenFrom(request, CUSTOMER_COOKIE),
    "customer",
  );
  if (!session)
    throw new ServiceError(
      "UNAUTHORIZED",
      401,
      "Please start a new campaign session.",
    );
  return session;
}
export function requireAdmin(request: Request, adminOnly = false) {
  const session = getStore().session(tokenFrom(request, ADMIN_COOKIE));
  if (
    !session ||
    !session.user_id ||
    !["admin", "reviewer"].includes(session.role)
  )
    throw new ServiceError("UNAUTHORIZED", 401, "Please sign in.");
  if (adminOnly && session.role !== "admin")
    throw new ServiceError("FORBIDDEN", 403);
  return session;
}
export function sameOrigin(request: Request) {
  const configured = serverConfig().appOrigin;
  if (process.env.NODE_ENV === "production" && !configured)
    throw new ServiceError(
      "ORIGIN_NOT_CONFIGURED",
      503,
      "This service is not yet available.",
    );
  const expected = configured || new URL(request.url).origin;
  if (request.headers.get("origin") !== expected)
    throw new ServiceError("ORIGIN_DENIED", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ServiceError("ORIGIN_DENIED", 403);
}
export function peerBucket(request: Request) {
  const raw =
    process.env.PANO_TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-for")?.split(",")[0].trim()
      : undefined;
  return raw && isIP(raw)
    ? createHash("sha256").update(raw).digest("hex").slice(0, 20)
    : "shared";
}
export function attachSession(
  response: NextResponse,
  token: string,
  seconds: number,
  admin = false,
) {
  const origin = serverConfig().appOrigin;
  response.cookies.set(admin ? ADMIN_COOKIE : CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "strict",
    path: "/",
    maxAge: seconds,
  });
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function boundedBody(
  request: Request,
  max: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(max) || max <= 0)
    throw new Error("Invalid body limit");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > max))
    throw new ServiceError(
      "PAYLOAD_TOO_LARGE",
      413,
      "The upload exceeds the size limit.",
    );
  if (!request.body) throw new ServiceError("EMPTY_BODY", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel("timeout").catch(() => {});
  }, 15000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw new ServiceError("BODY_TIMEOUT", 408);
      if (request.signal.aborted) throw new ServiceError("BODY_ABORTED", 400);
      if (done) break;
      size += value.length;
      if (size > max) {
        void reader.cancel().catch(() => {});
        throw new ServiceError("PAYLOAD_TOO_LARGE", 413);
      }
      if (value.length) chunks.push(value);
    }
    if (!size) throw new ServiceError("EMPTY_BODY", 400);
    if (declared !== null && Number(declared) !== size)
      throw new ServiceError("TRUNCATED_BODY", 400);
    return Buffer.concat(chunks, size);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    throw new ServiceError("JSON_REQUIRED", 415);
  let body: unknown;
  try {
    body = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await boundedBody(request, 16384),
      ),
    );
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("INVALID_JSON", 400);
  }
  const result = schema.safeParse(body);
  if (!result.success)
    throw new ServiceError(
      "INVALID_REQUEST",
      400,
      "Please check the supplied information.",
    );
  return result.data;
}
export async function apiHandler(action: () => Promise<Response> | Response) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ServiceError)
      return json({ error: error.code, message: error.message }, error.status);
    console.error(
      JSON.stringify({ event: "api_failure", code: "INTERNAL_ERROR" }),
    );
    return json(
      {
        error: "SERVICE_UNAVAILABLE",
        message: "We couldn't complete this request. Please try again later.",
      },
      503,
    );
  }
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)) return false;
  const [, salt, expected] = stored.split(":");
  const actual = scryptSync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
export const dummyPasswordHash =
  "scrypt:11111111111111111111111111111111:" + "00".repeat(64);
export function customerOrCreate(request: Request): {
  session: Session;
  cookie?: { token: string; seconds: number };
} {
  const existing = getStore().session(
    tokenFrom(request, CUSTOMER_COOKIE),
    "customer",
  );
  if (existing) return { session: existing };
  getStore().rateLimit(`sessions:${peerBucket(request)}`, 30, 60000);
  const created = getStore().createSession("customer");
  return {
    session: {
      owner_id: created.ownerId,
      role: "customer",
      user_id: null,
      expires_at: Date.now() + created.seconds * 1000,
    },
    cookie: created,
  };
}
