import { z } from "zod";
import {
  apiHandler,
  json,
  readJson,
  requireCustomer,
  sameOrigin,
} from "@/lib/server/http";
import { campaignSchema } from "@/lib/server/campaign-schema";
import { serverConfig } from "@/lib/server/config";
import { getStore } from "@/lib/server/store";
import { ServiceError } from "@/lib/server/errors";
import { requireAccount } from "@/lib/server/accounts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return apiHandler(async () => {
    sameOrigin(request);
    if (!serverConfig().uploadsEnabled)
      throw new ServiceError(
        "UPLOADS_DISABLED",
        503,
        "Creative submissions are not available yet.",
      );
    const body = await readJson(
      request,
      z
        .object({
          key: z.uuid(),
          campaignId: z.uuid().optional(),
          details: campaignSchema,
        })
        .strict(),
    );
    const session = requireAccount(request);
    const store = getStore();
    store.rateLimit("draft:global",300);
    store.rateLimit(`draft:${session.owner_id}`, 30);
    let campaign;
    if (body.campaignId) {
      store.updateDraft(body.campaignId, session.owner_id, body.details);
      campaign = store.campaign(body.campaignId, session.owner_id)!;
    } else
      campaign = store.createCampaign(session.owner_id, body.key, body.details);
    const response = json({
      campaignId: campaign.id,
      currentAssetId: campaign.current_asset_id,
    });
    return response;
  });
}
export async function GET(request: Request) {
  return apiHandler(() => {
    const session = requireCustomer(request);
    const id = new URL(request.url).searchParams.get("id") || "";
    const campaign = getStore().campaign(id, session.owner_id);
    if (!campaign) throw new ServiceError("NOT_FOUND", 404);
    return json({
      campaignId: campaign.id,
      details: JSON.parse(campaign.details),
      currentAssetId: campaign.current_asset_id,
      businessStatus: campaign.business_status,
    });
  });
}
