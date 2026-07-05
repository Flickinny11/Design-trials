# SHELL W9A — MOCK WATCH APP SHOWPIECE ENHANCEMENT — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630` · **Baseline HEAD:** `56c44516`
**Governing:** `docs/prism/ORRERY-NO7-VISION.md` (§2 Atelier, §7 asset pipeline) ·
`SHELL-W9A-PROMPT.md` · provenance law (W9 addendum) · DL13/DL16.
**Status:** RUN COMPLETE (pending marker at end).

## Mission
Enhance the ORRERY No.7 mock watch-atelier app — the capability proof inside the framed
preview pane — into a stronger showpiece using the live generation pipelines: **Tripo**
(hero-grade Smart-Mesh PBR watch geometry) + **Replicate FLUX** (richer tileable materials +
signature dial art) + more cinematic staging — while every certified behavior stays green.

## Architecture map (located before touching anything)
- **Hero watch** = graph node `orr-atelier-watch`, `codeRef: builtin:atelier-watch` →
  `src/lib/prism/atelier/watch-node-factory.ts` (HYBRID: GLB parts `case-gen.glb` /
  `bezel-gen.glb` / `crown-gen.glb` + `tourbillon.glb` movement, dressing procedural
  dial/hands/indices/crystal/strap). Materials from `src/lib/prism/atelier/config.ts`.
- **Render path (certified context a):** `useGraphSourceStore` fetches
  `public/prism-mock/home/live-graph.json`; `/` mounts it; the W2 Task-0 engine-frame iframes
  `/`. Contexts (b) preview-runtime + (c) W5B ship-gate render *different* graphs — kept green,
  no visual change expected there (see deviations context note).
- **Off-limits (I-ENGINE/I-CANVAS):** `runtime/**`, `prism-player/**`, `app/page.tsx`, editor
  graph/overlays, `default-factory.ts`, `coderef-*`. **Diff-verified untouched at close.**

## Fresh-dated research (2026-07-05) — via the real committed pipeline
- **Tripo:** REST `api.tripo3d.ai/v2/openapi/task`; `image_to_model` model_version
  `P1-20260311` (Smart Mesh P1 — PBR + part segmentation); `texture:true pbr:true
  texture_quality:detailed`. `face_limit` is model-constrained (our 60000 was rejected 400 →
  dropped it, let Tripo auto-mesh, optimized GLB after). Driver `.assetgen/tripo.py`.
- **Replicate:** `black-forest-labs/flux-2-pro` (2MP, quality 95). Material chain
  `.assetgen/gen-flux.py` → `.assetgen/derive-material-pbr.mjs` (matched-latent delit PBR).

## What shipped
A dramatically stronger hero watch. **(1) Signature dial** — a legible, jewel-like "Orrery
Celestial" dial (aventurine starfield + sunburst guilloché, concentric gold orbital rings with
gold/silver planet spheres, a moonphase aperture, faceted applied gold markers) replacing the
former dark/illegible disc; plus an upgraded royal-blue guilloché dial. **(2) Hero geometry** —
fresh Tripo Smart-Mesh (P1) case + bezel + a rose-gold skeletonized tourbillon movement (from
FLUX studio concepts), optimized and committed. **(3) Materials** — richer brushed-metal +
leather PBR (matched-latent delit normal/roughness). **(4) Staging** — a node-local three-point
studio light rig (+ face-lift) so the milled metal throws moving specular and the dial sparkles;
a cinematic eased reveal; a night dim so the lume owns the dark; a genuine reduced-motion path.

## Hero geometry (Tripo) — per-part art-fidelity decisions (W9A-D1 gate)
| Part | Decision | Note |
|---|---|---|
| **Case** (`case-gen.glb`) | **SHIP new** (Tripo P1) | Clean fresh topology from an isolated studio concept. Read too mirror-hot at first with the new rig; **tuned the lights** (softer key, +face-lift) → premium. 0.49MB (2.4MB→). |
| **Bezel** (`bezel-gen.glb`) | **SHIP new** (Tripo P1) | Polished/brushed ring; composes with the case. 0.32MB. |
| **Movement** (`tourbillon.glb`) | **SHIP new** (Tripo P1) | Rose-gold skeletonized tourbillon — a real upgrade on flip/explode. 0.72MB (3.7MB→). |
| **Crown** (`crown-gen.glb`) | **KEEP existing** geometry | Not regenerated (tiny on screen); its file was **committed + optimized** (2.46MB→0.28MB) so the hero is shippable (DL13). |
Each candidate was inspected structurally (`glb-inspect.mjs`) and visually **in-context** in the
running app (the truest gate) before shipping. All Tripo GLBs carry baked PBR incl. a normal map
that the factory grafts onto the live finish.

## Materials (Replicate FLUX) — per-map upgrades (W9A-D2)
- `dial-tex-orrery.png` — hero celestial dial (FLUX 2MP → outer-rehaut vignette finish that adds
  real dial depth AND buries FLUX's residual rim maker's-mark text under the chapter-ring/bezel).
- `dial-tex-guilloche.png` — royal-blue clous-de-Paris guilloché (same finish).
- `metal-nrm-brushed.png` / `metal-rgh-brushed.png` — vertically-brushed steel (matched-latent delit).
- `strap-nrm-leather.png` / `strap-rgh-leather.png` — black full-grain calf leather.
- DL16: the default build (steel/brushed/orrery/rhodium/gold/black-leather) reads with full tonal
  range + specular pop; watch-region pixel stats meanLum 47.5, 3.1% bright, 14.2% near-black (bg
  bleed) → **no flat-black void**.

## Staging enhancements (`watch-node-factory.ts`, +65 lines, additive)
- `makeProductLights()` — world-fixed 3-point studio rig (warm key / cool rim / soft fill) + a
  near-axial face-lift so the aventurine dial always reads; bounded distance/decay keeps the pool
  local (does not wash galaxy neighbours); fades into night so the lume glow owns the dark.
- Cinematic **intro reveal** — eased reveal turn + scale-in on first mount; a flattering resting tilt.
- **Reduced-motion** — reads `prefers-reduced-motion`; suppresses idle drift, cursor parallax, the
  reveal, and freezes the hands at a poised pose, while drag/flip/explode/night stay on demand.

## Integrity
- `npm run build:prism` (rebake `mock-app.prism`): runs on every `npm run dev` start (deterministic);
  my texture/GLB changes are runtime URL fetches, not bundled, so the artifact is unaffected — the
  stray 1-byte working-tree diff was discarded (clean).
- `npm run verify`: **EXIT 0** — verify:prism 14/14 · galaxy 7/7 · global-shell 6/6 · parity S1–S8
  PASS · schema 338/338 · tenancy 35/35 GREEN.
- **W5B §14.1 headless ship gate**: `tests/unit/shell-w5b-ship-anywhere.test.ts` **11/11 PASS**
  (incl. the §14.1 GATE), EXIT 0.
- `tsc`: **9 = baseline, 0 new**. Console errors on the atelier: **0**.
- **I-CANVAS / I-ENGINE**: diff vs `56c44516` touches only `watch-node-factory.ts` + atelier
  assets + notes — **no engine/runtime/canvas-editor file**. Diff-verified.
- Certified contexts: (a) framed preview pane = `/` renders the upgraded watch (verified live,
  desktop + mobile); (b) preview-runtime + (c) ship-gate render different graphs and stay GREEN.

## Evidence (`notes/verification/shell-w9a/`)
- **Before:** `baseline-01-arrival.png`, `baseline-02-atelier.png`, `baseline-03-dial-faceon.png`
  (dark/illegible dial, flat lighting).
- **After (desktop, real build):** `w9a-desktop-01-hero.png`, `-02-explode.png`, `-03-night.png`,
  `-04-arrival.png`; **mobile:** `w9a-mobile-01-atelier.png`; plus `wip-01…08` tuning frames.
- `metrics.json` (fps 48 in the automation browser, pixel stats, verify/ship-gate/tsc, spend).

## Deviations / method record
`notes/spec-deviations-w9a.md` — W9A-D1 (Tripo hero geometry via §7 pipeline, art-gated,
better-of-new-vs-existing) · W9A-D2 (FLUX matched-latent materials) · W9A-D3 (additive staging in
mock-app content, reduced-motion preserved) · W9A-D4 (`.prism` deterministic rebake) · context note.
Additionally: the load-bearing `atelier/*.glb` were gitignored (37MB experiment junk lives there);
force-added exactly the 3 the factory fetches (case/bezel/crown) so the hero is shippable (DL13).

## Spend log
| Pipeline | Item | Cost | Balance |
|---|---|---|---|
| Tripo | (start) | — | 640 credits |
| Tripo | case (P1, PBR) | 60 | 580 |
| Tripo | movement (P1, PBR) | 60 | 520 |
| Tripo | bezel (P1, PBR) | 60 | 460 |
| Replicate FLUX | 9 flux-2-pro images (dials×4, plates×2, concepts×3) | ≈ $0.45 (est.) | — |
**Totals:** Tripo 180 credits (→ 460 left). Replicate ≈ $0.45 (well under the ~$5 cap). No keys in
git/logs/report (I-SECRETS).

## Judges
- prism-criteria-reviewer: _pending_
- user-advocate ("is this watch app a jaw-dropping showpiece?"): _pending_

## Marker
`PRISM-SHELL-W9A: RUN COMPLETE` — on judges 0 MUST-FIX.
