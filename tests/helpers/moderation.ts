import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestContext } from "node:test";
import { PanoStore } from "../../lib/server/store.ts";
import { ServiceError } from "../../lib/server/errors.ts";
import { decide } from "../../lib/moderation/decision-engine.ts";
import { assetDirectory, originalPath } from "../../lib/media/storage.ts";
import { digest } from "../../lib/media/integrity.ts";
import type {
  MediaMetadata,
  PolicyDecision,
  ProviderSignal,
} from "../../lib/moderation/types.ts";

export function environment(
  t: TestContext,
  values: Record<string, string | undefined>,
) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

export function isolatedStore(t: TestContext) {
  const testsRoot = fileURLToPath(new URL("../", import.meta.url));
  const root = mkdtempSync(path.join(testsRoot, ".moderation-"));
  environment(t, {
    PANO_PRIVATE_DIR: root,
    PANO_MODERATION_POLICY_VERSION: "TEST_POLICY_V1",
    MODERATION_PROVIDER: "disabled",
    MODERATION_API_KEY: "",
    CLAMSCAN_PATH: "",
    APPROVED_MEDIA_RETENTION_DAYS: "90",
    REJECTED_MEDIA_RETENTION_DAYS: "2",
    REVIEW_MEDIA_RETENTION_DAYS: "7",
    MAX_IMAGE_SIZE_MB: "10",
    MAX_VIDEO_SIZE_MB: "50",
    VIDEO_DURATION_SECONDS: "8",
    VIDEO_DURATION_TOLERANCE_SECONDS: "0.25",
    VIDEO_MODERATION_SAMPLE_INTERVAL_MS: "500",
    VIDEO_MODERATION_MAX_FRAMES: "64",
    MODERATION_TIMEOUT_MS: "1000",
  });
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected network request in moderation tests");
  });
  const connections: PanoStore[] = [];
  const open = () => {
    const connection = new PanoStore(root);
    // Store-level fixtures use explicit privileged actors; role tests provision
    // separate real reviewer records. These are never production accounts.
    for (const id of ["admin", "reviewer"])
      connection.db.prepare("INSERT OR IGNORE INTO admins VALUES(?,?,?,'admin',0)").run(id, `fixture-${id}`, "not-a-login-hash");
    connections.push(connection);
    return connection;
  };
  const close = (connection: PanoStore) => {
    connection.close();
    connections.splice(connections.indexOf(connection), 1);
  };
  t.after(() => {
    for (const connection of connections) connection.close();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(testsRoot));
    assert.ok(path.basename(root).startsWith(".moderation-"));
    rmSync(root, { recursive: true, force: true });
  });
  return { store: open(), root, open, close };
}

export const imageMetadata: MediaMetadata = {
  mediaType: "image",
  mimeType: "image/png",
  width: 32,
  height: 32,
  duration: null,
  frameRate: null,
  hasAudio: false,
};

export const videoMetadata: MediaMetadata = {
  mediaType: "video",
  mimeType: "video/mp4",
  width: 32,
  height: 32,
  duration: 8,
  frameRate: 30,
  hasAudio: false,
};

export function signal(
  overrides: Partial<ProviderSignal> = {},
): ProviderSignal {
  return {
    findings: [],
    uncertain: false,
    textComplete: true,
    requestIds: ["mock-request"],
    ...overrides,
  };
}

export function findingSignal(
  category: string,
  confidence: number,
  overrides: Partial<ProviderSignal> = {},
) {
  return signal({
    findings: [{ category, confidence, source: "visual" }],
    ...overrides,
  });
}

export function reserve(
  store: PanoStore,
  options: {
    owner?: string;
    campaignId?: string;
    key?: string;
    mediaType?: "image" | "video";
  } = {},
) {
  const owner = options.owner ?? "test-owner";
  const mediaType = options.mediaType ?? "image";
  const campaignId =
    options.campaignId ??
    store.createCampaign(owner, randomUUID(), {
      company: "Synthetic test",
      creativeType: mediaType === "image" ? "Image" : "8-second video",
    }).id;
  const { asset } = store.reserveUpload(
    owner,
    campaignId,
    options.key ?? randomUUID(),
    mediaType === "image" ? "synthetic.png" : "synthetic.mp4",
    mediaType === "image" ? "image/png" : "video/mp4",
    mediaType,
  );
  mkdirSync(assetDirectory(asset.id), { recursive: true });
  writeFileSync(path.join(assetDirectory(asset.id), "preview.webp"), "synthetic preview");
  return asset;
}

export function processing(
  store: PanoStore,
  options: Parameters<typeof reserve>[1] = {},
) {
  const asset = reserve(store, options);
  writeFileSync(originalPath(asset.id), Buffer.alloc(16, 97));
  store.finishUpload(asset.id, 16, digest(Buffer.alloc(16, 97)));
  const job = store.claimJob();
  assert.ok(job);
  assert.equal(job.asset_id, asset.id);
  return { asset: store.asset(asset.id)!, job };
}

export function completed(
  store: PanoStore,
  result: PolicyDecision = decide([signal()]),
  options: Parameters<typeof reserve>[1] = {},
) {
  const { asset, job } = processing(store, options);
  store.markSecurity(
    job,
    true,
    asset.media_type === "image" ? imageMetadata : videoMetadata,
  );
  assert.equal(
    store.completeJob(job, result, "mock", ["mock-request"], Date.now() - 20),
    true,
  );
  return store.asset(asset.id)!;
}

export function serviceError(code: string, status = 409) {
  return (error: unknown) =>
    error instanceof ServiceError &&
    error.code === code &&
    error.status === status;
}
