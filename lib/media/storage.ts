import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { serverConfig } from "../server/config";
import { ServiceError } from "../server/errors";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function assetDirectory(id: string) {
  if (!uuid.test(id)) throw new ServiceError("INVALID_ASSET_ID");
  const root = path.resolve(serverConfig().privateRoot, "media");
  const target = path.resolve(root, id);
  if (path.dirname(target) !== root)
    throw new ServiceError("INVALID_STORAGE_PATH");
  return target;
}
export function originalPath(id: string) {
  return path.join(assetDirectory(id), "original.bin");
}
export function workDirectory(id: string, lease = "default") {
  if (lease !== "default" && !uuid.test(lease))
    throw new ServiceError("INVALID_WORK_PATH");
  return path.join(assetDirectory(id), `work-${lease}`);
}
export async function storeUpload(id: string, request: Request, limit: number) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
    throw new ServiceError(
      "PAYLOAD_TOO_LARGE",
      413,
      "This file exceeds the upload limit.",
    );
  const directory = assetDirectory(id);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, "upload.partial");
  const handle = await fs.open(temporary, "wx", 0o600);
  const hash = createHash("sha256");
  let size = 0;
  let timedOut = false;
  if (!request.body) {
    await handle.close();
    throw new ServiceError("EMPTY_UPLOAD");
  }
  const reader = request.body.getReader();
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 60000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new ServiceError(
          "PAYLOAD_TOO_LARGE",
          413,
          "This file exceeds the upload limit.",
        );
      }
      hash.update(value);
      await handle.writeFile(value);
    }
    if (timedOut)
      throw new ServiceError(
        "UPLOAD_TIMEOUT",
        408,
        "The upload timed out. Please try again.",
      );
    if (!size) throw new ServiceError("EMPTY_UPLOAD");
    if (declared && Number(declared) !== size)
      throw new ServiceError("TRUNCATED_UPLOAD");
    await handle.sync();
    await handle.close();
    await fs.rename(temporary, originalPath(id));
    return { size, hash: hash.digest("hex") };
  } catch (error) {
    await handle.close().catch(() => {});
    await fs.rm(temporary, { force: true });
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
export async function purgeMedia(id: string) {
  const directory = assetDirectory(id);
  await fs.rm(directory, { recursive: true, force: true });
}
export function safeFilename(name: string) {
  if (
    name.length > 180 ||
    /[\x00-\x1f\x7f/\\:]/.test(name) ||
    name.includes("..") ||
    name.startsWith(".")
  )
    throw new ServiceError(
      "INVALID_FILENAME",
      400,
      "Please rename your file and upload it again.",
    );
  return name.normalize("NFC");
}
