import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/ContactForm";
import { company, whatsappLink } from "@/lib/company";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common"),
    page = await getTranslations("contactPage");
  return { title: t("contact"), description: page("intro") };
}
export default async function ContactPage() {
  const t = await getTranslations("contactPage"),
    common = await getTranslations("common"),
    locale = await getLocale();
  const whatsapp = whatsappLink(locale);
  return (
    <div className="pv-contact">
      <section className="pv-contact-hero">
        <div className="pv-wrap">
          <p className="micro pv-label">
            <i className="pv-dot" /> {common("contact")} / PanoVision
          </p>
          <h1 className="pv-display pv-display-xl">
            <span>{t("l1")}</span>
            <span>{t("l2")}</span>
            <span>{t("l3")}</span>
          </h1>
          <p className="pv-contact-intro">{t("intro")}</p>
        </div>
      </section>

      <section className="pv-wrap pv-contact-layout">
        <ul className="pv-contact-links">
          <li>
            <a href={`mailto:${company.email}`}>
              <span className="micro">{common("email")}</span>
              <strong dir="ltr">{company.email}</strong>
              <ArrowUpRight size={22} />
            </a>
          </li>
          <li>
            <a href={company.instagram} target="_blank" rel="noopener noreferrer">
              <span className="micro">Instagram</span>
              <strong dir="ltr">{company.instagramHandle}</strong>
              <ArrowUpRight size={22} />
            </a>
          </li>
          {whatsapp && (
            <li>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <span className="micro">WhatsApp</span>
                <strong>{common("contact")}</strong>
                <ArrowUpRight size={22} />
              </a>
            </li>
          )}
          {company.phone && (
            <li>
              <a dir="ltr" href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>
                <span className="micro">{common("phone")}</span>
                <strong>{company.phone}</strong>
                <ArrowUpRight size={22} />
              </a>
            </li>
          )}
          <li className="pv-contact-where">
            <span className="micro">{common("country")}</span>
            <strong>{common("lebanon")}</strong>
          </li>
        </ul>
        <ContactForm />
      </section>
    </div>
  );
}
