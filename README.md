# PanoVision

WHERE BRANDS GET SEEN.

PanoVision is developing a roadside digital advertising network in Lebanon. The business is in pilot planning. No confirmed screen locations, customers, station partnerships, prices or audience statistics are published here. City markers are geographic context, not operating screens.

## Start Here

The working project is **`C:/Users/Owner/PanoVision`**. It was moved out of OneDrive after filesystem errors. Open and run this copy; the old OneDrive project is not the working directory. Keep the database, uploads and development output off synced/network folders.

| Guide | Contents |
| --- | --- |
| [Main website platform update](docs/PLATFORM-GUIDE.md) | Current 28-question guide: map, accounts, languages, estimates, creative previews and honest integration status |
| [Platform verification](docs/PLATFORM-VERIFICATION.md) | Current tests, responsive/language checks and production limitations |
| [Future screen integration](docs/SCREEN-INTEGRATION.md) | Real playback evidence, private attachments, quote/completion models and device integration contract |
| [Website guide](docs/WEBSITE-GUIDE.md) | All 23 beginner handoff questions: running, editing, locations, forms and deployment |
| [Moderation guide](docs/MODERATION-GUIDE.md) | All 21 beginner moderation questions, decisions, policy changes and review |
| [Production guide](docs/PRODUCTION.md) | Configuration, worker, admin provisioning, security, retention, backups and remaining work |
| [Assets](docs/ASSETS.md) | Official logo, generated concept, map sources, coordinates and attribution |
| [Safety audit](docs/SAFETY-AUDIT.md) | Severity-rated findings, fixes, checklist and 17 plain-language answers |
| [Earlier verification](docs/VERIFICATION.md) | Historical 176-test moderation baseline; superseded for platform additions by the current report |

## Current Status

The updated main website runs at **[http://127.0.0.1:4177/](http://127.0.0.1:4177/)** with an exact-origin override. Earlier preview processes on 4174 and 4175 remain untouched. Use 4177 for this build. These are local addresses, not public deployments.

The website and moderation pipeline are implemented locally. This is not a public or certified production deployment. Complete the configuration and launch checklist before accepting real customer creatives.

- The Next.js website and six-step campaign form are implemented. The campaign backend stores a draft when the visitor starts an upload, then stores creative files privately and records moderation jobs in SQLite.
- A final campaign request is stored on the server only after its current creative passes the required checks. **No email notification is sent.** A stored request is not a booking, quote, payment or broadcast.
- **The contact form is still a local draft.** Prepare message offers a download and an email-app link; the site itself does not deliver a message or store it on the server.
- Customer accounts and company-scoped dashboards are at `/login` and `/dashboard`. Signup/login/logout, private campaign access, profile and password updates are real. Email changes use current-password reauthentication and verification codes from both inboxes, and need SMTP configuration. Initial signup verification, password recovery, online payment and automatic proof-of-play still need integration.
- Credentials and a live malware scanner are not configured for this handoff. Uploads default to disabled, and the moderation provider defaults to disabled. No live OpenAI/scanner integration has been validated.
- Missing checks fail closed: the file cannot pass automatically. With uploads enabled and a worker running, a missing scanner/provider leads to manual review; without the worker, jobs stay queued. Human approval cannot bypass a missing security scan.
- The protected dashboard is at `/admin/moderation`, with sign-in at `/admin/login`. Provision staff using `admin:create`; there is no default account. The real worker is separate from the web server. Local uploads are enabled in `.env.local`, with missing services deliberately producing a hold.
- SQLite with Node 24 and a persistent private local volume supports this **single-host** design. It is not a scalable cloud-ready, serverless or multi-host deployment.

## Run Locally

The server is already running at the address above. After restarting the computer, use PowerShell to serve the existing verified build. Node 24 is required by the SQLite backend. This machine has a bundled runtime and project-local npm CLI:

```powershell
Set-Location 'C:/Users/Owner/PanoVision'
$node = 'C:/Users/Owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$env:PATH = (Split-Path $node) + ';' + $env:PATH
$env:PANO_APP_ORIGIN='http://127.0.0.1:4177'
& $node package/bin/npm-cli.js run start -- --hostname 127.0.0.1 --port 4177
```

Open [the main website](http://127.0.0.1:4177/). Press **Ctrl+C** in its terminal to stop that process. If the server is already running, use it instead of starting another on the same port. The separate moderation worker must also run for queued uploads to be checked; see the production guide. Serving the website alone does not process the queue.

For development, use a free port, set `PANO_APP_ORIGIN` to exactly match it, and replace `start` with `dev`. Coordinate any rebuild/development session with the owner of the running preview because `.next` is shared. Use one hostname consistently: `localhost` and `127.0.0.1` are different origins for cookies and request checks.

For a fresh dependency installation, use `node package/bin/npm-cli.js ci` with the committed lockfile. See the [website guide](docs/WEBSITE-GUIDE.md) for the meaning of installation and development commands.

## Commands

Throughout the guides, `npm run ...` means `node package/bin/npm-cli.js run ...` on this machine.

| Command | Purpose / status |
| --- | --- |
| `npm run dev` | Development server; choose a free port and matching `PANO_APP_ORIGIN` |
| `npm run test` | Policy, database, media, provider, API and form tests with safe synthetic fixtures |
| `npm run typecheck` | TypeScript consistency check |
| `npm run lint` | Source checks |
| `npm run build` | Production compilation; does not deploy |
| `npm run start` | Serve an existing production build; the current local main site uses port 4177 |
| `npm run worker` | Background moderation queue and retention worker |
| `npm run admin:create` | Trusted staff provisioning: username via arguments, password via temporary `PANO_ADMIN_PASSWORD`, role `admin` or `reviewer` |
| `npm run prepare:map` | Re-download and compile geography; intentionally changes map files |

Do not run a build in this directory while another process is building or serving development output from the same `.next` directory. Coordinate server changes with whoever owns the running preview.

## Project Map

| Path | Responsibility |
| --- | --- |
| `app/`, `components/` | Pages and visitor interfaces |
| `lib/company.ts` | Public company details and image paths |
| `data/locations.ts` | Verified future screen locations; currently empty |
| `data/lebanon-map.json`, `public/maps/` | Compiled map and original geographic sources |
| `config/moderation-policy.ts` | PanoVision advertising rules |
| `lib/moderation/` | Provider adapter, policy decisions and job processing |
| `lib/media/` | Private upload storage, validation, scanner and media extraction |
| `lib/server/`, `app/api/` | Configuration, sessions, SQLite and protected requests |
| `scripts/moderation-worker.ts` | Separate queue worker and media cleanup |

Before accepting real confidential creatives, complete the [production checklist and omissions register](docs/PRODUCTION.md). Privacy and terms remain drafts requiring professional review.
