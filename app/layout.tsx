import type { Metadata, Viewport } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/noto-sans-arabic/400.css";
import "@fontsource/noto-sans-arabic/600.css";
import "@fontsource/noto-sans-arabic/700.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import "./platform.css";
import "./redesign.css";
import "./sections.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { optionalAccountSession } from "@/lib/server/account-page";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const baseMetadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: "PanoVision | Digital Outdoor Advertising in Lebanon",
    template: "%s | PanoVision",
  },
  description:
    "PanoVision is building a new digital roadside advertising network in Lebanon, connecting high-visibility screens with a streamlined campaign experience.",
  icons: { icon: "/brand/favicon.png", apple: "/brand/favicon.png" },
  openGraph: {
    type: "website",
    locale: "en_LB",
    siteName: "PanoVision",
    title: "PanoVision | Where Brands Get Seen",
    description: "Building Lebanon's next-generation roadside media network.",
    ...(siteUrl
      ? {
          images: [
            {
              url: "/brand/social.png",
              width: 1200,
              height: 630,
              alt: "PanoVision. Where brands get seen.",
            },
          ],
        }
      : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: "PanoVision | Where Brands Get Seen",
  },
  robots: siteUrl
    ? { index: true, follow: true }
    : { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#020817" };
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale(),
    t = await getTranslations("home"),
    common = await getTranslations("common");
  const title = `PanoVision | ${common("tagline")}`;
  return {
    ...baseMetadata,
    title: { default: title, template: "%s | PanoVision" },
    description: t("description"),
    openGraph: {
      ...baseMetadata.openGraph,
      title,
      locale: `${locale}_LB`,
      description: t("description"),
    },
    twitter: { ...baseMetadata.twitter, title, description: t("description") },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale(),
    t = await getTranslations("common");
  const account = await optionalAccountSession();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <NextIntlClientProvider>
          <a className="skip-link" href="#main">
            {t("skip")}
          </a>
          <Navbar signedIn={!!account} />
          <main id="main">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
