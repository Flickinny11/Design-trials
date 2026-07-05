# Spec Hardening — Residuals for Logan

**Date:** 2026-06-05 (Phase 3B, docs-only). **Branch:** `prism-editor-build` (unchanged, uncommitted).

These are genuine **design** questions that surfaced during hardening and that I did **not** decide. Each has my recommendation; none is encoded as fact in the canonical-3 until you confirm. (Pure doc-hygiene and code/marker cleanups are in `docs/prism/SPEC-INDEX.md` §6, not here.)

---

## R1 — Keyframe time/length model (the anchor §7 open problem)

**Question.** The anchor (§7) leaves the animation time/length model as an OPEN DESIGN PROBLEM ("animation has no video frames … each kind has its own driver"; you were mid-thought on a seconds-based approach). The **Canvas spec already locked an answer**: a single **continuous-seconds master clock (float), no global fps**, plus a **Driver model** (`Time/Scroll/Pointer/State/Event`) where each animation = `(keyframes/states) + a driver` (CANVAS §2 decision 3–4, §8.1–§8.2).

**Recommendation (confirm).** Adopt the Canvas spec's answer as the resolution of the anchor's open problem — it matches your seconds-based instinct and cleanly spans fixed-duration / scroll-linked / pointer-reactive / looping animations via the driver, not via frames. **Decision needed:** confirm this is what you meant, so the anchor's "OPEN DESIGN PROBLEM" can be marked resolved-by-canvas rather than left dangling.

---

## R2 — `<app>_world` vs `App_Name_World` vs `PrismRootNode` (naming)

**Question.** The anchor calls the root store **`<app>_world`** (§1). The editor-build spec + code call the implementing node **`App_Name_World`** / type **`PrismRootNode`**. They denote the same thing; the runtime spec (§8) treats them as synonyms.

**Recommendation.** Keep the **type** name `PrismRootNode` (code-stable) and adopt **`<app>_world`** as the *conceptual/displayed* name (per-app, e.g. `kriptik_world`), retiring the literal "App_Name_World" placeholder string in UI/captions. **Decision needed:** confirm the displayed naming convention so the node-editor/runtime specs can fix one term.

---

## R3 — Legacy `VisualPreview` regen path: remove now, or keep as future-source stub?

**Question.** Anchor Decision 3 supersedes the legacy `VisualPreview` "Save & Verify → regen API" path (→ future-source, engine-tier regeneration). Code still has it live alongside the Round-2 preview-store path; it can render an **empty-`Group` stand-in** for unfactored nodes (an F3/FP-R3 risk).

**Recommendation.** In STEP-3, **remove the legacy `VisualPreview` regen path from the active app** and route everything through the one verifying path (NODE-EDITOR §9). Preserve the regen *concept* only as a documented future-source seam (it becomes the engine-tier regeneration), not as live code. **Decision needed:** confirm removal vs. keeping it dormant-but-present.

---

## R4 — Caption-driven repair model vs. Canvas local-VLM re-caption (one model story or two?)

**Question.** NODE-EDITOR §9.2 specifies a **small cold-context model** that reads node+hub captions to repair a failed build. CANVAS §10 / decision 10 specifies a **local in-browser VLM** (FastVLM/SmolVLM via Transformers.js) for liveness **re-captioning**, with cloud VLM at build-finalize. These are adjacent but not identical jobs (repair-from-caption vs. caption-from-render).

**Recommendation.** Unify where possible: use the **same local-VLM runtime** for both, with two prompts (re-caption vs. repair). Keep authoritative cloud verification at build-finalize only (cost discipline). **Decision needed:** confirm one shared model story, and whether repair may call cloud on hard failures or must stay local.

---

## R5 — Galaxy node sphere vs. Canvas "bubble" (are they the same primitive?)

**Question.** NODE-EDITOR §3.3 specifies the galaxy **dormant sphere** (node-state, sized by contents, labelled). CANVAS §6 specifies a **translucent liquid "bubble"** (`MeshPhysicalMaterial` transmission) for a *new/unpopulated* node in canvas. Both are spheres for "not-yet-an-artifact."

**Recommendation.** Treat them as the **same visual language** (one sphere/bubble component, parameterized) but distinct *states*: galaxy = the dormant container for an existing node; canvas-bubble = a node still awaiting its first artifact. No conflict, but worth one shared component so they don't drift visually. **Decision needed:** confirm they should look like one family.

---

## R6 — Where is a page's background *authored* — Hub Editor or Canvas?

**Question.** NODE-EDITOR §4 puts the hub's **page background** in the Hub Editor (the page-level chooser). CANVAS owns the background **layer model** (`viewport-fixed | camera-locked | parallax | world | infinite-environment`) and its rendering. So "choose/assign the page background" (Hub Editor) and "compose/animate the background layers in 3D" (Canvas) are split.

**Recommendation.** Keep the split: Hub Editor = *assign* the page's background (and its plan/intent); Canvas = *author* the layer stack visually. **Decision needed:** confirm this matches your mental model, or fold all background authoring into one surface.

---

## R7 — The 9 seed primitives: ship-as-is, or rebuild against the `Animatable` contract first?

**Question.** The 9 cinematic primitives exist in code (`src/lib/prism/runtime/shared/primitives/`) under the old fixed-library contract. The Canvas spec's catalog requires every primitive to implement `Animatable` + `ControlSchema` (§8.3). SPEC-INDEX §4 calls the 9 the "seed set" of the 300+.

**Recommendation.** Adopt the 9 as the seed set but **wrap/adapt them to the `Animatable` contract** as the first catalog entries (rather than maintaining two animation interfaces). The deviations log already flags fidelity gaps in several (e.g. `orbit`/`parallax-scroll`/`magnetic-cursor` stomp `scenePosition`) — fix those during the adapt. **Decision needed:** confirm "adapt the 9 into the canvas catalog" vs. "keep them as a separate legacy lane."

---

## R8 — Dangling future-source spec references (3 named, absent)

**Question.** `DIFFUSION-ENGINE-SPEC.md`, `PRISM_ENGINE_BROWSER_BASED_SPEC.md`, `Editor_UI_Rough_Spec` are cited as authoritative (archived migration spec `:552`–`:554`) but are **not in the repo**. They may have been renamed into `PRISM-ENGINE-SPEC-V3.md` / the editor-build spec, or they live outside the repo.

**Recommendation.** Treat them as **future-source** inputs to the eventual unified Engine+Harness+Runtime spec; either (a) add them to the repo if you have them, or (b) declare them folded-into `PRISM-ENGINE-SPEC-V3.md` so the references stop dangling. **Decision needed:** do these files exist elsewhere, and should I expect them?

---

## R9 — "Two CLAUDE.md docs" — scope confirmation

**Question.** The Phase-3B prompt's scope lock names "the two CLAUDE.md docs." On disk, the only CLAUDE.md with substantive, stale, contradictory content is **`kid-kode-landing/CLAUDE.md`** (fixed this pass). The others (`Design-trials/.claude/CLAUDE.md`, `docs/CLAUDE.md`, `docs/prism/CLAUDE.md`, `.claude/rules/CLAUDE.md`) are auto-generated claude-mem stubs with no spec content.

**Recommendation.** I edited only `kid-kode-landing/CLAUDE.md` (the substantive one) and left the mem stubs untouched (editing them is pointless/regenerated). **Decision needed:** confirm there isn't a *second* substantive CLAUDE.md you intended (e.g. one outside this repo) that I should also reconcile.

---

*End of residuals. None of the above is decided in the canonical-3; each awaits your call.*

---

# LOGAN'S RESOLUTIONS (recorded by Claude, 2026-06-05)

Resolved on Logan's behalf (follow directly from anchor v2 + the Canvas spec he approved):

- **R1 — RESOLVED: yes.** Continuous-seconds master clock + Driver model (Canvas §2.3–4, §8) IS the resolution of the anchor §7 open problem. Mark anchor §7 "resolved-by-canvas" (not dangling). Matches Logan's seconds-based instinct.
- **R2 — RESOLVED.** Keep code TYPE name `PrismRootNode`; use `<app>_world` (e.g. `kriptik_world`) as the conceptual/displayed name; retire the literal "App_Name_World" placeholder in UI/captions.
- **R3 — RESOLVED: remove.** In Step 3, remove the legacy `VisualPreview` regen path from the active app; route everything through the one verifying edit path (NODE-EDITOR §9). Keep the regen *concept* only as documented future-source (engine-tier regeneration), not live code.
- **R4 — RESOLVED.** One shared local-VLM runtime for BOTH re-captioning and caption-repair (two prompts). Repair stays local; authoritative cloud verification only at build-finalize (and permitted as a last resort on hard failure). Never cloud-per-keystroke.
- **R5 — RESOLVED: one family.** Galaxy dormant sphere and Canvas "bubble" are one parameterized component, two states (galaxy = dormant container for an existing node; canvas-bubble = node awaiting its first artifact).
- **R7 — RESOLVED: adapt.** Adopt the 9 cinematic primitives as the catalog seed set, adapted to the `Animatable` + `ControlSchema` contract (one animation interface, INV-5). Fix the flagged fidelity gaps (orbit / parallax-scroll / magnetic-cursor stomping `scenePosition`) during the adapt. No separate legacy lane.
- **R8 — RESOLVED (answer known).** The three "dangling" specs (`DIFFUSION-ENGINE-SPEC.md`, `PRISM_ENGINE_BROWSER_BASED_SPEC.md`, `Editor_UI_Rough_Spec`) exist in Logan's Claude.ai project knowledge. They are FUTURE-SOURCE for the unified Engine+Harness+Runtime spec; stage to repo at the engine phase. Declare them future/folded in SPEC-INDEX so the references stop dangling. No action now.

Pending Logan's quick confirm:
- **R6 — PENDING.** Page background: Hub Editor *assigns* the page background + plan; Canvas *composes/animates* the background layers. (Claude's read: matches Logan's "hub stores the page's background" description — likely yes.)
- **R9 — PENDING (optional).** Only `kid-kode-landing/CLAUDE.md` was substantive and was fixed; the rest are auto-generated stubs left untouched. Confirm no other substantive CLAUDE.md exists elsewhere.

- **R6 — RESOLVED (Logan, 2026-06-05).** ALL page-background content lives in the HUB: the background visual AND any code that animates the background / governs its behavior. Hub Editor = set/assign the background + its behavior code (page-level). Canvas = modify the *style* of that background, only when that hub is selected. Workflow: Galaxy (find the hub) → enter the hub (preview) → switch to Canvas to edit its style.
- **R9 — RESOLVED (Logan, 2026-06-05).** No other substantive CLAUDE.md exists. The 5 other CLAUDE.md files are confirmed empty claude-mem "Recent Activity" stubs (169–334 B, no instructions/specs); harmless, left untouched.
