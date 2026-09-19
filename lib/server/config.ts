import "server-only";
import path from "node:path";
import { existsSync, realpathSync } from "node:fs";
function numberSetting(
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`Invalid ${name} configuration`);
  return value;
}
function integerSetting(
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = numberSetting(name, fallback, min, max);
  if (!Number.isSafeInteger(value))
    throw new Error(`Invalid ${name} configuration`);
  return value;
}
function resolvedPath(target: string): string {
  if (existsSync(target)) return realpathSync(target);
  const parent = path.dirname(target);
  if (parent === target) throw new Error("Storage path is unavailable");
  return path.join(resolvedPath(parent), path.basename(target));
}
function contains(parent: string, target: string) {
  const relative = path.relative(parent, target);
  return (
    !relative ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}
export function privateStorageRoot(directory: string) {
  const root = path.resolve(directory),
    resolved = resolvedPath(root);
  for (const served of [
    path.resolve("public"),
    path.resolve(".next", "static"),
  ]) {
    const physical = resolvedPath(served);
    if (
      contains(served, root) ||
      contains(root, served) ||
      contains(physical, resolved) ||
      contains(resolved, physical)
    )
      throw new Error("Private storage must be separate from public files");
  }
  return resolved;
}
export function serverConfig() {
  const privateRoot = privateStorageRoot(
    process.env.PANO_PRIVATE_DIR || ".private",
  );
  const appOrigin = process.env.PANO_APP_ORIGIN || "";
  if (appOrigin) {
    const parsed = new URL(appOrigin);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      parsed.hostname,
    );
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== appOrigin ||
      (process.env.NODE_ENV === "production" &&
        parsed.protocol !== "https:" &&
        !loopback)
    )
      throw new Error("Invalid PANO_APP_ORIGIN configuration");
  }
  return {
    privateRoot,
    appOrigin,
    uploadsEnabled: process.env.PANO_UPLOADS_ENABLED === "true",
    provider: process.env.MODERATION_PROVIDER || "disabled",
    apiKey: process.env.MODERATION_API_KEY || "",
    visionModel: process.env.MODERATION_VISION_MODEL || "gpt-4.1-mini",
    moderationModel:
      process.env.MODERATION_SAFETY_MODEL || "omni-moderation-latest",
    transcriptionModel:
      process.env.MODERATION_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
    imageLimit: numberSetting("MAX_IMAGE_SIZE_MB", 10, 1, 25) * 1024 * 1024,
    videoLimit: numberSetting("MAX_VIDEO_SIZE_MB", 50, 1, 100) * 1024 * 1024,
    expectedDuration: numberSetting("VIDEO_DURATION_SECONDS", 8, 1, 30),
    durationTolerance: numberSetting(
      "VIDEO_DURATION_TOLERANCE_SECONDS",
      0.25,
      0,
      1,
    ),
    sampleInterval:
      numberSetting("VIDEO_MODERATION_SAMPLE_INTERVAL_MS", 500, 100, 500) /
      1000,
    maxFrames: integerSetting("VIDEO_MODERATION_MAX_FRAMES", 64, 20, 120),
    providerTimeout: numberSetting(
      "MODERATION_TIMEOUT_MS",
      30000,
      1000,
      120000,
    ),
    ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
    ffprobe: process.env.FFPROBE_PATH || "ffprobe",
    clamscan: process.env.CLAMSCAN_PATH || "",
    rejectedDays: numberSetting("REJECTED_MEDIA_RETENTION_DAYS", 2, 0, 30),
    reviewDays: numberSetting("REVIEW_MEDIA_RETENTION_DAYS", 7, 1, 60),
    approvedDays: numberSetting("APPROVED_MEDIA_RETENTION_DAYS", 90, 1, 365),
    uploadPerHour: integerSetting("UPLOADS_PER_SESSION_HOUR", 10, 1, 50),
    globalUploadsPerHour: integerSetting("UPLOADS_GLOBAL_HOUR", 100, 1, 1000),
    globalPendingUploads: integerSetting("UPLOADS_GLOBAL_PENDING", 20, 1, 100),
    privateStorageLimit:
      numberSetting("MAX_PRIVATE_STORAGE_MB", 5120, 100, 102400) * 1024 * 1024,
  };
}
