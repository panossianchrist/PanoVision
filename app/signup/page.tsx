import { redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/return-to";
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  redirect(
    `/login?mode=signup&returnTo=${encodeURIComponent(safeReturnTo((await searchParams).returnTo))}`,
  );
}
