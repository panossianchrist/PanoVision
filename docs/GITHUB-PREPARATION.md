# Private GitHub Preparation

Project: `C:\Users\Owner\PanoVision`

Requested GitHub repository: **panovision**, **PRIVATE**. Local branch: **main**.

## Scope

This preparation changes only repository safety rules and documentation. Website code, design, images, translations, dependencies and runtime configuration remain unchanged. No public repository, publication, GitHub Pages deployment or history rewrite is authorized by this task.

The local source was already checkpointed in `05b01ea` (PanoVision website before Claude Code handoff). A new preparation commit records the additional ignore rules, reviewed scanner exception and this guide. No dependency installation or copy is needed.

## What Stays Out Of Git

`.gitignore` excludes `node_modules`, `.next`, `dist`, `out`, real `.env` files, `.private`, SQLite databases, logs, test output, machine-local tools, private-key/certificate files and common credential files such as `.npmrc`, `.netrc`, `.git-credentials`, `credentials.json` and service-account JSON files. Only the safe `.env.example` is tracked.

An ignore file protects matching paths, not secret text pasted into a source file. Before a future push, review `git status`, inspect the staged diff and run a secret scan. Do not force-add ignored secret files. Private GitHub visibility is not a substitute for keeping secrets out of Git.

## Secret Review

- Gitleaks 8.30.1 was obtained from the official release and the downloaded archive's SHA-256 digest was checked against GitHub's release metadata. The scanner and redacted reports stay in ignored `.tools/`.
- Scan the full reachable Git history with the command below, not only the latest working files.
- The initial scan identified one synthetic test password in `tests/customer-accounts.test.ts:35`. The file uses an isolated test database and synthetic accounts. `.gitleaksignore` excludes only the exact historical commit/file/rule/line fingerprint of that reviewed false positive. It does not disable a rule or exclude the test directory.
- A separate review checks historical filenames and compares credential values from the local environment against committed blobs without printing those values. No real environment file, private database or matching local credential was found in the initial history.
- A clean scan means no unreviewed findings were detected, not a guarantee against every possible secret. New edits must be reviewed again.

```powershell
.\.tools\gitleaks-8.30.1\gitleaks.exe git --log-opts="--all --full-history" --redact=100 --no-banner --no-color .
```

Scanner reference: [Gitleaks](https://github.com/gitleaks/gitleaks).

## GitHub Authorization Required

At preparation time, no GitHub integration was connected, the GitHub CLI was unavailable, Git Credential Manager listed no GitHub account, and no remote was configured for this project. Repository creation and pushing must wait for the user's GitHub authorization. Do not claim that a repository exists or was pushed until verified.

Install the GitHub integration offered in this conversation and follow its sign-in/authorization steps using the account that should own `panovision`. Do not paste a password, access token or recovery code into chat. Review requested permissions before granting them. Organization policies may require approval by an organization administrator.

After authorization, the publishing agent must:

1. Confirm the correct GitHub owner/account. If `panovision` already exists, inspect it instead of overwriting it. If it is public, stop and ask the user how to proceed; do not upload this project there.
2. Create `panovision` with **Private** visibility. Do not initialize a competing README, license or `.gitignore` on GitHub for this existing local project. Verify private visibility before pushing.
3. Set `origin` only to the verified repository URL, without embedding credentials.
4. Push `main` normally with upstream tracking. Never force-push or overwrite remote history.
5. Verify GitHub still reports private visibility and that remote `main` matches the full local commit SHA. Report the actual repository URL and push result only after verification.

GitHub reference: [Creating a new repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository).
