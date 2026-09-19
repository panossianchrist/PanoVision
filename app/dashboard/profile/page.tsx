import { getTranslations } from "next-intl/server";
import { accountPageSession } from "@/lib/server/account-page";
import { customerProfile } from "@/lib/server/accounts";
import { ProfileForm } from "@/components/account/ProfileForm";
import { accountMailConfigured } from "@/lib/server/account-mail";
export default async function ProfilePage() {
  const session = await accountPageSession("/dashboard/profile"),
    t = await getTranslations("common");
  return (
    <>
      <header className="dashboard-heading">
        <h1>{t("profile")}</h1>
      </header>
      <ProfileForm
        profile={customerProfile(session)}
        emailReady={accountMailConfigured()}
      />
    </>
  );
}
