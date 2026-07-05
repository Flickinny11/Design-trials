# STEP 7 — Drivers (scroll / pointer / state / event motion plays in the built scene)

**Branch:** `prism-editor-build` (HEAD unchanged — work left staged/uncommitted for review)
**Model:** claude-opus-4-8 · focused session · app-implementation, verified
**Date:** 2026-06-07

Ground truth: `docs/prism/PRISM-CANVAS-EDITOR-SPEC.md` §8.2 (Driver model), §16 (Preview:
drivers respond to real input), §18 criteria **15 & 16**, §3 **INV-6**; `PRISM-INTENT-ANCHOR.md` §3.

---

## What was missing (root cause)

The built-state surface (canvas + preview-app) is rendered by `AssembledSceneContent` →
`AssembledSceneNode` → `ArtifactNode layout="scene"` → `getSharedNodeContext({runPrimitives:true})`
→ `defaultRenderModeFactory`. Step 6 ran each node's `cinematicPrimitives`, so **time** drivers
already worked (`orbit`/`depth-rotate` are `gsap.timeline({repeat:-1})` that self-run on gsap's
ticker). But:

1. The shared primitives context built `makePrimitivesAPI({scene,camera,renderer})` — **no
   `pointer`/`scroll` sources**, so `parallax-scroll` and `magnetic-cursor` (which already
   consume `ctx.scroll`/`ctx.pointer`) received no input.
2. **`onTick` was never driven** per frame, so `magnetic-cursor`'s lerp never ran.
3. **Paused timelines** (`displacement-transition`, etc.) were never played by any trigger.

## What was built

THE RULE held: motion comes entirely from each node's OWN declared `cinematicPrimitives`; the
drivers only PLAY what the node already specifies. No motion authored, no node positioned.

| File | Change |
|---|---|
| `src/lib/prism/runtime/shared/drivers.ts` *(new)* | **DriverHub** — pointer / scroll / state / event sources + a per-frame ticker + a per-node result registry. DOM-pure (FP-05/INV-15): the host pushes real input via setters; primitives consume read-only surfaces. |
| `src/lib/prism/runtime/shared/driver-dispatch.ts` *(new)* | `attachPrimitiveDriver(hub, result, trigger, {nodeId})` — maps a node's declared `trigger` to playback: `load`/`inview` → play once; `scroll` → scrub `timeline.progress(p)`; `hover` → play/reverse on `hover:<id>` state; `click` → replay on a `click` event; registers `onTick`. **Only calls play/progress/reverse/restart — never touches keyframes (INV-6).** Returns a detach. |
| `src/lib/prism/runtime/shared-context.ts` | Singleton `DriverHub`; `makePrimitivesAPI` now receives `pointer`/`scroll`/`emit` from the hub; `ctx.drivers` + `ctx.emit` wired when `runPrimitives:true`; `getSharedDriverHub()`; reset path. |
| `src/lib/prism/runtime/shared/adapter.ts` | Optional `NodeContext.drivers` field (additive). |
| `src/lib/prism/runtime/factories/default-factory.ts` | Per `cinematicPrimitive` ref: attach the driver + register the result; detach + clear in `userData.cleanup`. |
| `src/lib/prism/runtime/shared/primitives/parallax-scroll.ts` | Capture the base position lazily so scroll OFFSETS from the node's authored position instead of clobbering it to origin (Δ identical when base=0, so existing tests stay green). |
| `src/components/editor/graph/GraphScene.tsx` | **`SceneDriverHost`** inside `AssembledSceneContent`: `useFrame` drives `hub.frame.tick`; `pointermove`→pointer NDC and `wheel`→scroll progress on the WebGL canvas; `window.__prismDrivers` debug/verify handle. `AssembledSceneNode` pointer/click handlers additionally push hover-state / click-event (additive — existing selection behavior unchanged). |
| `tests/integration/STEP7.driver-hub.test.ts`, `STEP7.driver-dispatch.test.ts` *(new)* | Unit coverage incl. INV-6. |
| `scripts/verify-step7-drivers.mjs` *(new)* | Playwright evidence harness. |

The live graph (`public/prism-mock/home/live-graph.json`) exercises: `home-headline`
(`parallax-scroll`, trigger `inview`), `home-feature-card` (`magnetic-cursor`, trigger `hover`),
`home-parallax-stack` (`displacement-transition`, trigger `inview`), `home-orbit-decor`
(`orbit`, trigger `load` — already worked).

---

## Verification (evidence-based "done")

Harness: `node scripts/verify-step7-drivers.mjs` — boots `next dev`, drives the built
**preview-app** (boot default, RA-17) in headless Chromium (renderer backend: **webgpu** via
swiftshader), measures node motion via the `window.__prismDrivers` probes, screenshots, checks
console. Raw JSON: `notes/verification/step7/verify-step7-drivers.json`. **8/8 checks pass.**

### Scope item 1 — ScrollDriver  → **PASS** (§18 crit 16, §8.2)
`home-headline`'s `parallax-scroll` Y responds to scroll progress.
- **Measured:** scroll `0 → 1` ⇒ **Δy = +0.1500** (p0.y=0.0000, p1.y=0.1500) — exactly the
  declared `intensity: 0.15` on the declared `axis: 'y'`. Offset from the node's authored
  position, not a teleport.
- **Pictures:** `notes/verification/step7/01-preview-app-baseline.png` vs `02-scroll-progress-1.png`.

### Scope item 2 — PointerDriver → **PASS** (§18 crit 16, §16, §8.2)
`home-feature-card`'s `magnetic-cursor` drifts toward the pointer; `onTick` is driven per frame.
- **Measured:** pointer centered → upper-right `(0.85, 0.65)` ⇒ **Δx = +0.242, Δy = +0.185**
  toward the pointer (converging on `ndc × intensity(0.3)` ≈ `0.255 / 0.195`).
- **Pictures:** `01-preview-app-baseline.png` vs `03-pointer-pulled.png` — the right-hand
  feature card visibly shifts up-and-right toward the cursor.

### Scope item 3 — StateDriver / EventDriver + inview play → **PASS** (§18 crit 15/16)
- The paused **`displacement-transition` plays on its trigger**: `home-parallax-stack` timeline
  reached **progress = 1, totalTime = 1.4 s, paused = false** (it was inert before — paused at 0).
- **State + Event INPUT paths reach dispatch** live without error (`setState`/`fireEvent`
  through `__prismDrivers`); frame ticker active (`frameSize = 1`), magnetic result registered
  (`nodeResultCount = 1`).
- The discrete **click → replay** and **hover → play/reverse** dispatch is proven by unit tests
  (`STEP7.driver-dispatch.test.ts`): a click-triggered timeline stays paused until the event
  fires then `restart()`s; a hover state plays forward and reverses on un-hover. (The live graph
  declares no click-triggered timeline, so the unit test is the click capture; the live capture
  is the inview play above.)

### INV-6 — keyframes independent of driver → **PASS** (§3, §18 crit 15)
- **Live:** re-firing every driver input (scroll/state/event) on `home-parallax-stack` left the
  timeline keyframe **duration unchanged: `[1.4] → [1.4]`**.
- **Unit:** `STEP7.driver-dispatch.test.ts` re-attaches the SAME gsap timeline under
  `scroll → hover → click → load → inview → time` and asserts the keyframe model (per-tween end
  value, duration, start time) is byte-identical across every reassignment.

### Console + no-rebuild → **PASS**
- **Console:** zero new console/page errors in preview-app (`console.clean`).
- **No rebuild on toggle (INV-R6/FP-R4):** canvas ↔ preview-app issued **Δbuilds = 0**.

### Tests
- New: `STEP7.driver-hub.test.ts` (9) + `STEP7.driver-dispatch.test.ts` (10) — all green.
- Regression: `T03.parallax-scroll`, `T03.magnetic-cursor`, `HL05.shared-context`,
  `HL08.default-factory`, `T02.adapter` — all green.
- Full suite: **1251 passed**, 8 skipped, **15 pre-existing failures** in 10 stale editor-build
  source-scan/superseded-mode tests (`preview-hub`/`hub-world`/"default canvas"). Confirmed
  pre-existing: the identical 15 fail with this change **stashed**. Zero new failures.
- `tsc --noEmit`: **10 errors, all pre-existing** (test contexts omitting `THREE`; the drei
  async `gl` factory line). Identical count with this change stashed. Zero new type errors.

### Fresh-context reviewer (`prism-criteria-reviewer`, diff + criteria only)
**VERDICT: PASS.** Every criterion MEETS; forbidden-pattern sweep CLEAN (FP-05 DOM-purity,
"drivers don't author/position motion", no app-behavior-via-driver, no rebuild-on-toggle). Two
non-blocking nits: (a) the `inview` dispatch plays-once on appearance with a true scroll-gated
intersection deferred — acceptable since the hub is camera-framed; (b) a pre-existing
`magnetic-cursor` note (out of this change's scope — and a non-issue in the scene path, where the
factory object is reset to local identity and the wrapper holds the authored position, so the
lerp offsets around 0 rather than clobbering, as the +0.24/+0.19 *drift from screen position*
evidence confirms).

---

## Scope lock
- Edited app source only for the driver-wiring slice. No keyframe-editor UI, no 300-primitive
  catalog, no new animation authoring, no app function/behavior wiring (node editor), no
  text/lighting/material/engine work.
- No dependency added/changed; no forbidden pattern worked around (dependency guard + anti-drift
  hooks fired and were respected — relative imports used instead of the `@/` alias under the
  runtime scope).
- Dev server started by the harness was shut down (port 4788 free).
- **No commit.** HEAD stays `prism-editor-build`; changes left staged for Logan's review.

---

## Plain-language summary (for a non-coder)

Before this step, the built app could play "always-on" motion (a decoration that orbits forever),
but it ignored you. Now the app **reacts to what you do**, and every reaction is the motion the
node itself was designed to have — nothing invented:

- **Scroll the built app** and the headline slides — it's pinned to your scroll, moving up as you
  scroll down. (See `02-scroll-progress-1.png` vs the baseline `01`.)
- **Move your mouse** and the feature card on the right leans toward your cursor like a magnet,
  drifting back when you move away. (Compare `03-pointer-pulled.png` to `01` — the right-hand
  card shifts up toward where the pointer went.)
- A layered panel on the left **plays its reveal animation** when it comes into view (it used to
  sit frozen).
- Hover and click are wired the same way for any element designed to react to them.

We measured the exact movement (the headline moves by precisely the 0.15 it was authored to; the
card drifts ~0.24 toward the cursor), confirmed nothing rebuilds when you flip between the editor
and the running app, and confirmed there are no errors. Pictures are in
`notes/verification/step7/`.
