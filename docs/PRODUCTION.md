# Production Setup and Operations

## Supported Deployment

This is a single-host Next.js/Node 24 service, with SQLite WAL, private filesystem storage and a separate durable worker. It is not an ephemeral serverless deployment, a multi-host database or a physical-screen player. The server and worker must use the same private volume, policy version and provider settings. Keep all runtime data out of synced/network folders. Do not expose the private root through a reverse proxy, CDN or static-file alias.

The updated local site is at `http://127.0.0.1:4177`, with a process-level origin override. `.env.local` enables local uploads, but has no scanner or provider key. Its real worker therefore holds files for review. This configuration is for local inspection only, not accepting real confidential advertising. See the README for the machine's Node executable and current startup command.

## Configuration

Copy the settings from `.env.example` into your deployment's secret/configuration system. Do not commit secrets. Public values and private values must remain separate.

| Setting | Purpose / default |
| --- | --- |
| `PANO_APP_ORIGIN` | Exact origin, no trailing slash. HTTPS required except loopback |
| `NEXT_PUBLIC_SITE_URL` | Public canonical domain; leave empty for non-indexable local previews |
| `PANO_PRIVATE_DIR` | Persistent private local volume, `.private` by default |
| `PANO_UPLOADS_ENABLED` | Explicit `true` to accept drafts/uploads; default false |
| `MODERATION_PROVIDER` | `openai` when configured; otherwise disabled |
| `MODERATION_API_KEY` | Private provider credential, no default |
| `MODERATION_VISION_MODEL` | `gpt-4.1-mini`, configurable |
| `MODERATION_SAFETY_MODEL` | `omni-moderation-latest`, configurable |
| `MODERATION_TRANSCRIPTION_MODEL` | `gpt-4o-mini-transcribe`, configurable |
| `MODERATION_TIMEOUT_MS` | Per-provider-request timeout, 30000 |
| `PANO_MODERATION_POLICY_VERSION` | Version recorded with each decision; rule fingerprint also enforced |
| `MAX_IMAGE_SIZE_MB`, `MAX_VIDEO_SIZE_MB` | 10 and 50; keep browser limits synchronized when changing |
| `VIDEO_DURATION_SECONDS` | 8; browser duration validation must change with it |
| `VIDEO_DURATION_TOLERANCE_SECONDS` | 0.25 |
| `VIDEO_MODERATION_SAMPLE_INTERVAL_MS` | 500; supported 100-500 |
| `VIDEO_MODERATION_MAX_FRAMES` | 64; excessive scene/frame counts hold for review |
| `FFMPEG_PATH`, `FFPROBE_PATH` | Trusted maintained executable paths, not uploaded binaries |
| `CLAMSCAN_PATH` | Trusted ClamAV `clamscan` executable; no scanner means no approval |
| `REJECTED_MEDIA_RETENTION_DAYS` | 2, configurable 0-30 |
| `REVIEW_MEDIA_RETENTION_DAYS` | 7, configurable 1-60 |
| `APPROVED_MEDIA_RETENTION_DAYS` | 90, configurable 1-365 |
| `UPLOADS_PER_SESSION_HOUR` | 10 |
| `UPLOADS_GLOBAL_HOUR` | 100 |
| `UPLOADS_GLOBAL_PENDING` | 20 |
| `MAX_PRIVATE_STORAGE_MB` | 5120, conservative reservations include derived media |
| `PANO_TRUST_PROXY` | false; enable only behind a trusted proxy that overwrites forwarded headers |

The supplied Windows FFmpeg/FFprobe packages are development/test helpers, not a promise that their old bundled builds are appropriate for public untrusted media. Install maintained system packages, verify versions and patch them before deployment. Configure ClamAV signature updates and monitor freshness. The scanner integration is `scanMalware` in `lib/media/validation.ts`: exit 0 is clean, 1 is infected, every other result is unavailable. No external media provider receives a file before a clean scan and successful decode.

## Worker and Admin Commands

### Customer Email Changes

Set `SMTP_HOST`, `SMTP_PORT` (465 for implicit TLS, or your provider's STARTTLS port), `SMTP_USER`, `SMTP_PASSWORD`, and a provider-verified `SMTP_FROM` in the server secret configuration. TLS and certificate verification are mandatory. No SMTP secrets enter client code. Keep these settings empty until an actual mailbox/provider is selected.

The profile's Change email address flow requires the current password and separate eight-digit codes from both the current and proposed mailboxes. Codes expire in 20 minutes, allow five attempts, are stored only as challenge-bound hashes, and are consumed once. Requests are limited to three per customer per hour. Successful changes revoke older customer sessions; password changes invalidate pending email changes. Delivery failure leaves the old address unchanged. Email contents are localized and contain no campaign files.

This SMTP integration serves email changes only. It does not add signup verification, password recovery, delivered contact forms, campaign notifications or invoices. Never treat an unverified signup address/company name as proof of legal company ownership. Review onboarding and recovery requirements before public account launch. Live SMTP delivery must be verified in staging; automated tests use an injected mail sink and do not send messages.

Implementation references: [OWASP email-change guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#changing-a-users-registered-email-address), [Nodemailer SMTP](https://nodemailer.com/smtp).

### Local Commands

On this machine, replace `npm` with `node package/bin/npm-cli.js`. Use Node 24.

```powershell
Set-Location 'C:/Users/Owner/PanoVision'
node package/bin/npm-cli.js ci
node package/bin/npm-cli.js run test
node package/bin/npm-cli.js run typecheck
node package/bin/npm-cli.js run lint
node package/bin/npm-cli.js run build
$env:PANO_APP_ORIGIN='http://127.0.0.1:4177'
node package/bin/npm-cli.js run start -- --hostname 127.0.0.1 --port 4177
```

In a second terminal, with the same configuration:

```powershell
node package/bin/npm-cli.js run worker
```

Provision a staff account from the trusted server, not through a public sign-up page. The CLI has no default credential and refuses an existing username. Use a password manager to generate a unique password of at least 16 characters. This PowerShell prompt avoids placing it in command history:

```powershell
$secure = Read-Host 'New admin password' -AsSecureString
$env:PANO_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
try {
  node package/bin/npm-cli.js run admin:create -- owner admin
} finally {
  Remove-Item Env:PANO_ADMIN_PASSWORD
  $secure.Dispose()
}
```

Use `reviewer` instead of `admin` for read-only staff who may inspect permitted previews/history but must not change creative or business decisions. Open `/admin/login`. Passwords use salted scrypt; server-side sessions contain only hashed opaque random tokens, expire after eight hours, and are revoked at sign-out. There is no public password-reset flow or email recovery. A trusted operator can disable an account and revoke its sessions in the database; have a developer manage that operation. Before exposing staff login broadly, add an identity-aware proxy/VPN or a reviewed SSO/MFA integration, and preserve application role checks.

For development, choose a free port, for example 4180, and set `$env:PANO_APP_ORIGIN='http://127.0.0.1:4180'` in that terminal before `npm run dev -- --hostname 127.0.0.1 --port 4180`. The local `.env.local` otherwise uses 4174. Do not mix `localhost` and `127.0.0.1`. Coordinate development and builds with the owner of the running preview because `.next` is shared.

## Security Checklist

- Terminate TLS at a maintained reverse proxy; bind the app to loopback/private networking. Enforce a request body limit compatible with the configured video limit, header/time/connection limits, request-rate limits and upload timeouts. Test proxy buffering and chunked upload behavior.
- Run the web server, worker and media tools as dedicated low-privilege services, never as administrator/root. Place media processing in a constrained container or OS sandbox with CPU, memory, process and disk limits. FFmpeg is invoked without a shell, with network protocols restricted and bounded execution time, but those are not a substitute for OS isolation or patched decoders.
- Restrict filesystem permissions on database, media, logs, secrets and backups. On Windows, verify NTFS ACLs; POSIX `mode` flags do not establish Windows ACLs. Use encrypted storage and encrypted, access-controlled backups.
- Permit outbound provider traffic only as required. No customer-supplied URL is fetched. The browser never calls moderation APIs or receives their keys. Keep raw provider text, media and credentials out of telemetry/error collection.
- Maintain the malware scanner and its definitions. Validate clean, infected, unavailable and timeout behaviors in staging; the repository has only harmless synthetic fixtures and mocked unsafe-category signals.
- Establish staff review procedures and appeal handling. Critical restricted media has no admin preview/export, is blocked from approval and is marked for immediate deletion. Coordinate retention and incident handling with qualified counsel; no reporting duty is invented by this code.
- Review dependencies, run the lockfile audit, patch software and run regression tests before release. Changing model versions requires representative policy evaluation, not only unit tests. Model probabilities are not calibrated legal confidence.

## Jobs, Failures and Races

The upload request streams to a generated private path, returns an ID, and creates one durable job. SQLite transactions provide idempotent reservation and completion. Leases expire after ten minutes; heartbeats extend them. Completion is fenced by a lease token and captured policy version. A replaced creative can finish its own check but cannot become the campaign's current creative again. Lease-specific derived files prevent competing retries from overwriting one another.

Provider errors produce manual review. Database commit errors leave processing blocked for retry. More than three attempts produces a hold when the next lease is claimed. A stopped worker leaves uploads queued, not approved. Alert on jobs that remain queued/processing, repeated worker errors, scanner problems, private-volume utilization and provider budget limits. Review outcomes and average processing time are available only in the protected dashboard; they include automated processing history, not a calibrated accuracy measurement.

Jobs deliberately do not reuse prior approvals by file hash. Exact bytes are hashed on upload, rechecked before/after moderation and before approval/submission/business transitions/dispatch. The sanitized image has a separate verified hash. Each upload receives a new result under current rules. Duplicate frames/text within a clip can share the same check. A missing job cannot approve an asset; alert on orphaned uploaded/processing records and recover them through a reviewed operational procedure.

## Retention and Backups

The worker checks media retention approximately every minute. It first marks eligible files unavailable, then deletes the media, retaining metadata/audit records. Interrupted uploads are eligible for cleanup after one hour. Active jobs are not purged mid-processing. Derived frames/audio are removed after a completed job; originals remain private until their retention period ends. Critical restricted content is purged promptly and has immediate access restrictions even if deletion encounters an error.

Define and implement campaign metadata/audit deletion, customer deletion requests and backup expiry before launch. These do not have an automatic general retention schedule yet. Do not include quarantined/critical media in unrestricted backups; set an explicit backup policy. Use SQLite's backup API or stop both services for a consistent database/media snapshot, including WAL state. Do not copy only an actively written `.sqlite` file. Test restoration in an isolated environment, reapply current policy, and verify no paused/expired campaign is unintentionally activated.

Policy updates require coordinated deployment: pause upload acceptance, let in-flight work finish or stop the worker, back up, deploy identical rules/config to both services, restart and test. Existing approvals become ineligible when their version/fingerprint differs. Re-upload for a fresh check. Do not run old and new policy workers concurrently against the same database.

## Business Gates

`requested -> business_approved -> paid -> scheduled -> live` is enforced server-side, with database triggers as a second guard. Availability, specifications and quote approval have individual timestamps. The API requires explicit attestations before setting them. Payment and schedule have separate confirmations. Pausing or replacing a creative clears these approvals. Reviewers cannot make business transitions. All staff decisions require audit reasons and optimistic revisions.

These are bookkeeping states, not a screen-control system. `PanoStore.canCreativeGoLive` centralizes evidence/eligibility and byte verification; `publishableMedia` also requires a live campaign and returns the exact verified byte snapshot. A future player must use this gate before every dispatch and consume those bytes, not reopen a path or trust a stale exported `live` flag. The publication hash covers the returned sanitized WebP/video; the original upload hash is returned separately. No hardware, financial transaction, quote email or payment reconciliation is integrated here.

SQLite active-transition triggers call the registered `pano_media_intact` function as a second byte check. Generic SQLite connections lacking that function cannot advance campaigns. Keep trusted maintenance tooling within the service contract; do not disable triggers to change states. Evidence/identity protections block ordinary SQL edits, not a malicious administrator with authority to alter the schema or application code. Review the full [Safety Audit](SAFETY-AUDIT.md).

Deploy this safety migration with both services stopped. Back up first; restart matching web/worker builds together. Legacy approvals without matching hash-bound evidence are held for a new upload/review, not silently trusted. Automated results and audit events are append-only; implement an explicitly authorized retention/pseudonymization migration before public launch rather than disabling evidence protection during routine operation.

## Remaining Launch Work

Supply verified contact details, review and publish privacy/terms, agree final platform policy, evaluate models on representative lawful ads, configure provider billing/data settings and ClamAV, set up hosting/TLS/service supervision/OS isolation/backups, provision staff, and establish operational review coverage. Connect reliable notifications and contact-message delivery. The contact form is still an explicitly labeled local draft; campaign requests are stored but not emailed. No public deployment or claim of perfect detection is included.

The code includes authenticated admin review, real private persistence and SMTP-configured email-change verification. It does not include customer account recovery, initial signup email verification, SSO/MFA, managed object storage, a distributed queue, payment processing, physical display scheduling or legal certification. Those are separate integrations, not hidden mock services.
