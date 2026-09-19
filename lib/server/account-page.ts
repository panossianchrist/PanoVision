import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CUSTOMER_COOKIE } from "./http";
import { getStore } from "./store";
export async function optionalAccountSession() {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value || "";
  const session = getStore().session(token, "customer");
  return session?.user_id ? session : null;
}
export async function accountPageSession(returnTo = "/dashboard") {
  const session = await optionalAccountSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return session;
}
