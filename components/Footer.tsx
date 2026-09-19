import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { company, hasRealEmail, whatsappLink } from "@/lib/company";
import { useLocale, useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("common"), f = useTranslations("footer"), locale = useLocale();
  const whatsapp = whatsappLink(locale);
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Link href="/">
              <Image
                src={company.logo}
                alt={`PanoVision. ${t("tagline")}`}
                width={1000}
                height={180}
              />
            </Link>
            <p>{f("description")}</p>
            <span className="micro">{t("lebanon")}</span>
          </div>
          <nav aria-label={f("explore")}>
            <span className="micro muted">{f("explore")}</span>
            <Link href="/network">{t("network")}</Link>
            <Link href="/how-it-works">{t("how")}</Link>
            <Link href="/#special-occasions">{t("special")}</Link>
            <Link href="/start-campaign">{t("start")}</Link>
            <Link href="/dashboard">{t("dashboard")}</Link>
            <Link href="/contact">{t("contact")}</Link>
          </nav>
          <div className="footer-connect">
            <span className="micro muted">{f("connect")}</span>
            {hasRealEmail ? (
              <a href={`mailto:${company.email}`}>
                <span dir="ltr">{company.email}</span> <ArrowUpRight size={15} />
              </a>
            ) : (
              <Link href="/contact">
                {t("contact")} <ArrowUpRight size={15} />
              </Link>
            )}
            {company.instagram ? (
              <a href={company.instagram} target="_blank" rel="noreferrer">
                <span dir="ltr">{company.instagramHandle}</span> <ArrowUpRight size={15} />
              </a>
            ) : (
              <span className="muted">
                Instagram <span className="micro">Coming soon</span>
              </span>
            )}
            {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp <ArrowUpRight size={15} /></a>}
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} PanoVision</span>
          <span className="footer-tagline">{t("tagline")}</span>
          <div>
            <Link href="/privacy">{t("privacy")}</Link>
            <Link href="/terms">{t("terms")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
