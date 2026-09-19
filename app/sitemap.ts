import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return [];
  return ["", "/network", "/how-it-works", "/start-campaign", "/contact"].map(
    (path) => ({
      url: `${site}${path}`,
      changeFrequency: "monthly",
      priority: path ? 0.7 : 1,
    }),
  );
}
