---
description: Evidence-based two-layer verification of a Prism change against the canonical-3 success criteria (functional via Chrome DevTools MCP + vision via KripVerify/Claude-in-Chrome), then a fresh-context review. Replaces the retired Ralph verify loop.
argument-hint: "[criteria ids or surface, e.g. RT-SC-10 NE-SC-13 | galaxy camera]"
---

# /prism-verify — make a change real, then prove it

Prism renders its UI into a **WebGPU canvas**. DOM/selector testing cannot *see*
the built UI, so verification is **two layers** and **evidence-based**. "I added
it" is never done. A change is done only when the relevant canonical-3 numbered
criteria pass **with evidence** (screenshot / console output / scene-graph
assertion) and a fresh-context reviewer signs off.

> Model: run this from a **claude-opus-4-8** session (UI-selected; never opusplan).

## Inputs
- `$ARGUMENTS` — the criteria ids or surface under test. If empty, infer the
  surface from the diff and pull the matching ids from the canonical-3.
- Source of truth / rubric: the **numbered atomic success criteria** in
  `kid-kode-landing/docs/prism/PRISM-RUNTIME-SPEC.md` (RT-SC-*),
  `…/PRISM-NODE-EDITOR-SPEC.md` (NE-SC-*), `…/PRISM-CANVAS-EDITOR-SPEC.md` (§18),
  with `PRISM-INTENT-ANCHOR.md` as ruler and `docs/prism/SPEC-INDEX.md` for
  precedence. Open unmet items live in `notes/verification/unmet-criteria.json`.

## Loop

1. **Make the change** (or take the just-made diff). Keep it scoped to one surface.

2. **Load the app in real Chrome.** Prefer the KripVerify sandbox (it manages a
   dedicated Chrome-for-Testing + dev server):
   - `kv_dev_server_status` → if down, `kv_restart_dev_server`.
   - `kv_navigate(localUrl)` → `kv_wait_for(canvas)`.
   If KripVerify is unavailable, fall back to Chrome DevTools MCP
   (`npx chrome-devtools-mcp@latest`, Chrome 144+): `navigate_page` → `wait_for`.

3. **Layer (a) — functional (does it run clean + is the structure right?).**
   - Console: `kv_check_console(level='error')` (or DevTools `list_console_messages`).
     Any runtime error in scope = fail.
   - Network: `kv_check_network(status_min=400)`.
   - Structural assertions via `kv_evaluate` / DevTools `evaluate_script` against
     the live scene graph — e.g. for RT-SC-03 assert exactly one rendering
     `<canvas>` and no split-pane; for RT-SC-08 instrument `createNode` and assert
     0 calls on a pure mode toggle; for RT-SC-10 assert preview-app reuses canvas's
     mounted `THREE.Object3D` refs (no separate `PrismHost` mount).

4. **Layer (b) — vision + interaction (does it RENDER and FUNCTION like a user?).**
   - `kv_screenshot(full_page=true)` — **judge the look** against the criterion
     (is the artifact actually there, at the right place, not a sphere/stand-in?).
   - **Drive it like a user:** `kv_click` / `kv_type` / `kv_evaluate` (or
     Claude-in-Chrome) to toggle galaxy↔canvas↔preview-app, select a node, drag a
     handle, build a node — and screenshot the result. Confirm the behavior, not
     just the paint.
   - `kv_verify` for an end-to-end assertion when a single check captures the
     criterion.

5. **Grade against the criteria WITH EVIDENCE.** For each id in scope: pass /
   partial / fail, each backed by a screenshot path or console/assertion output.
   Save artifacts under `notes/verification/<surface-or-date>/`.

6. **On fail — edit + retry, applying the ANTI-STUCK RULE.** After ~2 failed fix
   attempts on the SAME criterion, STOP guessing: **web-search the current correct
   approach** (current versions/APIs as of today's real date), do root-cause
   analysis, then retry. **Never downgrade a dependency** or pick an older/easier
   API to make an error disappear (the dependency-allowlist guard blocks downgrades).

7. **Fresh-context review.** Hand the diff + the in-scope criteria to the
   **`prism-criteria-reviewer`** subagent (it sees only diff + criteria, reports
   gaps, never edits). MUST-FIX items block "done".

8. **Update the ledger.** Remove every criterion you closed *with evidence* from
   `notes/verification/unmet-criteria.json`; leave the rest. The non-blocking
   `spec-criteria-stop.sh` hook surfaces whatever remains.

## Done means
Every in-scope criterion passes with attached evidence **and** the reviewer
returns `pass`. Anything less stays `unmet`. Do not commit a criterion as met on
assertion alone.
