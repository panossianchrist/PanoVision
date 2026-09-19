import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  environment,
  isolatedStore,
  reserve,
  signal,
  findingSignal,
  serviceError,
} from "./helpers/moderation.ts";
import {
  storeUpload,
  originalPath,
  assetDirectory,
  safeFilename,
  workDirectory,
} from "../lib/media/storage.ts";
import {
  sniffFile,
  validateImage,
  validateVideo,
  extractFrames,
  extractAudio,
  mediaCommand,
  scanMalware,
} from "../lib/media/validation.ts";
import { processJob, runRetention } from "../lib/moderation/service.ts";
import type {
  ModerationProvider,
  ProviderSignal,
} from "../lib/moderation/types.ts";
import { digest } from "../lib/media/integrity.ts";

test("scene detection captures a one-frame safe flash between interval samples",async t=>{
  const {store}=isolatedStore(t);binaries(t);const asset=reserve(store,{mediaType:"video"});await fs.mkdir(assetDirectory(asset.id),{recursive:true});
  await mediaCommand(process.env.FFMPEG_PATH!,["-hide_banner","-loglevel","error","-f","lavfi","-i","color=c=black:s=96x64:r=30","-vf","drawbox=color=white:t=fill:enable='eq(n,7)'","-t","8","-c:v","libx264","-pix_fmt","yuv420p","-f","mp4",originalPath(asset.id)]);
  const frames=await extractFrames({...asset,duration:8});assert.ok(frames.some(frame=>Math.abs(frame.timestamp-7/30)<.01));
  environment(t,{VIDEO_MODERATION_SAMPLE_INTERVAL_MS:"100",VIDEO_MODERATION_MAX_FRAMES:"20"});
  await assert.rejects(extractFrames({...asset,duration:8},"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"),/FRAME_COVERAGE_INCOMPLETE/);
});

const provider = (
  changes: Partial<ModerationProvider> = {},
): ModerationProvider => ({
  name: "synthetic-mock",
  moderateImage: async () => signal(),
  moderateVideoFrame: async () => signal(),
  moderateText: async () => signal(),
  transcribeAudio: async () => "",
  ...changes,
});
const png = () =>
  sharp({
    create: {
      width: 96,
      height: 64,
      channels: 3,
      background: { r: 20, g: 80, b: 140 },
    },
  })
    .png()
    .toBuffer();
function binaries(t: TestContext) {
  environment(t, {
    FFMPEG_PATH:
      process.platform === "win32"
        ? path.resolve("node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe")
        : "ffmpeg",
    FFPROBE_PATH:
      process.platform === "win32"
        ? path.resolve("node_modules/@ffprobe-installer/win32-x64/ffprobe.exe")
        : "ffprobe",
  });
}
async function imageJob(t: TestContext, data?: Buffer) {
  const fixture = isolatedStore(t);
  const asset = reserve(fixture.store);
  const bytes = data || (await png());
  const stored = await storeUpload(
    asset.id,
    new Request("http://local/upload", {
      method: "POST",
      body: new Uint8Array(bytes),
    }),
    10485760,
  );
  fixture.store.finishUpload(asset.id, stored.size, stored.hash);
  return {
    ...fixture,
    asset: fixture.store.asset(asset.id)!,
    job: fixture.store.claimJob()!,
  };
}

for (const timing of ["before scan", "during scan"]) {
  test(`same-length source replacement ${timing} never approves`, async t => {
    const { store, asset, job } = await imageJob(t);
    const replace = async () => fs.writeFile(originalPath(asset.id), Buffer.alloc(asset.file_size, 1));
    if (timing === "before scan") await replace();
    await processJob(store, job, {
      scan: async () => "clean",
      provider: provider({ moderateImage: async () => { if (timing === "during scan") await replace(); return signal(); } }),
    });
    assert.equal(store.asset(asset.id)!.status, "manual_review");
    assert.equal(store.asset(asset.id)!.approval_id, null);
    assert.match(store.asset(asset.id)!.reason_codes, /MEDIA_INTEGRITY_FAILED/);
  });
}

test("image classifier receives decoded pixels, independent of harmless filename", async t => {
  const { store, asset, job } = await imageJob(t);
  let received = false;
  await processJob(store, job, {
    scan: async () => "clean",
    provider: provider({ moderateImage: async bytes => {
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, 96);
      received = true;
      return findingSignal("EXPLICIT_NUDITY", .99);
    } }),
  });
  assert.equal(received, true);
  assert.equal(store.asset(asset.id)!.status, "rejected");
});

test("real PNG decode with mock safety checks is approved; original remains private", async (t) => {
  const { store, asset, job } = await imageJob(t);
  await processJob(store, job, {
    provider: provider(),
    scan: async () => "clean",
  });
  assert.equal(store.asset(asset.id)!.status, "approved");
  assert.equal(store.asset(asset.id)!.security_valid, 1);
  assert.ok((await fs.stat(originalPath(asset.id))).size > 0);
  assert.ok(!originalPath(asset.id).includes(`${path.sep}public${path.sep}`));
});
test("unconfigured scanner holds a valid image and is not bypassed by AI", async (t) => {
  const { store, asset, job } = await imageJob(t);
  let calls = 0;
  await processJob(store, job, {
    provider: provider({
      moderateImage: async () => {
        calls++;
        return signal();
      },
    }),
  });
  assert.equal(calls, 0);
  assert.equal(store.asset(asset.id)!.status, "manual_review");
  assert.equal(store.asset(asset.id)!.scan_passed, 0);
  assert.match(
    store.asset(asset.id)!.reason_codes,
    /SECURITY_SCANNER_UNAVAILABLE/,
  );
});
for (const code of ["MODERATION_PROVIDER_UNAVAILABLE", "MODERATION_TIMEOUT"]) {
  test(`${code} never approves or blames the customer`, async (t) => {
    const { store, asset, job } = await imageJob(t);
    await processJob(store, job, {
      scan: async () => "clean",
      provider: provider({
        moderateImage: async () => {
          throw new Error(code);
        },
      }),
    });
    assert.equal(store.asset(asset.id)!.status, "manual_review");
    assert.equal(store.asset(asset.id)!.rejection_kind, null);
  });
}
test("ambiguous image is held and visible text is also reviewed", async (t) => {
  const { store, asset, job } = await imageJob(t);
  let text = "";
  await processJob(store, job, {
    scan: async () => "clean",
    provider: provider({
      moderateImage: async () =>
        signal({ visibleText: "Synthetic advertising claim" }),
      moderateText: async (value) => {
        text = value;
        return findingSignal("HEALTH_CLAIMS", 0.8);
      },
    }),
  });
  assert.equal(text, "Synthetic advertising claim");
  assert.equal(store.asset(asset.id)!.status, "manual_review");
  assert.ok(!store.asset(asset.id)!.findings.includes(text));
});
test("synthetic critical signal restricts and purges media without preview/export", async (t) => {
  const { store, asset, job } = await imageJob(t);
  await processJob(store, job, {
    scan: async () => "clean",
    provider: provider({
      moderateImage: async () => findingSignal("SEXUAL_CONTENT_MINORS", 0.95),
    }),
  });
  assert.equal(store.asset(asset.id)!.restricted, 1);
  assert.equal(store.asset(asset.id)!.purged, 1);
  await assert.rejects(fs.stat(assetDirectory(asset.id)));
});
test("infected scanner result is technical rejection, not a policy verdict", async (t) => {
  const { store, asset, job } = await imageJob(t);
  await processJob(store, job, {
    scan: async () => "infected",
    provider: provider(),
  });
  assert.equal(store.asset(asset.id)!.status, "rejected");
  assert.equal(store.asset(asset.id)!.rejection_kind, "technical");
});
test("corrupted image, disguised file and extension mismatch are rejected", async (t) => {
  const { store, asset, job } = await imageJob(t, Buffer.from("not an image"));
  await processJob(store, job, {
    scan: async () => "clean",
    provider: provider(),
  });
  assert.equal(store.asset(asset.id)!.status, "rejected");
  assert.equal(store.asset(asset.id)!.rejection_kind, "technical");
  const valid = reserve(store);
  await fs.mkdir(assetDirectory(valid.id), { recursive: true });
  const bytes = await png();
  await fs.writeFile(originalPath(valid.id), bytes);
  const described = {
    ...valid,
    file_size: bytes.length,
    original_filename: "image.exe",
  };
  await assert.rejects(sniffFile(described));
  await assert.rejects(validateImage({ ...valid, id: asset.id }, "image/png"));
});
test("private storage rejects path traversal, oversized and truncated uploads", async (t) => {
  const { store } = isolatedStore(t);
  for (const name of [
    "../bad.png",
    "x\\bad.png",
    "evil:stream.png",
    ".hidden.png",
    "a\u0000.png",
  ]) {
    assert.throws(() => safeFilename(name));
  }
  assert.throws(() => assetDirectory("../../public"));
  assert.throws(() => workDirectory("../../public"));
  const asset = reserve(store);
  await assert.rejects(
    storeUpload(
      asset.id,
      new Request("http://local", { method: "POST", body: "12345" }),
      4,
    ),
    serviceError("PAYLOAD_TOO_LARGE", 413),
  );
  const second = reserve(store);
  await assert.rejects(
    storeUpload(
      second.id,
      new Request("http://local", {
        method: "POST",
        headers: { "Content-Length": "8" },
        body: "123",
      }),
      10,
    ),
    serviceError("TRUNCATED_UPLOAD", 400),
  );
});
test("malware scanner missing binary fails closed", async (t) => {
  isolatedStore(t);
  environment(t, { CLAMSCAN_PATH: "missing-scanner-binary" });
  assert.equal(await scanMalware("synthetic-file"), "unavailable");
});

test("excessive image dimensions fail before provider analysis", async t => {
  const bytes = await sharp({ create: { width: 8193, height: 16, channels: 3, background: "white" } }).png().toBuffer();
  const { store, asset, job } = await imageJob(t, bytes);
  let called = false;
  await processJob(store, job, { scan: async () => "clean", provider: provider({ moderateImage: async () => { called = true; return signal(); } }) });
  assert.equal(called, false);
  assert.equal(store.asset(asset.id)!.rejection_kind, "technical");
});

for (const mediaType of ["image", "video"] as const) {
  test(`oversized ${mediaType} is refused before buffering the body`, async t => {
    const { store } = isolatedStore(t);
    const asset = reserve(store, { mediaType });
    const limit = (mediaType === "image" ? 10 : 50) * 1024 * 1024;
    await assert.rejects(storeUpload(asset.id, new Request("http://local", { method: "POST", headers: { "Content-Length": String(limit + 1) }, body: "x" }), limit), serviceError("PAYLOAD_TOO_LARGE", 413));
    assert.equal(store.asset(asset.id)!.status, "uploading");
    assert.equal(store.claimJob(), undefined);
  });
}

test("retry exhaustion holds the asset without running the provider", async t => {
  const { store, asset, job } = await imageJob(t);
  await processJob(store, { ...job, attempts: 4 }, { provider: provider() });
  assert.equal(store.asset(asset.id)!.status, "manual_review");
  assert.match(store.asset(asset.id)!.reason_codes, /MODERATION_RETRY_EXHAUSTED/);
});
test("retention marks media unavailable before deleting and cannot revive it", async (t) => {
  const { store, asset, job } = await imageJob(t);
  await processJob(store, job, {
    provider: provider(),
    scan: async () => "clean",
  });
  store.db.prepare("UPDATE assets SET expires_at=1 WHERE id=?").run(asset.id);
  await runRetention(store);
  assert.equal(store.asset(asset.id)!.purged, 1);
  await assert.rejects(fs.stat(originalPath(asset.id)));
});

test("safe eight-second video: real decode, interval/scene frames and audio extraction", async (t) => {
  const { store } = isolatedStore(t);
  binaries(t);
  const asset = reserve(store, { mediaType: "video" });
  await fs.mkdir(assetDirectory(asset.id), { recursive: true });
  await mediaCommand(process.env.FFMPEG_PATH!, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=96x64:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=16000",
    "-t",
    "8",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-f",
    "mp4",
    originalPath(asset.id),
  ]);
  const size = (await fs.stat(originalPath(asset.id))).size;
  store.finishUpload(asset.id, size, digest(await fs.readFile(originalPath(asset.id))));
  const current = store.asset(asset.id)!;
  assert.equal(await sniffFile(current), "video/mp4");
  const metadata = await validateVideo(current, "video/mp4");
  assert.equal(metadata.hasAudio, true);
  assert.ok(Math.abs(metadata.duration! - 8) < 0.25);
  const validated = { ...current, ...{ duration: metadata.duration } },
    frames = await extractFrames(validated);
  assert.ok(frames.length >= 16);
  assert.ok(frames.at(-1)!.timestamp >= 7.4);
  assert.ok((await extractAudio(validated)).length > 44);
  let visualCalls = 0,
    textCalls = 0,
    audioCalls = 0;
  await processJob(store, store.claimJob()!, {
    scan: async () => "clean",
    provider: provider({
      moderateVideoFrame: async () => {
        visualCalls++;
        return signal({ visibleText: "Same synthetic text" });
      },
      moderateText: async (_text, source) => {
        if (source === "audio") audioCalls++;
        else textCalls++;
        return signal();
      },
      transcribeAudio: async () => "Synthetic harmless words",
    }),
  });
  assert.equal(store.asset(asset.id)!.status, "approved");
  assert.ok(visualCalls >= 16);
  assert.equal(textCalls, 1);
  assert.equal(audioCalls, 1);
});
test("video duration mismatch is a technical issue and corrupt metadata is blocked", async (t) => {
  const { store } = isolatedStore(t);
  binaries(t);
  const asset = reserve(store, { mediaType: "video" });
  await fs.mkdir(assetDirectory(asset.id), { recursive: true });
  await mediaCommand(process.env.FFMPEG_PATH!, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=64x64:r=24",
    "-t",
    "9",
    "-c:v",
    "libx264",
    "-f",
    "mp4",
    originalPath(asset.id),
  ]);
  await assert.rejects(
    validateVideo(asset, "video/mp4"),
    (error: unknown) =>
      (error as { code: string }).code === "TECHNICAL_VIDEO_DURATION",
  );
  await fs.writeFile(originalPath(asset.id), "corrupt synthetic data");
  await assert.rejects(validateVideo(asset, "video/mp4"));
});

for (const scenario of [
  "one rejected frame",
  "rejected start",
  "rejected middle",
  "rejected audio",
  "ambiguous audio",
  "empty audio",
  "audio failure",
  "frame failure",
  "no frames",
]) {
  test(`video fail-safe aggregation: ${scenario}`, async (t) => {
    const { store } = isolatedStore(t);
    const asset = reserve(store, { mediaType: "video" });
    await fs.mkdir(assetDirectory(asset.id), { recursive: true });
    await fs.writeFile(originalPath(asset.id), "safe synthetic fixture");
    store.finishUpload(asset.id, 22, digest(Buffer.from("safe synthetic fixture")));
    let index = 0;
    const frames = await Promise.all(
      Array.from({ length: 16 }, async (_, i) => {
        const target = path.join(assetDirectory(asset.id), `safe-${i}.txt`);
        await fs.writeFile(target, `synthetic frame ${i}`);
        return { path: target, timestamp: i * 0.5 };
      }),
    );
    const responses: ProviderSignal[] = Array.from({ length: 16 }, (_, i) =>
      ((scenario === "one rejected frame" && i === 15) || (scenario === "rejected start" && i === 0) || (scenario === "rejected middle" && i === 8))
        ? findingSignal("EXPLICIT_NUDITY", 0.95)
        : signal(),
    );
    await processJob(store, store.claimJob()!, {
      sniff: async () => "video/mp4",
      scan: async () => "clean",
      video: async () => ({
        mediaType: "video",
        mimeType: "video/mp4",
        width: 32,
        height: 32,
        duration: 8,
        frameRate: 30,
        hasAudio: scenario.includes("audio"),
      }),
      frames: async () => {
        if (scenario === "frame failure")
          throw new Error("FRAME_COVERAGE_INCOMPLETE");
        return scenario === "no frames" ? [] : frames;
      },
      audio: async () => Buffer.from("synthetic audio"),
      provider: provider({
        moderateVideoFrame: async () => responses[index++],
        moderateText: async () => scenario === "rejected audio" ? findingSignal("THREATS", .99) : signal({ uncertain: true }),
        transcribeAudio: async () => {
          if (scenario === "audio failure") throw new Error("MODERATION_PROVIDER_UNAVAILABLE");
          return scenario === "empty audio" ? "" : "Harmless synthetic transcript";
        },
      }),
    });
    assert.equal(
      store.asset(asset.id)!.status,
      scenario === "one rejected frame" || scenario.startsWith("rejected") ? "rejected" : "manual_review",
    );
    if (scenario === "one rejected frame") assert.equal(index, 16);
  });
}
