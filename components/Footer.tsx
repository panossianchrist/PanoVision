import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { company, hasRealEmail, whatsappLink } from "@/lib/company";
import { useLocale, useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("common"), f = useTranslations("footer"), locale = useLocale();
  const whatsapp = whatsappLink(locale);
  return (
    <footer className="site-footer pv-footer">
      <span className="pv-footer-word" aria-hidden="true">
        PANOVISION
      </span>
      <span className="pv-footer-signal" aria-hidden="true" />
      <div className="container">
        <div className="pv-footer-lead">
          <p className="pv-footer-claim">{t("tagline")}</p>
          <Link className="pv-button" href="/start-campaign">
            <span>{t("start")}</span>
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="footer-top">
          <div className="footer-brand">
            <Link href="/">
              <Image
                src={company.logoTransparent}
                alt={`PanoVision. ${t("tagline")}`}
                width={1500}
                height={274}
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
            {company.instagram && (
              <a href={company.instagram} target="_blank" rel="noreferrer">
                <span dir="ltr">{company.instagramHandle}</span> <ArrowUpRight size={15} />
              </a>
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
