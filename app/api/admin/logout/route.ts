import {
  ADMIN_COOKIE,
  apiHandler,
  json,
  requireAdmin,
  sameOrigin,
  tokenFrom,
} from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
export async function POST(request: Request) {
  return apiHandler(() => {
    sameOrigin(request);
    requireAdmin(request);
    getStore().revokeSession(tokenFrom(request, ADMIN_COOKIE));
    const response = json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return response;
  });
}
