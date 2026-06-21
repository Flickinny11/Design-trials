# ORRERY No.7 — F7 RESPONSIVE + FALLBACK + PERF (autonomous chain phase 3)

You are the autonomous ORRERY build agent. Repo: `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing`, branch `prism-editor-build`. Operator non-technical, pre-authorized, NOT watching — never stop for "go". Commit + push per verified wave. Print the marker only when done + verified.

## IF RESUMING (session was interrupted)
Run `cd kid-kode-landing && git log --oneline -10`. `AUTO-CKPT: F7 ...` commits = done waves; audit, skip them, continue from the first incomplete wave. If `notes/ORRERY-F7-REPORT.md` exists with the marker, re-print the marker and stop.

## READ FIRST
- `docs/prism/ORRERY-NO7-PROTOTYPE-SPEC.md` §3.2 (responsive interaction), §9.7 (SC-O11 fallback) + §9.8 (SC-O13 perf), §10.4 (F7 plan).
- Same critical rules + verification protocol as F5.5/F6: graph-is-the-app, TSL only, MSDF text only, synchronous createNode, allowlist before import, 3 view modes, NO test fixtures in live-graph, zero console errors. Verify via Playwright MCP with a forced `graphSource.loadFromUrl()` + real screenshots + cold loads.

## THIS PHASE — make it usable on every device, never blank, and fast

Commit each wave:

1. **Breakpoints.** A `useBreakpoint()` hook → `xs(≤480) | sm(≤900) | lg(>900)`. Drive layout from it.
2. **Mobile Atelier (SC-O12).** At 375×812: hide the desktop side-rail, show a bottom-sheet catalog (in-scene MSDF/quad panel pinned to the lower viewport), one layer at a time, **tap-to-apply** (drag disabled on touch). Tapping a swatch still applies the material. Larger hit targets.
3. **Progressive fallback (SC-O11).** WebGPU detection via `navigator.gpu?.requestAdapter()`. If null → WebGL2 renderer path initializes (the runtime already supports WebGL2 fallback — confirm it engages). If BOTH fail → a static poster `<img>` (render one hero still to `public/orrery-poster.webp`) so the page is **never blank white**. Test by stubbing `navigator.gpu = undefined` and reloading.
4. **Perf (SC-O13).** Defer 3D init until after LCP: hook `web-vitals` `onLCP` → set `window.__LCP_TIME__`, set `window.__THREE_INIT_TIME__` at renderer init, assert init > LCP. Add `THREE.LOD` (full / 512 / proxy) to the heavy watch meshes; `IntersectionObserver`-gated dynamic `import()` for heavy per-region bundles. Target LCP ≤ 3000ms, 60fps on configurator interactions.

## VERIFY
Use Playwright MCP, force graph reload, cold loads, real screenshots:
- SC-O11.1 with `navigator.gpu` stubbed undefined → a WebGL2 `<canvas>` initializes (`document.querySelector('canvas').getContext('webgl2') !== null`) within 5s.
- SC-O11.2 with both renderers forced to fail → a non-white poster image is visible (screenshot at T+5s shows content).
- SC-O12.1/.2 at viewport 375×812 → bottom-sheet visible, side-rail hidden (screenshot); tapping a swatch updates `configurator.getState().build`.
- SC-O12.3 at 768×1024 → side-rail visible.
- SC-O13.1 `window.__LCP_TIME__` ≤ 3000; SC-O13.2 `__THREE_INIT_TIME__ > __LCP_TIME__`.
- Screenshots (mobile, tablet, webgl2-fallback, poster) under `notes/verification/orrery-f7/`. 0 console errors.

## DELIVERABLE
`kid-kode-landing/notes/ORRERY-F7-REPORT.md` — SC-O11/12/13 PASS/FAIL + evidence, what shipped, honest flags. Commit waves `AUTO-CKPT: F7 <wave>`, push each. Append to `notes/ORRERY-ATELIER-PROGRESS.md`.

## ANTI-STUCK
After 2 failed attempts: web-search / context7 the current approach (three/webgpu WebGL2 fallback, web-vitals, Lenis touch), root-cause, retry. Never downgrade a dependency. Ship what works and flag the rest OPEN rather than blocking.

## COMPLETION MARKER (print this EXACT line last, only after report written + committed + pushed):
ORRERY-F7: RUN COMPLETE
