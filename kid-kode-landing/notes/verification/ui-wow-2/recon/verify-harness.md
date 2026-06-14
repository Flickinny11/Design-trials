# Recon: verify-harness (real-app verification pipeline)

Surface: the Playwright/real-GPU capture + no-regression toolchain that grades every Prism
UI change. Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing`.
This note is the ready-to-use recipe for "launch + screenshot at 3 viewports on real GPU"
for the UI-WOW-2 run, plus the no-regression gates and where the design tokens live.

---

## 0. TL;DR — the copy-paste recipe

The canonical harness is **`scripts/ui-wow-capture.mjs`** (33 KB, last touched the night before
this recon). It boots its own `next dev`, launches **REAL headed Chrome with Metal WebGPU** (not
SwiftShader), drives the editor like a user, and writes DPR-2 frames + zoom crops + computed-font
dumps + a per-scene `_console-errors.json`. Extend it by adding a named async fn to `SCENE_FNS`.

```bash
# node is via nvm and NOT on the default PATH (which node → not found). Always:
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"   # or v22.22.1
cd /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing

# Owns its server (spawns `next dev -p 4920`, waits up to 120s for first compile):
node scripts/ui-wow-capture.mjs --scenes baseline-desktop,baseline-mobile --port 4920

# Reuse an already-running dev server (skips spawn; --base disables OWN_SERVER):
node scripts/ui-wow-capture.mjs --scenes typography --base http://localhost:4920
# scene name containing /mobile/i ⇒ mobile viewport auto-selected (see §2).
```

Evidence lands under `notes/verification/ui-wow/<scene>/` (override with `--out`). For UI-WOW-2,
point `--out notes/verification/ui-wow-2/<phase>` (the `before/`, `p0/`, `recon/` dirs already exist).

---

## 1. Real-GPU (Metal, not SwiftShader) Chrome launch recipe

`scripts/ui-wow-capture.mjs:37` and `:613`:

```js
const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'];
// ...
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: WEBGPU_ARGS });
```

Load-bearing facts:
- **`channel: 'chrome'`** drives the *installed* Google Chrome, not Playwright's bundled Chromium.
  Bundled Chromium falls back to SwiftShader (software) and produces lower-fidelity / sometimes
  black canvases. The catalog harness documents this explicitly
  (`scripts/verify-catalog-realgpu.mjs:4` — "standard verify runs headless ANGLE+swiftshader… this
  drives the REAL installed Chrome").
- **`headless: false`** (truly headed). Memory note `prism-runtime-render-path` / catalog runs
  confirm: real-GPU headed is *faster and higher fidelity* than SwiftShader headless.
- The perf probe (`scripts/ui-design-perf-probe.mjs:13`) uses a hybrid `--headless=new` +
  `--enable-unsafe-webgpu --enable-features=Vulkan` with `channel:'chrome'` — new-headless still
  reaches the real GPU and is fine for FPS/latency math, but for *look* judgement use the fully
  headed launch above.
- Fallback pattern (graceful degrade) — `scripts/prebuilt-library-advocate-capture.mjs:50`:
  ```js
  try { browser = await chromium.launch({ channel: 'chrome', headless: false, args: WEBGPU_ARGS }); }
  catch (e) { browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] }); /* note the fallback */ }
  ```
- **Verify the backend in-page** after load (don't assume):
  ```js
  const backend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown'); // expect 'webgpu'
  ```
  Set at `src/components/editor/graph/GraphScene.tsx:3099` from `renderer.backend.isWebGPUBackend`.
  Values: `'webgpu' | 'webgl2' | 'unknown'`. **`'webgl2'` means you fell back to SwiftShader/ANGLE —
  re-judge invalid.** Note INV-R14: `@react-three/postprocessing` EffectComposer is WebGL-only and is
  *skipped under WebGPU* (`GraphScene.tsx` `useIsWebGPU`), so postproc-dependent looks only appear on
  the WebGL2 fallback — don't author WOW that depends on the legacy EffectComposer.

---

## 2. Multi-viewport screenshots (desktop / mobile / constrained, DPR-2)

`runScene` (`ui-wow-capture.mjs:568-577`) creates a fresh context per scene; the viewport is chosen
by whether the scene name matches `/mobile/i` (`:619`, `const mobile = /mobile/i.test(name)`):

```js
const context = await browser.newContext(
  mobile
    ? { viewport: { width: 390,  height: 844  }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }  // mobile
    : { viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 },                                  // desktop DPR-2
);
```

Three established viewport presets across the harnesses (use all three for UI-WOW-2):

| Preset | viewport | DPR | flags | source |
|---|---|---|---|---|
| **desktop** | 1440×1200 (or 1440×1100) | **2** | — | `ui-wow-capture.mjs:572`, `prebuilt-…-capture.mjs:107` |
| **mobile** | **390×844** | **3** | `isMobile:true, hasTouch:true` | `ui-wow-capture.mjs:571`, `:143` |
| **constrained / preview-pane** | e.g. 768×1024 tablet, or any narrow width | 2 | — | `live-modes-smoke.mjs:47-51` viewport presets |

"Constrained" = the editor embedded in a narrow preview-pane. The in-app **viewport-preset toolbar**
(`[data-component="viewport-preset-toolbar"] [data-preset="mobile|tablet|desktop|fit"]`) lets you
resize the *rendered canvas* without changing the browser context — `live-modes-smoke.mjs:52-73`
drives it and measures `[data-pane="preview"] canvas` boundingBox with ±2px tolerance. For UI-WOW-2's
"responsive to constrained widths" requirement, add a 3rd context at e.g. `{ width: 960, height: 760,
deviceScaleFactor: 2 }` (a realistic embedded-pane size) and/or exercise the preset toolbar.

**Screenshot methods** (all DPR-2 native, no upscaling):
- Full frame: `await page.screenshot({ path, fullPage: false })` — `makeCtx.shot()` (`:65`).
- **Zoom crop / loupe**: `makeCtx.crop(name, selector, pad=8)` (`:73`) — clips a selector's bbox
  (already 2× pixels at DPR-2 → reads as a high-DPI loupe). Use for tile/typography detail.
- Tile-clip (per-element): `prebuilt-…-capture.mjs:84-91` clips each `[data-cluster-tile]` bbox and
  saves `-frozen.png` + `-play2.png` to prove animation (see §6 motion check).
- **Computed-font dump** (cascade-race proof): `makeCtx.fontDump(name, selectors)` (`:84`) writes a
  JSON of `getComputedStyle` `fontFamily/weight/size/letterSpacing` + `document.fonts.check()` for
  `Clash Display / Geist / JetBrains Mono`. Gotcha (from memory `ui-wow-run`): **`document.fonts.check`
  lies** — the harness records `firstFamily` (the actual first resolved family) as the real proof.

**Scene driving helpers** (`makeCtx`, `:50-113`):
- `waitScene(settle=2600)` — waits for `[data-pane="graph"] canvas` then settles. First compile ≈25 s,
  so navigation uses `timeout: 180000` and `waitUntil: 'domcontentloaded'` (`:583`).
- `setMode(m)` — `window.__PRISM_EDITOR_SET_VIEW_MODE__(m)` where m ∈ **`galaxy | canvas | preview-app`**
  (installed at `src/app/page.tsx:229`). These are the canonical-3 modes (RA-06b); never pass
  `hub-world`/`preview-hub` (FP-14).
- `click(selector, {settle})`, `crop`, `shot`, `fontDump`, plus in-page debug stores (next bullet).
- **In-page debug stores**: `window.__PRISM_DEBUG_STORES__.{graphEditor,graphSource}.getState()`
  (`src/app/page.tsx:323`) — drive `drillIntoHub`, read `nodes`, `viewMode`, `activeHubId`, etc.
  `window.__clusterRig` (`cluster-tile-renderer.ts:725`) exposes `{ready,tileCount,backend,deviceLostCount}`
  for the library gallery rig.

---

## 3. Console-error + network-4xx checks

**Console + page errors** (every harness wires both) — `ui-wow-capture.mjs:575-577`:
```js
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
```
Written to `<scene>/_console-errors.json`, filtering the benign React-DevTools nag (`:594`,
`!/Download the React DevTools/.test(t)`). **A non-empty console-errors list (after that filter) is a
fail** — the WOW bar is "0 console errors real-GPU" (UI-WOW report headline).

**Network 4xx/failed** — *not* in `ui-wow-capture.mjs` yet; the established pattern lives in
`verify-3d-object.mjs:34`, `verify-c29-mobile-signoff.mjs:36`, `useradvocate-capture.mjs:343`,
`verify-step5-edit-path.mjs:69`:
```js
page.on('response', (r) => {
  if (r.status() >= 400 && !/favicon/i.test(r.url())) badResponses.push({ url: r.url().slice(0,120), status: r.status() });
});
page.on('requestfailed', (req) => { if (!benignUrl(req.url())) netErrors.push(`FAILED ${req.url()} ${req.failure()?.errorText ?? ''}`); });
```
**Add this to any UI-WOW-2 capture scene** — it's the cheapest catch for missing assets/atlas/MSDF.

---

## 4. No-regression gates (run all before claiming WOW)

The `package.json` scripts + established floors (UI-WOW report `notes/UI-WOW-REPORT.md:68`):

| Gate | Command | Baseline / bar |
|---|---|---|
| **Vitest full suite** | `npx vitest run` (config `vitest.config.ts`; 594 test files under `tests/{unit,integration,shaders,editor-build,material-lighting,text}`) | **3349 passed / 8 skipped / 0 failed (548 files)** — must equal baseline; any new fail = regression |
| **Typecheck** | `npm run typecheck` (`tsc --noEmit`) or gated `npm run typecheck:gate` (`scripts/typecheck-gate.mjs`, baseline `notes/tsc-baseline.json`) | **0 NEW** errors (≈9 pre-existing allowed by the gate) |
| **Catalog verify** | `npm run verify:catalog` (`scripts/verify-catalog.mjs`) — static 3D-primitive catalog check | green |
| **Prism static smoke** | `npm run verify:prism` (`scripts/verify-prism.mjs`, 15 checks §10) + `node scripts/browser-smoke.mjs` | floor, not the bar |
| **Forbidden-pattern sweep** | `.claude/hooks/anti-drift-check.sh` (PreToolUse, fires on Write/Edit) — see §5 | clean (blocks at write time) |
| **PURPLE scan** | `node scripts/ui-design-purple-scan.mjs <dir-of-pngs> [--threshold 0.001]` | **0 purple** (hue 262–318°, sat≥0.28, val≥0.16); >0.1% = MUST-FIX |
| **Perf probe** | `node scripts/ui-design-perf-probe.mjs <port>` — input/hover latency p50/p95 + idle/palette/mode-toggle FPS, desktop + mobile-390 | smooth desktop+mobile, `deviceLost: 0`, <100ms latency |

Note: `npm run dev` runs `build:prism && next dev`. `dev:fast` is `next dev` only (skips the
`.prism` artifact rebuild) — fine when assets are already baked under `public/prism-assets/`, which
they are. The capture harness spawns `npx next dev -p <port>` directly (no build:prism), so ensure
assets are baked once (`npm run build:prism`) if you've touched the mock-app source.

---

## 5. Forbidden-pattern hook (`.claude/hooks/anti-drift-check.sh`, 188 lines)

PreToolUse on Write/Edit. Blocks the commit at write-time. Editor-build FP-NN block is active while
`.prism-editor-build-active` markers exist. The ones that constrain UI-WOW-2 edits:

- **FP-05** (`:92`): `document.*` / `window.*` in **runtime/node modules** — only
  `window.devicePixelRatio` allowed. (Editor-shell files like `GraphScene.tsx`/`page.tsx` are NOT
  runtime modules, so their `window.__PRISM_*` globals are legal — FP-R11 scope.)
- **FP-01** (`:76`): no `from 'pixi'` / `import * as PIXI`. **One renderer only.**
- **FP-02** (`:81`): no `new THREE.TextGeometry(` — text is MSDF.
- **FP-04** (`:86`): no destructive `.scenePosition/.editorTransform/.canvasTransform/.compiledTransform.{x,y,z} =`
  inside `compile*|organize*|previewHub*|previewApp*` bodies (non-destructive compile, INV-17).
- **FP-06/07** (`:104/:109`): no raw secret literals; no `process.env.*_SECRET|KEY|TOKEN|PASSWORD`
  outside `src/server/**` or `server-only` modules.
- **FP-08** (`:121`): keyframe literals must carry `coordinateSpace` ∈
  `'universe'|'hub-scene'|'viewport-composition'|'scroll-timeline'|'camera'` — **relevant to the P1
  keyframe-editor phase.**
- **FP-09** (`:132`): `createNode` must be synchronous.
- **FP-11/12/14** (`:141/:148/:152`): no direct store-state mutation; viewMode literal must be one of
  `galaxy|canvas|preview-app`; **`'hub-world'`/`'preview-hub'` literal forbidden anywhere under src/**.
- **FP-15** (`:157`): Inspector tabs must write through `usePreviewStateStore`, not
  `useGraphSourceStore.getState().updateNode`.
- **FP-13** (`:166`): FLUX/fal asset calls must include `"no text, no letters, no labels"` negative.
- **Top-level DOM-style block** (`:64`): `.style.(background|border|boxShadow|backgroundImage) =`
  is blocked unless the line carries an `ALLOWED-DOM-STYLE` marker. **Imperative inline-style
  background writes are forbidden — style via tokens/classes.** (`new PIXI.Graphics` similarly needs
  `ALLOWED-GRAPHICS`.)

---

## 6. Animation / motion proof (for hover-preview & keyframe WOW)

`prebuilt-library-advocate-capture.mjs` is the model for proving "it actually animates, not a
thumbnail":
- `stats(buf)` (`:29`) — Sharp `meanLuma` + `nonEmptyFrac` (proves the tile renders real content, not
  black). `rendersContent = nonEmptyFrac > 0.03`.
- `frameDelta(a,b)` (`:40`) — downsample to 120×90, mean abs per-channel diff between two frames at
  different times. `animates = motionDelta > 0.4`. (Memory `primitives-expansion-run`: the WOW bar
  for meaningful motion is **≥6 meanAbsDiff** for hero effects; 0.4 is just the "moves at all" floor.)
- Per-tile sequence: frozen crop → `.hover()` → wait 160 ms → play1 → wait 420 ms → play2 →
  `frameDelta(play1, play2)`. Move pointer to `(5,5)` between tiles so neighbors aren't co-hovered.

---

## 7. Design tokens (style only via these — no hardcoded hex)

Both files are the **FROZEN CONTRACT** (Wave 0, 2026-06-09):
- **`src/components/editor/design-system/tokens.css`** — single source of truth for every color,
  surface, edge, elevation, motion, type value. Palette is **brass / bone / ice, NO purple**:
  - Neutrals `--ds-void #04050a … --ds-steel #323848` (graphite housing).
  - Text `--ds-text-hi #f3f1ea … --ds-text-low #6e7077` (bone engraving).
  - **Brass ramp `--ds-brass-100 #f7e9c6 … --ds-brass-700 #654a22`** — the ONE accent family
    (primary `--ds-brass-400 #cd9f55`); rgb triplets provided for alpha comp.
  - **Ice secondary `--ds-ice-200 … --ds-ice-500`** — informational/frozen ONLY, never the hero.
  - Status `--ds-ok/warn/danger/neutral`; gradient ramps (`--ds-grad-brass`, never flat-fill).
- **`src/components/editor/design-system/materials.css`** — reusable surface materials/edges/elevation/
  motion + the `.ds-*` classes (`.ds-glass`, `.ds-smoked`, `.ds-metal`, `.ds-ceramic`, `.ds-well`,
  `.ds-btn`, `.ds-toggle`, `.ds-edge*`, `.ds-grain`). Consumes tokens exclusively (no raw hex except
  achromatic data-URI grain textures). Component-local hex is forbidden where a token exists.
  - **Pseudo-element budget**: `.ds-edge*` owns `::before`, `.ds-grain` owns `::after` — a component
    needing its own pseudos must not combine them on one element.
  - **`:where()` positioning** (`materials.css:28`): surfaces declare `position:relative` at ZERO
    specificity so a Tailwind `.absolute`/`.fixed` always wins (Wave-2 bug: Inspector fell into flow
    because `.ds-glass`'s `position:relative` out-cascaded `.absolute`).
- **Tier gating (INV-9)** via `html[data-ds-tier]`, stamped pre-hydration by
  `DS_TIER_BOOT_SCRIPT` (`design-system/tier.ts:41`): `t2` = WebGPU + fine pointer (full frost +
  refraction, hero surfaces only); `t1` = standard frost, no refraction filter; `t0` = opaque
  gradient panels, minimal blur — **same geometry + palette across tiers**. Read via
  `document.documentElement.dataset.dsTier` (perf probe `ui-design-perf-probe.mjs:23`). Mobile
  emulation → coarse pointer → `t1`. Motion is transform/opacity only; **`backdrop-filter` is never
  animated**.

---

## 8. "fal" must never surface in UI

The media-generation backend (fal.ai) is referenced internally as `@/lib/editor/media-gen-client`
and the user-facing surface is labeled **"Generate" / "Media Generator"** — `PromptWizard.tsx:7`
("Media Generator (never surfaces the backing provider)"), `ChangeArtifactFlyout.tsx:76`
(`title="Generate"`). The word `fal` lives only in scripts (`scripts/ui-wow-fal-gen.mjs`,
`fal-ledger.json`) and the FP-13 hook. **Any new UI string saying "fal" is a defect.** The fal
spend ledger for UI-WOW-2 starts at **$0.431** (warn $25/$40, STOP $48 — `UI-WOW-2-PROGRESS.md`).

---

## 9. Where evidence goes (UI-WOW-2 scaffold already exists)

- `notes/verification/ui-wow-2/{before,p0,recon}/` already created. Add per-phase dirs.
- Harness default out-root: `notes/verification/ui-wow/<scene>/` → override `--out
  notes/verification/ui-wow-2/<phase>`.
- Each scene writes: frames `*.png`, zoom crops, `*.json` font dumps, `_console-errors.json`,
  and the harness writes `_run-summary.json` at the out-root.
- Prior run report (the bar to beat): `notes/UI-WOW-REPORT.md`; progress ledger
  `notes/verification/UI-WOW-2-PROGRESS.md`.

---

## 10. Gotchas (carried from memory + code)

1. **node not on PATH** — must `export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"` (or
   v22.22.1) every shell; bare `node` → "not found".
2. **`channel:'chrome'` + `headless:false` or you get SwiftShader** (`__PRISM_RENDERER_BACKEND__`
   reads `'webgl2'` instead of `'webgpu'`) → fidelity invalid; re-run.
3. **First compile ≈25 s** — navigation timeout 180 s, `waitForSelector('[data-pane="graph"] canvas')`
   then settle ≥2.6 s; gallery rigs need ~1.5–1.8 s extra to render real content (GPU-render race —
   black/white canvas means "screenshot before ready", not "broken").
4. **`document.fonts.check` lies** — trust `firstFamily` from `getComputedStyle`. next/font
   cascade-race renders SERIF if fallbacks aren't `ui-sans-serif` (memory `ui-wow-run`).
5. **Stale `.next` cache** can serve old chrome — `rm -rf .next` if a known-good change doesn't show.
6. **WebGPU skips legacy postprocessing** (INV-R14) — don't author WOW that needs
   `@react-three/postprocessing` EffectComposer; it only runs on the WebGL2 fallback.
7. **Vitest is `npx vitest run`** (594 files under `tests/`, none under `src/`); the full tally is
   3349 — verify the number didn't move.
