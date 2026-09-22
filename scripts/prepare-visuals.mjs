// Builds website-only derivatives. Originals in public/brand and public/images are never modified.
//   public/images/panovision-concept-enhanced.webp  cinematic grade of the concept visual
//   public/brand/panovision-logo-hero.webp          official logo with its baked navy background removed
import fs from "node:fs/promises";
import sharp from "sharp";

const conceptSource = "public/images/canopy-concept.webp";
const conceptOutput = "public/images/panovision-concept-enhanced.webp";
const logoSource = "public/brand/PanoVision_Logo.png";
const logoOutput = "public/brand/panovision-logo-hero.webp";

// Measured from the source image (1536 x 1024): the four corners of the elevated display.
const screen = [
  [192, 266],
  [1190, 89],
  [1190, 268],
  [192, 388],
];

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

async function grayscale(svgBody, width, height, blur) {
  let image = sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/>${svgBody}</svg>`,
    ),
  ).greyscale();
  if (blur) image = image.blur(blur);
  return image.raw().toBuffer();
}

async function concept() {
  const { data, info } = await sharp(conceptSource)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const polygon = `<polygon points="${screen.map((p) => p.join(",")).join(" ")}" fill="white"/>`;
  const [mask, glowNear, glowFar] = await Promise.all([
    grayscale(polygon, W, H, 2.2),
    grayscale(polygon, W, H, 46),
    grayscale(polygon, W, H, 150),
  ]);
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const i = p * 3;
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;
      const m = mask[p] / 255;
      const near = glowNear[p] / 255;
      const far = glowFar[p] / 255;

      // Environment: deeper sky, cooler shadows, calmer colour.
      const sky = 0.34 + 0.5 * smooth(0, 470, y);
      const ground = 0.66 + 0.1 * smooth(470, 1024, y);
      const exposure = sky + (ground - sky) * smooth(380, 560, y);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const desat = 0.34;
      let er = (r + (lum - r) * desat) * exposure;
      let eg = (g + (lum - g) * desat) * exposure;
      let eb = (b + (lum - b) * desat) * exposure;
      // Cool, cinematic grade over the whole environment.
      er *= 0.88;
      eg *= 0.97;
      eb *= 1.1;
      const shadow = 1 - smooth(0.05, 0.6, lum * exposure);
      er *= 1 - 0.1 * shadow;
      eg *= 1 - 0.02 * shadow;
      eb *= 1 + 0.16 * shadow;
      // Contrast curve: deeper blacks, restrained highlights.
      const curve = (v) => clamp((v - 0.5) * 1.22 + 0.5 - 0.035);
      er = curve(er);
      eg = curve(eg);
      eb = curve(eb);

      // Display: brighter and richer.
      const sr = clamp(r * 1.16 + 0.015);
      const sg = clamp(g * 1.16 + 0.03);
      const sb = clamp(b * 1.2 + 0.05);

      r = er + (sr - er) * m;
      g = eg + (sg - eg) * m;
      b = eb + (sb - eb) * m;

      // Screen light spilling onto the canopy and forecourt (screen blend, blue).
      const bloom = clamp(near * 0.5 + far * 0.34) * (1 - m * 0.55);
      r = 1 - (1 - r) * (1 - bloom * 0.1);
      g = 1 - (1 - g) * (1 - bloom * 0.42);
      b = 1 - (1 - b) * (1 - bloom * 0.95);

      // Vignette pulls the eye toward the display.
      const dx = (x / W - 0.5) / 0.62;
      const dy = (y / H - 0.34) / 0.78;
      const vignette = 1 - 0.58 * smooth(0.55, 1.35, Math.hypot(dx, dy));
      r *= vignette;
      g *= vignette;
      b *= vignette;

      out[i] = Math.round(clamp(r) * 255);
      out[i + 1] = Math.round(clamp(g) * 255);
      out[i + 2] = Math.round(clamp(b) * 255);
    }
  }
  await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 84, effort: 6 })
    .toFile(conceptOutput);
  const size = (await fs.stat(conceptOutput)).size;
  console.log(`concept: ${W}x${H}, ${Math.round(size / 1024)} KB -> ${conceptOutput}`);
}

async function logo() {
  const { data, info } = await sharp(logoSource)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  // Background colour: average of the four corners.
  const corners = [0, W - 1, (H - 1) * W, H * W - 1].map((p) => p * 3);
  const bg = [0, 1, 2].map(
    (c) => corners.reduce((sum, i) => sum + data[i + c], 0) / corners.length,
  );
  const out = Buffer.alloc(W * H * 4);
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const o = (y * W + x) * 4;
      const d = [0, 1, 2].map((c) => Math.max(0, data[i + c] - bg[c]));
      let alpha = Math.max(...d) / 255;
      if (alpha < 0.045) alpha = 0;
      if (alpha > 0) {
        for (let c = 0; c < 3; c++)
          out[o + c] = Math.round(
            clamp((data[i + c] - bg[c] * (1 - alpha)) / alpha / 255) * 255,
          );
        out[o + 3] = Math.round(clamp(alpha * 1.04) * 255);
        if (alpha > 0.1) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
  }
  const pad = 14;
  const box = {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(W, maxX + pad) - Math.max(0, minX - pad),
    height: Math.min(H, maxY + pad) - Math.max(0, minY - pad),
  };
  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .extract(box)
    .resize({ width: 1500 })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(logoOutput);
  const meta = await sharp(logoOutput).metadata();
  const size = (await fs.stat(logoOutput)).size;
  console.log(
    `logo: bg=${bg.map((v) => Math.round(v))} crop=${JSON.stringify(box)} out=${meta.width}x${meta.height}, ${Math.round(size / 1024)} KB -> ${logoOutput}`,
  );
}

await concept();
await logo();
