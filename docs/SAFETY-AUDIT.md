# PanoVision Moderation Safety Audit

2026-09-17. Project: `C:/Users/Owner/PanoVision`.

## Scope and Outcome

The existing implementation was inspected, not rebuilt. Scope: every API route, database mutator, moderation provider, worker, upload/storage path, administrator operation and the current scheduling/live bookkeeping. Repository-wide state-word search output is in `test-results/state-path-audit.txt`. No payment webhook, import endpoint, campaign duplication endpoint, external publishing service or physical-screen player exists here.

The code findings below were fixed and regression-tested. This is **not a production certification or a guarantee that AI detects all prohibited content**. No real prohibited media was used. Live OpenAI accuracy and ClamAV were not tested: credentials/services are not configured. Real local uploads are deliberately held when those checks are unavailable.

## Findings

| ID | Severity | Problem and consequence | Fix |
| --- | --- | --- | --- |
| A01 | CRITICAL, defense in depth | Direct database/trusted-script status updates could relabel a rejected asset approved without approval evidence; campaign guards trusted those labels. No public customer SQL-execution path was found. | Require immutable matching automated/admin approval evidence, bound to hash, policy and revision. Campaign guards also require evidence. Test forged status promotion and old-proof replay. |
| A02 | HIGH | Stored hashes were never rechecked. A filesystem mistake or write-capable process could replace reviewed bytes; previews reopened paths after metadata checks. | Rehash source/preview at moderation and safety boundaries. Verify bytes before submission, overrides, business transitions, SQL scheduling and dispatch. Serve the exact checked snapshot. Missing/changed files revoke eligibility. |
| A03 | HIGH | Reviewers could approve overrides; store mutators accepted arbitrary actor strings. | Enabled administrators only, enforced in API/service/transaction. Reviewer UI is read-only. |
| A04 | HIGH | Low-score category flags, an overall provider flag or some missing categories could disappear into a safe result. | Require all 13 expected category flags/scores. Flags force at least review; confident hard findings still reject. Critical flags cannot disappear below a threshold. Unmapped high scores hold. |
| A05 | MEDIUM | Empty transcription was treated as silence despite possible recognition failure. | Empty transcript with an audio track requires review. No audio track remains acceptable. |
| A06 | MEDIUM | Decision evidence lacked file hashes; override audit lacked policy version/fingerprint. Evidence could be edited in place. | Persist hash/policy/revision with existing actor/time/reason/decisions. Results and audit events are append-only under ordinary SQL. |
| A07 | MEDIUM | Job ownership did not bind the supplied asset ID to its lease. | Check job, asset, token and expiry together for writes/heartbeat. |
| A08 | MEDIUM | Incomplete policy configuration or disabled critical handling could pass otherwise empty findings. | Missing categories/disabled critical handling force review. A fixed critical child-safety floor preserves restricted handling even with missing/misconfigured rules. Pipeline changes invalidate previous fingerprints. |
| A09 | LOW | Private preview had no endpoint-specific request budget. | Per-staff preview rate limit and bounded byte snapshots. |

A01 is a critical *consequence of an erroneous trusted mutation*, not a demonstrated remote customer exploit. A fully compromised server/database administrator can remove constraints or change code. OS permissions, isolation and restricted operational access remain essential.

## Requested Checklist

“Verified” means tested code behavior, not real classifier accuracy or a completed deployment.

| Check | Current status | Problem found | Fix applied | Test added / existing evidence |
| --- | --- | --- | --- | --- |
| Server-side upload validation | Verified | No new format bypass found | Retain MIME sniffing, size limits, full decode | Fake extension/MIME, corruption, dimensions, image/video size tests |
| Private quarantine storage | Verified locally | No public media route found | Generated private paths; DB enforces quarantine-first | Upload/API/store checks; private-path HTTP smoke check |
| Image moderation | Verified with mocks | A02 | Classify actual decoded pixels; verify hashes | Decoded-pixel assertion; tamper before/during scan |
| Video full-duration sampling | Verified with real FFmpeg | No first-frame-only behavior | Interval + scene sampling; timestamp/gap/end checks | Real eight-second clip, one-frame flash and cap overflow |
| Visible-text moderation | Verified with mocks | No new bypass found | Separate OCR text check; incomplete OCR holds | Ambiguous text/unreadable text tests |
| Audio moderation | Verified extraction/mocks | A05 | Empty/error transcript holds | Rejected, ambiguous, empty and failed audio |
| Hard-reject aggregation | Verified | No averaging bypass | One confident hard violation wins | Start/middle/end and one-bad-among-16 frames |
| Manual-review handling | Verified | A01/A03 | Evidence and administrator-only overrides | Review plus payment/direct live mutations blocked |
| Provider failure handling | Verified with mocks | A04 | Strict categories and conservative flags | HTTP 401/429/500, network, timeout, malformed/missing/contradictory results |
| File immutability/hash | Verified | A02 | Immutable identity and repeated SHA-256 checks | Same-size source/preview changes and missing files |
| Creative replacement | Verified | Existing gate sound | New version/pointer and approval reset retained | Replacement and old-job completion tests |
| Admin permissions | Verified | A03 | API/service admin role enforcement | Unauthorized, reviewer and disabled-actor tests |
| Admin audit trail | Verified | A06 | Hash/policy/revision-bound append-only evidence | Preserved AI result and immutable-evidence tests |
| Payment/moderation separation | Verified | No payment callback exists | Separate gates/timestamps retained | Paid flags cannot publish processing/review/rejected assets |
| Final publishing gate | Verified in repository | A01/A02 | Shared eligibility, SQL byte guard, verified dispatch | Direct SQL scheduling tamper and live-dispatch revocation |
| Rate limiting | Verified locally | A09 | Preview budget added; existing budgets retained | Durable bucket exhaustion and upload in-flight limits |
| Logging privacy | Inspected/tested | No raw-content logging path found | IDs/codes and generic errors retained | API/provider redaction checks; worker log inspection |
| Storage privacy | Verified locally | A02 | Authenticated verified snapshots, no-store/nosniff/sandbox | Private preview browser/auth/integrity tests |
| Race conditions | Verified for tested interleavings | A07 and evidence replay risk | Asset-bound leases, proof revisions and transactional role checks | Stale worker/review, retention, replacement and proof replay |
| Background worker safety | Verified | A07 | Bound leases; durable atomic completion retained | Actual CLI worker, restart/retry, missing job, failed DB commit |

## Guarantees by Layer

| Layer | Guarantee |
| --- | --- |
| UI | Distinct uploading/checking/review/rejected/passed states; no Continue without server eligibility. Not the security boundary. |
| API | Strict schemas, ownership/session/role checks, same-origin writes and rate limits. Customers cannot choose decisions. |
| Service | Security/decode precede provider calls. Failure/incomplete checks hold; hard rejection wins. Shared eligibility plus actual byte checks. |
| Database | Quarantine-first, immutable identity/evidence, matching proof, current owner/version/policy/security/expiry and separate business/payment/schedule checks. Atomic proof and decision commit. |
| Scheduling/publishing | Every repository transition rechecks. SQLite calls `pano_media_intact` before active transitions. `publishableMedia` checks live/current eligibility and returns verified bytes, never a reopenable path. |

A future player must use the verified dispatch gate for each dispatch and must not trust a cached `live` flag, old URL or stale file path. For images, dispatch returns the reviewed sanitized WebP; `sha256` hashes those returned bytes and `sourceSha256` identifies the original upload. There is no connected hardware/player to certify.

## Red-Team Matrix

Tests use generated colors/test patterns, harmless words, the supplied logo, abstract category labels and simulated failures:

- Safe, rejected, ambiguous and provider-error images.
- Actual eight-second video decoding/frame/audio extraction; mock violations at 0, 4 and 7.5 seconds; one rejected frame among 15 safe frames.
- A high-contrast harmless single-frame flash between interval samples; excessive frame count held instead of silently truncated.
- Safe visuals with rejected/ambiguous/empty/error audio; extraction failure and no frames.
- Network, timeout, 401/429/500, malformed JSON, refusals, incomplete responses, missing categories, unreadable text and conflicting flags.
- Extension/MIME mismatch, corrupt image/video, oversized image/video, excessive image dimensions and nine-second video rejection.
- Duplicate upload/job completion, stale leases, exhausted retries, missing jobs, partial processing and database failure after classification.
- Direct API approval fields, unauthorized/reviewer/disabled overrides, stale revisions and audited administrator decisions.
- Changed bytes before/during moderation, after approval, before scheduling/live and during dispatch; database hashes alone are insufficient.
- Replacement and old jobs finishing later; processing/review/rejected assets stay blocked even with payment timestamps.

This verifies handling of **detected signals and failures**, not real model recall. Interval/scene sampling can miss a subtle, small-area or low-contrast flash. Resizing/compression, OCR/transcription mistakes, unfamiliar language, prompt injection and model errors remain risks. Human reviewers must watch the entire clip. Evaluate detection on representative lawful media before launch; there is no claim that every physical frame is classified.

## Simple Answers

1. **Weaknesses found:** Hash enforcement/evidence, reviewer permissions, discarded provider warnings, empty audio, missing audit details, incomplete lease binding and incomplete policy handling. See the severity table.
2. **Critical issue:** A01, the direct-status approval-evidence gap. It required trusted database/code access; no public customer SQL bypass was identified.
3. **Exactly what changed:** Verified byte snapshots, shared eligibility, SQL evidence/integrity guards, immutable records, admin-only decisions, full expected category validation and conservative audio/policy handling, all with regression tests.
4. **Image checks:** Real type/extension/size, clean malware scan and bounded full decode. Actual sanitized pixels go to safety and platform-policy checks; filenames/descriptions are not evidence.
5. **Eight-second video checks:** Validate duration/dimensions/streams/codecs; fully decode; sample throughout at the configured interval plus scene changes; validate gaps/end coverage; classify distinct frames and audio text.
6. **Short frames:** Scene extraction supplements interval sampling. Any detected confident hard violation rejects the video. A synthetic flash test verifies this extraction case, not every possible flash or model detection.
7. **Visible text:** Vision extracts readable text; separate text classifiers assess it. Incomplete/unreadable results hold. Embedded instructions are untrusted data.
8. **Audio:** Extract mono WAV, transcribe and classify text. Errors or empty transcripts with an audio track hold. No track is acceptable. Transcription cannot establish music rights or identify every non-speech sound.
9. **Uncertainty:** Manual review, blocked until an eligible administrator decision. Critical restricted content is never previewed/exported/approved.
10. **Provider outage:** A hold, never approval. Database failure leaves an uncommitted blocked job; retries are fenced. Orphaned/missing jobs remain blocked and require operator attention.
11. **Payment:** It has a separate state/timestamp. It neither approves a creative nor creates evidence; later transitions recheck safety.
12. **Replacement:** New bytes get a new asset/version/job; the campaign pointer and business approvals reset. Old jobs cannot move the pointer back.
13. **File changes:** Identity metadata cannot normally be edited. Source/preview hashes are rechecked at safety boundaries; missing/changed bytes block dispatch and revoke eligibility. A compromised host remains outside this guarantee.
14. **Manual review:** Staff inspect permitted private previews. An administrator reviews the complete creative/context and records a reasoned decision. Missing security, technical, restricted, expired or purged media cannot be waived into approval.
15. **Overrides:** API/service/transaction role checks, disabled-account enforcement, origin/rate controls, optimistic revision, byte verification and atomic append-only evidence; original AI evidence remains intact.
16. **Remaining risks:** Model/OCR/audio/sampling misses, human mistakes/malicious privileged staff, vulnerable decoders, configuration/storage/backup mistakes and an external player not yet built. Passing tests do not remove these risks.
17. **Before launch:** Configure/evaluate the real provider and scanner; install maintained decoders; isolate workers; enforce ACLs/TLS/proxy limits; protect staff accounts/MFA; define monitoring, appeals, human/legal review, privacy/retention/backups. Connect operational services separately. See `PRODUCTION.md`.

## Sources and Deployment Limits

Exact command results and browser coverage are in `VERIFICATION.md`. Test accounts/databases are isolated and deleted. The adapter contract was checked against [OpenAI's moderation documentation](https://developers.openai.com/api/docs/guides/moderation): flags and scores are separate signals, and some categories are text-only. A zero image-only score for such a category is not safety evidence; the separate vision-policy check remains necessary.

No public hosting/CDN configuration was available to audit. Local media is outside served directories; deployment must preserve that separation. The bundled old Windows FFmpeg/FFprobe binaries are test helpers, not approved production decoders. Maintained decoders, real scanner/provider evaluation and an independent security review remain release blockers. Legal interpretation, rights and regulated advertising require qualified human/legal review.

Evidence tables are now append-only under normal application SQL. Define controlled audited retention/pseudonymization and backup expiry before launch; do not casually remove triggers. Deploy web/worker together. Existing approvals without matching evidence are held, not backfilled as trusted approvals. Monitor stuck jobs, scanner/provider health, repeated failures, volume/CPU/memory, staff access and model drift.
