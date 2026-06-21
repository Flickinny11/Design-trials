# ORRERY No.7 — F5.4 Report — Sapphire Crystal + Liquid Glass + Arrival Watch

**Run:** F5.4 (Sapphire crystal + liquid-glass panel + transmission guard; Arrival hero watch fix)
**Date:** 2026-06-20
**Branch:** `prism-editor-build`
**Commits:** `da1d1366` (P1), `b110c119` (P2), this report (P3)
**Verification:** Playwright MCP against live WebGPU app at `http://localhost:3000` (no KripVerify). Vitest for the budget guard.

---

## Headline

| Wave | Result |
|---|---|
| **P1 — Sapphire crystal + liquid-glass panel + transmission guard** | ✅ SHIPPED & VERIFIED |
| **P2 — Arrival hero watch** | ✅ VERIFIED ALREADY CORRECT (reported blank-plane not reproducible — no rewrite) |
| **P3 — Verification + regression + report** | ✅ PASS (configurator intact, 0 console errors, INV clean) |

**fal spend:** **$1.035 / $40** (F5.4 added **$0.00** — crystal is a TSL node material, the panel is a screen-space primitive; no assets generated). $38.965 remaining.

---

## §9.5 Success Criteria — SC-O10 (Transmission budget) + SC-O14.4

| SC | Statement | Result | Evidence |
|---|---|---|---|
| **SC-O10.1** | `window.__PRISM_TRANSMISSION_COUNT__` never exceeds 2 | ✅ **PASS** | Live value = **1** on Atelier with crystal + panel both mounted; unit test proves the hard cap at 2 + `'[PRISM] TRANSMISSION LIMIT: capped at 2'` warn on a 3rd request. |
| **SC-O10.2** | Sapphire crystal renders with visible IOR lensing (objects behind refract) | ✅ **PASS** | `p1-crystal-refraction-zoom.png` — domed sapphire over the dial; dial face + hands + markers read through the crystal with a refractive rim + specular sweep. Material: `MeshPhysicalNodeMaterial`, `transmission 0.95`, `ior 1.76`. |
| **SC-O10.3** | Atelier panel glass uses screen-space UV displacement (no 2nd transmission render) | ✅ **PASS** | Panel node material = `MeshBasicNodeMaterial` with a live `colorNode` (viewport-sampled), **transmission absent**. Count stays **1** with the panel mounted → panel contributes **0**. |
| **SC-O10.4** | Count does not exceed 2 with crystal + panel both visible | ✅ **PASS** | Live count = **1** with both on screen (≤2). |
| **SC-O14.4** | Crystal/glass layer node has `ior ≥ 1.7` (sapphire ≈ 1.76) | ✅ **PASS** | Live read of the mounted crystal material: `ior = 1.76`. |

---

## P1 — Sapphire crystal + liquid-glass panel + transmission guard

### What shipped
1. **Transmission budget guard** — `src/lib/prism/runtime/shared/transmission-budget.ts` (DOM-free, INV-R12/FP-05 clean). `requestTransmission`/`releaseTransmission`/`getTransmissionCount`, hard cap `MAX_TRANSMISSION = 2`. A 3rd refracting surface is rejected (caller downgrades to a Path-C clearcoat/translucency look) and logs `[PRISM] TRANSMISSION LIMIT: capped at 2`.
   - Wired in **both** mesh lanes of `default-factory.ts` (meshPrimitive + GLB), released on node `cleanup()` so hub-switch frees slots.
   - Bridged to `window.__PRISM_TRANSMISSION_COUNT__` as a **live getter** in `GraphScene.tsx` (component file — outside FP-05 scope, matching the existing `__PRISM_GALAXY_PROBE__` pattern).
   - **Unit test** `tests/unit/orrery/transmission-budget.test.ts` (4/4 pass) proves admit-2 / reject-3 + warn / release-frees-slot / idempotent.
2. **Sapphire crystal** — new node `orr-atelier-watch-crystal` in `live-graph.json`: sphere primitive (radius 0.86, 64 segs) flattened to a shallow dome (`scaleZ 0.18`) seated above the second hand. `materialSpec`: `transmission 0.95, ior 1.76, roughness 0.02, metalness 0, thickness 0.08, dispersion 0.02, clearcoat 0.35`. Floats in sync with the watch assembly.
3. **Liquid-glass panel (Path C)** — new primitive `liquid-glass-panel` (`src/lib/prism/animatable/primitives/liquid-glass-panel.ts`): screen-space UV displacement via `viewportSharedTexture(screenUV + ripple)` on a `MeshBasicNodeMaterial` — **no `transmission`**, so it never enters the budget. `mountable: true` opts it past the glass-category mount skip. Bound to new node `orr-atelier-panel-glass` (a plane behind the price/summary/SAVE cluster) with a dark frosted-tint fallback plate for legibility.

### Verification
- Live scene read: crystal = `MeshPhysicalNodeMaterial` (transmission 0.95, ior 1.76); panel = `MeshBasicNodeMaterial` (colorNode present, no transmission). `__PRISM_TRANSMISSION_COUNT__` = 1.
- Screenshots: `p1-atelier-full.png`, `p1-crystal-refraction-zoom.png`.
- 0 console errors; no spurious TRANSMISSION-LIMIT warn (under budget).
- Targeted tests pass: budget (4/4), primitives-registry + animation-catalog + bindings (37/37). tsc unchanged at the 9-error baseline (pre-existing GraphScene gl-factory + HL08 test).

---

## P2 — Arrival hero watch

**Reported problem:** `orr-arrival-watch` renders as "a large blank white tilted PLANE with a loading spinner."

**Diagnosis (Playwright MCP, live scene):** **Not reproducible.** `orr-arrival-watch` loads the real **54,563-vertex** Hunyuan3D PBR watch mesh (`watch.glb`, 2.3 MB) with its baked **1024²** texture and renders as a photoreal gold/navy *celestial-movement* timepiece with a leather strap.

Tested under every condition the symptom could hide in:

| Condition | Result |
|---|---|
| Warm (cached) load | ✅ Photoreal watch |
| Cold reload (`page.goto`) | ✅ Photoreal watch |
| Throttled-cold (180 kbps, browser cache cleared) | ✅ Photoreal watch (`p2-arrival-cold-throttled.png`) |
| **Scene environment (IBL) nulled** | ✅ Still photoreal — slightly less shiny but fully textured (`p2-arrival-no-env-robustness.png`) → the look rides the baked texture, **not** the env, so the "blank-white-when-env-missing" failure mode does not exist |

**Root cause of the stale report:** the bug predates F5.4 and was already fixed — the F4b-FIX evidence (`notes/verification/editor-experience/F4b-FIX/before-s1-arrival.png`) already shows the watch rendering. No occluding white-plane node exists in the hub (`orr-arrival-{headline,sub,watch,dust}` only).

**Action:** Per *verify-before-claim* / *don't-break-what-works*, **no rewrite** of a working hero asset. The GLB renders via a raw (non-node) `MeshPhysicalMaterial` that the WebGPURenderer auto-converts; this is the standard GLTF path and verified robust above. Evidence: `p2-arrival-full.png`, `p2-arrival-watch-zoom.png`.

> **Honest flag:** the GLB submesh material is `isNodeMaterial:false` (`metalness 1, roughness 1`). It renders correctly today and survives env-loss, so it is **not** a blocker. If a future renderer change ever regresses GLB auto-conversion, the spec-clean hardening would be to rebuild GLB submaterials as `MeshPhysicalNodeMaterial` preserving every baked map — deferred because forcing that conversion now risks regressing a flawless hero asset for no demonstrated benefit.

---

## P3 — Regression + INV + console

### F5.3 configurator regression (via `__PRISM_DEBUG_STORES__.configurator`)
| Check | Result |
|---|---|
| Tap **guilloché** dial → texture applies live | ✅ dial material `hasMap:true, mapW:2048` (was navy/no-map); price $38,000 → ~$60,000 |
| Constraint CPQ — **manual** movement blocks **moonphase** | ✅ `complications` stays `none`, `lastReason = "Moonphase requires the Automatic or Tourbillon movement."` |
| **Tourbillon** allows moonphase | ✅ `complications = moonphase`, `lastReason = null` |
| Serialize → mutate → restore round-trip | ✅ restored build === snapshot |
| Configurator did **not** pollute `live-graph.json` on disk | ✅ file git-clean (in-memory + material-swap only) |

Evidence: `p3-dial-guilloche-live.png` (guilloché dial rendering live **under** the crystal), `p3-atelier-final.png` (reset to default).

### Invariant greps (all clean)
| INV | Result |
|---|---|
| No `THREE.TextGeometry` usage | ✅ 0 (all hits are forbidding comments / MSDF / the codegen verifier regex) |
| No PixiJS imports | ✅ 0 (only the codegen verifier's detection regex) |
| No `hub-world` / `preview-hub` literals (FP-14) | ✅ 0 |
| No leftover `broken-url` test fixtures | ✅ 0 |
| No raw secrets in `live-graph.json` | ✅ 0 |
| No `window.*`/`document.*` in new runtime modules (FP-05) | ✅ 0 (the one match is a comment) |

### Console
- **0 errors** session-wide across Atelier + Arrival (3 pre-existing library warnings only: coderef-factory dynamic-import, THREE.Clock deprecation, Rapier init params — none from F5.4).

---

## Blockers
**None.** All F5.4 SC pass; configurator regression clean; 0 console errors.

## Honest flags
1. **Arrival GLB material is non-node** (`isNodeMaterial:false`). Renders correctly + env-independent today; flagged as future hardening, not a defect (see P2).
2. **Crystal lensing is intentionally subtle** (low dispersion 0.02, thin 0.08) per spec §4 ("low chromaticAberration ~0.04, thin thickness") — a realistic sapphire, not a fishbowl. The refractive read is the rim distortion + specular sweep + dial-through-glass, not a strong magnifier.
3. **Panel Path-C displacement** samples the live framebuffer; the high default tint (0.62) keeps labels legible even where the sampled backdrop is dark, and a scalar dark-frost fallback covers any backend where the viewport node degrades.

## fal ledger
`capUsd 40 · totalCostUsd 1.035 · 9 calls` — **F5.4 added $0.00.** $38.965 remaining.

## Evidence (`notes/verification/orrery-f54/`)
- `p1-atelier-full.png`, `p1-crystal-refraction-zoom.png`
- `p2-arrival-full.png`, `p2-arrival-watch-zoom.png`, `p2-arrival-cold-throttled.png`, `p2-arrival-no-env-robustness.png`
- `p3-atelier-final.png`, `p3-dial-guilloche-live.png`
