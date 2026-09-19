import { apiHandler } from "@/lib/server/http";
import { requireAccount } from "@/lib/server/accounts";
import { getStore } from "@/lib/server/store";
import { ServiceError } from "@/lib/server/errors";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiHandler(async () => {
    const session = requireAccount(request),
      store = getStore();
    store.rateLimit(`customer-preview:${session.user_id}`, 120, 60000);
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new ServiceError("FORBIDDEN", 403);
    const campaign = store.campaign((await params).id, session.owner_id);
    const asset = campaign?.current_asset_id
      ? store.asset(campaign.current_asset_id, session.owner_id)
      : undefined;
    if (
      !asset ||
      asset.restricted ||
      asset.purged ||
      asset.purge_pending ||
      !asset.scan_passed ||
      !asset.security_valid ||
      asset.expires_at <= Date.now() ||
      !["approved", "rejected", "manual_review"].includes(asset.status)
    )
      throw new ServiceError("PREVIEW_UNAVAILABLE", 404);
    const bytes = store.verifiedMedia(asset.id);
    let start = 0,
      end = bytes.length - 1,
      status = 200;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) throw new ServiceError("INVALID_RANGE", 416);
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : end;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        end >= bytes.length
      )
        throw new ServiceError("INVALID_RANGE", 416);
      status = 206;
    }
    store.audit(
      asset.id,
      campaign!.id,
      session.user_id!,
      "customer_preview",
      null,
      null,
      "Customer accessed own campaign creative",
    );
    return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
      status,
      headers: {
        "Content-Type":
          asset.media_type === "image" ? "image/webp" : asset.mime_type,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        ...(status === 206
          ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` }
          : {}),
        "Cache-Control": "no-store, private",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  });
}
