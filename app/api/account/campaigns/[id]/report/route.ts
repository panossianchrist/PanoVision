import { apiHandler } from "@/lib/server/http";
import { customerCampaign, requireAccount } from "@/lib/server/accounts";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiHandler(async () => {
    const campaign = customerCampaign(
      (await params).id,
      requireAccount(request),
    );
    const report = {
      title: "PanoVision campaign report",
      generatedAt: new Date().toISOString(),
      campaign: campaign.name,
      locations: {
        cities: campaign.details.selectedCities || [],
        screens: campaign.details.selectedScreens || [],
        packageId: campaign.details.packageId || null,
      },
      requestedPeriod: {
        start: campaign.details.startDate,
        end: campaign.details.endDate,
      },
      status: campaign.businessStatus,
      creative: campaign.creative
        ? { name: campaign.creative.filename, status: campaign.creative.status }
        : null,
      quote: campaign.quote,
      payment: campaign.paymentStatus,
      scheduling: campaign.scheduleStatus,
      proofOfPlay: campaign.evidence,
      notes:
        "Only recorded data is included. Requested dates are not proof of actual delivery. No audience or impression estimates are inferred.",
    };
    return new Response(JSON.stringify(report, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          'attachment; filename="PanoVision-campaign-report.json"',
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
