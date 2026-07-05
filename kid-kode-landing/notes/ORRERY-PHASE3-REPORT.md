# ORRERY No.7 — PHASE 3 REPORT (the cinematic motion layer)

Branch `prism-editor-build` · model **claude-opus-4-8** (1M ctx, confirmed at start + each resume) · 2026-06-22
App: `kid-kode-landing/` · Graph: `public/prism-mock/home/live-graph.json`

Phase 3 added the **cinematic motion layer** on top of the Phase-1/2 photoreal 3D scene and
closed Phase 2's two honest flags. Every target was driven to a CITED pass via the wired Chrome
DevTools MCP (functional `evaluate_script` traces + multi-frame screenshots), the art-fidelity
reviewer, a fresh-context `prism-criteria-reviewer`, and the `user-advocate` capstone, plus a
clean COLD-LOAD GATE at run-start AND as the final gate.

---

## VERDICT: RUN COMPLETE — P3-1..P3-5 pass all gates; Phase 1+2 not regressed

### P3 criteria (multi-frame + functional evidence)
| Criterion | Verdict | Evidence |
|---|---|---|
| **P3-1** TRUE in-WebGPU cinematic hub transition (fixes flag #4) | **PASS** | In-canvas camera-PARENTED TSL brass curtain (ChromeSlabLayer idiom: `scene.add(camera); camera.add(group)`, `frustumCulled=false`, renderOrder 9500, depthTest/Write off, toneMapped off) → `__PRISM_HUB_TRANSITION__.inCanvas===true`, NO DOM `.ds-hub-morph-stage`. Curtain timeline frames `w1-curtain-cover{30,60,100b}`. Live cover trace **0→1→0** (close ~320ms / hold / open ~400ms). Swap GATED to peak cover: the 102-node atelier mount's **~6s main-thread stall held entirely behind cover=1** (the exact problem the Phase-2 DOM overlay was a workaround for, now solved in-WebGPU). Camera **dolly-through** trace **z 10.5→14.87 (pull back) →10.5 (fly in)**, settles at hero pose (no framing regression). Reveal frames `w1-live-transition-A` (Celestia), `w1-atelier-after-transition`. DOM curtain retired from `page.tsx`. |
| **P3-2** dramatic exploded view (fixes flag #3) | **PASS** | Dial stack decomposed into individually-choreographed tiers (bezel/dial/chapter/indices/hands/cap) with per-part STAGGER (crystal first → bezel last), BIG depth throws (crystal +2.9u), 12 indices fan radially, movement recedes to expose the gear-train; `explode()` AUTO-ORIENTS to a 3/4 pose. Frames `w2-exploded-mid`, `w2-exploded-full`, `w4-exploded-deeper`. Reassembles clean (`w4-atelier-rest`). Advocate: "unmistakably reads as the watch coming apart." |
| **P3-3** day/night + lume reveal | **PASS** | `__ATELIER_RIG__.night(on?)` eases a night level that dims env IBL (1.0→0.07) + named shared key/fill/ambient AND ramps the hands+indices emissive lume (0→5.5) + a dial glow point-light → watch goes dark, lume markers ignite. Day `w2-day` vs night `w2-night2` (`nightLevel→1.0` verified). Shared lights RESTORED on rig unmount — leaving the Atelier mid-night leaves s1 fully bright (`w2-s1-after-night-restore`), no leak. transmission stays ≤2. |
| **P3-4** premium micro-response | **PASS** | Watch cursor PARALLAX (leans toward pointer → studio specular sweeps): verified yaw delta **0.096 rad** far-left vs far-right. Tactile PRESS: pivot scale **1.0→0.965** on pointer-down → 1.0 on up. Existing MagneticCursor (magnetic snap + grow + press + warm glow) mounted on all controls (verified live). |
| **P3-5** cinematic camera language | **PASS** | preview-app idle camera DRIFT (slow orbit sway + dolly + target parallax around the hero pose, eased in, gated non-atelier/non-journey/transition-idle): verified continuous motion **x±0.18 / y±0.10 / z±0.10** over 3.6s. Entrances = the P3-1 dolly-through. The scene always feels alive, never static. |
| **SC-V-FX2** living ambient layer (carried) | **PASS** | Volumetric nebula + godray intact on all hubs (Phase-2 non-regression). |

---

## GATES
| Gate | Result |
|---|---|
| **COLD-LOAD GATE — run start** | **PASS** — canvas 1440×809, webgpu, not stuck, transmission 1, **0 console errors, 0 _next 404s** |
| **COLD-LOAD GATE — FINAL (on final committed code)** | **PASS** — canvas 1440×809, webgpu, not stuck, transmission 1, transition `inCanvas=true`, **no DOM curtain**, **0 _next 404s, 0 console errors** |
| 6-hub no-regression sweep (live transitions incl. atelier) | **PASS** — all 6 render, **0 console errors**, transmission ≤2 |
| In-scope console errors | **0** across every wave + sweep |
| Transmission budget (`__PRISM_TRANSMISSION_COUNT__`) | **1–2** (≤2 ✓); no new transmission material added |
| tsc gate (`scripts/typecheck-gate.mjs`) | **PASS** — 0 new (9 vs baseline 10) |
| Prod build (`npm run build`) | **PASS** — ✓ Compiled successfully 11.9s, 18 routes |
| art-fidelity reviewer (`scripts/art-fidelity-review.mjs`) | **13/13 PASS, 0 NEEDS-POLISH** |
| prism-criteria-reviewer (fresh context, diff-only) | **MUST-FIX: none** — every criterion PASS, clean forbidden-pattern sweep, no schema deletion, no view-mode drift, no Phase-1/2 regression |
| user-advocate (capstone, from frames) | **PLEASED on all 4 — OVERALL PLEASED: "Yes, this beats Slider Revolution." MUST-FIX: none** |

---

## ROOT-CAUSE + FIX (flag #4 — the headline)
Phase-2's in-canvas curtain "rendered but never covered the viewport" because it was a **frustum-
culled, scene-ROOTED position-follower**. The pipeline is WebGPU with **no EffectComposer** (it's
`!isWebGPU`-gated) — R3F renders straight to screen with ACES. The two camera-aligned objects that
DO composite in this exact pipeline (`HubSceneBackground` with `frustumCulled={false}`, and
`ChromeSlabLayer` which does `scene.add(camera); camera.add(group)`) revealed the fix: a **camera-
PARENTED** quad with `frustumCulled=false` and a high renderOrder. A second reason Phase 2 went DOM
— the CSS compositor keeps animating through the heavy hub-swap main-thread stall — is solved here
by a frame-driven state machine that GATES the content swap to the curtain's peak coverage (and
defers the commit one frame so a fully-covered frame paints first), so the stall happens behind a
frozen-fully-closed curtain.

## KEY FILES
- `src/components/editor/transition/HubSceneTransition.tsx` — camera-parented TSL brass-curtain quad (NEW)
- `src/stores/useHubTransitionStore.ts` — gated close→commit-at-peak→hold→open orchestrator (NEW)
- `src/components/editor/graph/GraphScene.tsx` — curtain mount, camera dolly-through, idle drift, named lights
- `src/components/atelier/AtelierWatchRig.tsx` — staggered exploded view, day/night lume, cursor parallax + press
- `src/app/page.tsx` + `src/components/editor/overlays/PreviewHubNav.tsx` — nav routed through the gated transition; DOM curtain retired

Frames: `notes/verification/phase3/` (1440px PNGs).

## HONEST FLAGS (non-blocking — advocate/reviewer notes, no MUST-FIX)
1. **Exploded spread** — strengthened this wave (deeper Z throws) per the advocate's wish; intentionally bounded so parts don't overlap the price-card UI. Reads unmistakably exploded.
2. **P3-4 controls magnetism** uses the pre-existing `MagneticCursor` (verified mounted) — no NEW control-side code; the new code is the watch parallax/press. Criterion met via existing + new.
3. **s1 subhead contrast** over the bright (living) nebula light-pool is slightly low in some frames — pre-existing layout / animated-nebula timing (Phase-2 flag #1 carryover), still legible.
4. **`HubMorphTransition.tsx` + `.ds-hub-morph-stage` CSS** remain on disk (retired, unmounted) — harmless traceability; a follow-up could delete them.
5. **Capture timing** — the transition/explode/lume are time-based; the curtain `setHold(v)` debug hook + the eased traces were used to capture deterministic frames (a single screenshot can miss the peak).

---

ORRERY-PHASE3: RUN COMPLETE
