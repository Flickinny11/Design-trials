# PRISM TOOLBAR V2 — RUN REPORT

**Date:** 2026-06-23 · **Branch:** `prism-editor-build` · **Model:** claude-opus-4-8
**Scope (founder):** the canvas-editor TOOLBAR only — spec `docs/prism/PRISM-EDITOR-CHROME-SPEC.md`
§0 D1–D7, §1 TB-1..9, §2 IC-1..5, §6 generation, §7 verification. Node editor (§3 NE)
and keyframe editor (§4 KF) **DEFERRED** to later founder-scoped runs.

## Why this run existed
The previous toolbar run built the forms as PROCEDURAL Three.js geometry + shaders,
violating the binding directive that every visual FORM be a **GENERATED photoreal 3D
object** (a real GLB on disk, like the watch GLBs). This run REDOES the toolbar to the
hardened spec: the shell, every button, and every icon are now generated GLBs; the prior
run's procedural forms are discarded. The liquid-glass material, the warp, the hover-spin,
the tooltips, and the action wiring are reused as the BEHAVIOR layer on top of the GLBs
(sanctioned by spec §6).

---

## 1. The generated GLB forms (on disk)
All under `kid-kode-landing/public/prism-mock/editor/meshes/` — **29 GLBs, 22 MB total**,
all **plain/uncompressed** (no DRACO/meshopt, since no decoder is wired in the app runtime).

| Form | Files | How generated |
|---|---|---|
| Toolbar shell | `shell.glb` (0.29 MB) | Tripo v3.1 `text_to_model` → a solid smooth rounded liquid-glass rail (regenerated; the first prompt produced a hollow ring) |
| 14 buttons | `btn-{transform,selection,add,library,image,object3d,background,changeArtifact,promptEdit,text,animation,function,lighting,build}.glb` (~0.8 MB ea) | Tripo v3.1 `text_to_model` → a coherent luxury machined-metal medallion family (knurled/fluted/beaded/hex bezels) |
| 14 icons | `ic-{…same ids…}.glb` (~0.75 MB ea) | Tripo v3.1 `text_to_model` → bespoke colored 3D emblems (RGB-arrow gizmo, amethyst+brackets, mint cross, fanned cards, rose-gold frame+mountain, teal crystal-in-cage, ringed planet, gold sparkle, jade caret pill, ice "T", tangerine play, cyan node-link, glass bulb, gold cog) |

**Optimization (wave 1):** Tripo returned each at ~1.46M tris / ~44 MB (it ignored `face_limit`).
A build-time pass (`/.assetgen/optimize-glb.mjs`: gltf-transform weld→simplify[meshoptimizer]
→dedup→prune + sharp texture downsize) decimated to ~24k tris + 512–1024 px textures, writing
**plain GLB** — 1.2 GB → 22 MB total. Fidelity preserved (verified by render). Keys stay in
`.assetgen/` (gitignored).

## 2. Mount + behaviors (wave 2–3)
Isolated R3F WebGL canvas (`liquid-toolbar/`, the Glb3DPreview idiom — never touches the
`three/webgpu` graph scene).
- **Shell:** `useShellGeometry` extracts the shell GLB mesh, scales it to the rail box, and
  renders it under `MeshTransmissionMaterial` (real transmission FBO + soap-film iridescence —
  not glassmorphism). A per-frame **vertex warp** (traveling sine on X, phase-shifted on Z,
  cached rest positions) makes it bend/undulate like liquid glass (TB-1/TB-2).
- **Buttons:** each `btn-<id>.glb` (kept baked metal PBR) is seated in a recessed socket in the
  glass; **hover-spin physics** (3.5-turn impulse on X, +2.6 on click, friction decel, settle to
  nearest turn) tumbles it end-over-end revealing its 3D depth (TB-3/4/5/6).
- **Icons:** each `ic-<id>.glb` mounts on the coin face with its baked color routed to emissive
  for a vivid glow + hover-brighten; tumbles with the coin (IC-1/2/3).
- **Engraving (TB-8):** changeArtifact / text / build present the SAME generated icon GLB as an
  intaglio (recessed well + cut-metal re-material) that glows + lifts + sweeps on hover.
- **Tooltips (TB-7/IC-4):** textless buttons show a glass hover tooltip; ADD + BUILD carry
  persistent inline labels.
- **Actions (TB-9/D6):** unchanged wiring — every button fires its real handler.

## 3. Verification (wave 4)
- **Cold load:** `_next` 404s 0, page errors 0, `<canvas>` present, no stuck loader.
- **Scene-graph assertion** (`window.__PRISM_TOOLBAR_SCENE__` traverse): **29 GLB-backed meshes**
  (shell + 14 btn + 14 ic), **0 procedural form stand-ins**. The generated GLBs ARE the mounted
  forms — no procedural fallback. (29 GLBs also confirmed fetched via `performance.resource`.)
- **Motion:** warp proven numerically (shell vertex deforms per-frame, `warpActive:true`); spin
  proven by a 4-phase montage (face → edge sliver → back → edge sliver).
- **tsc gate:** 0 new (9 total · baseline 10). **Console errors in canvas mode:** 0.
- **art-fidelity stage-1:** 6/6 PASS (`art-fidelity-report.json`).
- **prism-criteria-reviewer:** every in-scope row D1–D7 / TB-1..9 / IC-1..5 = **MEET**; NE/KF
  legitimately out of scope. The sole MUST-FIX was a broken evidence citation in the checklist
  (fixed); two nits addressed (loud warn vs silent shell box-fallback; dead procedural exports
  trimmed from `kit.tsx`).
- **user-advocate (round 1):** assets premium + on-claim, but flagged two in-app MUST-FIXes —
  shattered-glass refraction on hover, and buttons/icons smearing to mush behind the glass.
  **Fixed:** cut + capped the refraction churn (kills the shatter) and raised the coins + pushed
  the icons in front of the glass (kills the mush); recaptured. _(Round-2 verdict: see §4.)_

Full per-row evidence: `notes/EDITOR-CHROME-CHECKLIST.md`. Frames: `notes/verification/toolbar-v2/`.

## 4. Final verdicts
- **art-fidelity:** 6/6 PASS.
- **prism-criteria-reviewer:** all in-scope rows (D1–D7, TB-1..9, IC-1..5) MEET; NE/KF legitimately
  DEFERRED; defect gate clean (0 procedural form stand-ins, no glassmorphism, no cheap icons, no
  forbidden import). MUST-FIX (checklist citation) + 2 nits all addressed.
- **user-advocate (round 2): PLEASED.** Both round-1 MUST-FIXes confirmed resolved on recaptured
  frames — shattered-glass-on-hover gone (smooth refraction), and buttons/icons read as crisp,
  distinct, colored 3D objects in the live rail. "The claim now holds in the live app… this clears
  the bar." Residual non-blocking FLAG: lower-rail hover still showed some churn + a faint engraved
  build button → addressed by a follow-up tweak (reduced the hover-energy warp/distortion bump
  further; brightened + enlarged the engraved icon on hover so the build engraving lifts and glows
  clearly). The vertical refraction striation that remains is the liquid-glass character, not a defect.
- **Cold load** clean · **tsc** 0-new · **console** 0 errors in canvas mode.

**Result: 100% of in-scope checklist rows PASS; NE/KF DEFERRED by founder scope.**

## 5. Honest flags
- The toolbar GLBs are Tripo `text_to_model` (not image/multi-view); the icons + buttons came out
  premium, so multi-view wasn't needed. The shell needed one re-prompt.
- The engraving's hover state also rises+spins the coin (button behavior), so a fixed-crop capture
  of the engraving "reveal" catches mostly the glow; the rest-state intaglio + hover glow are both
  present (advocate round-1 non-blocking FLAG).
- A latent `BoxGeometry` fallback remains in `useShellGeometry` for the case the shell GLB fails to
  load; it now logs a loud warning rather than silently substituting a box.

---

PRISM-TOOLBAR-V2: RUN COMPLETE
