import { getTranslations } from "next-intl/server";
import { LegalNotice } from "@/components/LegalNotice";
export async function generateMetadata() {
  const t = await getTranslations("common");
  return { title: t("terms"), robots: { index: false, follow: false } };
}
export default function TermsPage() {
  return <LegalNotice kind="terms" />;
}
