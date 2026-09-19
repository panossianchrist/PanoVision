import "server-only";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import type { ModerationProvider, ProviderSignal } from "./types";
import { decide, technicalDecision } from "./decision-engine";
import { createModerationProvider } from "./provider";
import { PanoStore, type Job } from "../server/store";
import { ServiceError, TechnicalError } from "../server/errors";
import { verifyOriginal, verifyMedia } from "../media/integrity";
import {
  sniffFile,
  scanMalware,
  validateImage,
  validateVideo,
  extractFrames,
  extractAudio,
} from "../media/validation";
import {
  originalPath,
  purgeMedia,
  workDirectory,
} from "../media/storage";

export type PipelineDependencies = {
  provider: ModerationProvider;
  sniff: typeof sniffFile;
  scan: typeof scanMalware;
  image: typeof validateImage;
  video: typeof validateVideo;
  frames: typeof extractFrames;
  audio: typeof extractAudio;
};
export async function processJob(
  store: PanoStore,
  job: Job,
  overrides: Partial<PipelineDependencies> = {},
) {
  const deps: PipelineDependencies = {
    provider: createModerationProvider(),
    sniff: sniffFile,
    scan: scanMalware,
    image: validateImage,
    video: validateVideo,
    frames: extractFrames,
    audio: extractAudio,
    ...overrides,
  };
  const asset = store.asset(job.asset_id);
  if (!asset) return;
  const started = Date.now(),
    signals: ProviderSignal[] = [],
    requestIds: string[] = [];
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    try {
      if (!store.heartbeat(job)) leaseLost = true;
    } catch {
      leaseLost = true;
    }
  }, 15000);
  heartbeat.unref();
  const add = (signal: ProviderSignal) => {
    signals.push({ ...signal, visibleText: undefined });
    requestIds.push(...signal.requestIds);
  };
  let result;
  try {
    if (job.attempts > 3) throw new Error("MODERATION_RETRY_EXHAUSTED");
    verifyOriginal(asset);
    const mime = await deps.sniff(asset);
    store.stage(job, "security");
    const malware = await deps.scan(originalPath(asset.id));
    if (malware === "infected")
      throw new TechnicalError("TECHNICAL_MALWARE_DETECTED");
    if (malware !== "clean") throw new Error("SECURITY_SCANNER_UNAVAILABLE");
    store.stage(job, "validating");
    const metadata =
      asset.media_type === "image"
        ? await deps.image(asset, mime)
        : await deps.video(asset, mime);
    store.markSecurity(job, true, metadata);
    const validated = store.asset(asset.id)!;
    const seenText = new Set<string>(),
      seenFrames = new Set<string>();
    async function analyze(signal: ProviderSignal) {
      const text = signal.visibleText?.trim();
      add(signal);
      if (text && !seenText.has(text) && !decide(signals).critical) {
        seenText.add(text);
        store.stage(job, "text");
        add(await deps.provider.moderateText(text));
      }
    }
    store.stage(job, "visual");
    if (asset.media_type === "image")
      await analyze(
        await deps.provider.moderateImage(
          verifyMedia(validated),
        ),
      );
    else {
      const frames = await deps.frames(validated, job.lease_token);
      if (!frames.length) throw new Error("FRAME_COVERAGE_INCOMPLETE");
      for (const frame of frames) {
        if (leaseLost) throw new Error("LEASE_LOST");
        if (Date.now() - started > 480000)
          throw new Error("MODERATION_TIMEOUT");
        store.stage(job, "visual");
        const data = await fs.readFile(frame.path),
          digest = createHash("sha256").update(data).digest("hex");
        if (seenFrames.has(digest)) continue;
        seenFrames.add(digest);
        await analyze(
          await deps.provider.moderateVideoFrame(data, frame.timestamp),
        );
        if (decide(signals).decision === "rejected" || decide(signals).critical)
          break;
      }
      if (
        metadata.hasAudio &&
        decide(signals).decision !== "rejected" &&
        !decide(signals).critical
      ) {
        store.stage(job, "audio");
        const speech = await deps.provider.transcribeAudio(
          await deps.audio(validated, job.lease_token),
        );
        if (!speech.trim()) throw new Error("AUDIO_REVIEW_REQUIRED");
        add(await deps.provider.moderateText(speech, "audio"));
      }
    }
    store.stage(job, "policy");
    verifyMedia(validated);
    result = decide(signals);
  } catch (error) {
    if (error instanceof TechnicalError) result = technicalDecision(error.code);
    else {
      const allowed = [
        "SECURITY_SCANNER_UNAVAILABLE",
        "MEDIA_TOOLS_UNAVAILABLE",
        "FRAME_COVERAGE_INCOMPLETE",
        "FRAME_TIMESTAMPS_INVALID",
        "MODERATION_PROVIDER_UNAVAILABLE",
        "MODERATION_TIMEOUT",
        "MODERATION_RETRY_EXHAUSTED",
        "AUDIO_REVIEW_REQUIRED",
        "MEDIA_INTEGRITY_FAILED",
      ];
      const code = error instanceof ServiceError ? error.code : error instanceof Error ? error.message : "";
      const reason =
        allowed.includes(code)
          ? code
          : "MODERATION_SYSTEM_ERROR";
      result = decide(signals, [reason]);
    }
  } finally {
    clearInterval(heartbeat);
  }
  const completed =
    !leaseLost &&
    store.completeJob(job, result, deps.provider.name, requestIds, started);
  if (completed && result.critical && store.beginPurge(asset.id)) {
    await purgeMedia(asset.id);
    store.markPurged(asset.id);
  } else
    await fs.rm(workDirectory(asset.id, job.lease_token), {
      recursive: true,
      force: true,
    });
  console.info(
    JSON.stringify({
      event: "moderation_complete",
      assetId: asset.id,
      campaignId: asset.campaign_id,
      decision: result.decision,
      reasonCodes: result.reasonCodes,
      durationMs: Date.now() - started,
      committed: completed,
    }),
  );
  return result;
}
export async function runRetention(store: PanoStore) {
  for (const asset of store.expiredAssets()) {
    if (store.beginPurge(asset.id)) {
      await purgeMedia(asset.id);
      store.markPurged(asset.id);
    }
  }
  store.cleanupMetadata();
}
