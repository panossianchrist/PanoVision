import fs from "node:fs/promises";
import sharp from "sharp";

const logo = process.argv[2];
const concept = process.argv[3];
if (!logo || !concept) throw new Error("Usage: node scripts/prepare-assets.mjs <official-logo> <concept-image>");
await fs.mkdir("public/brand", { recursive: true });
await fs.mkdir("public/images", { recursive: true });
await fs.copyFile(logo, "public/brand/PanoVision_Logo.png");
// Crop empty background only, retaining the complete supplied artwork and tagline.
await sharp(logo).extract({ left: 170, top: 205, width: 1665, height: 300 }).resize(1000).webp({ quality: 94 }).toFile("public/brand/panovision-logo.webp");
await sharp(logo).extract({ left: 185, top: 207, width: 510, height: 300 }).resize(96, 96, { fit: "contain", background: "#020817" }).png().toFile("public/brand/favicon.png");
await sharp(concept).resize(1800, undefined, { withoutEnlargement: true }).webp({ quality: 86 }).toFile("public/images/canopy-concept.webp");
await sharp(logo).resize(1200, 630, { fit: "contain", background: "#020817" }).png().toFile("public/brand/social.png");
console.log("Official logo and concept assets optimized.");
