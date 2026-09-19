# Creative Moderation: Beginner Guide

This guide answers the 21 questions in your moderation brief. The website has been extended, not rebuilt for this feature. Files mentioned below are inside `C:/Users/Owner/PanoVision`.

## 1. What Does It Do?

It keeps uploaded advertisements private, checks the file, evaluates visual and text content, and produces exactly one primary decision: approved, rejected, or manual review. It never treats a completed upload as approval. A separate business workflow controls availability, specifications, quotes, payment and scheduling. AI is not a legal authority and can make mistakes.

## 2. What Happens to an Image?

The browser creates a campaign draft, uploads the file to private storage, and receives a creative ID. A background worker checks its actual file type, extension and size, invokes a malware scanner, decodes the image and checks dimensions. It sends a sanitized image to the configured visual classifiers, inspects visible advertisement text, and applies PanoVision's rules. Results are saved in the database; the browser refreshes the status without waiting on one long request.

## 3. What Happens to an Eight-Second Video?

After private upload and scanning, FFprobe checks the container, codecs, streams, resolution, frame rate and duration. FFmpeg decodes the complete clip, extracts frequent frames and scene changes, and extracts audio when present. Frames, visible text and transcribed speech are checked. One clear prohibited frame rejects the whole clip; safe frames cannot average it away. A video outside 8 seconds plus/minus 0.25 seconds receives a technical rejection.

## 4. What Does Approved Mean?

The creative passed the configured content check, or an authorized administrator recorded an allowed override. It may proceed to campaign review. It is not legal approval, a guarantee that every issue was detected, a confirmed booking or authorization to broadcast. Security checks, the exact reviewed bytes, current creative version and policy version must still be valid.

## 5. What Does Rejected Mean?

A configured content rule or a technical requirement was not met. These are stored separately. Customers receive restrained wording, never model scores, provider JSON or a declaration that they broke the law. They may upload a replacement without creating a new campaign.

## 6. What Does Manual Review Mean?

The creative is held. This happens for ambiguous advertising categories, uncertainty, unreadable text, or an unavailable/failed service. It cannot proceed or go live until a permitted human review is recorded. Missing malware/security validation cannot be bypassed by an administrator: fix the service and upload again.

## 7. Where Are the Rules?

`config/moderation-policy.ts` is the central rule configuration. Each category has an action, a description, a review threshold and a rejection threshold. Rules are separate from the provider code. `lib/moderation/decision-engine.ts` applies them; `lib/moderation/provider.ts` supplies model signals.

## 8. How Do I Change Manual Review to Rejection?

For example, after PanoVision approves the business policy, change the `ALCOHOL` rule's `action` from `"manual_review"` to `"reject"`. Keep an appropriate review threshold for uncertain cases. Ask a developer to run tests and review the change. Increment `policyVersion` or `PANO_MODERATION_POLICY_VERSION`, rebuild, and restart the web server and worker together. A fingerprint also changes automatically when rule contents change, preventing reuse of an old approval.

Do not change thresholds simply to make a troublesome file pass. Changes affect every future customer, not just one upload.

## 9. How Do I Add a New Category?

Add a unique uppercase code and a precise rule description to `moderationRules`. Start an uncertain category with manual review. The provider's structured output category list and instructions are derived from this configuration. A developer should add synthetic tests for the new category, evaluate the classifier on representative lawful advertising, version the policy and redeploy both processes. A new category does not become reliable merely because its name exists in the file.

## 10. Where Do I Configure the AI Provider?

Server environment variables, shown in `.env.example`. Set `MODERATION_PROVIDER=openai` and set `MODERATION_API_KEY` privately. The vision, safety and transcription model names are separately configurable. Restart both processes after changes. Local `.env.local` currently enables local uploads but leaves the provider disabled and the scanner unset. This deliberately demonstrates a held result, not working live AI.

## 11. Which Keys Must Remain Private?

All API keys, admin passwords, session cookies and future storage credentials. Never prefix a secret with `NEXT_PUBLIC_`; that prefix is for public browser configuration. Never put credentials in React components, screenshots, commits, public files or support messages. `.env.local`, private media, logs and test output are ignored by Git. Use a production secret manager and rotate compromised credentials.

## 12. How Are Frames Scanned?

`VIDEO_MODERATION_SAMPLE_INTERVAL_MS=500` requests a frame about every half-second, supplemented by scene changes. Eight seconds normally produces at least 16 representative frames. Timestamp and coverage checks reject incomplete extraction. Exact duplicate frames and identical extracted text are checked once. More than the configured frame cap results in review, not silent truncation. Sampling cannot guarantee detection of every fleeting detail; final business review remains necessary.

## 13. How Is Audio Checked?

FFmpeg extracts a mono 16 kHz WAV. The configured transcription service returns speech text, then the same policy classifiers review that text. No audio track is a valid condition. Extraction, transcription or classification errors hold the creative. An empty transcript from an audio-bearing clip also requires review; it is not proof of silence. Transcription does not establish rights to music, detect every sound, or guarantee language accuracy.

## 14. What If a Provider Is Unavailable?

The worker saves a manual-review result with an internal error code, or leaves a job processing if a database commit fails. It never approves on error. The browser explains that the automated check could not complete. Jobs have durable leases, fenced completion and bounded retries after worker interruption. Once services are repaired, customers can upload a new version for a fresh full check.

## 15. Where Are Results Stored?

By default, `.private/panovision.sqlite` contains campaigns, creative versions, moderation results, jobs, sessions, admin accounts, rate counters and audit events. Original media and temporary derived files are below `.private/media/`, never `public/`. `PANO_PRIVATE_DIR` changes the private root. Use an unsynced persistent local disk, not OneDrive or a public bucket.

The database stores category codes, bounded scores and request IDs for internal review, but not raw model responses, transcripts, extracted advertisement text or AI reasoning. Customer details remain in campaign records. Media retention does not remove these records; define a separate metadata and backup retention policy before launch.

## 16. How Do I Review a Flagged Creative?

First provision an account using the trusted server CLI described in [Production](PRODUCTION.md#worker-and-admin-commands). There is no default account or password. Sign in at `/admin/login`, then open `/admin/moderation`. Filter the queue and choose a creative. The detail view shows its company, version, original automated decision, current decision, policy, reason codes, media details and audit history. Eligible previews open only after an authorized request. Restricted critical content has no preview/export feature.

## 17. How Do I Override a Decision?

Review the entire creative, visible text, audio and relevant advertising context. Enter a specific reason of at least 10 characters. Confirm the review checkbox and choose Approve, or choose Reject / Request replacement. The API checks authorization, revision and security eligibility again. The audit records who acted, when, the previous decision, the new decision and the reason. The original automated result remains unchanged. A stale review must be refreshed. Technical, expired, purged, restricted or unscanned files cannot be approved through an override.

Only the `admin` role can override creative decisions or advance the business workflow. A `reviewer` can inspect permitted previews and history but cannot change decisions, confirm payment or schedule. Override evidence includes the exact file hash, policy version/fingerprint, revision, actor, reason and before/after decisions. Business review requires availability, screen specifications and quote confirmation; later steps require verified payment and scheduling. These are audited staff confirmations, not payment processing or a connection to physical displays.

## 18. How Do Customers Replace Rejected Creatives?

Choose Upload a different creative in the Creative step, select the replacement, then Upload & check creative. The same campaign receives a new version: V1, V2, V3, and so on. Earlier results remain in history. The newest upload becomes the current creative and clears prior business approvals. An approved V1 cannot be substituted for a pending V2 at submission.

## 19. What Is Safe for Me to Edit?

Verified public company details, normal marketing copy, approved images, and carefully reviewed policy descriptions. Change media retention periods only with an agreed business/privacy policy. Test edits locally and keep a source-control checkpoint. See [Website Guide](WEBSITE-GUIDE.md).

## 20. What Needs a Developer?

Authentication, database migrations/triggers, provider parsing, file paths, media commands, security scanning, thresholds, leases, deletion logic, limits and campaign gates. Do not remove a guard to unblock a campaign. Never manually move an upload into the public folder. Do not approve a critical restricted creative or invent reporting obligations: follow an established policy developed with qualified counsel.

## 21. What Is Needed Before Production?

An HTTPS domain, real contact information, reviewed privacy/terms, protected persistent storage, maintained FFmpeg/FFprobe and ClamAV, a funded provider account/key, evaluated policy/model behavior, a supervised worker, provisioned staff accounts, operational monitoring, tested backups and incident procedures. Add a reliable notification/contact-delivery channel and establish staffed review times. Reviewers need a documented process for rights, regulated ads, appeals and false positives. An independent deployment/security review is advisable for public uploads.

No real API key, live scanner, public hosting, payment service, email delivery or physical-display connection has been configured here. [Production](PRODUCTION.md) is the launch checklist.

## Provider References

- [OpenAI moderation](https://developers.openai.com/api/docs/guides/moderation): image/text safety signals have category and input-type limitations; they are not legal decisions.
- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs): the visual policy classifier requests a strict JSON schema and validates the result again server-side.
- [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text): audio transcription before text policy checks.
- [Data controls](https://developers.openai.com/api/docs/guides/your-data): verify account-specific retention and contractual settings. `store:false` does not mean zero provider retention.
