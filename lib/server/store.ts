import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type {
  Asset,
  MediaMetadata,
  PolicyDecision,
  Stage,
} from "../moderation/types";
import { activePolicy } from "../moderation/policy";
import { privateStorageRoot, serverConfig } from "./config";
import { ServiceError } from "./errors";
import { migrateSafety, approvalEvidenceSql } from "./safety-schema";
import { hasCurrentApproval } from "../moderation/eligibility";
import { digest, readPrivateMedia, verifyMedia } from "../media/integrity";
import { migrateCustomers } from "./customer-schema";

export type Campaign = {
  id: string;
  owner_id: string;
  details: string;
  current_asset_id: string | null;
  business_status: string;
  created_at: number;
  updated_at: number;
  revision: number;
  business_approved_at: number | null;
  availability_approved_at: number | null;
  specifications_approved_at: number | null;
  quote_approved_at: number | null;
  payment_confirmed_at: number | null;
  schedule_confirmed_at: number | null;
};
export type Job = {
  id: string;
  asset_id: string;
  lease_token: string;
  attempts: number;
  policy_key?: string;
};
export type Admin = {
  id: string;
  username: string;
  password_hash: string;
  role: "reviewer" | "admin";
  disabled: number;
};
export type Session = {
  owner_id: string;
  role: "customer" | "reviewer" | "admin";
  user_id: string | null;
  expires_at: number;
};
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export class PanoStore {
  readonly db: DatabaseSync;
  constructor(root: string) {
    root = privateStorageRoot(root);
    mkdirSync(root, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(root, "panovision.sqlite"));
    this.db.function("pano_media_intact", (id, sha256, fileSize, mediaType, previewSha256) => {
      try {
        if (typeof id !== "string" || typeof sha256 !== "string" || typeof fileSize !== "number" || !["image", "video"].includes(String(mediaType))) return 0;
        verifyMedia({ id, sha256, file_size: fileSize, media_type: mediaType, preview_sha256: previewSha256 } as Asset);
        return 1;
      } catch {
        return 0;
      }
    });
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS admins(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('reviewer','admin')),disabled INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,owner_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('customer','reviewer','admin')),user_id TEXT,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,idempotency_key TEXT NOT NULL,details TEXT NOT NULL,current_asset_id TEXT,business_status TEXT NOT NULL DEFAULT 'draft' CHECK(business_status IN ('draft','requested','business_approved','paid','scheduled','live','paused')),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,business_approved_at INTEGER,payment_confirmed_at INTEGER,schedule_confirmed_at INTEGER,UNIQUE(owner_id,idempotency_key));
      CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaigns(id),owner_id TEXT NOT NULL,idempotency_key TEXT NOT NULL,version INTEGER NOT NULL,original_filename TEXT NOT NULL,storage_key TEXT NOT NULL,mime_type TEXT NOT NULL,file_size INTEGER NOT NULL DEFAULT 0,sha256 TEXT,media_type TEXT NOT NULL CHECK(media_type IN ('image','video')),duration REAL,width INTEGER,height INTEGER,status TEXT NOT NULL CHECK(status IN ('uploading','uploaded','processing','approved','rejected','manual_review','failed')),stage TEXT NOT NULL DEFAULT 'uploaded',decision TEXT CHECK(decision IN ('approved','rejected','manual_review')),automated_decision TEXT CHECK(automated_decision IN ('approved','rejected','manual_review')),rejection_kind TEXT CHECK(rejection_kind IN ('content','technical')),policy_key TEXT,policy_version TEXT,reason_codes TEXT NOT NULL DEFAULT '[]',findings TEXT NOT NULL DEFAULT '[]',provider TEXT,scan_passed INTEGER NOT NULL DEFAULT 0,security_valid INTEGER NOT NULL DEFAULT 0,restricted INTEGER NOT NULL DEFAULT 0,purged INTEGER NOT NULL DEFAULT 0,priority TEXT NOT NULL DEFAULT 'normal',created_at INTEGER NOT NULL,completed_at INTEGER,expires_at INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,UNIQUE(owner_id,idempotency_key),UNIQUE(campaign_id,version));
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL UNIQUE REFERENCES assets(id),status TEXT NOT NULL DEFAULT 'queued',lease_token TEXT,lease_until INTEGER,attempts INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS moderation_results(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES assets(id),decision TEXT NOT NULL CHECK(decision IN ('approved','rejected','manual_review')),rejection_kind TEXT,policy_version TEXT NOT NULL,policy_key TEXT NOT NULL,provider TEXT NOT NULL,request_ids TEXT NOT NULL,started_at INTEGER NOT NULL,completed_at INTEGER NOT NULL,reason_codes TEXT NOT NULL,findings TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY,asset_id TEXT,campaign_id TEXT,actor_id TEXT NOT NULL,action TEXT NOT NULL,original_decision TEXT,final_decision TEXT,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS rate_limits(bucket TEXT NOT NULL,window_start INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(bucket,window_start));
      CREATE INDEX IF NOT EXISTS assets_owner ON assets(owner_id,campaign_id,version);
      CREATE INDEX IF NOT EXISTS assets_queue ON assets(status,priority,created_at);
      CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status,lease_until);
      CREATE INDEX IF NOT EXISTS audit_asset ON audit_events(asset_id,created_at);`);
    this.transaction(() => {
      migrateCustomers(this.db);
      const columns = this.db.prepare("PRAGMA table_info(campaigns)").all() as {
        name: string;
      }[];
      for (const name of [
        "availability_approved_at",
        "specifications_approved_at",
        "quote_approved_at",
      ]) {
        if (!columns.some((column) => column.name === name))
          this.db.exec(`ALTER TABLE campaigns ADD COLUMN ${name} INTEGER`);
      }
      if (!columns.some((column) => column.name === "idempotency_details")) {
        this.db.exec(
          "ALTER TABLE campaigns ADD COLUMN idempotency_details TEXT",
        );
        this.db.exec("UPDATE campaigns SET idempotency_details=details");
      }
      const assetColumns = this.db
        .prepare("PRAGMA table_info(assets)")
        .all() as { name: string }[];
      if (!assetColumns.some((column) => column.name === "purge_pending"))
        this.db.exec(
          "ALTER TABLE assets ADD COLUMN purge_pending INTEGER NOT NULL DEFAULT 0",
        );
      migrateSafety(this.db);
      this.db.exec(`DROP TRIGGER IF EXISTS campaign_guard_update;
      CREATE TRIGGER IF NOT EXISTS campaign_guard_insert BEFORE INSERT ON campaigns
      WHEN NEW.business_status!='draft' OR NEW.current_asset_id IS NOT NULL OR NEW.business_approved_at IS NOT NULL OR NEW.availability_approved_at IS NOT NULL OR NEW.specifications_approved_at IS NOT NULL OR NEW.quote_approved_at IS NOT NULL OR NEW.payment_confirmed_at IS NOT NULL OR NEW.schedule_confirmed_at IS NOT NULL
      BEGIN SELECT RAISE(ABORT,'CAMPAIGN_MUST_START_DRAFT'); END;
      CREATE TRIGGER campaign_guard_update BEFORE UPDATE ON campaigns
      WHEN NEW.business_status IN ('requested','business_approved','paid','scheduled','live')
      BEGIN
        SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM assets a WHERE a.id=NEW.current_asset_id AND a.campaign_id=NEW.id AND a.owner_id=NEW.owner_id AND a.status='approved' AND a.decision='approved' AND a.scan_passed=1 AND a.security_valid=1 AND a.restricted=0 AND a.purged=0 AND a.purge_pending=0 AND a.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND a.policy_key=(SELECT value FROM settings WHERE key='active_policy') AND json_valid(NEW.details) AND CASE json_extract(NEW.details,'$.creativeType') WHEN 'Image' THEN a.media_type='image' WHEN '8-second video' THEN a.media_type='video' ELSE 0 END) THEN RAISE(ABORT,'CREATIVE_NOT_APPROVED') END;
        SELECT CASE WHEN NEW.business_status IN ('business_approved','paid','scheduled','live') AND (NEW.business_approved_at IS NULL OR NEW.availability_approved_at IS NULL OR NEW.specifications_approved_at IS NULL OR NEW.quote_approved_at IS NULL) THEN RAISE(ABORT,'BUSINESS_REVIEW_REQUIRED') END;
        SELECT CASE WHEN NEW.business_status IN ('paid','scheduled','live') AND NEW.payment_confirmed_at IS NULL THEN RAISE(ABORT,'PAYMENT_REQUIRED') END;
        SELECT CASE WHEN NEW.business_status IN ('scheduled','live') AND NEW.schedule_confirmed_at IS NULL THEN RAISE(ABORT,'SCHEDULING_REQUIRED') END;
      END;
      CREATE TRIGGER IF NOT EXISTS campaign_reset_paused AFTER UPDATE ON campaigns
      WHEN NEW.business_status IN ('draft','paused') AND (NEW.business_approved_at IS NOT NULL OR NEW.availability_approved_at IS NOT NULL OR NEW.specifications_approved_at IS NOT NULL OR NEW.quote_approved_at IS NOT NULL OR NEW.payment_confirmed_at IS NOT NULL OR NEW.schedule_confirmed_at IS NOT NULL)
      BEGIN UPDATE campaigns SET business_approved_at=NULL,availability_approved_at=NULL,specifications_approved_at=NULL,quote_approved_at=NULL,payment_confirmed_at=NULL,schedule_confirmed_at=NULL WHERE id=NEW.id; END;
      CREATE TRIGGER IF NOT EXISTS asset_campaign_guard AFTER UPDATE ON assets
      WHEN NEW.status!='approved' OR NEW.decision IS NOT 'approved' OR NEW.scan_passed!=1 OR NEW.security_valid!=1 OR NEW.restricted!=0 OR NEW.purged!=0 OR NEW.purge_pending!=0 OR NEW.expires_at<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) OR NEW.policy_key IS NOT (SELECT value FROM settings WHERE key='active_policy') OR NEW.campaign_id!=OLD.campaign_id OR NEW.owner_id!=OLD.owner_id OR NEW.media_type!=OLD.media_type
      BEGIN UPDATE campaigns SET business_status='paused',updated_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),revision=revision+1 WHERE current_asset_id=NEW.id AND business_status IN ('requested','business_approved','paid','scheduled','live'); END;`);
      this.db
        .prepare(
          "INSERT INTO settings(key,value) VALUES('active_policy',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(activePolicy().key);
      this.db
        .prepare(
          "UPDATE campaigns SET business_status='paused',revision=revision+1,updated_at=? WHERE business_status IN ('requested','business_approved','paid','scheduled','live') AND (NOT EXISTS(SELECT 1 FROM assets a WHERE a.id=campaigns.current_asset_id AND a.campaign_id=campaigns.id AND a.owner_id=campaigns.owner_id AND a.policy_key=? AND a.status='approved' AND a.decision='approved' AND a.scan_passed=1 AND a.security_valid=1 AND a.restricted=0 AND a.purged=0 AND a.purge_pending=0 AND a.expires_at>? AND CASE json_extract(campaigns.details,'$.creativeType') WHEN 'Image' THEN a.media_type='image' WHEN '8-second video' THEN a.media_type='video' ELSE 0 END) OR (business_status IN ('business_approved','paid','scheduled','live') AND (business_approved_at IS NULL OR availability_approved_at IS NULL OR specifications_approved_at IS NULL OR quote_approved_at IS NULL)) OR (business_status IN ('paid','scheduled','live') AND payment_confirmed_at IS NULL) OR (business_status IN ('scheduled','live') AND schedule_confirmed_at IS NULL))",
        )
        .run(Date.now(), activePolicy().key, Date.now());
    });
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
  session(token: string, role?: string): Session | undefined {
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    const session = this.db
      .prepare(
        "SELECT owner_id,role,user_id,expires_at FROM sessions WHERE token_hash=? AND expires_at>?",
      )
      .get(hash(token), Date.now()) as Session | undefined;
    if (!session || (role && session.role !== role)) return;
    if (session.user_id && session.role === "customer") {
      const member = this.db.prepare("SELECT u.id FROM customers u JOIN company_memberships m ON m.user_id=u.id WHERE u.id=? AND m.company_id=? AND u.disabled=0").get(session.user_id, session.owner_id);
      if (!member) return;
    } else if (session.user_id) {
      const admin = this.adminById(session.user_id);
      if (!admin || admin.disabled || admin.role !== session.role) return;
    }
    return session;
  }
  createSession(role: Session["role"], userId: string | null = null) {
    const token = randomBytes(32).toString("hex");
    let ownerId = userId || randomUUID();
    if (role === "customer" && userId) {
      const member = this.db.prepare("SELECT m.company_id FROM company_memberships m JOIN customers u ON u.id=m.user_id WHERE u.id=? AND u.disabled=0 ORDER BY m.company_id LIMIT 1").get(userId) as {company_id:string} | undefined;
      if (!member) throw new ServiceError("UNAUTHORIZED",401);
      ownerId = member.company_id;
    }
    const seconds = role === "customer" ? 60 * 60 * 24 * 7 : 60 * 60 * 8;
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?,?)")
      .run(hash(token), ownerId, role, userId, Date.now() + seconds * 1000);
    return { token, ownerId, seconds };
  }
  revokeSession(token: string) {
    this.db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token));
  }
  admin(username: string) {
    return this.db
      .prepare("SELECT * FROM admins WHERE username=?")
      .get(username) as Admin | undefined;
  }
  adminById(id: string) {
    return this.db.prepare("SELECT * FROM admins WHERE id=?").get(id) as
      Admin | undefined;
  }
  addAdmin(
    username: string,
    passwordHash: string,
    role: Admin["role"] = "admin",
  ) {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO admins VALUES(?,?,?,?,0)")
      .run(id, username, passwordHash, role);
    return id;
  }
  hasAdmins() {
    return !!this.db
      .prepare("SELECT id FROM admins WHERE disabled=0 LIMIT 1")
      .get();
  }
  rateLimit(bucket: string, limit: number, periodMs = 3600000) {
    const windowStart = Math.floor(Date.now() / periodMs) * periodMs;
    const row = this.db
      .prepare(
        "INSERT INTO rate_limits VALUES(?,?,1) ON CONFLICT(bucket,window_start) DO UPDATE SET count=count+1 RETURNING count",
      )
      .get(bucket, windowStart) as { count: number };
    if (row.count > limit)
      throw new ServiceError(
        "RATE_LIMIT",
        429,
        "Too many requests. Please try again later.",
      );
  }
  campaign(id: string, ownerId?: string) {
    const row = this.db
      .prepare("SELECT * FROM campaigns WHERE id=?")
      .get(id) as Campaign | undefined;
    return row && (!ownerId || row.owner_id === ownerId) ? row : undefined;
  }
  createCampaign(ownerId: string, key: string, details: unknown) {
    return this.transaction(() => {
      const existing = this.db
        .prepare(
          "SELECT * FROM campaigns WHERE owner_id=? AND idempotency_key=?",
        )
        .get(ownerId, key) as
        (Campaign & { idempotency_details: string }) | undefined;
      if (existing) {
        if (
          !isDeepStrictEqual(JSON.parse(existing.idempotency_details), details)
        )
          throw new ServiceError("IDEMPOTENCY_CONFLICT", 409);
        return existing;
      }
      const id = randomUUID(),
        now = Date.now(),
        serialized = JSON.stringify(details);
      this.db
        .prepare(
          "INSERT INTO campaigns(id,owner_id,idempotency_key,details,idempotency_details,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(id, ownerId, key, serialized, serialized, now, now);
      return this.campaign(id)!;
    });
  }
  updateDraft(id: string, ownerId: string, details: unknown) {
    this.transaction(() => {
      const campaign = this.campaign(id, ownerId);
      if (!campaign) throw new ServiceError("NOT_FOUND", 404);
      if (this.db.prepare("SELECT 1 FROM campaign_completion WHERE campaign_id=?").get(id)) throw new ServiceError("CAMPAIGN_LOCKED",409);
      if (
        campaign.business_status !== "draft" &&
        campaign.business_status !== "paused"
      )
        throw new ServiceError("CAMPAIGN_LOCKED", 409);
      this.db
        .prepare(
          "UPDATE campaigns SET details=?,updated_at=?,revision=revision+1 WHERE id=?",
        )
        .run(JSON.stringify(details), Date.now(), id);
    });
  }
  asset(id: string, ownerId?: string) {
    const row = this.db.prepare("SELECT * FROM assets WHERE id=?").get(id) as
      Asset | undefined;
    return row && (!ownerId || row.owner_id === ownerId) ? row : undefined;
  }
  requireAdministrator(actor: string) {
    const admin = this.adminById(actor);
    if (!admin || admin.disabled || admin.role !== "admin")
      throw new ServiceError("FORBIDDEN", 403);
  }
  verifiedMedia(id: string) {
    const asset = this.asset(id);
    if (!asset) throw new ServiceError("NOT_FOUND", 404);
    try {
      return verifyMedia(asset);
    } catch {
      // Persist revocation outside the transaction that will reject publication.
      this.transaction(() => {
        this.db.prepare("UPDATE assets SET status='manual_review',decision='manual_review',security_valid=0,approval_id=NULL,reason_codes='[\"MEDIA_INTEGRITY_FAILED\"]',revision=revision+1 WHERE id=?").run(id);
        this.audit(id, asset.campaign_id, "integrity", "integrity_failure", asset.decision, "manual_review", "Stored bytes missing or do not match reviewed hashes");
      });
      throw new ServiceError("MEDIA_INTEGRITY_FAILED", 409, "This creative requires a new upload and review.");
    }
  }
  private eligibleCreative(campaign: Campaign, asset: Asset) {
    return !this.db.prepare("SELECT 1 FROM campaign_completion WHERE campaign_id=?").get(campaign.id) && campaign.current_asset_id === asset.id && campaign.id === asset.campaign_id &&
      campaign.owner_id === asset.owner_id && hasCurrentApproval(asset, activePolicy().key) &&
      !!this.db.prepare(`SELECT 1 FROM assets a WHERE a.id=? AND ${approvalEvidenceSql("a")}`).get(asset.id);
  }
  canCreativeGoLive(campaign: Campaign, asset: Asset) {
    if (!this.eligibleCreative(campaign, asset)) return false;
    this.verifiedMedia(asset.id);
    return true;
  }
  publishableMedia(id: string) {
    const campaign = this.campaign(id);
    const asset = campaign?.current_asset_id ? this.asset(campaign.current_asset_id) : undefined;
    if (!campaign || campaign.business_status !== "live" || !asset || !this.eligibleCreative(campaign, asset))
      throw new ServiceError("CAMPAIGN_GATE_BLOCKED", 409);
    // Future display integrations must consume this verified snapshot, not a path.
    const bytes = this.verifiedMedia(asset.id);
    return this.transaction(() => {
      const current = this.campaign(id);
      const latest = this.asset(asset.id);
      if (!current || current.business_status !== "live" || !latest ||
        !this.eligibleCreative(current, latest) || latest.sha256 !== asset.sha256 ||
        latest.preview_sha256 !== asset.preview_sha256)
        throw new ServiceError("CAMPAIGN_GATE_BLOCKED", 409);
      return { assetId: asset.id, version: asset.version, sha256: digest(bytes), sourceSha256: asset.sha256, bytes };
    });
  }
  reserveUpload(
    ownerId: string,
    campaignId: string,
    key: string,
    filename: string,
    mime: string,
    mediaType: "image" | "video",
  ) {
    return this.transaction(() => {
      const campaign = this.campaign(campaignId, ownerId);
      if (!campaign) throw new ServiceError("NOT_FOUND", 404);
      if (this.db.prepare("SELECT 1 FROM campaign_completion WHERE campaign_id=?").get(campaignId)) throw new ServiceError("CAMPAIGN_LOCKED",409);
      const existing = this.db
        .prepare("SELECT * FROM assets WHERE owner_id=? AND idempotency_key=?")
        .get(ownerId, key) as Asset | undefined;
      if (existing) {
        if (
          existing.campaign_id !== campaignId ||
          existing.original_filename !== filename ||
          existing.mime_type !== mime ||
          existing.media_type !== mediaType
        )
          throw new ServiceError("IDEMPOTENCY_CONFLICT", 409);
        return { asset: existing, existing: true };
      }
      const creativeType = (
        JSON.parse(campaign.details) as { creativeType?: unknown }
      ).creativeType;
      if ((mediaType === "image" ? "Image" : "8-second video") !== creativeType)
        throw new ServiceError("CREATIVE_TYPE_MISMATCH", 400);
      const cfg = serverConfig();
      const count = this.db
        .prepare(
          "SELECT COUNT(*) AS n FROM assets WHERE owner_id=? AND purged=0 AND status IN ('uploading','uploaded','processing')",
        )
        .get(ownerId) as { n: number };
      if (count.n >= 3)
        throw new ServiceError(
          "UPLOAD_BUSY",
          429,
          "Please wait for your current uploads to finish.",
        );
      const pending = this.db
        .prepare(
          "SELECT COUNT(*) AS n FROM assets WHERE purged=0 AND status IN ('uploading','uploaded','processing')",
        )
        .get() as { n: number };
      if (pending.n >= cfg.globalPendingUploads)
        throw new ServiceError(
          "UPLOAD_BUSY",
          429,
          "Please wait for current uploads to finish.",
        );
      // Reserve original bytes plus bounded decoded outputs, including overlapping retries.
      const imageBytes = cfg.imageLimit + 64 * 1024 * 1024,
        videoWorkBytes = 3 * ((cfg.maxFrames + 1) * 8 + 2) * 1024 * 1024;
      const usage = this.db
        .prepare(
          "SELECT COALESCE(SUM(CASE WHEN media_type='image' THEN ? ELSE MAX(file_size,?)+CASE WHEN status IN ('uploading','uploaded','processing') OR purge_pending=1 THEN ? ELSE 0 END END),0) AS bytes FROM assets WHERE purged=0",
        )
        .get(imageBytes, cfg.videoLimit, videoWorkBytes) as { bytes: number };
      if (
        usage.bytes +
          (mediaType === "image"
            ? imageBytes
            : cfg.videoLimit + videoWorkBytes) >
        cfg.privateStorageLimit
      )
        throw new ServiceError(
          "STORAGE_QUOTA",
          429,
          "Creative storage is temporarily full.",
        );
      const id = randomUUID(),
        now = Date.now();
      const version = (
        this.db
          .prepare(
            "SELECT COALESCE(MAX(version),0)+1 AS n FROM assets WHERE campaign_id=?",
          )
          .get(campaignId) as { n: number }
      ).n;
      this.db
        .prepare(
          "INSERT INTO assets(id,campaign_id,owner_id,idempotency_key,version,original_filename,storage_key,mime_type,media_type,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,'uploading',?,?)",
        )
        .run(
          id,
          campaignId,
          ownerId,
          key,
          version,
          filename,
          `${id}/original.bin`,
          mime,
          mediaType,
          now,
          now + 7 * 86400000,
        );
      this.db
        .prepare(
          "UPDATE campaigns SET current_asset_id=?,business_status='draft',business_approved_at=NULL,availability_approved_at=NULL,specifications_approved_at=NULL,quote_approved_at=NULL,payment_confirmed_at=NULL,schedule_confirmed_at=NULL,updated_at=?,revision=revision+1 WHERE id=?",
        )
        .run(id, now, campaignId);
      this.audit(
        id,
        campaignId,
        ownerId,
        "upload_reserved",
        null,
        null,
        "New creative version reserved",
      );
      return { asset: this.asset(id)!, existing: false };
    });
  }
  finishUpload(id: string, size: number, sha256: string) {
    this.transaction(() => {
      const asset = this.asset(id),
        cfg = serverConfig();
      if (
        !asset ||
        !Number.isSafeInteger(size) ||
        size <= 0 ||
        size >
          (asset.media_type === "image" ? cfg.imageLimit : cfg.videoLimit) ||
        !/^[a-f0-9]{64}$/.test(sha256)
      )
        throw new ServiceError("INVALID_UPLOAD", 400);
      const update = this.db
        .prepare(
          "UPDATE assets SET file_size=?,sha256=?,status='uploaded',revision=revision+1 WHERE id=? AND status='uploading' AND purged=0 AND purge_pending=0 AND restricted=0 AND expires_at>?",
        )
        .run(size, sha256, id, Date.now());
      if (!update.changes) throw new ServiceError("UPLOAD_CONFLICT", 409);
      this.db
        .prepare("INSERT INTO jobs(id,asset_id,created_at) VALUES(?,?,?)")
        .run(randomUUID(), id, Date.now());
    });
  }
  failUpload(id: string, code: string) {
    this.db
      .prepare(
        "UPDATE assets SET status='failed',stage='complete',reason_codes=?,expires_at=?,revision=revision+1 WHERE id=? AND status='uploading'",
      )
      .run(JSON.stringify([code]), Date.now(), id);
  }
  claimJob(): Job | undefined {
    return this.transaction(() => {
      const row = this.db
        .prepare(
          "SELECT * FROM jobs WHERE status='queued' OR (status='running' AND lease_until<?) ORDER BY created_at LIMIT 1",
        )
        .get(Date.now()) as
        { id: string; asset_id: string; attempts: number } | undefined;
      if (!row) return;
      const token = randomUUID();
      this.db
        .prepare(
          "UPDATE jobs SET status='running',lease_token=?,lease_until=?,attempts=attempts+1 WHERE id=?",
        )
        .run(token, Date.now() + 600000, row.id);
      this.db
        .prepare(
          "UPDATE assets SET status='processing',stage='security',revision=revision+1 WHERE id=? AND status IN ('uploaded','processing')",
        )
        .run(row.asset_id);
      return {
        ...row,
        lease_token: token,
        attempts: row.attempts + 1,
        policy_key: activePolicy().key,
      };
    });
  }
  ownsJob(job: Job) {
    return !!this.db
      .prepare(
        "SELECT id FROM jobs WHERE id=? AND asset_id=? AND status='running' AND lease_token=? AND lease_until>?",
      )
      .get(job.id, job.asset_id, job.lease_token, Date.now());
  }
  heartbeat(job: Job) {
    const now = Date.now();
    return (
      this.db
        .prepare(
          "UPDATE jobs SET lease_until=? WHERE id=? AND asset_id=? AND lease_token=? AND status='running' AND lease_until>?",
        )
        .run(now + 600000, job.id, job.asset_id, job.lease_token, now).changes > 0
    );
  }
  stage(job: Job, stage: Stage) {
    this.transaction(() => {
      if (!this.ownsJob(job)) throw new ServiceError("LEASE_LOST", 409);
      this.db
        .prepare("UPDATE assets SET stage=? WHERE id=? AND status='processing'")
        .run(stage, job.asset_id);
    });
  }
  markSecurity(job: Job, scanPassed: boolean, metadata?: MediaMetadata) {
    this.transaction(() => {
      if (!this.ownsJob(job)) throw new ServiceError("LEASE_LOST", 409);
      this.db
        .prepare(
          "UPDATE assets SET scan_passed=?,security_valid=?,mime_type=COALESCE(?,mime_type),width=?,height=?,duration=?,preview_sha256=? WHERE id=?",
        )
        .run(
          Number(scanPassed),
          Number(!!metadata),
          metadata?.mimeType || null,
          metadata?.width || null,
          metadata?.height || null,
          metadata?.duration ?? null,
          metadata?.mediaType === "image" ? digest(readPrivateMedia(job.asset_id, true)) : null,
          job.asset_id,
        );
    });
  }
  completeJob(
    job: Job,
    result: PolicyDecision,
    provider: string,
    requestIds: string[],
    startedAt: number,
  ) {
    return this.transaction(() => {
      if (!this.ownsJob(job)) return false;
      const asset = this.asset(job.asset_id);
      if (!asset || asset.status !== "processing") return false;
      const policy = activePolicy(),
        now = Date.now();
      if (job.policy_key !== policy.key)
        throw new ServiceError("POLICY_CHANGED", 409);
      if (
        result.decision === "approved" &&
        (!asset.scan_passed ||
          !asset.security_valid ||
          asset.purged ||
          asset.purge_pending ||
          asset.restricted)
      )
        throw new ServiceError("APPROVAL_BLOCKED", 409);
      const cfg = serverConfig();
      const days =
        result.decision === "approved"
          ? cfg.approvedDays
          : result.decision === "rejected"
            ? cfg.rejectedDays
            : cfg.reviewDays;
      const resultId = randomUUID();
      this.db
        .prepare(
          "INSERT INTO moderation_results(id,asset_id,decision,rejection_kind,policy_version,policy_key,provider,request_ids,started_at,completed_at,reason_codes,findings,asset_sha256,asset_revision,preview_sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          resultId,
          asset.id,
          result.decision,
          result.rejectionKind,
          policy.version,
          policy.key,
          provider,
          JSON.stringify(requestIds.slice(0, 160)),
          startedAt,
          now,
          JSON.stringify(result.reasonCodes),
          JSON.stringify(result.findings),
          asset.sha256,
          String(asset.revision + 1),
          asset.preview_sha256,
        );
      this.db
        .prepare(
          "UPDATE assets SET status=?,stage='complete',decision=?,automated_decision=?,rejection_kind=?,policy_key=?,policy_version=?,reason_codes=?,findings=?,provider=?,restricted=?,priority=?,completed_at=?,expires_at=?,scanned_sha256=?,approval_id=?,revision=revision+1 WHERE id=?",
        )
        .run(
          result.decision,
          result.decision,
          result.decision,
          result.rejectionKind,
          policy.key,
          policy.version,
          JSON.stringify(result.reasonCodes),
          JSON.stringify(result.findings),
          provider,
          Number(result.critical),
          result.priority,
          now,
          result.critical ? now : now + days * 86400000,
          asset.sha256,
          result.decision === "approved" ? resultId : null,
          asset.id,
        );
      this.db
        .prepare(
          "UPDATE jobs SET status='done',lease_until=NULL WHERE id=? AND lease_token=?",
        )
        .run(job.id, job.lease_token);
      this.audit(
        asset.id,
        asset.campaign_id,
        "worker",
        "automated_decision",
        null,
        result.decision,
        result.reasonCodes.join(",") || "Configured checks completed",
      );
      return true;
    });
  }
  audit(
    assetId: string | null,
    campaignId: string | null,
    actor: string,
    action: string,
    original: string | null,
    final: string | null,
    reason: string,
  ) {
    const id = randomUUID();
    const asset = assetId ? this.asset(assetId) : undefined;
    const policy = activePolicy();
    this.db
      .prepare("INSERT INTO audit_events(id,asset_id,campaign_id,actor_id,action,original_decision,final_decision,reason,created_at,asset_sha256,policy_key,policy_version,asset_revision,preview_sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        assetId,
        campaignId,
        actor,
        action,
        original,
        final,
        reason,
        Date.now(),
        asset?.sha256 ?? null,
        policy.key,
        policy.version,
        asset ? String(asset.revision + (action === "admin_override" || action === "request_new_creative" ? 1 : 0)) : null,
        asset?.preview_sha256 ?? null,
      );
    return id;
  }
  override(
    id: string,
    revision: number,
    decision: "approved" | "rejected" | "manual_review",
    actor: string,
    reason: string,
    requestNew = false,
  ) {
    this.requireAdministrator(actor);
    const candidate = this.asset(id);
    if (decision === "approved" && candidate?.security_valid && !candidate.purged && !candidate.purge_pending && !candidate.restricted)
      this.verifiedMedia(id);
    return this.transaction(() => {
      this.requireAdministrator(actor);
      const asset = this.asset(id);
      if (!asset) throw new ServiceError("NOT_FOUND", 404);
      if (asset.revision !== revision)
        throw new ServiceError(
          "STALE_REVIEW",
          409,
          "This creative changed. Refresh before reviewing it.",
        );
      if (!["approved", "rejected", "manual_review"].includes(asset.status))
        throw new ServiceError("NOT_REVIEWABLE", 409);
      if (reason.trim().length < 10 || reason.length > 1000)
        throw new ServiceError(
          "REASON_REQUIRED",
          400,
          "Provide a review reason of 10 to 1000 characters.",
        );
      if (
        decision === "approved" &&
        (!asset.scan_passed ||
          !asset.security_valid ||
          asset.purged ||
          asset.purge_pending ||
          asset.restricted ||
          asset.rejection_kind === "technical" ||
          asset.policy_key !== activePolicy().key ||
          asset.expires_at <= Date.now())
      )
        throw new ServiceError(
          "SECURITY_REVIEW_REQUIRED",
          409,
          "This file needs successful security validation and current-policy review before approval.",
        );
      if (decision !== "approved")
        this.db
          .prepare(
            "UPDATE campaigns SET business_status='paused',business_approved_at=NULL,payment_confirmed_at=NULL,schedule_confirmed_at=NULL,revision=revision+1 WHERE current_asset_id=?",
          )
          .run(id);
      const approvalId = this.audit(
        id, asset.campaign_id, actor,
        requestNew ? "request_new_creative" : "admin_override",
        asset.decision, decision, reason.trim(),
      );
      this.db
        .prepare(
          "UPDATE assets SET status=?,decision=?,rejection_kind=?,reason_codes=?,approval_id=?,revision=revision+1,completed_at=?,expires_at=? WHERE id=? AND revision=?",
        )
        .run(
          decision,
          decision,
          asset.rejection_kind === "technical"
            ? "technical"
            : decision === "rejected"
              ? "content"
              : null,
          JSON.stringify([
            requestNew ? "NEW_CREATIVE_REQUESTED" : "HUMAN_REVIEW_DECISION",
          ]),
          decision === "approved" ? approvalId : null,
          Date.now(),
          asset.restricted || asset.purged || asset.purge_pending
            ? Date.now()
            : Date.now() +
                (decision === "approved"
                  ? serverConfig().approvedDays
                  : decision === "rejected"
                    ? serverConfig().rejectedDays
                    : serverConfig().reviewDays) *
                  86400000,
          id,
          revision,
        );
      return this.asset(id)!;
    });
  }
  submitCampaign(
    id: string,
    ownerId: string,
    assetId: string,
    details: unknown,
  ) {
    const candidate = this.asset(assetId, ownerId);
    const current = this.campaign(id, ownerId);
    if (candidate && current) this.canCreativeGoLive(current, candidate);
    return this.transaction(() => {
      const campaign = this.campaign(id, ownerId);
      if (!campaign || campaign.current_asset_id !== assetId)
        throw new ServiceError("CURRENT_CREATIVE_REQUIRED", 409);
      const asset = this.asset(assetId, ownerId);
      if (
        !asset ||
        !this.eligibleCreative(campaign, asset)
      )
        throw new ServiceError(
          "CREATIVE_NOT_APPROVED",
          409,
          "Your current creative must be approved before submitting the campaign.",
        );
      if (!["draft", "paused", "requested"].includes(campaign.business_status))
        throw new ServiceError("CAMPAIGN_LOCKED", 409);
      if (
        (details as { creativeType?: string })?.creativeType !==
        (asset.media_type === "image" ? "Image" : "8-second video")
      )
        throw new ServiceError("CREATIVE_TYPE_MISMATCH", 400);
      if (campaign.business_status === "requested") {
        if (!isDeepStrictEqual(JSON.parse(campaign.details), details))
          throw new ServiceError("CAMPAIGN_LOCKED", 409);
        return campaign;
      }
      this.db
        .prepare(
          "UPDATE campaigns SET details=?,business_status='requested',updated_at=?,revision=revision+1 WHERE id=?",
        )
        .run(JSON.stringify(details), Date.now(), id);
      this.audit(
        assetId,
        id,
        ownerId,
        "campaign_submitted",
        null,
        null,
        "Campaign entered business review",
      );
      return this.campaign(id)!;
    });
  }
  transitionCampaign(
    id: string,
    expectedRevision: number,
    next: "business_approved" | "paid" | "scheduled" | "live" | "paused",
    actor: string,
    reason: string,
  ) {
    this.requireAdministrator(actor);
    const candidate = this.campaign(id);
    if (next !== "paused" && candidate?.current_asset_id) {
      const asset = this.asset(candidate.current_asset_id);
      if (asset) this.canCreativeGoLive(candidate, asset);
    }
    return this.transaction(() => {
      this.requireAdministrator(actor);
      const campaign = this.campaign(id);
      if (!campaign) throw new ServiceError("NOT_FOUND", 404);
      if (campaign.revision !== expectedRevision)
        throw new ServiceError("STALE_CAMPAIGN", 409);
      const prior = {
        business_approved: "requested",
        paid: "business_approved",
        scheduled: "paid",
        live: "scheduled",
        paused: campaign.business_status,
      }[next];
      if (campaign.business_status !== prior)
        throw new ServiceError("INVALID_TRANSITION", 409);
      if (reason.trim().length < 10 || reason.length > 1000)
        throw new ServiceError("REASON_REQUIRED", 400);
      const now = Date.now();
      try {
        const asset = campaign.current_asset_id ? this.asset(campaign.current_asset_id) : undefined;
        if (next !== "paused" && (!asset || !this.eligibleCreative(campaign, asset)))
          throw new ServiceError("CAMPAIGN_GATE_BLOCKED", 409);
        if (next === "business_approved")
          this.db
            .prepare(
              "UPDATE campaigns SET business_status=?,business_approved_at=?,availability_approved_at=?,specifications_approved_at=?,quote_approved_at=?,updated_at=?,revision=revision+1 WHERE id=?",
            )
            .run(next, now, now, now, now, now, id);
        else {
          const column = {
            paid: "payment_confirmed_at",
            scheduled: "schedule_confirmed_at",
            live: null,
            paused: null,
          }[next];
          const statement = this.db.prepare(
            column
              ? `UPDATE campaigns SET business_status=?,${column}=?,updated_at=?,revision=revision+1 WHERE id=?`
              : "UPDATE campaigns SET business_status=?,updated_at=?,revision=revision+1 WHERE id=?",
          );
          if (column) statement.run(next, now, now, id);
          else statement.run(next, now, id);
        }
      } catch {
        throw new ServiceError(
          "CAMPAIGN_GATE_BLOCKED",
          409,
          "Creative approval and all required business approvals must be current.",
        );
      }
      this.audit(
        campaign.current_asset_id,
        id,
        actor,
        "business_transition",
        campaign.business_status,
        next,
        reason,
      );
      return this.campaign(id)!;
    });
  }
  reviewQueue(status: string = "manual_review", page = 0) {
    const allowed = [
      "all",
      "uploaded",
      "processing",
      "approved",
      "rejected",
      "manual_review",
      "failed",
    ];
    if (
      !allowed.includes(status) ||
      !Number.isSafeInteger(page) ||
      page < 0 ||
      page > 100000
    )
      throw new ServiceError("INVALID_FILTER");
    return this.db
      .prepare(
        `SELECT a.*,c.details,c.business_status,c.current_asset_id,c.revision AS campaign_revision FROM assets a JOIN campaigns c ON c.id=a.campaign_id ${status === "all" ? "" : "WHERE a.status=?"} ORDER BY CASE a.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,a.created_at DESC,a.id LIMIT 50 OFFSET ?`,
      )
      .all(...(status === "all" ? [] : [status]), page * 50);
  }
  history(id: string) {
    return this.db
      .prepare(
        "SELECT actor_id,action,original_decision,final_decision,reason,created_at,policy_version,policy_key,asset_sha256 FROM audit_events WHERE asset_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100",
      )
      .all(id);
  }
  metrics() {
    return {
      rejectionKinds:this.db.prepare("SELECT rejection_kind AS kind,COUNT(*) AS count FROM assets WHERE status='rejected' GROUP BY rejection_kind").all(),
      counts: this.db
        .prepare("SELECT status,COUNT(*) AS count FROM assets GROUP BY status")
        .all(),
      averageProcessingMs: this.db
        .prepare(
          "SELECT AVG(completed_at-started_at) AS milliseconds FROM moderation_results",
        )
        .get(),
      failures: this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM moderation_results WHERE reason_codes LIKE '%MODERATION_%' OR reason_codes LIKE '%SECURITY_%' OR reason_codes LIKE '%FRAME_%' OR reason_codes LIKE '%MEDIA_TOOLS_%'",
        )
        .get(),
    };
  }
  expiredAssets() {
    return this.db
      .prepare(
        "SELECT * FROM assets WHERE purged=0 AND (expires_at<? OR (status='uploading' AND created_at<?)) AND status NOT IN ('processing','uploaded') LIMIT 100",
      )
      .all(Date.now(), Date.now() - 3600000) as unknown as Asset[];
  }
  beginPurge(id: string) {
    return this.transaction(() => {
      const row = this.asset(id);
      if (
        !row ||
        row.purged ||
        ["uploaded", "processing"].includes(row.status) ||
        (!row.purge_pending &&
          row.expires_at > Date.now() &&
          !(
            row.status === "uploading" && row.created_at < Date.now() - 3600000
          ))
      )
        return false;
      this.db
        .prepare(
          "UPDATE assets SET purge_pending=1,status=CASE WHEN status='uploading' THEN 'failed' ELSE status END,revision=revision+1 WHERE id=?",
        )
        .run(id);
      return true;
    });
  }
  markPurged(id: string) {
    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE campaigns SET business_status='paused',revision=revision+1 WHERE current_asset_id=? AND business_status!='draft'",
        )
        .run(id);
      this.db
        .prepare(
          "UPDATE assets SET purged=1,purge_pending=0,status=CASE WHEN status='uploading' THEN 'failed' ELSE status END,revision=revision+1 WHERE id=?",
        )
        .run(id);
      this.audit(
        id,
        null,
        "retention",
        "media_purged",
        null,
        null,
        "Configured retention elapsed",
      );
    });
  }
  cleanupMetadata() {
    this.db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
    this.db
      .prepare("DELETE FROM rate_limits WHERE window_start<?")
      .run(Date.now() - 2 * 86400000);
  }
}
const globalStore = globalThis as typeof globalThis & { panoStore?: PanoStore };
export function getStore() {
  return (globalStore.panoStore ||= new PanoStore(serverConfig().privateRoot));
}
