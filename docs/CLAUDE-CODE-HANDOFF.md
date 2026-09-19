# PanoVision Local Source Handoff

## The Folder To Open

**C:\Users\Owner\PanoVision**

This is the existing, full editable Next.js project. It already lives in a normal local folder outside OneDrive. No source export, move, static-site conversion, dependency copy or website redesign is needed.

Do not confuse it with:

- `C:\Users\Owner\OneDrive\Documents\ChatGPT\PanoMedia`: an older workspace location, not the authoritative project.
- `C:\Users\Owner\PanoVisionPreview`: a separate frontend-only public preview, not the full authenticated application.
- `.next`, `out` or a hosted URL: generated output or a running website, not the original development source.

## Editable Source Inventory

| What you need | Where it is |
| --- | --- |
| Dependencies and reproducible versions | `package.json`, `package-lock.json` |
| Pages, layouts and backend API routes | `app/`, including `app/api/` |
| Reusable interface components | `components/` |
| Website styles | `app/globals.css`, `app/platform.css` |
| Next.js, TypeScript, lint and CSS configuration | `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs` |
| Business/pricing and moderation configuration | `lib/company.ts`, `config/` |
| English, French and Arabic | `messages/en.json`, `messages/fr.json`, `messages/ar.json`, `i18n/request.ts` |
| Map geometry, city coordinates and future inventory | `data/lebanon-map.json`, `data/locations.ts`, `public/maps/` |
| Campaign forms, preview, selection and pricing | `components/campaign/`, `lib/selection.ts`, `lib/pricing.ts`, campaign API routes |
| Accounts, database schema and private backend | `lib/server/`, account/dashboard pages and API routes |
| Moderation and media processing | `lib/moderation/`, `lib/media/`, `components/moderation/`, admin routes, `scripts/moderation-worker.ts` |
| All image assets used by the website | `public/brand/`, `public/images/`; the original supplied logo PNG is included |
| Tests, tooling and operational guides | `tests/`, `scripts/`, `docs/`, `README.md` |
| Existing coding-agent instructions | `AGENTS.md`, `CLAUDE.md` |

Asset provenance is in `docs/ASSETS.md`. Some provenance paths identify historical input files outside the project, but running/building the website does not require those external files: its used images and map data are local. Font packages are installed from the lockfile.

## Git And Secrets

At the start of this handoff, this folder had no Git repository or prior tracked history. The checkpoint is named **PanoVision website before Claude Code handoff**. No Git remote is added and nothing is uploaded or published as part of this handoff.

No author identity was configured on this machine. The checkpoint uses the explicit, neutral one-commit identity `PanoVision checkpoint <checkpoint@panovision.invalid>`. This is not a real mailbox or a claim about your identity. Global and repository author settings are left unchanged. You may choose your own Git author details before future commits.

`.gitignore` excludes dependencies, build output, real environment files, private databases/uploads/backups, logs, test output and the machine-local bundled npm CLI. Existing ignored files stay on this computer; they are not deleted or included in the checkpoint. `.env.example` is intentionally included and contains safe defaults and empty credential fields, not working passwords or API keys.

The private `.env.local` and `.private` directory are not development source. Keep them private. A Git checkpoint backs up source, not private customer data; use the separate database backup procedures for that data. Git ignore rules prevent normal commits, but are not a security boundary that stops another local program or coding agent from reading files. Do not paste secrets into prompts or upload the entire folder indiscriminately.

## Open The Same Folder With Claude Code

1. Open **Windows Terminal** or **PowerShell** from the Start menu.
2. Check whether Claude Code is available:

```powershell
claude --version
```

3. If the command is not recognized, follow [Anthropic's official Windows installation instructions](https://code.claude.com/docs/en/setup). One documented option is `winget install Anthropic.ClaudeCode`. Reopen your terminal after installation. This handoff does not install Claude Code or sign into a Claude account.
4. Start Claude Code in this exact project folder:

```powershell
Set-Location 'C:\Users\Owner\PanoVision'
claude
```

5. Follow Claude's sign-in prompts, and review any folder-trust or permissions prompts. Confirm the displayed working directory is `C:\Users\Owner\PanoVision`. Starting the CLI inside the project directory is the workflow in the [official quickstart](https://code.claude.com/docs/en/quickstart).
6. A suitable first message is:

> Read AGENTS.md, CLAUDE.md and docs/CLAUDE-CODE-HANDOFF.md. This is the existing PanoVision project. First explain its structure without editing files. Do not change the design, functionality or moderation security unless I explicitly ask. Do not read or reveal .env.local, private campaign files or credentials.

You do not need to export or upload the source to Claude Code. It works in this same local folder. Avoid having two coding agents edit the same files at the same time; finish one set of changes and check Git status before switching agents.

## Reproduce On Another Computer

The project requires **Node.js 24**, as declared in `package.json`, and npm. A normal Node installation provides npm; the ignored `package/` directory is only this machine's fallback npm CLI. A fresh source checkout uses the lockfile:

```powershell
npm ci
```

Run that only in a new checkout or when deliberately replacing dependencies. There is no reason to reinstall or copy `node_modules` just to open the existing project with Claude Code. The handoff does not change `package.json`, the lockfile or installed dependencies.

For a new checkout only, create its private `.env.local` from `.env.example`, then configure actual values locally. Do not overwrite this computer's existing `.env.local`. Use a free development port and an exactly matching `PANO_APP_ORIGIN`. The current main preview was served on 4177; coordinate with its owner before starting development or rebuilding because `.next` is shared.

Media moderation additionally needs a separate worker and configured trusted media tools/scanner/provider. See `docs/PRODUCTION.md` before using real customer uploads. Missing integrations must remain safely blocked. A reproducible source checkout is not a claim that external services are configured or the business is ready for production.

## Check Your Work Later

```powershell
git status
git log -1 --oneline
git diff
```

`git status` shows changes since the last checkpoint. Ask an agent to explain a diff before accepting a large edit. Do not use destructive reset/clean commands to recover work without first reviewing what would be lost.
