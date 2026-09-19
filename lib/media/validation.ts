import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { fileTypeFromFile } from "file-type";
import { z } from "zod";
import { serverConfig } from "../server/config";
import { TechnicalError } from "../server/errors";
import { assetDirectory, originalPath, workDirectory } from "./storage";
import type { Asset, MediaMetadata } from "../moderation/types";
const execute = promisify(execFile);
export async function mediaCommand(
  binary: string,
  args: string[],
  timeout = 30000,
) {
  return execute(binary, args, {
    timeout,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    shell: false,
  });
}
export async function sniffFile(asset: Asset) {
  const file = originalPath(asset.id),
    stat = await fs.stat(file);
  const cfg = serverConfig();
  if (
    !stat.isFile() ||
    !stat.size ||
    stat.size !== asset.file_size ||
    stat.size > (asset.media_type === "image" ? cfg.imageLimit : cfg.videoLimit)
  )
    throw new TechnicalError("TECHNICAL_INVALID_FILE");
  const kind = await fileTypeFromFile(file);
  if (!kind) throw new TechnicalError("TECHNICAL_INVALID_FILE");
  const allowed: Record<string, string[]> = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
    "video/mp4": [".mp4"],
    "video/webm": [".webm"],
  };
  const ext = path.extname(asset.original_filename).toLowerCase();
  if (
    !allowed[kind.mime]?.includes(ext) ||
    kind.mime !== asset.mime_type ||
    !kind.mime.startsWith(`${asset.media_type}/`)
  )
    throw new TechnicalError("TECHNICAL_INVALID_FILE");
  return kind.mime;
}
export async function scanMalware(
  file: string,
): Promise<"clean" | "infected" | "unavailable"> {
  const scanner = serverConfig().clamscan;
  if (!scanner) return "unavailable";
  try {
    await mediaCommand(
      scanner,
      ["--no-summary", "--infected", "--", file],
      45000,
    );
    return "clean";
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return code === 1 ? "infected" : "unavailable";
  }
}
export async function validateImage(
  asset: Asset,
  mime: string,
): Promise<MediaMetadata> {
  try {
    const input = sharp(originalPath(asset.id), {
      limitInputPixels: 16000000,
      failOn: "warning",
      animated: true,
    });
    const metadata = await input.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width < 16 ||
      metadata.height < 16 ||
      metadata.width > 8192 ||
      metadata.height > 8192 ||
      (metadata.pages || 1) !== 1
    )
      throw new Error("dimensions");
    await input
      .rotate()
      .webp({ quality: 92 })
      .toFile(path.join(assetDirectory(asset.id), "preview.webp"));
    return {
      mediaType: "image",
      mimeType: mime,
      width: metadata.width,
      height: metadata.height,
      duration: null,
      frameRate: null,
      hasAudio: false,
    };
  } catch {
    throw new TechnicalError("TECHNICAL_INVALID_IMAGE");
  }
}
const streamSchema = z.object({
  codec_type: z.string(),
  codec_name: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  avg_frame_rate: z.string().optional(),
  duration: z.string().optional(),
});
const probeSchema = z.object({
  streams: z.array(streamSchema).min(1).max(2),
  format: z.object({ duration: z.string(), format_name: z.string() }),
});
export async function validateVideo(
  asset: Asset,
  mime: string,
): Promise<MediaMetadata> {
  const cfg = serverConfig();
  let output;
  try {
    output = await mediaCommand(
      cfg.ffprobe,
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        originalPath(asset.id),
      ],
      15000,
    );
  } catch (error) {
    if ((error as { code?: unknown }).code === "ENOENT")
      throw new Error("MEDIA_TOOLS_UNAVAILABLE");
    throw new TechnicalError("TECHNICAL_INVALID_VIDEO");
  }
  const parsed = probeSchema.safeParse(JSON.parse(output.stdout));
  if (!parsed.success) throw new TechnicalError("TECHNICAL_INVALID_VIDEO");
  const { streams, format } = parsed.data;
  const video = streams.filter((stream) => stream.codec_type === "video");
  const audio = streams.filter((stream) => stream.codec_type === "audio");
  if (
    video.length !== 1 ||
    audio.length > 1 ||
    streams.some((stream) => !["video", "audio"].includes(stream.codec_type))
  )
    throw new TechnicalError("TECHNICAL_INVALID_VIDEO");
  const stream = video[0],
    duration = Number(format.duration),
    dimensions = [stream.width || 0, stream.height || 0];
  const [numerator, denominator] = String(stream.avg_frame_rate)
    .split("/")
    .map(Number);
  const fps = numerator / denominator;
  if (!Number.isFinite(duration) || duration <= 0)
    throw new TechnicalError("TECHNICAL_INVALID_VIDEO");
  if (Math.abs(duration - cfg.expectedDuration) > cfg.durationTolerance)
    throw new TechnicalError("TECHNICAL_VIDEO_DURATION");
  if (
    dimensions.some((value) => value < 16 || value > 8192) ||
    dimensions[0] * dimensions[1] > 16000000 ||
    !Number.isFinite(fps) ||
    fps < 1 ||
    fps > 60 ||
    !["h264", "hevc", "vp8", "vp9", "av1"].includes(stream.codec_name || "")
  )
    throw new TechnicalError("TECHNICAL_INVALID_VIDEO");
  if (mime === "video/mp4" && !format.format_name.includes("mp4"))
    throw new TechnicalError("TECHNICAL_INVALID_VIDEO");
  if (mime === "video/webm" && !format.format_name.includes("webm"))
    throw new TechnicalError("TECHNICAL_INVALID_VIDEO");
  try {
    await mediaCommand(
      cfg.ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-xerror",
        "-err_detect",
        "explode",
        "-protocol_whitelist",
        "file,pipe",
        "-threads",
        "2",
        "-i",
        originalPath(asset.id),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-f",
        "null",
        "-",
      ],
      45000,
    );
  } catch {
    throw new TechnicalError("TECHNICAL_INVALID_VIDEO");
  }
  return {
    mediaType: "video",
    mimeType: mime,
    width: dimensions[0],
    height: dimensions[1],
    duration,
    frameRate: fps,
    hasAudio: audio.length > 0,
  };
}
export async function extractFrames(asset: Asset, lease = "default") {
  const cfg = serverConfig(),
    directory = path.join(workDirectory(asset.id, lease), "frames");
  await fs.mkdir(directory, { recursive: true });
  // Interval + scene changes are a union. The extra sentinel frame makes overflow
  // visible: a complex clip is held for review, never silently truncated and passed.
  const filter = `select='isnan(prev_selected_t)+gte(t-prev_selected_t,${cfg.sampleInterval})+gt(scene,0.2)',showinfo,scale=1280:1280:force_original_aspect_ratio=decrease`;
  const output = await mediaCommand(
    cfg.ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "info",
      "-nostdin",
      "-y",
      "-xerror",
      "-protocol_whitelist",
      "file,pipe",
      "-threads",
      "2",
      "-i",
      originalPath(asset.id),
      "-an",
      "-vf",
      filter,
      "-vsync",
      "vfr",
      "-frames:v",
      String(cfg.maxFrames + 1),
      "-q:v",
      "2",
      path.join(directory, "frame-%03d.jpg"),
    ],
    45000,
  );
  const files = (await fs.readdir(directory))
    .filter((file) => /^frame-\d{3}\.jpg$/.test(file))
    .sort();
  if (!files.length || files.length > cfg.maxFrames)
    throw new Error("FRAME_COVERAGE_INCOMPLETE");
  const timestamps = Array.from(
    output.stderr.matchAll(/pts_time:([\d.]+)/g),
    (match) => Number(match[1]),
  );
  if (timestamps.length !== files.length)
    throw new Error("FRAME_TIMESTAMPS_INVALID");
  const last = timestamps[timestamps.length - 1];
  if (
    timestamps[0] > 0.15 ||
    (asset.duration || 0) - last > cfg.sampleInterval + 0.15 ||
    timestamps.some(
      (time, index) =>
        !Number.isFinite(time) ||
        (index > 0 &&
          (time <= timestamps[index - 1] ||
            time - timestamps[index - 1] > cfg.sampleInterval + 0.15)),
    )
  )
    throw new Error("FRAME_COVERAGE_INCOMPLETE");
  return files.map((name, index) => ({
    path: path.join(directory, name),
    timestamp: timestamps[index],
  }));
}
export async function extractAudio(asset: Asset, lease = "default") {
  const directory = workDirectory(asset.id, lease);
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, "audio.wav");
  await mediaCommand(
    serverConfig().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-xerror",
      "-protocol_whitelist",
      "file,pipe",
      "-threads",
      "2",
      "-i",
      originalPath(asset.id),
      "-map",
      "0:a:0",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      target,
    ],
    30000,
  );
  return fs.readFile(target);
}
