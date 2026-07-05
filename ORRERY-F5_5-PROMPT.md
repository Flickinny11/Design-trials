# ORRERY No.7 — F5.5 POLISH (autonomous chain phase 1)

You are the autonomous ORRERY build agent. Repo: `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing`, branch `prism-editor-build`. Operator is non-technical, pre-authorized all ops (`bypassPermissions`), and is NOT watching — do not ask questions, do not stop for "go". Commit + push at every verified wave. When fully done, print the completion marker (see end).

## IF RESUMING (session was interrupted)
First run `cd /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing && git log --oneline -8`. If you see `AUTO-CKPT: F5.5 ...` commits, those targets are DONE — audit the repo, skip them, and continue from the first incomplete target. If `notes/ORRERY-F5_5-REPORT.md` exists with the marker, the phase is complete — just re-print the marker and stop.

## CONTEXT
F5.0–F5.4 shipped: 11-layer Atelier configurator (tap/drag/physics/constraints/price/save), 7 photoreal dial+strap textures, sapphire crystal + liquid-glass panel + ≤2 transmission guard, Arrival hero watch. Full spec: `docs/prism/ORRERY-NO7-PROTOTYPE-SPEC.md` (read §9 success criteria + §10 plan).

## CRITICAL RULES
1. Graph is the app — author in `public/prism-mock/home/live-graph.json` (flat top-level `nodes[]`, each with `parentHubId`).
2. TSL only (`MeshPhysicalNodeMaterial`); MSDF text only (no `THREE.TextGeometry`, no DOM text); synchronous `createNode`; no client secrets; allowlist before any new import (`.claude/hooks/dependency-allowlist-check.py`).
3. One scene, three view modes: `galaxy | canvas | preview-app`.
4. NEVER leave a test fixture (e.g. a `broken-url` codeRef) in `live-graph.json` — revert any injected test value before committing.
5. Zero console errors is the bar.

## VERIFICATION PROTOCOL (mandatory — this is how prior false-passes happened)
Use Playwright MCP (`mcp__playwright__browser_*`), NOT KripVerify.
- **Always force a fresh graph load before asserting**, because a long-lived browser session caches a stale graph and full reloads may not refresh it:
  ```js
  await window.__PRISM_DEBUG_STORES__.graphSource.getState().loadFromUrl('/prism-mock/home/live-graph.json');
  await new Promise(r=>setTimeout(r,2500));
  ```
- Navigate hubs via `window.__PRISM_EDITOR_PREVIEW_APP_NAV__.goTo('s1-arrival' | 's6-atelier' | ...)`.
- Take a SCREENSHOT and actually look at it. "Object exists in scene graph" is NOT proof it renders — confirm the pixels.
- Store handles: `window.__PRISM_DEBUG_STORES__.configurator|graphSource`, `window.__PRISM_SCENE__`, `window.__PRISM_TRANSMISSION_COUNT__`, `window.__ATELIER_RAPIER_READY__`.
- Dev server: `http://localhost:3000` (start with `npm run dev &` if `curl -s -o /dev/null -w '%{http_code}'` ≠ 200).

## THIS PHASE — three targets

### Target 1 — Arrival hero watch loading placeholder
On a cold load of `s1-arrival`, the hero watch node `orr-arrival-watch` (renderMode `mesh`, `meshUrl: /prism-mock/orrery/meshes/watch.glb`) shows a **plain white 3.2×3.2 placeholder plane** (MeshStandardMaterial #ffffff) for several seconds while the 2.3MB GLB loads. This looks broken on the landing hub.
- Find the placeholder render in `src/lib/prism/runtime/factories/default-factory.ts` (the `renderMode === 'mesh'` + `node.meshUrl` branch ~line 447).
- Replace the jarring white plane with a non-jarring loading state: a dark near-black disc/card matched to the hub backdrop, OR a low-poly proxy, OR a subtle shimmer — so the landing never flashes white. Keep it synchronous; swap to the GLB when `loadGLB` resolves (existing behavior).
- Verify: cold-load `s1-arrival`, screenshot within 1s of nav AND after full load — neither should show a bright white plane; the watch must still resolve to the photoreal `watch.glb`.

### Target 2 — Stale-graph-on-reload root cause
A full page reload sometimes loads an older graph (e.g. 290 nodes) instead of the current served file (292), only refreshing when `graphSource.loadFromUrl()` is forced. This made verification flaky and could affect real users.
- Investigate where the editor loads the graph at boot (`src/lib/prism-graph/loader.ts` `loadFromHomeHubFile`, and where GraphScene/page.tsx call it). Confirm `cache: 'no-store'` is honored end-to-end and the boot load isn't reading a module-cached/bundled snapshot.
- If it's a real cache bug, fix it so a fresh page load always reflects the current `live-graph.json`. If it's only a dev-HMR artifact of a long-running `next dev`, document that clearly in the report and confirm a fresh load is correct.

### Target 3 — Crystal + glass refinement (only if Targets 1–2 leave time)
Confirm (cold-load, forced graph reload) the sapphire crystal renders as a clean glass dome over the dial (`__PRISM_TRANSMISSION_COUNT__` === 1) and the Atelier panel reads as frosted glass. If the dome's edge looks harsh or the panel reads flat, refine the material (rim fresnel, slightly higher clearcoat) — but do not exceed the ≤2 transmission budget.

## DELIVERABLE
Write `kid-kode-landing/notes/ORRERY-F5_5-REPORT.md` with: per-target PASS/FAIL + screenshot evidence paths under `notes/verification/orrery-f55/`, what changed, console-error count, and honest flags. Commit each target as `AUTO-CKPT: F5.5 <target>` and `git push origin prism-editor-build`. Append one line per target to `kid-kode-landing/notes/ORRERY-ATELIER-PROGRESS.md`.

## ANTI-STUCK
After 2 failed attempts on the same thing: web-search / `mcp__context7__query-docs` the current correct approach, root-cause, retry. Never downgrade a dependency.

## COMPLETION MARKER (print this EXACT line as the very last thing, only after the report is written, committed, and pushed):
ORRERY-F5.5: RUN COMPLETE
