import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getStore, type PanoStore, type Session } from "./store";
import { ServiceError } from "./errors";
import { requireCustomer, passwordHash } from "./http";
import { publicAsset } from "../moderation/messages";
import { activePolicy } from "../moderation/policy";
import type {
  CustomerProfile,
  CustomerCampaign,
  CampaignEvidence,
} from "../account-types";

export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    company: z.string().trim().min(1).max(200),
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((value) => !value || /^\+?[\d ().-]{6,30}$/.test(value)),
    country: z.string().trim().max(100).default(""),
    role: z.string().trim().max(100).default(""),
    language: z.enum(["en", "fr", "ar"]).default("en"),
  })
  .strict();
export const signupSchema = profileSchema
  .extend({ password: z.string().min(15).max(128) })
  .strict();
export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  job_role: string;
  language: CustomerProfile["language"];
  password_hash: string;
  disabled: number;
};
export function findCustomer(email: string, store = getStore()) {
  return store.db
    .prepare("SELECT * FROM customers WHERE email=? COLLATE NOCASE")
    .get(email) as CustomerRow | undefined;
}
export function requireAccount(request: Request) {
  const session = requireCustomer(request);
  if (!session.user_id)
    throw new ServiceError(
      "ACCOUNT_REQUIRED",
      401,
      "Please log in or create an account before submitting a creative.",
    );
  return session;
}
export function registerCustomer(
  data: z.infer<typeof signupSchema>,
  store = getStore(),
) {
  const password = passwordHash(data.password);
  return store.transaction(() => {
    if (findCustomer(data.email, store))
      throw new ServiceError(
        "ACCOUNT_UNAVAILABLE",
        409,
        "An account could not be created with these details. Try signing in.",
      );
    const id = randomUUID(),
      companyId = randomUUID(),
      now = Date.now();
    store.db
      .prepare("INSERT INTO customer_companies VALUES(?,?,?)")
      .run(companyId, data.company, now);
    store.db
      .prepare(
        "INSERT INTO customers(id,name,email,phone,country,job_role,language,password_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        data.name,
        data.email,
        data.phone,
        data.country,
        data.role,
        data.language,
        password,
        now,
      );
    store.db
      .prepare("INSERT INTO company_memberships VALUES(?,?,'owner')")
      .run(companyId, id);
    return store.createSession("customer", id);
  });
}
export function customerProfile(
  session: Session,
  store = getStore(),
): CustomerProfile {
  const user = store.db
    .prepare(
      "SELECT u.*,c.name AS company FROM customers u JOIN company_memberships m ON m.user_id=u.id JOIN customer_companies c ON c.id=m.company_id WHERE u.id=? AND c.id=? AND u.disabled=0",
    )
    .get(session.user_id!, session.owner_id) as
    (CustomerRow & { company: string }) | undefined;
  if (!user) throw new ServiceError("UNAUTHORIZED", 401);
  return {
    name: user.name,
    company: user.company,
    email: user.email,
    phone: user.phone,
    country: user.country,
    role: user.job_role,
    language: user.language,
  };
}
export function updateProfile(
  session: Session,
  data: CustomerProfile,
  store = getStore(),
) {
  return store.transaction(() => {
    const current = customerProfile(session, store);
    if (current.email !== data.email)
      throw new ServiceError(
        "EMAIL_CHANGE_REQUIRES_VERIFICATION",
        409,
        "Email changes require a verified email delivery service. Contact PanoVision for assistance.",
      );
    store.db
      .prepare(
        "UPDATE customers SET name=?,phone=?,country=?,job_role=?,language=? WHERE id=?",
      )
      .run(
        data.name,
        data.phone,
        data.country,
        data.role,
        data.language,
        session.user_id!,
      );
    const membership = store.db
      .prepare(
        "SELECT role FROM company_memberships WHERE company_id=? AND user_id=?",
      )
      .get(session.owner_id, session.user_id!) as { role: string };
    if (membership.role !== "owner" && data.company !== current.company)
      throw new ServiceError("FORBIDDEN", 403);
    if (membership.role === "owner")
      store.db
        .prepare("UPDATE customer_companies SET name=? WHERE id=?")
        .run(data.company, session.owner_id);
    return customerProfile(session, store);
  });
}
export function customerCampaign(
  id: string,
  session: Session,
  store = getStore(),
): CustomerCampaign {
  customerProfile(session, store);
  const campaign = store.campaign(id, session.owner_id);
  if (!campaign) throw new ServiceError("NOT_FOUND", 404);
  const details = JSON.parse(campaign.details);
  const asset = campaign.current_asset_id
    ? store.asset(campaign.current_asset_id, session.owner_id)
    : undefined;
  const publicCreative = asset
    ? publicAsset(asset, activePolicy().key, true)
    : null;
  const quote = store.db
    .prepare(
      "SELECT amount_minor,currency,notes,issued_at FROM customer_quotes WHERE campaign_id=? ORDER BY issued_at DESC LIMIT 1",
    )
    .get(id) as
    | {
        amount_minor: number;
        currency: string;
        notes: string;
        issued_at: number;
      }
    | undefined;
  const evidence = store.db
    .prepare(
      "SELECT p.id,p.screen_name AS screenName,p.city,p.played_at AS playedAt,p.play_count AS playCount,a.original_filename AS creativeName,p.source,p.notes,p.verified_at AS verifiedAt FROM proof_of_play p JOIN assets a ON a.id=p.asset_id WHERE p.campaign_id=? ORDER BY p.played_at DESC LIMIT 500",
    )
    .all(id) as CampaignEvidence[];
  const completion = store.db
    .prepare("SELECT status FROM campaign_completion WHERE campaign_id=?")
    .get(id) as { status: string } | undefined;
  return {
    id,
    name: details.campaign || "",
    details,
    businessStatus: completion?.status || campaign.business_status,
    creative:
      asset && publicCreative
        ? {
            id: asset.id,
            filename: asset.original_filename,
            status: asset.status,
            message: publicCreative.message,
            canContinue: publicCreative.canContinue,
            mediaType: asset.media_type,
            previewAvailable:
              !!asset.scan_passed &&
              !!asset.security_valid &&
              !asset.restricted &&
              !asset.purged &&
              !asset.purge_pending &&
              asset.expires_at > Date.now() &&
              ["approved", "manual_review", "rejected"].includes(asset.status),
          }
        : null,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
    quote: quote
      ? {
          amount:
            quote.amount_minor /
            10 **
              new Intl.NumberFormat("en", {
                style: "currency",
                currency: quote.currency,
              }).resolvedOptions().maximumFractionDigits!,
          currency: quote.currency,
          issuedAt: quote.issued_at,
          notes: quote.notes,
        }
      : null,
    paymentStatus: campaign.payment_confirmed_at ? "confirmed" : "pending",
    scheduleStatus: campaign.schedule_confirmed_at ? "confirmed" : "pending",
    evidence,
  };
}
export function customerCampaigns(
  session: Session,
  store: PanoStore = getStore(),
) {
  customerProfile(session, store);
  const rows = store.db
    .prepare(
      "SELECT id FROM campaigns WHERE owner_id=? ORDER BY updated_at DESC LIMIT 100",
    )
    .all(session.owner_id) as { id: string }[];
  return rows.map((row) => customerCampaign(row.id, session, store));
}
