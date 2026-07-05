# CANVAS PRODUCTION-READY FINAL — Change-Artifact generation wired to fal + full human-grade system test. (Claude Code, ultracode)

## MODEL & MODE
claude-opus-4-8 (confirm line 1; note any opus fallback). ULTRACODE: Dynamic Workflows, parallel subagents, contract-first
per phase. Branch prism-editor-build, from git root. AUTO-CKPT at every VERIFIED phase (standard exclusions; verify
worktrees=0). LOGAN-INBOX polling at phase boundaries. ANTI-STUCK: web-search CURRENT (June 2026) approaches after ~2
fails; never downgrade a dep; NEVER fake/assert — evidence or it didn't happen. ENV: NODE_ENV unset; kill all browsers/
dev servers at each phase end; free ports. Maintain notes/verification/CANVAS-FINAL-PROGRESS.md continuously (resumable).

## READ FIRST
PRISM-CANVAS-EDITOR-SPEC.md §12 (Change Artifact wizard — Upload + Prompt), §12.2 (per-face mapping), §13 (prebuilt
library), §11 material, §8.3 picker, §18 criteria (esp. 19/20/21), §19 forbidden, §20 re-verify. PRISM-ENGINE-SPEC-V3
§ integrations (provider/credential-vault model). docs/prism/DESIGN-REFERENCES.md (required toolkit for any new UI).
The fal seams already in repo: kid-kode-landing/src/server/image-gen/, text-fill/, mock-app-source/assets/provision-
assets.mjs; FAL_KEY in kid-kode-landing/.env.local. The Observatory-Brass design system (consume its tokens/materials).
The ORRERY showcase. The honest-flags lists in CANVAS-COMPLETION / UI-FIDELITY-2 / PHYSICS-FLUID reports.

## PHASE 1 — CHANGE-ARTIFACT GENERATION, WIRED TO FAL (the core ask; build to §12, do NOT invent new spec)
Make the spec's Change-Artifact wizard fully real and seamless from inside Canvas: a user editing ANY element can
regenerate/replace its artifact, then keep editing the replacement.
- TOOLBAR + UI: add the Change-Artifact entry points per §12 (Add/Image/3D/Text groups already exist — wire "Change
  Artifact" / "Generate" affordances on the selected node + its inspector). New windows: the Upload wizard (§12.1:
  shape preview, per-face slots cube=6/cone=2/sphere=1, drag-to-assign, modify-shape, post-map crop/scale/opacity) and
  the Prompt wizard (§12.2: Image/3D/Video/Code tabs, prompt box + up to 4 multi-view slots, interactive result
  viewport, Use This / Change This→Modify This / From Scratch). Premium, in the Observatory-Brass language, mobile-aware.
- FAL PIPELINE: wire generation to fal via the existing server seams. RE-VERIFY CURRENT BEST fal models at build (June
  2026): image, single-image/prompt→3D (Logan's note: modern single-shot 3D generators now beat multi-view stitching —
  prefer them; keep multi-view only if it measurably wins), video, and image editing/variation. Implement the FULL
  result flow: generate → preview (interactive in-viewport for 3D) → **Use This** swaps the node's artifact AND retains
  the prior in the artifact library → user continues editing the new artifact (transform/material/animation all apply).
  Upload-your-own-media → generate-from-it path included (§12.1 + img2img/img23D).
- PROVIDER ABSTRACTION (Logan's intent, spec's credential-vault model): present it as Prism's OWN in-house media
  generator exposing the FULL model library (never surface "fal" in the user UI). Architect a clean provider layer so
  (a) fal is the default backing provider, (b) a user can optionally add their own API key for other platforms later
  (BYOK hook stubbed + documented, not necessarily all wired), (c) generation is metered as Prism credits per
  generation (credit-accounting hook + per-generation cost surfaced; billing backend is engine-spec scope — stub the
  meter cleanly, never fake spend). $50 fal budget for THIS build's own test generations: running ledger, warn $25/$40,
  STOP at $48.
- GATES: criteria 19 (upload→faces mapping), 20 (prompt→image/3D/video/code, 3D interactive, Use This swaps+retains),
  21. Round-trips through save/reload (replacement persists as that node's artifact). Real fal calls proven in the
  report with generated artifacts swapped onto live nodes.

## PHASE 2 — FULL HUMAN-GRADE SYSTEM TEST (every system, used as a human would)
The USER-ADVOCATE (computer-use, real app on GPU) drives the COMPLETE editor as a non-technical human — click, drag,
scroll, type, multi-select — across DESKTOP and a MOBILE viewport, exercising EVERY system end to end: 3 modes
(Galaxy/Canvas/Preview) + transitions; add text (font/texture-fill)/image/3D-object; apply animations from the 370+
catalog via the picker (all 5 drivers); physics primitives; material + lighting edits; grouping/ungroup; per-face image
mapping; AND the new Change-Artifact generate→Use-This→keep-editing flow. PRECAUTIONS (so "think like a human" stays
sound, not reckless): evidence-required verdicts (cite frame + the interaction performed); MUST-FIX only for genuine
breakage/confusion/dead-controls; FLAG (don't block) subjective taste; advocate may NOT edit code or invent scope —
it reports; a human-sensible rubric ("could a first-timer do this unprompted? is it smooth, navigable, intuitive, does
it make sense?") + Logan's finish-line quote. Produce a SYSTEM-TEST MATRIX: every system × desktop/mobile → pass +
evidence, or a logged defect.

## PHASE 3 — FIX + POLISH + OPTIMIZE
Fix every MUST-FIX from Phase 2. Clear the carried cosmetic honest-flags (physics soft-bead/bright-clip nits; jelly
saturation; the violet-orb retint — DEFAULT to retinting it brass/ice unless LOGAN-INBOX says keep). PERF PASS: measure
+ optimize for smooth/fast/responsive on BOTH desktop and mobile (frame budget held on T1; interaction latency <100ms;
tier-gating intact INV-9); fix any jank. No-regression: full suite + 370+ catalog render/play/control.

## PHASE 4 — PRODUCTION SIGN-OFF
Re-run the §18 criteria end-to-end (the buildable set) + §19 forbidden sweep, desktop AND mobile, advocate at DPR-2 with
zoom crops + the Slider-Revolution side-by-side standard. Produce the criterion-by-criterion evidence table and a clear
PRODUCTION-READY verdict: is the Canvas editor complete, premium, smooth, fast, responsive, optimized, mobile+desktop,
and shippable? Anything not → fix or flag HONESTLY with exact reason.

## GUARDRAILS
One renderer (Three.js/TSL/WebGPU); no PixiJS/2nd renderer; no stock icons; no diffusion-drawn letterforms; no
global-fps; no dep downgrades; additive-only schema; INV-9 tiering; NO PURPLE; design-tokens-only styling; assertion-
based verification FORBIDDEN; never surface "fal" in user-facing UI; never print FAL_KEY; secret-leak check before any
checkpoint.

## OUTPUT
notes/CANVAS-PRODUCTION-FINAL-REPORT.md: Phase-1 wired-generation walkthrough (real fal artifacts swapped onto nodes,
before/after, fal spend ledger); the system-test matrix (every system × desktop/mobile); fixes/polish/perf table;
the §18 + §19 production sign-off table with DPR-2 evidence; dependency-usage for any new UI; honest flags; AUTO-CKPT
hashes. Frames under kid-kode-landing/notes/verification/canvas-final/. Plain-language summary for Logan + the
production-ready verdict. STOP.

## MODEL FALLBACK GUARD (2026-06-13 — CRITICAL)
Fable-5 is unavailable and SILENTLY falls back to opus-4-8 (verified: requesting fable returned modelUsage=
claude-opus-4-8). This run is pinned to claude-opus-4-8 deliberately. At session start AND after any sentinel
auto-resume, CONFIRM modelUsage is the pinned model and RECORD it in the ledger. If a future session finds fable-5
genuinely available again (modelUsage==claude-fable-5 on a probe) you MAY switch back — but never trust the label;
always verify modelUsage.
