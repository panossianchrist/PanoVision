import { apiHandler, requireAdmin } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { ServiceError } from "@/lib/server/errors";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiHandler(async () => {
    const admin = requireAdmin(request);
    getStore().rateLimit(`preview:${admin.user_id}`, 120, 60000);
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new ServiceError("FORBIDDEN", 403);
    const { id } = await params;
    const asset = getStore().asset(id);
    if (
      !asset ||
      asset.restricted ||
      asset.purged ||
      asset.purge_pending ||
      !asset.scan_passed ||
      !asset.security_valid ||
      !["approved", "rejected", "manual_review"].includes(asset.status) ||
      asset.expires_at <= Date.now()
    )
      throw new ServiceError(
        "PREVIEW_UNAVAILABLE",
        404,
        "This creative is not available for preview.",
      );
    const bytes = getStore().verifiedMedia(id);
    const stat = { size: bytes.length };
    let start = 0,
      end = stat.size - 1,
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
        start < 0 ||
        end >= stat.size
      )
        throw new ServiceError("INVALID_RANGE", 416);
      status = 206;
    }
    getStore().audit(
      id,
      asset.campaign_id,
      admin.user_id!,
      "preview_access",
      null,
      null,
      "Authorized media preview",
    );
    return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
      status,
      headers: {
        "Content-Type":
          asset.media_type === "image" ? "image/webp" : asset.mime_type,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        ...(status === 206
          ? { "Content-Range": `bytes ${start}-${end}/${stat.size}` }
          : {}),
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Content-Disposition": "inline",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  });
}
