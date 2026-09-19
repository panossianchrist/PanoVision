import "server-only";
import type { DatabaseSync } from "node:sqlite";

export const approvalEvidenceSql = (a: string) => `COALESCE((${a}.approval_id IS NOT NULL AND ${a}.sha256 IS NOT NULL AND ${a}.scanned_sha256=${a}.sha256 AND (
  EXISTS(SELECT 1 FROM moderation_results r WHERE r.id=${a}.approval_id AND r.asset_id=${a}.id AND r.asset_sha256=${a}.sha256 AND (${a}.media_type!='image' OR (r.preview_sha256=${a}.preview_sha256 AND ${a}.preview_sha256 IS NOT NULL)) AND r.policy_key=${a}.policy_key AND r.decision='approved') OR
  EXISTS(SELECT 1 FROM audit_events e WHERE e.id=${a}.approval_id AND e.asset_id=${a}.id AND e.asset_sha256=${a}.sha256 AND (${a}.media_type!='image' OR (e.preview_sha256=${a}.preview_sha256 AND ${a}.preview_sha256 IS NOT NULL)) AND e.policy_key=${a}.policy_key AND e.action='admin_override' AND e.final_decision='approved'))),0)`;

export function migrateSafety(db: DatabaseSync) {
  const add = (table: string, columns: string[]) => {
    const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    for (const column of columns) {
      if (!existing.some(row => row.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`);
    }
  };
  add("assets", ["scanned_sha256", "preview_sha256", "approval_id"]);
  add("moderation_results", ["asset_sha256", "asset_revision", "preview_sha256"]);
  add("audit_events", ["asset_sha256", "policy_key", "policy_version", "asset_revision", "preview_sha256"]);
  // Refresh versioned guards atomically, including databases created by earlier builds.
  db.exec("DROP TRIGGER IF EXISTS asset_identity_immutable; DROP TRIGGER IF EXISTS asset_approval_evidence; DROP TRIGGER IF EXISTS campaign_approval_evidence; DROP TRIGGER IF EXISTS evidence_pause;");
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS asset_start_quarantined BEFORE INSERT ON assets
    WHEN NEW.status!='uploading' OR NEW.decision IS NOT NULL OR NEW.approval_id IS NOT NULL OR NEW.scan_passed!=0 OR NEW.security_valid!=0
    BEGIN SELECT RAISE(ABORT,'ASSET_MUST_START_QUARANTINED'); END;
    CREATE TRIGGER IF NOT EXISTS asset_identity_immutable BEFORE UPDATE ON assets
    WHEN NEW.id IS NOT OLD.id OR NEW.campaign_id IS NOT OLD.campaign_id OR NEW.owner_id IS NOT OLD.owner_id OR NEW.version IS NOT OLD.version OR NEW.storage_key IS NOT OLD.storage_key OR NEW.original_filename IS NOT OLD.original_filename OR NEW.media_type IS NOT OLD.media_type OR NEW.mime_type IS NOT OLD.mime_type OR (OLD.status!='uploading' AND (NEW.sha256 IS NOT OLD.sha256 OR NEW.file_size IS NOT OLD.file_size)) OR (OLD.status IN ('approved','rejected','manual_review') AND NEW.preview_sha256 IS NOT OLD.preview_sha256)
    BEGIN SELECT RAISE(ABORT,'ASSET_IDENTITY_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS asset_approval_evidence BEFORE UPDATE ON assets
    WHEN NEW.status='approved' AND (OLD.status!='approved' OR NEW.decision IS NOT OLD.decision OR NEW.approval_id IS NOT OLD.approval_id)
    BEGIN
      SELECT CASE WHEN NEW.revision<=OLD.revision OR NEW.decision IS NOT 'approved' OR NEW.scan_passed!=1 OR NEW.security_valid!=1 OR NEW.restricted!=0 OR NEW.purged!=0 OR NEW.purge_pending!=0 OR NOT ${approvalEvidenceSql("NEW")} OR NOT (
        EXISTS(SELECT 1 FROM moderation_results r WHERE r.id=NEW.approval_id AND CAST(r.asset_revision AS INTEGER)=NEW.revision) OR
        EXISTS(SELECT 1 FROM audit_events e WHERE e.id=NEW.approval_id AND CAST(e.asset_revision AS INTEGER)=NEW.revision))
      THEN RAISE(ABORT,'APPROVAL_EVIDENCE_REQUIRED') END;
    END;
    CREATE TRIGGER IF NOT EXISTS campaign_approval_evidence BEFORE UPDATE ON campaigns
    WHEN NEW.business_status IN ('requested','business_approved','paid','scheduled','live')
    BEGIN
      SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM assets a WHERE a.id=NEW.current_asset_id AND ${approvalEvidenceSql("a")}) THEN RAISE(ABORT,'APPROVAL_EVIDENCE_REQUIRED') END;
      SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM assets a WHERE a.id=NEW.current_asset_id AND pano_media_intact(a.id,a.sha256,a.file_size,a.media_type,a.preview_sha256)=1) THEN RAISE(ABORT,'MEDIA_INTEGRITY_FAILED') END;
    END;
    CREATE TRIGGER IF NOT EXISTS evidence_pause AFTER UPDATE OF approval_id,scanned_sha256,preview_sha256 ON assets
    WHEN NOT ${approvalEvidenceSql("NEW")}
    BEGIN UPDATE campaigns SET business_status='paused',revision=revision+1 WHERE current_asset_id=NEW.id AND business_status NOT IN ('draft','paused'); END;
    CREATE TRIGGER IF NOT EXISTS results_no_update BEFORE UPDATE ON moderation_results BEGIN SELECT RAISE(ABORT,'IMMUTABLE_EVIDENCE'); END;
    CREATE TRIGGER IF NOT EXISTS results_no_delete BEFORE DELETE ON moderation_results BEGIN SELECT RAISE(ABORT,'IMMUTABLE_EVIDENCE'); END;
    CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_EVIDENCE'); END;
    CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_EVIDENCE'); END;
    UPDATE assets SET status='manual_review',decision='manual_review',approval_id=NULL,security_valid=0,reason_codes='["MEDIA_EVIDENCE_REVIEW_REQUIRED"]',revision=revision+1 WHERE status='approved' AND NOT ${approvalEvidenceSql("assets")};
  `);
}
