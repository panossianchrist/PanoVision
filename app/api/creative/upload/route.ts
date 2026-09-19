import {
  apiHandler,
  json,
  peerBucket,
  sameOrigin,
} from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { serverConfig } from "@/lib/server/config";
import { idempotencySchema } from "@/lib/server/campaign-schema";
import { ServiceError } from "@/lib/server/errors";
import { safeFilename, storeUpload, purgeMedia } from "@/lib/media/storage";
import { publicAsset } from "@/lib/moderation/messages";
import { activePolicy } from "@/lib/moderation/policy";
import { requireAccount } from "@/lib/server/accounts";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: Request) {
  return apiHandler(async () => {
    sameOrigin(request);
    const cfg = serverConfig();
    if (!cfg.uploadsEnabled)
      throw new ServiceError(
        "UPLOADS_DISABLED",
        503,
        "Creative submissions are not available yet.",
      );
    const session = requireAccount(request),
      store = getStore();
    if (request.headers.get("content-type") !== "application/octet-stream")
      throw new ServiceError("INVALID_UPLOAD_TYPE", 415);
    const key = idempotencySchema.safeParse(
      request.headers.get("idempotency-key"),
    );
    const campaignId = idempotencySchema.safeParse(
      request.headers.get("x-campaign-id"),
    );
    if (!key.success || !campaignId.success)
      throw new ServiceError("INVALID_REQUEST");
    let name;
    try {
      name = decodeURIComponent(request.headers.get("x-file-name") || "");
    } catch {
      throw new ServiceError("INVALID_FILENAME");
    }
    const filename = safeFilename(name);
    if (!filename) throw new ServiceError("INVALID_FILENAME");
    const mime = request.headers.get("x-file-type") || "";
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/webm",
      ].includes(mime)
    )
      throw new ServiceError(
        "UNSUPPORTED_FILE",
        415,
        "Choose a JPEG, PNG, WebP, MP4 or WebM creative.",
      );
    store.rateLimit("uploads:global", cfg.globalUploadsPerHour);
    store.rateLimit(`uploads:owner:${session.owner_id}`, cfg.uploadPerHour);
    store.rateLimit(
      `uploads:peer:${peerBucket(request)}`,
      cfg.globalUploadsPerHour,
    );
    const mediaType = mime.startsWith("image/") ? "image" : "video";
    const campaign = store.campaign(campaignId.data, session.owner_id);
    if (!campaign) throw new ServiceError("NOT_FOUND", 404);
    const details = JSON.parse(campaign.details);
    if ((details.creativeType === "Image") !== (mediaType === "image"))
      throw new ServiceError(
        "CREATIVE_TYPE_MISMATCH",
        400,
        "Choose the creative format selected for your campaign.",
      );
    const reservation = store.reserveUpload(
      session.owner_id,
      campaign.id,
      key.data,
      filename,
      mime,
      mediaType,
    );
    if (reservation.existing)
      return json(
        {
          asset: publicAsset(
            reservation.asset,
            activePolicy().key,
            campaign.current_asset_id === reservation.asset.id,
          ),
        },
        200,
      );
    try {
      const result = await storeUpload(
        reservation.asset.id,
        request,
        mediaType === "image" ? cfg.imageLimit : cfg.videoLimit,
      );
      store.finishUpload(reservation.asset.id, result.size, result.hash);
    } catch (error) {
      store.failUpload(
        reservation.asset.id,
        error instanceof ServiceError ? error.code : "UPLOAD_FAILED",
      );
      await purgeMedia(reservation.asset.id);
      throw error;
    }
    return json(
      {
        asset: publicAsset(
          store.asset(reservation.asset.id)!,
          activePolicy().key,
        ),
      },
      202,
    );
  });
}
