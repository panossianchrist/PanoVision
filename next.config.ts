import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      ...["network", "how-it-works", "start-campaign", "contact"].map((page) => ({
        source: `/${page}.html`, destination: `/${page}`, permanent: true,
      })),
    ];
  },
  async headers() {
    // App Router's streaming/hydration payload ("self.__next_f.push(...)") is injected as an
    // inline <script>, and next/image sets inline `style` attributes on <img> — both require
    // 'unsafe-inline' below without moving to a per-request nonce (a larger change: it needs
    // middleware.ts to mint the nonce and thread it through every layout). img-src/media-src
    // allow blob: because the campaign wizard previews the chosen file locally, before upload,
    // via URL.createObjectURL() (components/campaign/CreativePreview.tsx and CampaignWizard.tsx)
    // — confirmed against the running site with Playwright; removing blob: breaks that preview.
    // Everything else is locked to 'self'; no remote scripts/styles/frames/objects anywhere.
    // The two routes serving private, potentially attacker-supplied media already send their own
    // stricter `default-src 'none'; sandbox` CSP inline and are unaffected by this default.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: csp },
      // Only takes effect over HTTPS; harmless (ignored) over plain HTTP in local development.
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    ] }];
  },
};
export default createNextIntlPlugin()(config);
