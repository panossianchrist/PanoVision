import Link from "next/link";
import { LayoutDashboard, UserRound, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { accountPageSession } from "@/lib/server/account-page";
import { AccountActions } from "@/components/account/AccountActions";
export async function generateMetadata() {
  const t = await getTranslations("common");
  return { title: t("dashboard"), robots: { index: false, follow: false } };
}
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await accountPageSession();
  const t = await getTranslations("common");
  return (
    <section className="container customer-dashboard">
      <div className="dashboard-toolbar">
        <nav aria-label={t("dashboard")}>
          <Link href="/dashboard">
            <LayoutDashboard size={17} />
            {t("dashboard")}
          </Link>
          <Link href="/dashboard/profile">
            <UserRound size={17} />
            {t("profile")}
          </Link>
          <Link href="/start-campaign">
            <Plus size={17} />
            {t("start")}
          </Link>
        </nav>
        <AccountActions />
      </div>
      {children}
    </section>
  );
}
