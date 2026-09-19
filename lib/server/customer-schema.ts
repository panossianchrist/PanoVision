import "server-only";
import type { DatabaseSync } from "node:sqlite";

export function migrateCustomers(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_companies(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE COLLATE NOCASE,phone TEXT NOT NULL,country TEXT NOT NULL DEFAULT '',job_role TEXT NOT NULL DEFAULT '',language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('en','fr','ar')),password_hash TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS company_memberships(company_id TEXT NOT NULL REFERENCES customer_companies(id),user_id TEXT NOT NULL REFERENCES customers(id),role TEXT NOT NULL CHECK(role IN ('owner','member')),PRIMARY KEY(company_id,user_id));
    CREATE INDEX IF NOT EXISTS company_membership_users ON company_memberships(user_id);
    CREATE TABLE IF NOT EXISTS email_changes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE REFERENCES customers(id),old_email TEXT NOT NULL,new_email TEXT NOT NULL,old_hash TEXT NOT NULL,new_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,ready INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS campaigns_owner_updated ON campaigns(owner_id,updated_at);
    CREATE TABLE IF NOT EXISTS customer_quotes(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaigns(id),amount_minor INTEGER NOT NULL CHECK(amount_minor>0),currency TEXT NOT NULL,notes TEXT NOT NULL,issued_by TEXT NOT NULL REFERENCES admins(id),issued_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS proof_of_play(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaigns(id),asset_id TEXT NOT NULL REFERENCES assets(id),screen_id TEXT NOT NULL,screen_name TEXT NOT NULL,city TEXT NOT NULL,played_at INTEGER NOT NULL,play_count INTEGER CHECK(play_count>0),source TEXT NOT NULL CHECK(source IN ('manual','player')),external_event_id TEXT UNIQUE,notes TEXT NOT NULL,verified_by TEXT NOT NULL REFERENCES admins(id),verified_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS proof_evidence(id TEXT PRIMARY KEY,event_id TEXT NOT NULL REFERENCES proof_of_play(id),kind TEXT NOT NULL CHECK(kind IN ('photo','video','playback_log')),private_storage_key TEXT NOT NULL,sha256 TEXT NOT NULL,content_type TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS campaign_completion(campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id),status TEXT NOT NULL CHECK(status IN ('completed','cancelled')),recorded_by TEXT NOT NULL REFERENCES admins(id),recorded_at INTEGER NOT NULL,reason TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS proof_immutable_update BEFORE UPDATE ON proof_of_play BEGIN SELECT RAISE(ABORT,'PROOF_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS proof_immutable_delete BEFORE DELETE ON proof_of_play BEGIN SELECT RAISE(ABORT,'PROOF_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS proof_valid_insert BEFORE INSERT ON proof_of_play WHEN
      NOT EXISTS(SELECT 1 FROM admins WHERE id=NEW.verified_by AND role='admin' AND disabled=0) OR
      NOT EXISTS(SELECT 1 FROM assets a JOIN campaigns c ON c.id=a.campaign_id WHERE a.id=NEW.asset_id AND c.id=NEW.campaign_id AND a.owner_id=c.owner_id AND NEW.played_at>=a.created_at) OR
      NEW.played_at>NEW.verified_at OR length(trim(NEW.screen_name))=0 OR length(trim(NEW.city))=0
      BEGIN SELECT RAISE(ABORT,'INVALID_PLAYBACK_EVIDENCE'); END;
    CREATE TRIGGER IF NOT EXISTS completion_valid_insert BEFORE INSERT ON campaign_completion WHEN
      NOT EXISTS(SELECT 1 FROM admins WHERE id=NEW.recorded_by AND role='admin' AND disabled=0) OR length(trim(NEW.reason))<10 OR
      (NEW.status='completed' AND NOT EXISTS(SELECT 1 FROM campaigns WHERE id=NEW.campaign_id AND business_status='live'))
      BEGIN SELECT RAISE(ABORT,'INVALID_CAMPAIGN_COMPLETION'); END;
    CREATE TRIGGER IF NOT EXISTS completion_pause AFTER INSERT ON campaign_completion BEGIN
      UPDATE campaigns SET business_status='paused',updated_at=NEW.recorded_at,revision=revision+1 WHERE id=NEW.campaign_id;
    END;
    CREATE TRIGGER IF NOT EXISTS completion_immutable_update BEFORE UPDATE ON campaign_completion BEGIN SELECT RAISE(ABORT,'COMPLETION_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS completion_immutable_delete BEFORE DELETE ON campaign_completion BEGIN SELECT RAISE(ABORT,'COMPLETION_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS completed_campaign_gate BEFORE UPDATE OF business_status ON campaigns WHEN NEW.business_status<>'paused' AND EXISTS(SELECT 1 FROM campaign_completion WHERE campaign_id=NEW.id) BEGIN SELECT RAISE(ABORT,'CAMPAIGN_COMPLETED'); END;
  `);
}
