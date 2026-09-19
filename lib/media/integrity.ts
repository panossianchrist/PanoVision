import "server-only";
import { openSync, closeSync, fstatSync, readSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Asset } from "../moderation/types";
import { serverConfig } from "../server/config";
import { assetDirectory, originalPath } from "./storage";
import { ServiceError } from "../server/errors";

export function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

// Bounded snapshot: verify and serve the same bytes, never reopen a checked path.
export function readPrivateMedia(id: string, preview = false) {
  const target = preview ? path.join(assetDirectory(id), "preview.webp") : originalPath(id);
  if (realpathSync(target) !== target) throw new ServiceError("MEDIA_INTEGRITY_FAILED", 409);
  const fd = openSync(target, "r");
  try {
    const stat = fstatSync(fd);
    const cfg = serverConfig();
    const limit = preview ? 64 * 1024 * 1024 : Math.max(cfg.imageLimit, cfg.videoLimit);
    if (!stat.isFile() || stat.size <= 0 || stat.size > limit)
      throw new ServiceError("MEDIA_INTEGRITY_FAILED", 409);
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) throw new ServiceError("MEDIA_INTEGRITY_FAILED", 409);
      offset += count;
    }
    if (fstatSync(fd).size !== bytes.length) throw new ServiceError("MEDIA_INTEGRITY_FAILED", 409);
    return bytes;
  } finally {
    closeSync(fd);
  }
}

export function verifyOriginal(asset: Asset) {
  const bytes = readPrivateMedia(asset.id);
  if (bytes.length !== asset.file_size || !asset.sha256 || digest(bytes) !== asset.sha256)
    throw new ServiceError("MEDIA_INTEGRITY_FAILED", 409);
  return bytes;
}

export function verifyMedia(asset: Asset) {
  const original = verifyOriginal(asset);
  if (asset.media_type !== "image") return original;
  const preview = readPrivateMedia(asset.id, true);
  if (!asset.preview_sha256 || digest(preview) !== asset.preview_sha256)
    throw new ServiceError("MEDIA_INTEGRITY_FAILED", 409);
  return preview;
}
