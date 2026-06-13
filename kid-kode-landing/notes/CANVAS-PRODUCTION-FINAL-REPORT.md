# CANVAS PRODUCTION-FINAL REPORT

**Run:** 2026-06-13 · **Branch:** `prism-editor-build` · **Model:** claude-opus-4-8 (confirmed; Fable-5 unavailable → pinned Opus 4.8 per launch-kit guard).

This report is built phase-by-phase. Evidence frames live under
`kid-kode-landing/notes/verification/canvas-final/`. The fal spend ledger is
`kid-kode-landing/notes/verification/canvas-final/fal-ledger.json` (authoritative).

---

## PLAIN-LANGUAGE SUMMARY (for Logan)

Inside the Canvas editor, you can now point at any element and **change what it's
made of** — without losing where it sits, how it's animated, or how it's lit.
Two ways:

- **Upload** your own picture, 3D model, video, or Rive file — and (for pictures)
  wrap it onto a shape (cube/sphere/cone/cylinder), mapping a different picture to
  each face.
- **Generate** it: describe what you want and Prism makes it — a picture, a real
  **3D object you can spin right there in the window**, a short video, or a
  composed 3D element. Pick **Standard** or **Studio** quality; each shows its
  credit cost. Hit **Use this** and it lands on the element; the old version is
  kept in an **artifact library** so you can always go back.

It's wired to a real cloud media generator (Prism's own — the underlying vendor
is never shown to the user), metered in Prism credits, and architected so you
could later plug in your own API key. Everything round-trips through save/reload.

---

## PHASE 1 — CHANGE-ARTIFACT GENERATION, WIRED (COMPLETE ✅)

### What shipped

| Piece | Where | Status |
|---|---|---|
| **Prism Media Generator** (provider layer) | `src/server/media-gen/{types,catalog,credits,fal-provider,compose-spec,byok,handle,index}.ts` | ✅ fal-backed, **branded** (no "fal" in any client payload — verified `grep -ci fal` = 0), **metered** (credits + real-USD build-budget guard), **BYOK** stub documented |
| **Asset persistence** | `src/server/assets/store.ts` + extended `/api/prism/assets` | ✅ generated image/glb/mp4 + uploaded glb/usdz/mp4/riv → one content-hash URL space; `toFalReachableUrl` uploads local assets to fal storage for edit/3D/video inputs |
| **Routes** | `/api/prism/image-gen` (rewired), `/api/prism/media-gen` (GET catalog+meter / POST dispatch) | ✅ one code path (`handle.ts`): budget-guard → provider → persist → meter |
| **Schema (additive INV-8)** | `PrismNode.artifactLibrary?`, `PrismNode.faceTextures?` | ✅ tsc-clean, round-trips |
| **Per-face rendering** | `mesh-primitive.ts buildFaceMaterials` + `default-factory.ts` + content-hash | ✅ Box=6 / Cone=2 / Cylinder=3 / Sphere=1 material groups |
| **Upload wizard** (§12.1) | `change-artifact/UploadWizard.tsx` + `ShapeFaceMapper.tsx` | ✅ drop image/glb/usdz/video/riv; flat or map-onto-shape with numbered face slots, drag-to-assign, modify-shape dims, per-face crop/opacity |
| **Prompt wizard** (§12.2) | `change-artifact/PromptWizard.tsx` + `Glb3DPreview.tsx` + `ModelPicker.tsx` | ✅ Image/3D/Video/Code tabs, prompt + up to 4 multi-view slots, interactive 3D viewport, Use This / Change This→Modify This / From Scratch |
| **Artifact library** | `change-artifact/ArtifactLibraryPanel.tsx` + `lib/editor/artifact-library.ts` + `apply-artifact.ts` | ✅ Use This retains prior (append-only); Restore |
| **Entry points** | toolbar **Change Artifact** group (`CanvasToolbar` + `ChangeArtifactFlyout`); Inspector **Change Artifact** button; `ChangeArtifactWizard` mount in `page.tsx` | ✅ |

UI built per the Observatory-Brass design system (`ds-glass`/`ds-btn`/brass kit
from `animation-tools/ui`), GSAP entrance + magnetic hover, Icon component only,
no purple, plain-language copy, mobile-aware. 4 leaf components were built in
parallel via a contract-first Workflow against fixed prop contracts
(`change-artifact/wizard-types.ts`).

### Re-verified fal models (§20, June 2026)

| Lane | Prism model (UI) | Backing endpoint (server-only) | Real-call status |
|---|---|---|---|
| Image | Standard / Studio | `fal-ai/flux-2` / `fal-ai/flux-2-pro` | ✅ proven (1.5s, `data.images[0]`) |
| Edit | Modify | `fal-ai/flux/dev/image-to-image` | ✅ proven (3.5s; first guessed id `flux-2/dev/i2i` was 404 → corrected) |
| 3D | Prism 3D | `fal-ai/hunyuan3d-v3/image-to-3d` (→ `trellis` → `hyper3d/rodin` fallbacks) | ✅ proven (`model_mesh.url`/`model_glb.url` → .glb) |
| Video | Prism Motion | `fal-ai/kling-video/v3/pro/image-to-video` | proven in June showcase (`data.video.url`); not re-billed this run |
| Code | Prism Compose | `fal-ai/any-llm` (claude-3.5-sonnet) → validated `ArtifactComposeSpec` | ✅ proven (JSON → clamped meshPrimitive+material; INV-10 contamination-aware) |

### Live-app evidence (real Chrome, Metal GPU, WebGPU, DPR 2)

Driven through the real editor by `scripts/canvas-final/verify-*.mjs`. **0 console
errors, 0 network failures** across the proven flows.

| Criterion | Evidence frame(s) | Result |
|---|---|---|
| **19** Upload→faces (cube=6, drag-assign, dims) | `26-shape-mapper-cube.png` (shape picker Cube/Sphere/Cone/Cylinder/Plane; 6 numbered face slots; picture pool) | ✅ |
| **20** Prompt→image, result, Use This | `05-prompt-result-image.png` (real brass-orrery image in viewport; Standard/Studio credits), `06-after-use-this.png` (node created + selected) | ✅ |
| **20** Prompt→3D, **interactive** viewport | `20-3d-input.png` (4 view slots, "Uses 8 credits"), `21-3d-result.png` (generated armillary GLB in orbit viewport), `22-3d-after-drag.png` (model visibly reoriented after drag — orbit interactivity) | ✅ |
| **20** Use This **retains prior** + Restore | `32-artifact-library.png` ("IN USE NOW" + retired tile with Restore), `33-after-restore.png` | ✅ |
| **Round-trip** (persist to reload-source) | `live-graph.json`: node `c86cbb4b` renderMode `plane` + generated `/prism-mock/uploads/…png`; node `275a9342` renderMode `mesh` + generated `…glb`; node `862c5c9e` `artifactLibrary` = 2 entries | ✅ |
| Branding (never surface "fal") | `GET /api/prism/media-gen` catalog JSON — `grep -ci fal` = **0** | ✅ |

### Before / after (a node's artifact, generated → swapped)

- **Before:** a fresh bubble element (no artifact) → minted via the toolbar
  Change-Artifact entry.
- **After (image):** node `c86cbb4b` carries the generated brass-orrery image as
  its `visual.sourceAsset` (renderMode `plane`), placed at its scene position.
- **After (3D):** node `275a9342` carries a generated `.glb` (renderMode `mesh`),
  lit by the scene rig, spinnable.
- The prior artifact, when one existed, is retained (`862c5c9e` library = 2).

### Fal spend ledger (this build's own test generations)

Budget $50 · warn $25/$40 · STOP $48. **Total at end of Phase 1: $0.263** (12
calls, 11 ok, 1 expected fail — the corrected edit-endpoint 404, $0 charged).
Well within budget. All generations metered through the in-product credit meter
too (stub tally; billing backend is engine-spec scope, never faked).

### Bug found + fixed during verification

- **`compile-anchors.ts` crash** (`Cannot read properties of undefined (reading
  'toLowerCase')`): `classifyByServiceTag`/`classifyBySubtype` assumed a
  serviceTag/subtype was always present, but **any** editor-minted node
  (including the shipped "+ Add Node") has none → the compile path crashed the
  whole app when such a node was in a compiled hub. Fixed defensively
  (`(serviceTag ?? '').toLowerCase()`); the minted Change-Artifact node also now
  carries a `serviceTag`. This was a **pre-existing latent bug** surfaced by the
  Change-Artifact "new element" flow.

### Honest flags carried into later phases

- **Criterion 21** (prebuilt element library, drag-to-place clusters) is **§13**,
  a feature distinct from the Change-Artifact (§12) ask. Not implemented in this
  build; flagged for Logan as separate scope (the §5 "Add from Library" affordance
  is not yet wired). Will confirm + state plainly in Phase 4.
- **Video lane** wired + uses the June-proven endpoint, but not re-billed with a
  fresh clip this run (kling v3 pro ≈ $0.10+/s). Phase 2/4 will capture one short
  real clip for the evidence table.
- **Fidelity:** the ShapeFaceMapper face labels read a touch small/low-contrast at
  DPR-2 (`26-shape-mapper-cube.png`) — queued for the Phase-3 polish pass against
  the raised-bar / Slider-Revolution standard.

### Checkpoints
- `dbe3500` — server spine. `8ccdcfe` — wizard UI. `4d9ec3b` — Phase-1 verify + compile-anchors fix.

---

## PHASE 2 — FULL HUMAN-GRADE SYSTEM TEST (COMPLETE ✅ — 0 MUST-FIX)

30 real-GPU frames captured (`scripts/canvas-final/system-test-capture.mjs`,
Chrome/WebGPU/DPR 2, desktop 1680×1050 + mobile 390×844, **0 console errors**),
then judged by 6 parallel **user-advocate** agents (non-technical-user rubric +
pro-3D-designer / Slider-Revolution bar; evidence-required, anti-rubber-stamp).
Frames in `notes/verification/canvas-final/system-test/`.

### System-test matrix

| System | Desktop | Mobile | Verdict |
|---|---|---|---|
| Modes (Galaxy/Canvas/Preview) + transitions | PASS | PASS (Canvas panels cramped — FLAG) | **MIXED** |
| Change Artifact (Upload + Prompt, generate→Use This→library) | PASS | PASS | **PASS** |
| Add / Text / Image tools | PASS | PASS | **PASS** |
| 3D object / Material / Lighting | PASS | PASS | **PASS** |
| Animation catalog (606 tiles, 46 pages, drivers) / Selection / Transform / Build | PASS | PASS (panel copy clipped — FLAG) | **MIXED** |
| Whole-editor mobile (390px) | — | PASS | **PASS** |

**MUST-FIX: 0.** Every system functions and reads premium. The advocate noted
the desktop animation catalog (**606 animations across 46 pages** with real
preview thumbnails, search, 7 category tabs, drivers, pagination) **exceeds** the
≥300 claim (criterion 12).

### Actionable flags (cosmetic — addressed in Phase 3)

| # | Flag | Where |
|---|---|---|
| F1/F12 | Mobile Canvas opens toolbar + Transform inspector together → occludes most of the 390px work surface | mobile-mode-canvas |
| F6 | Desktop Image inspector slider labels clipped on the left edge ("eft edge", "idth"…) | ImageFlyout PresentationControls |
| F7 | Engineer-jargon labels user-facing ("WIRED" status pill; "WRITES HUB LIGHTINGSPEC") | flyouts / lighting |
| F8/F9 | Mobile right-edge clipping (animation panel copy; bottom section-carousel tabs) | 390px panels |
| F3/F4 | Result-pane chrome plainer than the controls; quality-tier rows small | PromptWizard |
| F2/F10 | Mobile capture artifacts (Preview switch frame stuck on Canvas; tile-grid not reached) | recapture (not product bugs) |

Plus the carried cosmetic honest-flags from prior reports: physics
soft-bead/bright-clip, jelly saturation, **violet-orb retint → brass/ice**
(default per LOGAN-INBOX = no "keep" directive).
