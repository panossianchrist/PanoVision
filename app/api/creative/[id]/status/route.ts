import { apiHandler, json, requireCustomer } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { ServiceError } from "@/lib/server/errors";
import { activePolicy } from "@/lib/moderation/policy";
import { publicAsset } from "@/lib/moderation/messages";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiHandler(async () => {
    const session = requireCustomer(request);
    const store = getStore();
    store.rateLimit(`status:${session.owner_id}`, 120, 60000);
    const { id } = await params;
    const asset = store.asset(id, session.owner_id);
    if (!asset) throw new ServiceError("NOT_FOUND", 404);
    const campaign = store.campaign(asset.campaign_id, session.owner_id);
    return json({
      asset: publicAsset(
        asset,
        activePolicy().key,
        campaign?.current_asset_id === asset.id,
      ),
    });
  });
}
