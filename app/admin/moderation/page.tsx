import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { ReviewDashboard } from "@/components/moderation/ReviewDashboard";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function ModerationPage() {
  const session = getStore().session(
    (await cookies()).get(ADMIN_COOKIE)?.value || "",
  );
  if (!session?.user_id || !["reviewer", "admin"].includes(session.role))
    redirect("/admin/login");
  return (
    <ReviewDashboard role={session.role === "admin" ? "admin" : "reviewer"} />
  );
}
