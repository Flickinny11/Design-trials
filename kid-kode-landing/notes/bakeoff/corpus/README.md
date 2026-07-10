# W-BAKE frozen corpus (D1) — construction record + freeze

Authority: `docs/prism/RATIFICATION-2026-07-09.md` (OD12) + swarm-dispatch spec
v0.2 §11. Authored ONCE; identical for every contestant (I-B2). Any
post-freeze edit invalidates completed runs for the affected nodes.

## Functional corpus (`functional/`) — 50 cases

- **Reference plan:** the deterministic Conductor blueprint
  (`buildDeterministicBlueprint`) for the **Nova Atelier** reference brief
  (the same fixture family as the W5 pipeline proof), extended to five
  sections (Features, Collection, Pricing, Journal, Contact) → 6 hubs,
  **33 authored nodes** through the real certified path (`authorNode`).
- **Synthesized extras:** 17 additional cases in the same plan vocabulary
  (stat-tile / list-row / badge / quote-panel / thumb-card / divider-orn,
  cycled per hub) to reach 50. Marked `sourceNodeId: null` in each case file.
- **Stratification:** 30 simple / 15 moderate (**9 integration-bearing**,
  ≥8 required) / 5 complex. Tier definitions:
  - *simple* — static sprite/plane composition, no behavior.
  - *moderate* — interactions (hover/click) ± capability-referenced apiCalls
    + dataBindings; plane/parallax-plane/mesh modes.
  - *complex* — hero-grade: 2 cinematic primitives, emits, mesh or
    parallax-plane, multi-part visual spec.
- **Render modes:** codegen modes only (sprite/plane/parallax-plane/mesh).
  The blueprint's `renderMode:'text'` nodes need NO generated module (per
  `prompts.ts` SUB_PROMPT_TEXT), so their real copy rides inside cases as
  `intent.visualSpec.textContent` (rendered via `ctx.fontAtlas`, INV-R11).
- **Assets are real committed files** under `public/` (feature-card.png,
  parallax-stack.png + .depth.png, cta-hero.glb, gear-a.glb, chrome PBR maps).
- **Capability references only** (I3/I-B6): `capability:stripe.checkout`
  etc. — never tokens or secrets.

## Prompt layers (spec §3.1)

- **L1** — `functional/l1-system.txt` = `SHARED_SYSTEM_PROMPT` verbatim
  (byte-stable; hash in manifest).
- **L2** — `functional/l2-world.txt` = the WORLD block compiled ONCE for the
  whole bakeoff build (design tokens / nav map / shared contracts / animation
  vocabulary / capability references — the five permitted classes, nothing
  else). `worldHash` in manifest; byte-identical across every case, functional
  AND visual (A2).
- **L3** — frozen per case as the `l3` string in each case file:
  `buildPerNodePrompt(node, neighbors, atlas)` + render-mode guidance.
  Visual 3D hero cases without a GLB use the corpus-authored
  `VISUAL_HERO_SUBPROMPT` (procedural construction; frozen, identical for
  every contestant of that node).

## Visual corpus (`visual/`) — 20 cases, 8 genuinely 3D

- **Skeletons** (`skeletons.json`): 20 hero/visual cases authored from the
  design-grammar families + shell showpieces; 8 are genuinely 3D (camera,
  lighting, materials, motion): orbit product hero, particle constellation,
  glass prism refraction, kinetic 3D type, pedestal material study, loop
  column gallery, filmstrip carousel, orrery mechanism.
- **Design-director pass (OD12a):** Fable 5 (`claude-fable-5` via the claude
  CLI print route — `.constellation/` OpenRouter key does not exist on this
  machine; disclosed) authored every case's full visualSpec with concrete
  values: hex ramps, per-role type scale, spacing rhythm, camera + light
  rigs, PBR material params, cubic-bezier motion curves, contrast minimums.
  Raw transcripts: `design-director-transcript-batch{1,2}.json`
  (total $3.9148, ledgered). Merged output: `design-director-output.json`.
- Each case file carries `node` (full spec), the frozen `l3`, and `sceneSpec`
  (camera / lights / background / motionNote) for the render harness.

## Freeze proof

`functional/manifest.json` and `visual/manifest.json` carry sha256 hashes of
every emitted file plus `l1Hash`/`worldHash`. The corpus commit lands BEFORE
any contestant call; the run ledger records the corpus commit hash every run
reads from.

Generator: `tests/unit/wbake-build-corpus.test.ts`
(`WBAKE_BUILD_CORPUS=1` / `WBAKE_BUILD_VISUAL=1`) +
`scripts/bakeoff/design-director.mjs`.
