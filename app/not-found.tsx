import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
export default function NotFound() {
  const t=useTranslations("extras");
  return (
    <section className="container page-intro not-found">
      <span className="eyebrow">404 / PanoVision</span>
      <h1>
        {t("notFound")}
      </h1>
      <p>{t("notFoundText")}</p>
      <Link className="button" href="/">
        <ArrowLeft size={18} />
        {t("home")}
      </Link>
    </section>
  );
}
