import { z } from "zod";
import {
  apiHandler,
  json,
  readJson,
  requireAdmin,
  sameOrigin,
} from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiHandler(async () => {
    sameOrigin(request);
    const admin = requireAdmin(request, true);
    const body = await readJson(
      request,
      z
        .object({
          action: z.enum(["approve", "reject", "request_new"]),
          revision: z.number().int().positive(),
          reason: z.string().trim().min(10).max(1000),
        })
        .strict(),
    );
    const { id } = await params;
    const store = getStore();
    store.rateLimit(`review:${admin.user_id}`, 60);
    const asset = store.override(
      id,
      body.revision,
      body.action === "approve" ? "approved" : "rejected",
      admin.user_id!,
      body.reason,
      body.action === "request_new",
    );
    return json({
      id: asset.id,
      decision: asset.decision,
      revision: asset.revision,
    });
  });
}
