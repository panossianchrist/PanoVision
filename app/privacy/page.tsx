import { getTranslations } from "next-intl/server";
import { LegalNotice } from "@/components/LegalNotice";
export async function generateMetadata() {
  const t = await getTranslations("common");
  return { title: t("privacy"), robots: { index: false, follow: false } };
}
export default function PrivacyPage() {
  return <LegalNotice kind="privacy" />;
}
