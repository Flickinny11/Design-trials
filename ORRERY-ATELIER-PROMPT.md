# ORRERY No.7 — Atelier Build Agent — F5.4 Sapphire Crystal + Liquid Glass + Arrival Watch Fix

You are the autonomous ORRERY No.7 build agent. Read this entire prompt before doing anything.

## WHO + WHAT

**Project:** ORRERY No.7 luxury watchmaker app — the centerpiece demo proving Kriptik's Prism editor builds real, shippable 3D apps. Repo: `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing`, branch `prism-editor-build`.

**Logan is the founder, non-technical.** Pre-authorized ALL operations (`bypassPermissions`). He runs `check`/`go` at phase gates. Do NOT ask him mid-run. Commit at every verified wave boundary with prefix `AUTO-CKPT:`. Push to `prism-editor-build` after every commit.

**Shipped + verified (F5.0–F5.3) — do NOT redo:**
- 11-layer Atelier configurator (hub `s6-atelier`, 79 nodes): tap-to-apply live material swap, drag-drop + Rapier physics, constraint CPQ, live price/summary MSDF, save/restore.
- 7 fal dial/strap textures rendering live on tap (guilloché/meteorite/aventurine/solarized/enamel/alligator/rubber).
- Configurator store exposed at `window.__PRISM_DEBUG_STORES__.configurator.getState()` → `{build, activeLayer, lastReason, rev, setLayer, serialize, restore}`.
- fal spend: $1.035 of $40 cap.

**What you build this run (F5.4):**
1. **Wave 1 (P1):** Sapphire crystal over the watch + liquid-glass Atelier panel, with a hard transmission-render counter (≤2).
2. **Wave 2 (P2):** Fix the Arrival hub hero watch (currently renders as a blank white placeholder plane — make it render the real `watch.glb` mesh correctly).
3. **Wave 3 (P3):** Verification pass for the new SC + report.

---

## CRITICAL RULES (do not deviate)

1. **Graph is the app.** Every surface = Prism nodes in `public/prism-mock/home/live-graph.json`. No DOM UI for 3D.
2. **TSL only.** `MeshPhysicalNodeMaterial` for PBR/glass; TSL uniform nodes for live swaps. No raw GLSL.
3. **MSDF text only.** No `THREE.TextGeometry`, no DOM text overlays.
4. **Synchronous `createNode`.** Async loading happens inside via `ctx.glbLoader`/`ctx.textureLoader` (cached).
5. **No client secrets.** Capability refs only in graph data.
6. **Allowlist before import.** Check `.claude/hooks/dependency-allowlist-check.py` before any new `npm install`.
7. **Verification is mandatory.** Never claim PASS without screenshot / JS-eval evidence via Playwright MCP (`mcp__playwright__browser_*`). Drive the actual app. "I wired it" ≠ "it works." Screenshot the RENDERED result, not just structural assertions.
8. **No KripVerify** (crashes the machine). Playwright MCP only.
9. **Model for any subagents:** `model: "opus"` (Fable 5 unavailable).
10. **One scene, three modes:** `galaxy | canvas | preview-app` only.
11. **Do NOT leave test fixtures in `live-graph.json`.** If you inject a broken value to test error handling, REVERT it before committing. (A `broken-url.invalid` codeRef was left in the working tree last run — don't repeat that.)
12. **No console errors.** Zero is the bar.

---

## DEV SERVER

Serves on `http://localhost:3000`. Probably already running. Verify:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```
If not 200: `cd /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing && npm run dev & sleep 8`

Navigate to the Atelier in-app: `window.__PRISM_EDITOR_PREVIEW_APP_NAV__.goTo('s6-atelier')`. To Arrival: `goTo('s1-arrival')`.

---

## WAVE 1 (P1) — Sapphire Crystal + Liquid Glass

Spec reference: `docs/prism/ORRERY-NO7-PROTOTYPE-SPEC.md` §4 (Liquid Glass) + §10.2 (F5.4 plan) + SC-O10.

### P1.1 — Transmission counter guard (do this FIRST)

Before adding any glass, add a hard runtime counter so the budget is enforceable:
- In the render path (likely `src/components/editor/graph/GraphScene.tsx` or the scene root), expose `window.__PRISM_TRANSMISSION_COUNT__` = the number of materials currently on-screen with `transmission > 0` AND `transmission`-based screen rendering (true refraction, Path B).
- Add a guard: if a 3rd transmission material would render, log `console.warn('[PRISM] TRANSMISSION LIMIT: capped at 2')` and fall the extra surface back to a cheaper screen-space approximation (Path C) — do NOT hard-crash.
- The counter must be readable from Playwright for SC-O10.1.

### P1.2 — Sapphire crystal over the watch

The watch dial/case assembly is in hub `s6-atelier` (proxy parts `orr-atelier-watch-*`). Add a **crystal dome node** on top of the dial:
- New PrismNode in `live-graph.json` (id e.g. `orr-atelier-watch-crystal`), positioned just above the dial (z slightly in front of dial face, e.g. z≈0.56).
- `renderMode: 'mesh'` with `meshPrimitive` (a low-curvature dome/cylinder cap) OR a thin disc primitive.
- `materialSpec`: `MeshPhysicalNodeMaterial` params — `transmission: 0.95`, `ior: 1.76` (sapphire), `thickness: 0.08`, `roughness: 0.02`, `metalness: 0`, low `dispersion ~0.02`. The materialSpec system already supports these fields (transmission/ior/dispersion/clearcoat/thickness are in the schema).
- Goal: objects behind the crystal (dial, hands) visibly refract — reads as a real lens, NOT a blur.

### P1.3 — Liquid-glass Atelier panel (Path C, no 2nd transmission render)

The right-hand "YOUR ORRERY / price / SAVE / RESET" panel area: give it a frosted-glass chrome surface using **screen-space UV displacement** (Path C), NOT a second transmission render. Solid tint behind the MSDF labels for legibility. This must NOT increment `__PRISM_TRANSMISSION_COUNT__`.

### P1.4 — P1 verification

1. Navigate to Atelier, screenshot — crystal must show visible refraction of the dial/hands beneath it (SC-O10.2).
2. `evaluate(() => window.__PRISM_TRANSMISSION_COUNT__)` ≤ 2 with crystal + panel both visible (SC-O10.1).
3. Console: 0 errors.

**P1 commit:** `AUTO-CKPT: F5.4 P1 — sapphire crystal + liquid-glass panel + transmission guard`

---

## WAVE 2 (P2) — Arrival Hero Watch Fix

**The problem:** Navigate to `s1-arrival`. The hero watch (`orr-arrival-watch` node) renders as a large blank white tilted PLANE with a loading spinner, instead of the photoreal watch. This is the landing hub of a "shippable" app — it must not show a blank plane.

**What's known:**
- The node `orr-arrival-watch` in `live-graph.json` is `renderMode: 'mesh'`, `meshUrl: '/prism-mock/orrery/meshes/watch.glb'`, `codeRef: ''`.
- `watch.glb` EXISTS at `public/prism-mock/orrery/meshes/watch.glb` (2.3MB, valid).
- The mesh-load path EXISTS in `src/lib/prism/runtime/factories/default-factory.ts` (the `renderMode === 'mesh'` branch ~line 385; the `node.meshUrl` sub-branch ~line 447 calls `ctx.glbLoader.loadGLB(node.meshUrl)`).

**Your job — diagnose then fix:**
1. Load `s1-arrival`, open DevTools via Playwright. Check the Network tab — is `watch.glb` requested? Does it 200 or 404?
2. Check console for GLB-load or KTX2/Draco errors.
3. Determine the root cause:
   - If the white plane is a DIFFERENT node (backdrop/image) occluding the watch → fix z-order or the occluding node.
   - If watch.glb loads but renders white/untextured → the GLB needs a material applied (give it a steel `materialSpec`) or it's unlit.
   - If watch.glb does NOT load → trace why the mesh branch isn't firing (renderMode resolution, loader wiring) and fix it.
4. The fix must make the Arrival hub show a recognizable photoreal/steel watch (or, if watch.glb is genuinely unusable, swap to a working asset and document why).

**ANTI-STUCK:** After 2 failed attempts, web-search the current correct approach (`WebSearch` / `mcp__context7__query-docs` for three.js GLTFLoader/WebGPU). Never downgrade a dependency.

**P2 verification:** Navigate to `s1-arrival`, screenshot — must show a real watch, not a blank plane. Console 0 errors.

**P2 commit:** `AUTO-CKPT: F5.4 P2 — Arrival hero watch renders watch.glb (no more blank plane)`

---

## WAVE 3 (P3) — Verification Pass + Report

Re-run the F5.3 regression checks (configurator still works) PLUS the new F5.4 SC. Use `window.__PRISM_DEBUG_STORES__.configurator` for store assertions.

**Checks:**
- SC-O10.1 `__PRISM_TRANSMISSION_COUNT__` ≤ 2 — PASS/FAIL + value
- SC-O10.2 crystal refraction visible — screenshot + advocate judgment
- SC-O10.3 panel glass doesn't add a transmission render — value with panel only
- Arrival watch renders (not blank plane) — screenshot
- Regression: tap guilloché dial → texture still applies; price updates; constraint CPQ still blocks moonphase under manual movement; serialize/restore round-trips — all via the configurator store
- INV greps: no TextGeometry, no pixi, no secrets in live-graph, no hub-world/preview-hub literals, no leftover `broken-url` test fixtures
- Console 0 errors on both Atelier and Arrival hubs

**Write `notes/ORRERY-ATELIER-REPORT.md`** (OVERWRITE the F5.3 one) with the SC table, PASS/FAIL summary, blockers, honest flags, and fal ledger.

**P3 commit:** `AUTO-CKPT: F5.4 P3 — verification pass + report`

---

## LEDGER

Append one line per wave to `kid-kode-landing/notes/ORRERY-ATELIER-PROGRESS.md`:
```
[DATE] F5.4 P1 START — crystal + glass + transmission guard
[DATE] F5.4 P1 DONE — commit abc1234
...
```

When `notes/ORRERY-ATELIER-REPORT.md` is overwritten with the F5.4 results and committed, your run is COMPLETE. The sentinel detects completion and notifies Logan.

---

## ENVIRONMENT NOTES

- Node v24, Three r184 (`three/webgpu`, TSL), dev server `:3000`
- Git branch `prism-editor-build`, push after each commit
- Playwright MCP for all browser verification (NOT KripVerify)
- fal: key in `.env.local` as `FAL_KEY` — never print/commit; $38.97 remaining of $40 cap; ledger `notes/.atelier-provisioning.json` (you likely need NO new fal spend for F5.4 — crystal is a node material, not an asset)
- Materials: `materialSpec` schema already supports `transmission`/`ior`/`dispersion`/`clearcoat`/`thickness`/`iridescence`
- Store handles: `window.__PRISM_DEBUG_STORES__.configurator` (configurator), `.graphSource` (source graph), `window.__PRISM_EDITOR_PREVIEW_APP_NAV__.goTo(hubId)` (navigation), `window.__ATELIER_RAPIER_READY__` (physics ready)
