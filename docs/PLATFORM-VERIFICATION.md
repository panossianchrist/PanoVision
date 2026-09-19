# Main Website Verification

Verified on 18 September 2026 in `C:/Users/Owner/PanoVision`. This report covers the existing main Next.js website, not the separate static public preview. The current running main site is [http://127.0.0.1:4177/](http://127.0.0.1:4177/).

## Results

| Check | Result |
| --- | --- |
| TypeScript `tsc --noEmit` | Passed |
| ESLint across app, components, data, libraries, configuration, scripts and tests | Passed, no reported errors or warnings |
| Node test suite | 210 passed, 0 failed, 0 skipped |
| Next.js production build | Passed |
| Playwright responsive/language matrix | 280 page/viewport checks passed |
| Browser JavaScript console/page errors | None in the tested flows |
| Touch scroll, pinch zoom and hero animation pause | Passed in Chromium touch emulation |
| Final main-site HTTP checks | English/French/Arabic each returned 200 with correct language/direction and exactly one homepage map |
| Main-site private API check | Unauthenticated campaign access returned 401 |
| Main-site origin configuration | Same-origin invalid signup reached validation and returned 400, not an origin error; no account was created |
| Main-site visual check | Desktop/mobile screenshots inspected; no horizontal overflow; all eight normal-motion workflow steps became visible |

## Automated Coverage

`tests/campaign-planning.test.ts` has 16 focused checks for city/screen selection, parent/child conflicts, URL handoff, missing rates, daily/weekly/special pricing, packages, discounts, configured currency precision, contacts, translation-key parity and landscape/portrait screen ratios. Test inventory and rates are synthetic inputs, not published inventory.

`tests/customer-accounts.test.ts` has 18 checks for salted passwords, session rotation and revocation, cross-origin writes, input validation, company ownership, disabled accounts, profile roles, password changes, rate limiting, private media integrity, proof-record ownership, terminal campaign state and safe redirects. Email-change tests cover both mailbox codes, hash-only storage, attempt/expiry limits, failed delivery, password-change invalidation and one-use confirmation. They use an injected mail sink; no live email was sent.

The remaining 176 tests retain the existing moderation, media, provider, worker, database and business-gate coverage. This includes hash tampering, stale policy, worker leases, missing scanner/provider, rejected creatives, role restrictions, approval revocation and independent publication gates. Unsafe findings are harmless test signals; tests do not establish real-world classifier accuracy.

## Browser Matrix And Flows

`scripts/browser-check.mjs` starts a production-mode test server on 4176 with its own temporary database and private storage. It uses real application routes and database operations. Synthetic classifier results are injected only into test job processing. The temporary database is removed in cleanup; zero `browser-private-*` directories remained after the final successful run.

The matrix checks widths **1440, 1200, 1024, 768, 430, 390 and 320**. It includes 70 base public/auth page checks and 210 English/French/Arabic public/customer page checks. Routes cover home, network, how it works, campaign form, contact, privacy, terms, login/signup, dashboard, profile and campaign details. Additional staff review checks cover all seven widths.

Verified interactions:

- Mobile navigation opens, closes with Escape and follows its links.
- Exactly one homepage map; no screen markers when inventory is empty.
- Multiple cities remain selected, individual chips remove only one, zoom/pan/reset preserve selection, keyboard interaction works and selections reach the campaign form.
- Touch scrolling works over the map with hand mode off; hand mode enables pinch zoom. The animated hero moves and pauses when tapped.
- Signup produces a real empty dashboard; campaign contact data is prefilled; profile changes persist; logout/login restores the owned campaign.
- Special-occasion dates, times and custom minutes validate; a saved creative/draft survives refresh even when map query parameters remain in the URL.
- Local image previews decode correctly. An actual eight-second synthetic WebM plays, pauses, restarts and mutes/unmutes; Fit/Fill and cropping warnings work.
- Missing scanner, rejection and approval outcomes remain distinct. A rejected or unfinished creative cannot advance. The test-approved version can submit a real stored request in the isolated database.
- Staff authentication, private previews and separate business/payment/schedule/live attestations work. These test attestations do not represent real payments or broadcasts.
- Contact prepares a local draft and a `mailto:` link to the configured address, without pretending delivery occurred.
- English/French/Arabic customer workflows, image previews, metadata and document direction work. Arabic geography is not mirrored.
- Empty inventory, prices, campaigns and proof-of-play have genuine empty/pending states.

Machine-readable results: `test-results/browser-report.json`. Representative screenshots are in `test-results/`, including `main-final-1440.png`, `main-final-390.png`, `main-final-workflow.png`, `ar-creative-preview.png`, `ar-dashboard-profile-mobile.png` and `customer-campaign-desktop.png`. Any names or campaign media visible in test screenshots are synthetic fixtures, not real customer or delivery claims.

## Brief Traceability

| Brief sections | Implementation and status |
| --- | --- |
| 1-2, 30, 50-53 | Central contacts; correct email/Instagram; WhatsApp hidden until a verified number is configured |
| 3-14, 54-55, 76-78 | One geographic map, animated hero, multi-selection, chips, zoom/pan/reset, future real-screen catalog and details |
| 15-18 | Configured-only estimates, currency and package rules, URL handoff and editable form selections |
| 19-20, 59-61, 74 | Restrained interactions, responsive layout, keyboard labels/focus and reduced motion; no formal accessibility certification claimed |
| 21-26, 68-71, 80 | Real private customer/company records, login/logout, profile/password, campaign dashboard and separate commercial status; SMTP-configured email changes |
| 27-29, 72 | Proof and report schema, private real-data views and JSON report implemented; player events, proof attachments/admin workflow and PDF rendering remain future integrations |
| 31-35, 79 | Persisted English/French/Arabic translations, localized customer metadata and intentional RTL |
| 36-48, 81 | Prominent special occasions, 5/10/custom-minute requests, image/video preview, technical metadata and unchanged moderation requirements |
| 49, 56-58, 73, 82 | Navigation and eight-step journey updated; no fake success for unconnected payment, contact delivery, evidence or inventory |
| 62-69 | Server authorization, private media and additive company/quote/evidence models; no fabricated stations, clients, prices, partnerships or playback results |
| 75-83 | Type/lint/test/build/browser verification above; real external integrations remain unverified |
| 84 | All 28 beginner answers and explicit status categories are in `docs/PLATFORM-GUIDE.md` |

## Limits Before Launch

Passing this local suite does not certify a production service. No real station inventory, pricing, WhatsApp number, SMTP credential, malware scanner or moderation provider key was supplied. Missing safety services continue to block approval.

Email-change business logic is tested, but actual SMTP delivery must be verified in staging. Initial signup email verification and account recovery are not implemented. Contact email delivery, quote issuance, online payments, automatic availability, physical-player scheduling, proof-media ingestion, admin completion actions and PDF generation are not connected. The existing business-status controls are auditable records, not integrations with those external systems.

Browser testing used Microsoft Edge/Chromium and emulated touch, not physical iOS/Android devices, Safari or Firefox. Native-speaker copy review, a dedicated accessibility audit, production load testing, penetration testing, backup-restore drills, legal review and real device/provider integration tests remain launch work. No performance or accessibility score is claimed.

## Reproduce

Use the Node 24 runtime documented in the README. Do not build into `.next` while another development/build process is using it. The browser suite requires a free port 4176 and Playwright with Microsoft Edge available; set `PLAYWRIGHT_PACKAGE` if the package lives elsewhere.

```powershell
node node_modules/eslint/bin/eslint.js app components data lib config scripts tests next.config.ts
node node_modules/typescript/bin/tsc --noEmit
node --conditions=react-server --import tsx --test tests/*.test.ts
node node_modules/next/dist/bin/next build
node --conditions=react-server --import tsx scripts/browser-check.mjs
```

The running main server uses its normal `.private` storage, not the browser-test directory. Earlier local preview processes were not terminated. Use 4177 for this verified build; an old tab on 4174/4175 may display an older process. The separate public preview has not been republished by this update.
