# Prism mock-app tests

Home for test files that Ralph writes **before** implementing each task. Test-first is a structural discipline enforced by `/ralph-step` (step 6 commits the failing test; step 7 implements; step 8 runs the test along with `verify:prism` and `browser-smoke`).

## What goes here

Two shapes of tests, both driven by `node`:

1. **Playwright browser tests** — for runtime criteria (§10.3, §10.4, §10.6, §10.11–§10.16, §10.20, §10.25). These drive headless Chromium against a production build of the Next.js app. Must start the server from `kid-kode-landing/` before driving the page.

2. **Node static check extensions** — for structural criteria that aren't yet covered by `kid-kode-landing/scripts/verify-prism.mjs`. Pure-node scripts that inspect source files, the `.prism` artifact contents, or `home-hub.json`. Prefer extending `verify-prism.mjs` over creating a new runner when possible.

## Layout

Mirror `kid-kode-landing/src/` under `tests/`:

```
tests/
├── README.md
├── lib/
│   └── prism/
│       ├── player/
│       │   └── scroll-viewport.test.mjs
│       └── mock-app-source/
│           └── nodes/
│               └── navbar-link.test.mjs
└── components/
    └── prism-player/
        └── prism-host.test.mjs
```

Each test file's entry point is `node tests/<path>` (importable) or is invoked directly by Playwright via `npx playwright test`.

## Test-first contract (enforced by Ralph)

Per-iteration discipline from `/ralph-step`:

- Step 6 writes a single failing test that captures the spec acceptance behavior. Commit message: `test: <task-id> — failing test for §<ref>`. Run it; confirm it fails.
- Step 7 implements the minimum code to make it pass.
- Step 8 runs three things — the new test, `npm run verify:prism`, and `node scripts/browser-smoke.mjs`. All three must pass before step 9 invokes the spec-reviewer.
- The failing test committed in step 6 must NOT be modified during steps 7–8. If the test itself is wrong, that's a separate task.

## Running locally

```
# From kid-kode-landing/
npm run build        # needed for Playwright tests (server runs against production bundle)
npm run start &      # start on PORT=4777 (match browser-smoke.mjs)
node ../tests/lib/prism/player/scroll-viewport.test.mjs
kill %1
```

Playwright is already installed (`kid-kode-landing/package.json` declares `playwright` and it's pulled in by `browser-smoke.mjs`). Use `import { chromium } from 'playwright'` from `node_modules`, not a global install.

## What NOT to put here

- Unit tests for business logic that already exists and passes (e.g. stable utility functions with no spec tie-in). This directory is for spec-anchored acceptance tests, not coverage.
- Snapshot tests of fal.ai output. Those are too flaky and too expensive.
- Tests that mutate `public/prism-assets/`. Treat the baked artifact as read-only.
