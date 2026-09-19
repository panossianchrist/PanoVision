# Future Screen And Proof Integration

This is an implementation contract, not a claim that physical screens, payments, proof uploads or a player API are connected.

## Existing Foundation

- `data/locations.ts`: verified station/screen catalog, intentionally empty.
- `customer_quotes`: quoted minor-unit amount, configured currency, issuing admin, notes and timestamp. The quote-issuing UI/API is not wired yet. A price estimate must never silently become an accepted quote.
- `campaign_completion`: recorded completed/cancelled state, admin, reason and time. Completion/cancellation is immutable and blocks later publication or draft changes. The admin completion UI is not yet connected.
- `proof_of_play`: campaign and creative version, configured screen, played time, optional real count, manual/player source, unique external event ID, notes, verifying admin and timestamp. Inserts must match campaign ownership; verified evidence cannot be edited or deleted in place.
- `proof_evidence`: future private photo/video/playback-log objects with media kind, integrity hash, content type and creation date. It is a schema, not a public upload route.
- `lib/server/accounts.ts`: company-scoped reads for real quotes/evidence. No seeded deliveries or derived impression counts.
- `/api/account/campaigns/[id]/report`: authenticated, no-store JSON export. It may be used as input for a future PDF renderer after another ownership check. A report with no evidence is not proof that a campaign ran.
- `store.publishableMedia`: verifies current creative approval, policy, byte hashes, all commercial gates and campaign state. Screen integrations must call this gate immediately before dispatch, never read arbitrary paths or trust frontend approval flags.

## Manual Evidence Workflow To Connect

1. Add a staff-only ingestion route using `requireAdmin(request, true)`, exact-origin checks, bounded bodies and rate limits. Review-only staff must not publish evidence.
2. Select a real campaign and screen from the configured catalog. Validate the creative belongs to that campaign, including historical versions. Obtain actual played time/count, not requested dates.
3. Upload optional evidence to private quarantine, with generated storage identifiers, signature/decode checks, malware scanning and integrity hashes. Do not reuse public asset hosting or accept client-provided filesystem paths.
4. Require an explicit admin verification step and audit reason before a customer sees an event or attachment. Corrections need append-only superseding records, not silent alteration of evidence.
5. Add a company-authorized attachment reader with strict content types, ranges where needed, no-store/CORP/CSP headers and integrity checks. Do not expose direct storage keys or public media URLs.
6. Define evidence retention and deletion procedures separately from campaign creative retention. Do not assume an approved advertisement's 90-day media target covers proof records.

## Player Workflow To Connect

Provision separate device credentials, bind each device to a verified screen and rotate/revoke credentials. Authenticate every event; reject duplicate/replayed IDs, untrusted devices, future timestamps and mismatched campaign/asset versions. Require the exact dispatched creative hash. Keep raw events separate from verified customer-visible evidence. Device offline time or a scheduled booking is not proof of playback.

Capture timezone-aware timestamps in UTC; display them in Asia/Beirut. Record actual event counts only, without estimating impressions or unique viewers. Delivery acknowledgement should not bypass content review, payment or scheduling gates. Keep monitoring and retries idempotent. Validate a real end-to-end player in staging before changing any status based on device events.

## Operational Gaps

No player vendor, automatic availability service, payment processor, quote sender, PDF renderer or proof-media uploader is selected or connected. The separate email-change SMTP adapter is implemented but has no real credential configured. These integrations require real business data and an explicit deployment decision. Adding rows by hand to make a customer dashboard look populated is not a substitute for integration.
