import { z } from "zod";
import {
  apiHandler,
  json,
  readJson,
  requireAdmin,
  sameOrigin,
} from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { ServiceError } from "@/lib/server/errors";
export const runtime = "nodejs";
const schema = z
  .object({
    revision: z.number().int().positive(),
    next: z.enum(["business_approved", "paid", "scheduled", "live", "paused"]),
    reason: z.string().trim().min(10).max(1000),
    attestations: z
      .object({
        availability: z.boolean().optional(),
        specifications: z.boolean().optional(),
        quote: z.boolean().optional(),
        payment: z.boolean().optional(),
        schedule: z.boolean().optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiHandler(async () => {
    sameOrigin(request);
    const admin = requireAdmin(request, true);
    const body = await readJson(request, schema);
    const { id } = await params;
    const required: (keyof typeof body.attestations)[] =
      body.next === "business_approved"
        ? ["availability", "specifications", "quote"]
        : body.next === "paid"
          ? ["payment"]
          : body.next === "scheduled"
            ? ["schedule"]
            : [];
    if (required.some((key) => body.attestations[key] !== true))
      throw new ServiceError(
        "BUSINESS_CONFIRMATION_REQUIRED",
        400,
        "Confirm all required business checks before proceeding.",
      );
    const note = required.length
      ? `${body.reason}\nConfirmed: ${required.join(", ")}`
      : body.reason;
    const campaign = getStore().transitionCampaign(
      id,
      body.revision,
      body.next,
      admin.user_id!,
      note.slice(0, 1000),
    );
    return json({
      campaignId: campaign.id,
      status: campaign.business_status,
      revision: campaign.revision,
    });
  });
}
