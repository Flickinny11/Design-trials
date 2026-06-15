# POLISH MICRO-PASS — Report

Scoped finishing pass on two first-impression surfaces of the Prism editor. Branch `prism-editor-build`. Model: claude-opus-4-8. Premium-first, Observatory Brass; one renderer (Three.js/TSL/WebGPU, WebGL2 fallback); positions from node schema; additive schema only; fal spend **$0** (procedural/data only).

## What changed

### PA — Galaxy hub-worlds now read as hero worlds
- **`HubPlanet.tsx`** — expanded from 3 hash-picked families to **5 distinct hero identities** (`brass-gas-giant`, `bone-rock`, `ice-crystal`, `deep-ocean`, `ember-forge`), deterministically pinned to the 5 mock hubs (s1–s5). Surface canvas raised to **2048×1024** with a second high-frequency octave, crisper per-identity bump, anisotropy 8, a crater pass (bone-rock) and an emissive crack map (ember-forge). IBL / atmosphere-halo / Bloom / rim-fresnel preserved. Optional `identity?` prop for future authoring.
- **`GraphScene.tsx`** — size hierarchy: galaxy dormant node sphere **4.5 → 2.6u**; hub-planet `innerRadius` floor raised to `min(max(R·0.5, 9), 40)` (still < the node-cloud hull so moons orbit outside). Net projected-radius ratio ≈ **3.4×** (gate ≥2.5).

### PB — Arrival hero no longer occludes the copy
- **`live-graph.json`** (data only, positions from schema — INV-7/FP-2) — recomposed `s1-arrival` into a clean premium hero: eyebrow `ORRERY No.7…` (sub) + big `Time, machined.` headline lifted into the upper band (clear of the top tab-bar), the ORRERY watch as the lit centre-lower hero, well below the text. Final v4: sub `scenePosition.y 1.7`, headline `0.55`, watch `-2.4` (scale 1.45), with per-device `responsiveScenePos`.
- **Autosave-pollution root cause (found by the PB advocate's MUST-FIX):** the live graph had accumulated 4 duplicate `jelly-collide-sim` physics bindings on the headline node (autosave pollution since the last commit — NOT an intentional edit). That physics primitive dropped the headline's brass texture-fill, rendering its MSDF glyphs as white/green placeholder quads that occluded the headline. **Fix:** rebased `live-graph.json` on the clean committed baseline (headline bindings back to `["float"]`, 0 duplicate-id bindings across all 23 nodes) and re-applied only the two intentional edits (matte flags + PB recompose). Verified the headline now renders its gold brass-fill cleanly.

### PC — Galaxy secondary finish
- **Content glyph badges** — new `content-glyphs.tsx` (`NodeContentBadge`); every dormant node renders a small custom 3D glyph (image / text / 3d-object / integration) below the sphere via `deriveContentType(node)`. Custom geometry only (no stock icons).
- **Label LOD** — new `computePerLabelLod` (`galaxy-label-lod.ts`) wired into `NodeLabels`: distance-rank pre-pass fades distant/low-priority labels at element-detail zoom so they never pile into a mass; focused labels stay crisp.
- **Edges** — intra-hub `Edge` rewritten as a gently-curved (QuadraticBezier, 8% bow) brass-tinted soft polyline (opacity 0.2/0.32); inter-hub `GalaxyHubTethers` brass-tinted (lerp→brass300), thinned (core 0.45→0.3, halo 1.7→1.2) and softened (0.5→0.3). Kills the harsh bright-white look.
- **Planet sharpness** — folded into the HubPlanet surface upgrade above.
- **Hero matte** — additive `visual.opaque?` flag (types.ts) → `default-factory` renders opaque photo planes with `transparent:false`, removing the faint straight-alpha rectangular seam. Flagged on the 4 opaque macro planes (brass/sapphire/meteorite/pour). Alpha-bearing fx planes (dust, stars) unchanged. **Tradeoff (D3):** during a cold async texture load an opaque plane briefly shows its white base before the photo lands; sub-second, and the heroes gate confirms the settled state is correct.

### Additive schema (INV-18, never breaks existing fields)
- `NodeContentType`, `deriveContentType(node)`, `PrismNode.contentType?`
- `HubPlanetIdentity`, `PrismHub.identity?`
- `PrismVisual.opaque?`

### Dev-only diagnostics added (NODE_ENV-gated, editor-shell scope)
- `window.__PRISM_GALAXY_PROBE__()` → per-hub-planet / per-node-sphere / per-badge projected screen radii (PA + badge gates).
- `window.__PRISM_SCENE__` (introspection).

## Verification — Layer 1: numeric harness (evidence in `notes/verification/polish/`)

| Gate | Result | Detail |
|---|---|---|
| **PA** hub/node projected-radius ratio ≥2.5, 5 hubs | **PASS 2/2** | desktop & mobile ratio **3.43**, min-hub 2.56, 5 hubs (`galaxy/pa-ratio-log.json`) |
| **PB** text-occlusion = 0, watch present+lit, 4 viewports | **PASS 4/4** (v4) | AABB overlap **0.000**, vertical gap 0.12–0.26, watch cov 0.013–0.018 peak 255 (`hero/pb-occlusion-log.json`); headline/eyebrow clear of top chrome (sub minY 0.23–0.34 vs tab-bar ~0.13) |
| **PC** edge harsh-white <0.4%, badges legible, no label overlap | **PASS** | harshWhite 0.08%/0.10% (warm bias +30/+36), badges 12/12 mean 24–62px, label overlap 0 (`galaxy/pc-finish-log.json`) |

## Verification — Layer 2: computer-use advocate
_(opus-4-8, driving the real app, desktop + mobile + tablet + constrained; verdicts require cited evidence)_

| Feature | Net | Gate | MUST-FIX |
|---|---|---|---|
| **PA** galaxy hero-worlds | **PLEASED** | PASS | 0 — "5 distinct hero worlds, 3.4× size hierarchy on both viewports, no purple (PURPLE_FRAC 0), 0 console errors" |
| **PC** badges/labels/edges/sharpness | **PLEASED** | PASS | 0 — "badges distinct per type + legible (badgeFrac 1.0), labels never overlap (0 pairs), tethers soft brass (harshWhite 0.0008), planets crisp; 1 taste flag (cream hub close-up)" |
| **PB** arrival hero (round 1) | ANNOYED | BLOCKED | 2 — headline occluded by placeholder boxes (autosave pollution) + headline clipped by top tab-bar. **Both fixed** (see PB change above). |
| **PB** arrival hero (re-judge, v4) | **PLEASED** | PASS | 0 — "occlusion + placeholder boxes gone; hero reads cleanly desktop/tablet/constrained/mobile". 2 non-blocking flags: desktop headline brass-fill first-paint latency; minor eyebrow edge-clip on one transient frame |

**Net Layer-2 verdict: PLEASED on PA, PB, PC (0 MUST-FIX outstanding).**

## Verification — Layer 3: chat-monitor frames + fresh-context review
Frames in `notes/verification/polish/{galaxy,hero,detail}/` (canonical: `galaxy/overview-{desktop,mobile}`, `hero/{desktop,tablet,constrained,mobile}-arrival`, `detail/galaxy-detail-{desktop,mobile}`; advocate evidence in `_adv-*` + `*-verdict.json`).

**Fresh-context staff review (diff-only, opus-4-8): REVIEW: CLEAN — 0 MUST-FIX.** Confirmed: schema purely additive (tsc 9 == baseline, 0 new); matte default preserved + scoped (19/19 default-factory tests green); dev diagnostics NODE_ENV+window gated, editor-shell only (not in `src/lib/prism/runtime/**`); no `document.`/`window.` in the one runtime module touched; no purple; PB positions in data not code; one renderer / MSDF only; no gate/test loosened. 5 non-blocking NOTEs (unwired `PrismHub.identity` — PA met via pinned hub-id map; `opaque` latent in the lit branch — current opaque nodes are unlit; `PlanetFamily` alias widened, no importers; per-frame `getPoint` alloc — **fixed** with a reusable target; pre-existing component-local hex).

## No-regression evidence
| Check | Baseline | Now | Status |
|---|---|---|---|
| tsc | 9 (pre-existing) | **9** | ✓ no new errors |
| vitest | 3349 / 0 fail | **3349 / 0 fail** (8 skip) | ✓ |
| heroes harness | 20/20 | **20/20** | ✓ (matte fix safe) |
| atmosphere harness | 20/20 | **20/20** | ✓ (tether softening safe) |
| prod `next build` | passes | **Compiled successfully** (clean v4 data) | ✓ |
| live-graph autosave pollution | — | **0 duplicate-id bindings** across 23 nodes (rebased on HEAD) | ✓ |
| secret-leak | clean | **clean** | ✓ no raw secrets in src/public |
| fal spend | — | **$0** | ✓ procedural/data only |
| 60Hz galaxy | — | **desktop 60fps / mobile 60fps** (real Chrome headed, webgpu, 0 errs) | ✓ |

## Completion

All three verification gate layers pass with evidence (numeric harness + computer-use advocate PLEASED on PA/PB/PC + fresh-context review CLEAN), no-regression confirmed (tsc 9 · vitest 3349/0 · prod build · heroes 20/20 · atmosphere 20/20 · 60Hz · secret-clean · fal $0).

POLISH: RUN COMPLETE
