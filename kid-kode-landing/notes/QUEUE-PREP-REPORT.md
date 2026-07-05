# QUEUE-PREP — Report

**Status: COMPLETE.** Headless research+spec run. Deliverables: two queued-run build prompts +
research notes. NO code touched, NO browser driven, NO git run this session (files left untracked
for the monitor to commit safely). Model: claude-opus-4-8 (per env block).

---

## Deliverables (all written)
1. **`THREE-D-BACKGROUNDS-PROMPT.md`** (git root) — 3D background library. 6 phases (P0–P5),
   14 atomic success criteria, full FORMAT (model guard, Logan bar, DECISIONS D1–D11, INVARIANTS
   INV-1–10, FORBIDDEN FP-1–10, verification gate, completion marker, resumable ledger, AUTO-CKPT,
   LOGAN-INBOX).
2. **`GUIDED-TIPS-PROMPT.md`** (git root) — glowing-lightbulb first-visit walkthrough. 5 phases
   (P0–P4), 13 atomic success criteria, full FORMAT (same structure).
3. **`kid-kode-landing/notes/QUEUE-PREP-RESEARCH.md`** — dated research log (Domain A backgrounds,
   Domain B guided tips, proposed DESIGN-REFERENCES additions, instinct-vs-newest scorecard).
4. **`kid-kode-landing/notes/verification/QUEUE-PREP-PROGRESS.md`** — resumable ledger.

Both prompts were grep-self-checked against the FORMAT list — every required element confirmed
present in both files.

---

## What each prompt covers

### THREE-D-BACKGROUNDS-PROMPT.md — 3D background library
A library of massive, depth-scattered, animated, customizable hub backgrounds built as an
**image + REAL-3D-sprinkle HYBRID** expressed as a typed **layer stack** over the existing
`PrismHub.background: PrismHubBackgroundLayer[]` schema (additive only). The layer stack
(back-to-front): procedural volumetric nebula OR fal base plate (`infinite-environment`) →
depth-displaced parallax plate(s) (`parallax`/`world`) → GPU-compute particle/star field in real Z
(`world`) → optional Spark splat (`world`, desktop/T2) → camera-locked near-FX. Every layer lives in
scene Z so the **P2 `PrismHub.cameraKeyframes` camera journey flies through it with true parallax**
— no special-casing. Tier-gated (T0/T1/T2; mobile swaps raymarch→billboard, compute→points, drops
splat). Each preset is a droppable, customizable, round-tripping asset. Phases: contract+re-verify →
procedural core → hybrid image layer → splat → library UX + camera-journey readiness → verify.

### GUIDED-TIPS-PROMPT.md — glowing-lightbulb walkthrough
A top-right glowing lightbulb that launches a first-visit walkthrough where **Prism drives the
screen**: a programmatically driven animated cursor (reusing the existing `mouse-follower`/lerped
cursor) travels between targets; steps highlight via either a **DOM-chrome spotlight cutout** or a
**scene spotlight** (dimming the live WebGPU scene around a framed artifact); high-tech popups show
the relevant artifact **animated in 3D sharing the one renderer** + premium MSDF explanation +
Skip/Close. First-visit-aware (localStorage seen-flag), skippable, dismissible (Close/Esc/scrim),
re-triggerable from the lightbulb. A11y-first (prefers-reduced-motion fallback, focus trap, keyboard,
ARIA, brass focus ring). Built from the 406+ primitives + DESIGN-REFERENCES; bespoke controller
(not a heavy off-the-shelf tour lib, which can't touch the WebGPU scene). Phases: contract+re-verify
→ lightbulb+shell → scene-spotlight+3D popups → a11y+responsive → verify. The advocate verification
**actually triggers and steps through** the walkthrough.

---

## Research findings + chosen tools (full log in QUEUE-PREP-RESEARCH.md; searched 2026-06-14)

### 3D backgrounds
- **Base image:** 🆕 **FLUX.2 [dev] Turbo / [flex]** on fal (32B, cheaper/faster than the FLUX.1
  path the repo last locked) — but **procedural-first**; fal is the "image half" + richness/fallback,
  not the default. Negative prompt must kill text (INV-11).
- **Depth/parallax:** **fal `depth-anything` v2** stays the proven default (already wired →
  `parallax-plane`); 🆕 **Depth Anything V3 (ICLR 2026)** flagged as an optional upgrade (better on
  backlit/low-light/reflective) where reachable.
- **Volumetric:** 🆕 **TSL/WebGPU raymarch** with Beer-Lambert absorption + Henyey-Greenstein phase
  + light-march self-shadow (WebGL2 billboard fallback) — a real step up from flat FBM planes;
  composes the existing `nebula.ts`/`clouds.ts` primitives. Refs: Maxime Heckel TSL field guide,
  `dgreenheck/webgpu-galaxy`, `CK42BB/procedural-clouds-threejs`.
- **Particles:** 🆕 **WebGPU compute particles** (`instancedArray`, 300k–1M) for depth-scattered
  starfields in real Z; instanced `Points` fallback on mobile. (three.js `webgpu_compute_particles`.)
- **Splat:** 🆕 **Spark 2.0** (`@sparkjsdev/spark`, April 2026, World Labs) — LoD streaming of huge
  3DGS worlds, `.SOG`/`.SPZ` (~1M gaussians @ ~14MB); desktop/T2 only, procedural fallback below.

### Guided tips
- **Core:** a **bespoke a11y-first controller** (rejecting Onborda/Joyride as the core — they can't
  touch the WebGPU scene; Onborda ships no a11y), borrowing **Driver.js's** zero-dep spotlight-cutout
  technique for DOM-chrome steps.
- **Cursor:** drive the **existing `mouse-follower`/lerped cursor** (DESIGN-REFERENCES §7)
  programmatically — no new dep; the "Prism drives the screen" feel (concept ref: Jimo Smart Cursors).
- **Scene-spotlight + 3D popup:** bespoke by necessity (no library dims a WebGPU canvas or renders a
  3D artifact in a popup) — composed from the 406+ primitives + postprocessing (bloom/vignette).
- **A11y (2026 bar / WCAG 2.2):** prefers-reduced-motion fallback, focus trap, keyboard, ARIA — a
  real path, not a stub (Shepherd.js referenced for a11y patterns).

---

## Proposed DESIGN-REFERENCES.md additions (proposals only — this run does not edit docs)
Add ONLY where a 2026 tool clearly beats the existing toolkit; the build agent decides:
1. **Spark 2.0 (April 2026) LoD streaming** for 3DGS (`.SOG`/`.SPZ`, ~1M @ ~14MB) — beats the bare
   `gsplat.js`/`@mkkellogg` mention already in §13.
2. **Depth Anything V3 (ICLR 2026)** as the parallax-depth upgrade over V2 (keep V2 as proven default).
3. **Volumetric raymarch recipe in TSL** (Beer-Lambert + Henyey-Greenstein + light-march, WebGL2
   billboard fallback) — the doc has FBM/domain-warp but not the volumetric phase-function recipe.
4. **TSL GPU-compute particles** (`instancedArray`, 300k–1M) for depth-scattered starfields, with an
   instanced-`Points` mobile fallback.
5. **A small "Onboarding / Guided Tours" note:** Driver.js (spotlight cutout, zero-dep) as the
   highlight technique; Onborda's a11y gap + Shepherd's a11y strength; Jimo Smart Cursors as the
   cursor-driven concept reference.

---

## Honest flags
- Versions/model ids in the prompts are anchored to the 2026-06-14 search snapshot; both prompts
  carry a **RE-VERIFY CURRENT** step instructing the build agent to re-pull current versions and
  fall back without blocking — so a drift between now and queue-run won't stall either build.
- I did not (and per scope must not) verify the picks against the running app, npm registry installs,
  or the build agent's code — these are SPEC prompts, not implementations. The build agents own
  empirical verification via their own advocate + numeric harness gates.
- `PrismHub.background` and `PrismHub.cameraKeyframes` are confirmed present in
  `src/lib/prism-graph/types.ts` as additive optional fields, so the 3D-backgrounds prompt targets a
  real schema seam (no new graph schema invented).

QUEUE-PREP: RUN COMPLETE
