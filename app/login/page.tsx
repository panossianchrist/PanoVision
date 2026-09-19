import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { optionalAccountSession } from "@/lib/server/account-page";
import { safeReturnTo } from "@/lib/return-to";
import { AccountForm } from "@/components/account/AccountForm";
export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("welcome"), robots: { index: false, follow: false } };
}
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; mode?: string }>;
}) {
  const params = await searchParams,
    t = await getTranslations("account"),
    returnTo = safeReturnTo(params.returnTo);
  if (await optionalAccountSession()) redirect(returnTo);
  return (
    <section className="container account-entry">
      <div>
        <span className="eyebrow">{t("welcome")}</span>
        <h1>{params.mode === "signup" ? t("signupTitle") : t("loginTitle")}</h1>
        <p>{t("intro")}</p>
      </div>
      <AccountForm
        initialMode={params.mode === "signup" ? "signup" : "login"}
        returnTo={returnTo}
      />
    </section>
  );
}
