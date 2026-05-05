# Tests for the Prism Renderer Migration

Tests live here, mirroring `src/` layout. The migration uses TDD discipline
enforced by the Ralph loop's `/ralph-step` command.

## Discipline

1. Every Ralph task that touches runtime behavior requires a **failing test
   committed BEFORE implementation**. The `/ralph-step` step ordering enforces
   this: step 6 commits the failing test, step 7 implements, step 10 commits
   the implementation.
2. Tests committed first are **never edited during implementation**. If a test
   is wrong, the task definition was wrong — halt and revise the task in
   `notes/ralph-state.json`, don't paper over the test.
3. Test types:
   - **Unit** — `tests/unit/`. Pure-logic tests via `vitest` (or `node --test`
     for plain `.test.mjs`). No DOM, no canvas.
   - **Integration** — `tests/integration/`. R3F harness tests for hub manager,
     scene-root, loaders, primitives. Headless via `vitest` + `@react-three/test-renderer`.
   - **Browser** — `tests/browser/`. Playwright tests for Visual tab,
     Animation tab, full mock-app smoke. Run against `npm run dev` or a
     production build.
   - **Shader** — `tests/shaders/`. Render TSL shaders to an offscreen canvas
     and hash the output for visual regression. Use `vitest` with a WebGPU
     polyfill or run inside Playwright.

## Naming

```
tests/<area>/<task-id>.<scenario>.test.<ext>
```

- `task-id` matches the Ralph state's task id (e.g. `T03`, `T05`).
- `scenario` is a one-phrase description (`parallax-plane-renders-with-depth`).
- `ext` is `.test.ts`, `.test.tsx`, `.test.mjs` depending on the runner.

Examples:
- `tests/integration/T03.parallax-plane-renders-with-depth.test.ts`
- `tests/shaders/T03.dissolve-tsl-output-hash.test.mjs`
- `tests/browser/T07.editor-visual-tab-slider-feedback.spec.ts`

## Ralph enforces this

The `/ralph-step` command checks that for tasks where `tddRequired === true`:
- A failing test commit (prefix `test: <task-id>`) precedes the implementation
  commit by at least one commit, AND
- The implementation commit does not modify the test files committed in the
  preceding `test:` commit.

If either check fails, the iteration is rejected, `attemptCount` is bumped,
and the outer Ralph shell will retry the task in a fresh Claude process.

## Running tests

```bash
# Unit + integration + shader (vitest):
npx vitest run

# Browser:
npx playwright test

# Single test file:
npx vitest run tests/integration/T03.parallax-plane-renders-with-depth.test.ts
```

The renderer migration's verifier (Phase 4 / spec §10) runs as a separate
script and is wired into the Ralph state's per-task `verificationCommands[]`.
