# Spec Amendment 0001 — Mask-based Repair Loop

**Status:** DRAFT — pending user review. Do not implement until approved.
**Authored:** 2026-04-29
**Supersedes:** none. Extends `notes/prism-spec-extract.md` §5 Asset Build Pipeline.
**Affects build pipeline only.** No runtime changes. No new dependencies. §1.4 forbidden patterns intact.

---

## Section-numbering note

**Confirmed §5.5** in `notes/prism-spec-extract.md` per user signoff 2026-04-29. The on-disk extract is canonical per `kid-kode-landing/CLAUDE.md`; the original `PRISM-MOCK-APP-BUILD-SPEC.md` is not on disk and is not authoritative for placement decisions. The repair loop slots between `§5.0 Asset Provisioning` and `§5.x Atlas Build`.

---

## §5.5 Mask-based Repair Loop *(NEW SUBSECTION)*

### 5.5.0 Why this exists

`§5.0 Asset Provisioning via fal.ai` produces hub-level mockups via FLUX.2 Pro. Single-shot FLUX.2 Pro layout reliability falls off as element count rises: dense vertical compositions (≥20 elements across multiple sections) collapse, omit late-listed bands, or stack elements as physical display tiers rather than UI sections. Re-rolling burns budget and is non-deterministic.

The repair loop fixes this in the build pipeline, not at runtime. It validates the rendered mockup against the plan's element list, surgically repairs missing or spurious elements via masked regeneration, then proceeds to extraction. Output is still atlas-packed PNGs; runtime invariants are unchanged.

### 5.5.1 Pipeline placement

Inserts between `§5.0 Asset Provisioning` (which generates the hub mockup) and `§5.x Atlas Build`. Replaces the ad-hoc SAM run currently invoked from `scripts/segment-scifi.mjs`. The full sequence becomes:

1. `§5.0` — FLUX.2 Pro generates the hub mockup *(unchanged)*
2. `§5.5.2` — SAM 3.1 validator pass
3. `§5.5.3` — Diff against plan
4. `§5.5.4` — Mask-based repair (GPT Image 2 / fallbacks)
5. `§5.5.5` — Re-validate; iterate up to 2× then fall back to full regen
6. `§5.5.6` — Duplicate-and-reseal for backdrop layer
7. `§5.5.7` — Final SAM 3.1 extraction → per-node PNG + alpha

### 5.5.2 Validator pass — SAM 3.1 (Object Multiplex)

- Model: **SAM 3.1 Object Multiplex** checkpoints (released 2026-03-27). Drop-in replacement for SAM 3 wherever it appears in this spec; substitute the checkpoint identifier in fal endpoint URLs and prompt templates. **All references to "SAM 3" elsewhere in the spec are updated to "SAM 3.1 (Object Multiplex)" by this amendment.**
- Endpoint: `fal-ai/sam-3.1/object-multiplex` (or `fal-ai/sam-3/image-rle` if/when fal aliases to the new checkpoint).
- Input: the FLUX-generated mockup PNG.
- Concept prompts: every entry in `home-hub.json` `nodes[].intent.samHints.visualNouns`, sent as a single batched prompt list (Object Multiplex's primary capability — multi-concept detection in a single pass, vs SAM 3's serial prompts).
- Output: `{ detectedElements: [{ conceptKey, bbox, score, mask }, …] }` saved to `notes/mockup-candidates/<hub>-validator-pass.json`.

### 5.5.3 Diff against plan

For each element in `home-hub.json` `nodes[]` whose `intent.visibility.renderInCurrentMockup === true`, classify against the validator output:

| Plan state | Validator state | Classification | Action |
|---|---|---|---|
| Expected at bbox A | Detected at bbox ≈ A (IoU ≥ 0.4) | **PRESENT** | none — proceed |
| Expected at bbox A | Detected at bbox B, IoU < 0.2 with A | **WRONG_PLACEMENT** | mark for full regen (skip repair) |
| Expected at bbox A | No matching detection | **MISSING** | repair-add; mask = expected bbox A dilated per §5.5.3.1 |
| Not expected | Detected at bbox C with score ≥ 0.7 and not matched to any plan element | **SPURIOUS** | repair-remove; mask = bbox C dilated per §5.5.3.1 |

The `0.7` SPURIOUS score floor is calibrated to SAM 3.1 (Object Multiplex) UI-element confidence, which on cleanly-rendered FLUX subjects lands above 0.8 in observed runs; below 0.7 the detection is more likely sensor noise (volumetric fog, glow halos, atmospheric scattering) than a real spurious foreground.

Multiple `MISSING` and `SPURIOUS` classifications on the same hub are batched into a single repair pass (one mask containing the union of all repair regions).

`WRONG_PLACEMENT` aborts the repair loop and triggers full regen with a tightened prompt (§5.5.5). **Justification:** placement errors signal compositional drift the repair loop cannot surgically correct without cascading mask collisions — a remove-at-old + add-at-new compound pass would route both regions through GPT Image 2 in a single edit, where the model treats the masks as one editable region and tends to either (a) merge them into a single object spanning both bboxes, or (b) leak fill content from the old bbox into the new one because the mask geometry signals continuity. Full regen with a placement-anchored prompt is the cheaper-overall path despite the larger per-call cost. *(Open question: on telemetry data showing this assumption is wrong, the alternative path is "compound mask repair with one extra attempt budgeted (cap 3 instead of 2)"; do not implement until evidence supports it.)*

### 5.5.3.1 Mask dilation formula

For both **MISSING** (expected bbox) and **SPURIOUS** (detected bbox) classifications, the dilation amount in pixels is:

```
dilatePx = max(8, min(64, Math.floor(0.10 * shorterEdge)))
where shorterEdge = min(bbox.width, bbox.height)
```

Rationale: a flat 10 % over-dilates large bands (a 736 × 60 stats-counter ribbon would dilate to 73 px on its short edge, swallowing neighboring elements) and under-dilates small icons (an 80 × 80 social sigil would dilate to 8 px, which is enough but barely). The clamped formula gives small icons a ≥ 8 px safety halo and caps large bands at a 64 px halo on the short edge so they don't bleed across section boundaries.

### 5.5.4 Mask-based repair — GPT Image 2 (primary)

- Model: **GPT Image 2** edit endpoint (released 2026-04-21; replaces GPT Image 1.5 throughout this spec).
- fal endpoint: `fal-ai/openai/gpt-image-2/edit`.
- **Mask format convention (applies to GPT Image 2 *and* FLUX.2 Klein in §5.5.6):** the `mask_image_url` PNG is **single-channel binary**, white pixels (R=G=B=255) mark the edit region, black pixels (R=G=B=0) mark the preserve region. No alpha. **Mask dimensions must exactly match the corresponding `image_url` dimensions** — mismatched dimensions are a build failure surfaced via `notes/mockup-candidates/<hub>-build-failure.json` before any fal call is issued. Mask pixels at the boundary of edit/preserve regions follow §5.5.3.1 dilation; no anti-aliasing softening is applied at the mask level (sub-pixel feathering is the model's responsibility on the inpaint side).
- Inputs: `image_url` (the validated-but-imperfect FLUX mockup), `mask_image_url` (per the convention above, built from the diff classifications), `prompt` constructed per classification:

  - **MISSING** → `"add N more <conceptKey>s matching the existing style; <samHints.visualNouns>; <samHints.material>; <samHints.finish>"`
  - **SPURIOUS** → `"remove this element, fill seamlessly with the surrounding background"`
  - **MIXED** (both in one pass) → list each region's intent with positional anchors

- Quality ladder: start at `quality=low` ($0.009 at 1024², $0.013 at non-square sizes). Step up to `quality=medium` only on a re-validation failure of the low pass. After a medium-quality failure, **escalate to full regen (§5.5.5), not to `quality=high`** — by that point the failure mode is compositional, not detail-quality, and additional render budget is better spent on the regen template than on a third surgical attempt. `quality=high` is reserved for an explicit `REPAIR_QUALITY_HIGH=1` env-var override, used only for hand-debugging — not part of the default ladder. Hard cap at **8 cumulative repair attempts per hub** and **2 full regens per hub** (§5.5.5) — comprehensive escalation, not quick-fail.
- Telemetry: every GPT Image 2 call logs `{ hubId, attemptIndex, quality, classifications, costEstimate }` to `notes/mockup-candidates/<hub>-repair-log.jsonl`.

### 5.5.5 Re-validate and iterate

After each repair pass, re-run the SAM 3.1 validator (§5.5.2) and re-classify (§5.5.3). The repair-attempt counter is **cumulative for the hub** and does not reset across regen boundaries — it is the total number of GPT Image 2 edit calls issued for this build. Stop conditions:

- All elements PRESENT → proceed to §5.5.6.
- After 2 cumulative repair attempts (one low-quality + one medium-quality, per the §5.5.4 ladder) without convergence → fall back to **full FLUX.2 Pro regen** using the tightened-prompt template below (§5.5.5.1). The repair counter continues incrementing on subsequent post-regen repair attempts.
- Each post-regen cycle is itself bounded: 2 more cumulative repair attempts (low + medium) before the next regen escalation. The orchestrator loops repair → repair → regen → repair → repair → regen → repair → repair → halt — comprehensive escalation, not quick-fail.
- After 2 full regens, if a further 2 cumulative repair attempts still don't converge → halt the build with a non-zero exit code and write the validator output + last classifications to `notes/mockup-candidates/<hub>-build-failure.json`. Do not silently produce a broken artifact.
- Hard caps: `repairAttempts ≤ 8` cumulative; `fullRegens ≤ 2`. Either breach is a build failure.

### 5.5.5.1 Tightened-prompt template (full-regen fallback)

The orchestrator constructs the regen prompt by interpolating the failed-classifications list and the per-hub layout constraints into this template. `{...}` placeholders are filled at runtime from `home-hub.json` and the last validator output.

```
A complete photorealistic dark cinematic 3D rendered landing-page mockup for {hub.title}, {hub.layout.viewportWidth}×{hub.layout.contentHeight} portrait orientation.

CRITICAL — the previous render failed validation with the following defects, which MUST be fixed in this regen:
{for each failed classification:
- MISSING <conceptKey> at bbox (x={bbox.x}, y={bbox.y}, w={bbox.width}, h={bbox.height}) — {samHints.visualNouns joined with ", "}
- SPURIOUS object detected at bbox (x={bbox.x}, y={bbox.y}, w={bbox.width}, h={bbox.height}) — do NOT render any object in this region
- WRONG_PLACEMENT <conceptKey> — was rendered at wrong position; must appear at bbox (x={expected.x}, y={expected.y}, w={expected.width}, h={expected.height})
}

Every horizontal band described below MUST be visible and rendered. No empty regions, no large blank floor, no cropping the lower content. Every element is a physical sculpted object with mass, depth, and light interaction.

{The standard JSON-structured composition block from `provision-assets.mjs` follows here verbatim — sections, objects, color palette, render style, absolutely_forbidden — unchanged from the first-attempt prompt.}

ABSOLUTELY NO text, NO letters, NO words, NO numbers, NO labels, NO typography anywhere.
```

The orchestrator is responsible for: (a) reading the last validator output to populate the failed-classifications list; (b) reading `home-hub.json` for the standard composition block; (c) calling FLUX.2 Pro at `image_size = { width: hub.layout.viewportWidth, height: hub.layout.contentHeight }`, `guidance_scale = 6` (one notch up from the first attempt's 4), `num_inference_steps = 60`. The bumped guidance + steps reflect the lessons from session 2026-04-29: dense compositions need more model attention to follow the layout instructions strictly.

### 5.5.6 Duplicate-and-reseal — backdrop layer extraction

Once the validator passes:

1. Duplicate the validated mockup to `notes/mockup-candidates/<hub>-backdrop-source.png`.
2. Run SAM 3.1 again with the same concept prompts to produce **foreground-removal masks** (the union of all detected element masks).
3. Send the foreground-masked copy to **FLUX.2 Klein** (cheaper than GPT Image 2 for plain background fills; targeted at clean inpainting tasks) at endpoint `fal-ai/flux-2-klein/edit` with `prompt = "seamless background fill, no UI elements, no text, no foreground subjects; continue the existing atmosphere"`.
4. The output is the per-hub backdrop. Saves to `public/prism-assets/<hub>-backdrop.png` and is registered in `home-hub.json` as the source for the `page-backdrop` node (per §5.0 conventions).

### 5.5.7 Final extraction — SAM 3.1 → per-node PNG + alpha

1. Re-run SAM 3.1 on the validated mockup with the full element-list concept prompts.
2. For each `nodes[]` entry, take its detected mask, alpha-cut against the original mockup, crop to mask bbox + padding, save to `src/lib/prism/mock-app-source/assets/source-images/base/<nodeId>.png`.
3. Text remains a separate node layer rendered at runtime via MSDF (§5.0 invariant). **Do not generate text in mockups; do not bake text into per-node PNGs.**
4. The remainder of the build pipeline (`build:atlas`, `build:msdf`, `build:prism`) runs unchanged.

### 5.5.8 Fallback ladder *(wired but not used by default)*

Use only when the primary path (GPT Image 2 → re-validate → regen) repeatedly fails:

| Failure mode | Fallback | Endpoint | Notes |
|---|---|---|---|
| GPT Image 2 fails on UI text-heavy elements | **Nano Banana Pro Edit** (Gemini 3 Pro Image) | `fal-ai/google/nano-banana-pro/edit` | Currently #1 on LMArena for text rendering; native 4K output. Triggered only when a repair pass involves text-bearing UI surfaces. |
| Many hubs need the same surgical fix | **Seedream 5.0 brush mode** | `fal-ai/seedream/v5/edit` | Batch — up to 14 reference images per call at $0.035/image. Triggered only when ≥3 hubs share an identical repair classification in a single build. |

Fallback selection is automatic based on classification metadata, but each fallback path requires explicit unblock via `REPAIR_FALLBACK=1` env var on the build to limit cost variance during the build's stable phase.

### 5.5.9 Telemetry artifact

The build emits `public/prism-assets/<hub>-repair-telemetry.json` containing:

```json
{
  "hubId": "...",
  "validator": { "model": "sam-3.1-object-multiplex", "passes": 3 },
  "repairAttempts": 1,
  "fullRegens": 0,
  "classifications": { "PRESENT": 31, "MISSING": 1, "SPURIOUS": 1, "WRONG_PLACEMENT": 0 },
  "fallbacksTriggered": [],
  "totalFalCostUsd": 0.42
}
```

(The build-artifact hash from `build:prism` is intentionally omitted — it is not knowable at telemetry-write time, and back-filling it would require modifying one of the four protected scripts. Cross-correlation against a `.prism` build is done via timestamp + `hubId` if needed.)

This artifact is read by `verify-repair-loop` (a sibling script to `verify:prism`, see §5.5.10) and contributes a new check **§10.11 repair-loop:bounded** — `verify-repair-loop` asserts `repairAttempts ≤ 8` (cumulative) and `fullRegens ≤ 2`. A breach is a build failure.

### 5.5.10 Constraints (must not violate)

- **Orchestrator boundary.** Repair loop is invoked by a new top-level script `scripts/repair-loop.mjs` that runs **after** `scripts/provision-assets.mjs` (or the fal-driven hub-mockup generator that supersedes it) and **before** `npm run build:atlas`. `repair-loop.mjs` produces inputs to `build:atlas` (validated mockup PNG, per-element extracted PNGs in `source-images/base/`, backdrop PNG, telemetry JSON). The four protected `build:*` scripts (`build:atlas`, `build:msdf`, `build:prism`, `verify:prism` per `package.json`) have **no awareness** of the repair loop and remain unmodified — they read whatever `source-images/base/` contains and trust it. The boundary is one-way: orchestrator → filesystem → protected scripts.
- **Sibling-script pattern for new verify checks.** New verify checks introduced by amendments live in **sibling scripts** named `verify-<name>.mjs` (e.g. `scripts/verify-repair-loop.mjs` for §10.11) and are wired via a new top-level `verify` target in `package.json` (`"verify": "npm run verify:prism && npm run verify:repair-loop"`). The four protected scripts are immutable across amendments **except for §-reference renumber sweeps that follow the same automated transform applied to all source files** — the protection is on behavior, not literal byte-identity. `verify:prism` itself is never appended to with new logic, and no existing assert is removed or modified; only `§10.NN` tokens may move under a global numbering sweep. Each sibling script follows the same `assert(id, description, body)` pattern, exits non-zero on the first failure, and writes its own pass/fail summary to stdout.
- No new dependencies. `sharp` stays scoped to build-time SVG→PNG icon conversion (existing role); the orchestrator additionally uses sharp for mask-PNG construction and dimension validation (§5.5.4). The `@fal-ai/client` already in the stack routes GPT Image 2, FLUX.2 Klein, SAM 3.1 (Object Multiplex), Nano Banana Pro Edit, and Seedream 5.0.
- No runtime changes. §1.4 forbidden patterns intact: `PIXI.Graphics` still off-limits for visible UI. Repair loop is build-time only.
- Output is still atlas-packed PNGs flowing through `build:atlas`, `build:msdf`, `build:prism`. The repair loop must not modify those scripts.
- Repair attempts capped at 2 before full regen. Full regen capped at 1 before build failure. Counts written to telemetry and gated by §10.x in verify-prism.
- All SAM checkpoint references in the spec extract change from "SAM 3" to **"SAM 3.1 (Object Multiplex)"** — see §5.5.11 for the line-by-line diff.

### 5.5.11 Required edits to existing spec text *(diff against current extract)*

The amendment changes existing spec language in three places. Diff format: `BEFORE` / `AFTER`.

**Diff 1.** `notes/prism-spec-extract.md` §5.0 line 691 ff. — add SAM 3.1 to the model list and reference the repair loop.

```diff
 ### **5.0 Asset Provisioning via fal.ai**

-Provisioning script: `lib/prism/mock-app-source/assets/provision-assets.mjs`
+Provisioning script: `lib/prism/mock-app-source/assets/provision-assets.mjs`
+
+The provisioning step generates the hub mockup. The mockup is then validated
+and repaired via the **mask-based repair loop (§5.5)** before extraction
+proceeds. SAM-based segmentation throughout this section uses **SAM 3.1
+(Object Multiplex)** checkpoints (released 2026-03-27); all prior references
+to "SAM 3" are superseded.
```

**Diff 2.** Update the model table at line ~713 to name the new endpoints used by §5.5 alongside the existing FLUX.2 endpoint.

```diff
 | Style reference | fal FLUX.2 | Generated first, establishes visual consistency |
 | Base element images | fal FLUX.2 (no-text) | Inputs to sharp-svg text compositing |
+| Hub mockup validator | fal SAM 3.1 (Object Multiplex) | Multi-concept detection in single pass; drives §5.5 repair classifications |
+| Surgical repair (primary) | fal GPT Image 2 edit | Mask-based add/remove; quality ladder low→medium→high; replaces GPT Image 1.5 |
+| Backdrop reseal | fal FLUX.2 Klein edit | Cheaper plain-background inpainting after foreground extraction |
+| Repair fallback (text-heavy) | fal Nano Banana Pro Edit (Gemini 3 Pro Image) | LMArena #1 for text rendering; gated behind REPAIR_FALLBACK=1 |
+| Repair fallback (batch) | fal Seedream 5.0 brush | Up to 14 reference images per call; gated behind REPAIR_FALLBACK=1 |
 | State variant images | fal FLUX.2 with style ref | Each variant separately with prompt diffs |
 | Overlay layers | fal FLUX.2 transparent-bg OR public URLs | Reusable across nodes |
```

**Diff 3.** Add the new §10.x verify check to `notes/prism-spec-extract.md` §10 SUCCESS CRITERIA. Insert between current §10.10 and §10.11; renumber as needed:

```diff
+#### §10.x repair-loop:bounded
+
+`verify-repair-loop` (a sibling script to `verify:prism`, per §5.5.10)
+asserts the per-hub repair-loop telemetry artifact
+(`public/prism-assets/<hub>-repair-telemetry.json`) is present and that
+`repairAttempts ≤ 8` (cumulative) and `fullRegens ≤ 2`. A breach is a build
+failure. Output: `${repairAttempts} repair attempts, ${fullRegens} regens — bounded`.
+`verify:prism` itself is unchanged — the new check lives in
+`scripts/verify-repair-loop.mjs` and is wired via a new
+`"verify": "npm run verify:prism && npm run verify:repair-loop"` target
+in `package.json`.
```

---

## Acceptance criteria

This amendment is approved and merged into the spec extract when:

1. §5.5 placement confirmed per 2026-04-29 signoff.
2. The §5.0 / §10 / model-table edits in §5.5.11 are applied to `notes/prism-spec-extract.md`.
3. A follow-up implementation plan is authored under `.claude/plans/` covering: (a) `scripts/repair-loop.mjs` orchestrator, (b) `scripts/sam-validator.mjs` wrapping `fal-ai/sam-3.1/object-multiplex`, (c) `scripts/mask-repair.mjs` wrapping `fal-ai/openai/gpt-image-2/edit`, (d) `scripts/backdrop-reseal.mjs` wrapping `fal-ai/flux-2-klein/edit`, (e) extension to `scripts/verify-prism.mjs` adding §10.x. None of those exist yet — this amendment is data, not code.
4. No edit to the four protected scripts (`build:atlas`, `build:msdf`, `build:prism`, `verify:prism`) in `package.json`. The repair loop runs as a separate orchestrator that produces inputs to `build:atlas`.

---

## Out of scope (explicitly)

- Runtime hot-reload / live node refresh. The user's earlier "see nodes pop up live" idea is an enhancement to `src/lib/prism/player/boot.ts`, not this amendment. Tracked separately.
- Code-rendered (SVG) visuals. The repair loop preserves the diffusion-image path. Stand-down on the SVG/code-visual trial per the user's 2026-04-29 direction.
- Multi-hub orchestration. This amendment scopes the repair loop to one hub per build invocation. Multi-hub batching is the natural target for the Seedream fallback but is not yet specified.

---

*End of Spec Amendment 0001.*
