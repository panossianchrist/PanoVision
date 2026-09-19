import type { Metadata } from "next";
import {
  ArrowUpRight,
  Mail,
  Camera as Instagram,
  MapPin,
  Phone,
  MessageCircle,
} from "lucide-react";
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
    <>
      <section className="page-intro container">
        <span className="eyebrow">{common("contact")} / PanoVision</span>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </section>
      <section className="container contact-layout">
        <aside className="contact-details">
          <h2>PanoVision</h2>
          <p>
            <MapPin size={17} />
            {common("lebanon")}
          </p>
          <div>
            <span className="micro muted">
              <Mail size={15} />
              {common("email")}
            </span>
            <a href={`mailto:${company.email}`} dir="ltr">
              {company.email}
              <ArrowUpRight size={16} />
            </a>
          </div>
          <div>
            <span className="micro muted">
              <Instagram size={15} />
              Instagram
            </span>
            <a
              href={company.instagram}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
            >
              {company.instagramHandle}
              <ArrowUpRight size={16} />
            </a>
          </div>
          {company.phone && (
            <div>
              <span className="micro muted">
                <Phone size={15} />
                {common("phone")}
              </span>
              <a dir="ltr" href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>
                {company.phone}
              </a>
            </div>
          )}
          {whatsapp && (
            <div>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={17} />
                WhatsApp
                <ArrowUpRight size={16} />
              </a>
            </div>
          )}
          <p className="contact-tagline">{common("tagline")}</p>
        </aside>
        <ContactForm />
      </section>
    </>
  );
}
