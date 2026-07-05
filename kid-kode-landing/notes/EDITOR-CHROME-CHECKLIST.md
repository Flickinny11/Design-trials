# PRISM EDITOR-CHROME — per-row verification checklist (TOOLBAR V2)

Spec: `docs/prism/PRISM-EDITOR-CHROME-SPEC.md`. Scope this run: the TOOLBAR
(§0 D1–D7, §1 TB-1..9, §2 IC-1..5). Node editor (§3 NE) + keyframe editor (§4 KF)
are **DEFERRED** by founder scope (toolbar-only run). Every in-scope row walked
individually with cited evidence. Frames in `notes/verification/toolbar-v2/`.

Cold load: `_next` 404s **0**, page errors **0**, `<canvas>` present, no stuck loader.
tsc gate: **0 new** (9 total · baseline 10). Console errors in canvas mode: **0**.

Scene-graph assertion (`window.__PRISM_TOOLBAR_SCENE__` traverse): **29 GLB-backed
meshes** mounted (shell + 14 btn + 14 ic), **0 procedural form stand-ins**, 33
procedural *decorations* (socket rings / recess discs / glass core / backdrop —
not forms). 29 GLBs fetched (perf.resource). Disk: `public/prism-mock/editor/meshes/` 29 GLBs, 22 MB.

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| **D1** | Generation mandatory — every form a GLB on disk | **PASS** | `ls meshes/*.glb` = 29; scene assertion 29 GLB-backed meshes, 0 procedural form stand-ins |
| **D2** | Nothing flat | **PASS** | Rail = transmission-glass slab; buttons = 3D medallions; icons = 3D GLBs. `hero-rail.png`, grids. No CSS/flat surface |
| **D3** | No stock/cheap icons | **PASS** | `grid-icons-opt.png`: 14 bespoke 3D emblems; promptEdit = caret pill (banned lightning replaced). No emoji/Lucide/box/line |
| **D4** | No grotesque fonts | **PASS** | Only text = tooltip + ADD/BUILD via `ui-sans-serif` (Inter/system); no display/grotesque face |
| **D5** | Over-use styleguide/experiments | **PASS** | MeshTransmissionMaterial (soap-film iridescence) + studio Lightformer rig + generated PBR; reuses Glb3DPreview idiom |
| **D6** | Preserve function | **PASS** | Action matrix below — all 14 handlers fire |
| **D7** | Per-criterion verification | **PASS** | This checklist |
| **TB-1** | Toolbar = generated liquid-glass GLB (not glassmorphism) | **PASS** | `shell.glb` on disk (0.29MB); scene: shell mesh `userData.glbSource=shell.glb` under MeshTransmissionMaterial (real transmission FBO + refraction, not a blur panel) |
| **TB-2** | Toolbar warps/bends like liquid glass | **PASS** | Per-frame vertex warp on shell geometry; numeric: vertex 2860 moved over 400ms (`warpActive:true`); silhouette varies across `spin-p0..3` |
| **TB-3** | Each button own generated GLB sunk in glass | **PASS** | 14 `btn-*.glb` on disk; scene: 14 button GLB meshes; seated at REST_Z below the glass front face |
| **TB-4** | Hover → 3–4 end-over-end turns on horizontal (X) axis | **PASS** | `HOVER_TURNS=3.5` impulse on `rotation.x`; `EV-spin.jpg` (+ `spin-p0..3.png`) shows end-over-end rotation |
| **TB-5** | Click accelerates then smoothly decelerates | **PASS** | `CLICK_TURNS=2.6` added impulse + `FRICTION=1.35` decay + settle-to-nearest-turn (ToolButton3D spin integrator) |
| **TB-6** | Spin reveals real 3D depth/edges/shadows | **PASS** | `EV-spin.jpg` (+ `spin-p0..3.png`): face → edge sliver → back → edge sliver (coin collapses to a metallic edge at 90°/270°) |
| **TB-7** | Most textless + hover tooltip; few carry text | **PASS** | `w3-hover.png`: "Background" glass tooltip on hover (opacity 1); ADD + BUILD persistent inline labels |
| **TB-8** | A few buttons engraved with their icon, animated on hover | **PASS** | changeArtifact/text/build = intaglio (recess + cut-metal re-material); `engrave-rest.png` vs `engrave-hover.png` show glow + lift on hover |
| **TB-9** | Every toolbar action still fires | **PASS** | Action matrix: 13 open their flyout (transform→Transform, library→Elements, …, build→Build); function opens its binding popup only with a node selected (documented special-case). 14/14 handlers fire |
| **IC-1** | Every icon a generated bespoke 3D GLB | **PASS** | 14 `ic-*.glb` on disk; scene: 14 icon GLB meshes mounted |
| **IC-2** | Icons colored | **PASS** | `grid-icons-opt.png`: RGB gizmo, mint cross, amber cards, rose-gold frame, teal crystal, orchid planet, gold sparkle, jade pill, ice T, tangerine play, cyan node-link, warm bulb, gold cog |
| **IC-3** | Icons animated, gradients + shadows + premium | **PASS** | Idle sway + hover-brighten (baseColor→emissive lerp); icons tumble with the coin (spin montage); PBR gradients + scene shadows |
| **IC-4** | Hover tooltips on icons | **PASS** | Same tooltip layer — label appears on hover (`w3-hover.png`) |
| **IC-5** | Zero emoji/Lucide/lightning/box/line/cheap (defect) | **PASS** | All bespoke generated 3D GLBs; `grid-icons-opt.png` |
| **NE-1..5** | Node editor chrome | **DEFERRED** | Founder scope: toolbar-only run |
| **KF-1..2** | Keyframe editor | **DEFERRED** | Founder scope: toolbar-only run |

**Defect gate (auto-MUST-FIX):** flat surface — none · procedural form stand-in —
**0** (scene assertion) · glassmorphism-as-liquid-glass — none (real transmission) ·
emoji/Lucide/lightning/box/line/cheap symbol — none · grotesque font — none ·
non-firing action — none. **CLEAN.**

**Reviewers:** art-fidelity stage-1 **6/6 PASS** (`art-fidelity-report.json`);
prism-criteria-reviewer — **all in-scope rows MEET**, defect gate clean, NE/KF DEFERRED;
user-advocate — **PLEASED** (both MUST-FIXes resolved; residual lower-rail hover FLAG addressed).
