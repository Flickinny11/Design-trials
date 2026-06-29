# Local git + Vercel — "accurate until it's time to deploy"

This is the **local-only** loop. Nothing here touches the cloud. When it's time to
go live, flip the one switch noted at the bottom.

## What's pinned

`vercel.json` captures the **real** production deployment settings so a future cloud
deploy behaves exactly like local:

| Setting          | Value         | Why                                                                 |
|------------------|---------------|---------------------------------------------------------------------|
| `framework`      | `nextjs`      | Use Vercel's Next.js build pipeline.                                 |
| `buildCommand`   | `next build`  | Production runs `next build`, **not** `npm run build`. The heavy `build:prism` prebuild is skipped in the cloud; the prebuilt `public/prism-assets/mock-app.prism` ships in git and is served statically. |
| `installCommand` | `npm install` | Picks up `.npmrc` (`legacy-peer-deps=true`).                        |
| `git.deploymentEnabled` | `false` | **The "until it's time" switch.** Disables auto-deploy on git push. |

> Secrets (`.env.local`, `.vercel/`) are already gitignored — they never get committed.

## Save / revert (local git, no remote push)

The repo lives at `Design-trials/` (this app is a subfolder). Current branch:
`prism-editor-build`. Commits stay **local** — nothing is pushed to GitHub.

```bash
# from anywhere inside the repo
git add -A                       # stage everything (or name files)
git commit -m "checkpoint: <what changed>"   # SAVE a restore point

git log --oneline -10            # list restore points
git restore .                    # REVERT unstaged changes back to last commit
git reset --hard <commit-sha>    # REVERT the whole tree to an earlier commit
git revert <commit-sha>          # undo one commit, keeping history
```

## Prove it will deploy (local, no cloud)

Run exactly what Vercel runs in production. Green here == it will build in the cloud.

```bash
cd Design-trials/kid-kode-landing
npx next build        # production compile — must end with "✓ Compiled successfully"
# optional: serve the production build locally to click around
npx next start        # http://localhost:3000
```

Last verified: `next build` exit 0, 28/28 pages generated, all 13 API routes bundled.

## When it's time to deploy (do these intentionally — not before)

1. In `vercel.json`, set `git.deploymentEnabled` to `true` (or remove the `git` block).
2. `vercel pull` then `vercel build` to mirror the cloud build with project env, or
   `vercel deploy --prebuilt` / push to the connected branch.

Until then: commit locally, run `npx next build` to stay deploy-ready.
