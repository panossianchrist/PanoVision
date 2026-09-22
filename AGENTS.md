## GitHub Delivery Workflow

The user requests that every completed website change be committed and pushed to
`https://github.com/panossianchrist/PanoVision.git` on `main`, unless they explicitly
ask to keep a change local or use a different delivery workflow.

- Run checks appropriate to the change, review the diff, and commit only the
  intended task files. Do not include unrelated work from the user or other agents.
- The repository is public. Keep secrets, local environment files, private runtime
  data, uploads, dependencies, and build output out of commits. Preserve the safe
  `.env.example`, `.gitignore`, and secret-scanning protections.
- Before pushing, fetch and inspect the remote state and scan the outgoing history
  for secrets. Use a normal push, never a force-push or destructive history rewrite.
- If authentication, permissions, conflicting changes, or a different active branch
  prevent a safe push to `main`, stop the upload and explain what is needed. Do not
  overwrite others' changes or claim that local-only work is on GitHub.
- Verify the remote commit matches the delivered local commit and report whether
  the push succeeded when finishing the task.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
