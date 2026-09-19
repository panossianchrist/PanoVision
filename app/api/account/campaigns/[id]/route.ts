import { apiHandler, json } from "@/lib/server/http";
import { customerCampaign, requireAccount } from "@/lib/server/accounts";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiHandler(async () =>
    json({
      campaign: customerCampaign((await params).id, requireAccount(request)),
    }),
  );
}
