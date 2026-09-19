# Verification Record

Verified locally on 2026-09-17 against the source in `C:/Users/Owner/PanoVision`. See [Safety Audit](SAFETY-AUDIT.md) for findings, scope and limits.

## Automated Checks

- `node --conditions=react-server --import tsx --test tests/*.test.ts`: **176 passed, zero failures**. Tests use isolated temporary databases, harmless generated media and mock category responses. No prohibited test content or live provider call is used.
- ESLint over app, components, data, lib, config, scripts, tests and Next configuration: **passed, zero errors/warnings**.
- TypeScript checking and Next.js production build: **passed**. Admin/API routes run server-side; public pages are statically rendered where appropriate.
- `npm audit --omit=dev`: **zero reported vulnerabilities** at the time checked. This is a dependency advisory check, not a security certification.
- `npm ci --dry-run --ignore-scripts --offline`: **passed**. Manifest and lockfile dependency groups match. A clean installation on a different host still needs its own platform/runtime verification.
- Production client bundles were checked for moderation credential identifiers, SQLite code and private-storage configuration: none found. Secrets were not supplied for live integrations.
- The actual standalone worker and admin-provisioning CLI were launched in subprocess tests. The worker processed a real safe upload into a scanner-unavailable hold; provisioning created a salted account and rejected duplicate/weak credentials. The local preview worker also starts successfully. This check caught and fixed CommonJS/ESM interoperation in the environment loader.

## Browser Checks

`node --conditions=react-server --import tsx scripts/browser-check.mjs` launches an isolated production-mode test server on port 4176 and a headless Edge browser through Playwright. It does not turn on mock approval in the real website. It creates a temporary staff account and database, injects test-only worker dependencies in the test process, and removes that private data after testing.

Eight routes were checked at **1440, 1200, 1024, 768, 430, 390 and 320 pixels**: 56 page/viewport combinations, plus the authenticated admin detail view at all seven widths. Checks covered horizontal overflow, broken images, image alternatives and one primary heading. Browser console and page-error lists were empty. Desktop/mobile screenshots were inspected.

The interactive suite passed:

- Mobile menu opening, Escape dismissal, navigation and scroll-lock release.
- Geographic region selection, zoom/reset and the distinction between city markers and real screens.
- Form validation for required details, date ordering, custom display duration and invalid files.
- Private creative V1 held by an unavailable scanner, V2 rejected by a synthetic mock result, V3 approved after mocked checks with real decoding/storage.
- Rejected/manual creatives blocked at Continue; refreshing restores the owned approved draft; final submission creates a real database request.
- Summary download truthfully marked received, not a fictitious email delivery.
- Unauthorized admin navigation redirected to login; authenticated private preview and logout worked.
- Availability/specification/quote confirmations, payment confirmation, scheduling and live transitions worked in their required order against the server.
- Contact form validation and its explicitly local-only draft state.

Screenshots and the machine-readable browser report are in `test-results/`, which is ignored by Git. The real local preview is port 4174; its private data is separate from test data.

## Security and Business Invariants

The tests directly check ownership, origin enforcement, malformed bodies, MIME/extension mismatch, oversized/truncated uploads, corrupted media, out-of-range duration, complete video decoding, frequent sampling, a one-frame safe flash between regular samples, frame-limit overflow, unavailable scanner/provider, timeouts, missing frames/audio failures and unknown/incomplete classifier results.

Database tests check durable job leases, stale-worker fencing, idempotency conflicts, failed transaction rollback, policy changes during processing, policy fingerprint changes, expired approvals, critical restriction and purge, retention/override races, audited overrides, version replacement and resetting business approvals. Direct database transitions are tested as well as application methods. Unapproved, unscanned, expired, purged, restricted or old-policy creatives cannot pass the submission/live gates.

## Not Verified or Connected

The safety audit added same-size source/preview tampering, independent submission/scheduling/live/dispatch guards, SQL byte checks, matching immutable approval evidence, old-proof replay rejection, asset-bound leases, administrator-only decisions, failed post-classification commits, missing jobs, provider category/flag handling, empty transcripts, start/middle/end rejected frames and audio outcome aggregation. These tests do not measure live classifier accuracy.

No real provider credential or active ClamAV service was supplied, so live classifier accuracy, service billing/quotas, provider retention settings and real malware scanning are **not verified**. Human overrides and unsafe-category outcomes were tested with harmless fixtures and mock responses, not real prohibited content.

No public deployment, email delivery, payment transaction, SSO/MFA, physical screen integration, multi-host scaling, independent penetration test or legal compliance certification was performed. Complete [Production Setup](PRODUCTION.md) before accepting real customer content. AI checks are fallible and do not establish legality or ownership rights.
