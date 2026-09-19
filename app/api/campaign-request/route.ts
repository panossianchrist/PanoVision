import { z } from "zod";
import {
  apiHandler,
  json,
  readJson,
  sameOrigin,
} from "@/lib/server/http";
import { campaignSchema } from "@/lib/server/campaign-schema";
import { getStore } from "@/lib/server/store";
import { requireAccount } from "@/lib/server/accounts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return apiHandler(async () => {
    sameOrigin(request);
    const session = requireAccount(request);
    const body = await readJson(
      request,
      z
        .object({
          campaignId: z.uuid(),
          assetId: z.uuid(),
          details: campaignSchema,
        })
        .strict(),
    );
    getStore().rateLimit(`submit:${session.owner_id}`, 20);
    const campaign = getStore().submitCampaign(
      body.campaignId,
      session.owner_id,
      body.assetId,
      body.details,
    );
    return json(
      {
        campaignId: campaign.id,
        status: campaign.business_status,
        message:
          "Campaign request received. Availability, screen specifications, pricing and final business approval remain subject to review.",
      },
      201,
    );
  });
}
