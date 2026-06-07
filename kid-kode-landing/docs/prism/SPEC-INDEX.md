# PRISM SPEC INDEX — precedence, supersession, moves

**Date:** 2026-06-05 (Phase 3B spec-hardening, docs-only)
**Purpose:** the single map of which Prism spec outranks which, what replaced what (with line cites), what moved where, and what remains as pending non-doc (STEP-3) actions. When two specs collide, resolve by this precedence ladder; the **ruler** breaks all ties.

---

## 1. Precedence ladder (highest authority first)

| Tier | Document(s) | Role |
|---|---|---|
| **0 — RULER** | `Design-trials/PRISM-INTENT-ANCHOR.md` (v2) | Authoritative statement of design *intent*. Wins every conflict. "Recency wins" only between deliberate revisions; never a loop-ratified spec mirroring the broken build. |
| **1 — CANONICAL-3 (build-truth)** | `PRISM-RUNTIME-SPEC.md` · `PRISM-NODE-EDITOR-SPEC.md` · `PRISM-CANVAS-EDITOR-SPEC.md` | The only build-truth specs. Each owns a non-overlapping surface (runtime substrate / galaxy+node-editor / canvas visual-spatial-animation). Mutually reconciled. |
| **2 — SUPPORTING** | `CINEMATIC-PRIMITIVES-LIBRARY.md` · `../spec-deviations-prism.md` | Live references the canonical-3 lean on. CPL = 9 seed primitives + 6 TSL shaders (its "no bespoke animation" framing is rescinded — see §4). Deviations log = the as-built divergence record. |
| **3 — FUTURE-SOURCE** | `PRISM-ENGINE-SPEC-V3.md` · `../../notes/ralph-harness-v1.1.md` · `../../notes/spec-amendments/0001-mask-based-repair-loop.md` · `../../notes/prism-vision-context.md` · (archived `PRISM-MOCK-APP-BUILD-SPEC.md` retains app-architecture value) | Engine / harness / diffusion / caption / mask-repair material. Set aside, **not junk** — seed for the future unified Engine+Harness+Runtime spec (anchor §0). Not build-truth for the prototype. |
| **4 — ARCHIVE (superseded)** | `archive/PRISM-EDITOR-BUILD-SPEC.md` · `archive/PRISM-RENDERER-MIGRATION-SPEC.md` · `archive/PRISM-MOCK-APP-BUILD-SPEC.md` · (recommended: the notes extracts/analyses — see §5) | Retained for traceability only. Each carries a `SUPERSEDED BY … — archived 2026-06-05` header. Never build-truth. |

**Within the canonical-3 there is no internal precedence** — they are reconciled to be non-conflicting. If a future conflict appears between two of them, fix the non-canvas one (the canvas spec is adopted as-is) or escalate to the ruler / `notes/SPEC-HARDENING-RESIDUALS.md`.

---

## 2. Boundary map of the canonical-3 (who owns what)

| Concern | Owner |
|---|---|
| Unified `three/webgpu` scene; single `three` instance; WebGL2 fallback | RUNTIME §2/§4/§9 |
| The three modes as **states** of one scene; mode state machine; preview-app ≡ same built scene | RUNTIME §1.3/§6 |
| Two-state model (sphere XOR built); explicit **Build** + pop-transition; surgical rebuild | RUNTIME §5 |
| `builtSnapshot` content-hash cache; toggling never rebuilds | RUNTIME §7 (= CANVAS §11) |
| `<app>_world` root store; capability references / secrets vault | RUNTIME §8 |
| `createNode` contract; MSDF text; capability tiers | RUNTIME §9/§10 |
| Galaxy camera rig; node presentation (spheres/labels/icons/size); tethers | NODE-EDITOR §2/§3 |
| Hub editor panel + `global` hub | NODE-EDITOR §4 |
| Node editor = **purpose** (backend/functions/integrations/schema/behavior/caption) + visual-section exception | NODE-EDITOR §5 |
| Caption storage / display / edit (format is future-source) | NODE-EDITOR §7 |
| Edit → save → build → **verify** → preview path + caption-driven cold repair | NODE-EDITOR §9 |
| Transform editing, resize/rotate in 3D, keyframe editor, 300+ primitive catalog + bespoke, text system, lighting, materials, Rive, animation **drivers** | CANVAS (whole) |

**Load-bearing boundary:** function/behavior wiring = NODE-EDITOR; visual/spatial/animation authoring = CANVAS; canvas trigger buttons assign animation *drivers* only (CANVAS §1.3 ↔ NODE-EDITOR §1.2/§5.3).

---

## 3. Supersession table (what replaced what, with line cites)

Cites are into the **archived** files (`archive/…`) unless noted. Lines reference the pre-hardening content.

| # | Superseded text | Where (archived) | Replaced by |
|---|---|---|---|
| S1 | "Preview is compile, not render-of-source. Preview Hub and Preview App are non-destructive compiles … emit `CompiledHubView`/`CompiledAppView`." | `archive/PRISM-EDITOR-BUILD-SPEC.md:82`–`84` | RUNTIME §6.3, INV-R3/R4, FP-R5 — preview-app is the same built scene in place, not a compiled mount. **Central intent violation, now corrected.** |
| S2 | `compileAppToPreview` + route-like separate-player preview model | `archive/PRISM-EDITOR-BUILD-SPEC.md:217`–`218` (SC-053/054) | RUNTIME §6.3 — compile-to-data is not the preview mechanism. |
| S3 | CDN import-map for `three`/`three/webgpu`/`three/tsl`/`gsap` (bundled-vs-CDN split) | `archive/PRISM-RENDERER-MIGRATION-SPEC.md:429`–`444` | RUNTIME §2 decision 1, INV-R1, RT-SC-02 — ONE bundled `three` instance. |
| S4 | "Invariant 12 … the codegen model SELECTS primitives by name … does NOT author scene-level animation from scratch" | `archive/PRISM-RENDERER-MIGRATION-SPEC.md:36`, `:201`; `archive/PRISM-EDITOR-BUILD-SPEC.md:272` (INV-12); `CINEMATIC-PRIMITIVES-LIBRARY.md:6`,`:293` | **RESCINDED** by CANVAS §2 decision 6. Animation = 300+ catalog AND from-scratch authoring. RUNTIME §9 executes any animation regardless of origin. |
| S5 | 5-mode taxonomy + `hub-world` / `preview-hub` (mixed with the 3-mode amendment in the same file) | `archive/PRISM-EDITOR-BUILD-SPEC.md:138`,`:283`,`:284`,`:327`–`328` (5) vs `:7`,`:73`,`:292`,`:312`–`313` (3) | RUNTIME §1.3/§6 + FP-R8 — canonical 3 exactly (`galaxy\|canvas\|preview-app`). |
| S6 | Node editor surface with in-editor transform handles / assembled-default representation | `archive/PRISM-EDITOR-BUILD-SPEC.md:174` (SC-025) | NODE-EDITOR §5.2/§5.3 + CANVAS §1.3 — visual editing is canvas-only; node editor = purpose; galaxy resting = dormant spheres. |
| S7 | Split-pane dual-state (left mock / right 3D graph) | `archive/PRISM-MOCK-APP-BUILD-SPEC.md:260`,`:1941`,`:1996` | RUNTIME INV-R3/FP-R6 + anchor F1 — one unified scene; modes are states, not panes. |
| S8 | Renderer foundations (three/webgpu + WebGL2, TSL-only, MSDF, sync `createNode`) | `archive/PRISM-RENDERER-MIGRATION-SPEC.md` §2/§3/§8 | **Carried forward unchanged** into RUNTIME §9 + INV-R9/R11 (re-homed, not contradicted). |
| S9 | `App_Name_World` / `PrismRootNode`, secrets vault, capability refs, coordinate spaces | `archive/PRISM-EDITOR-BUILD-SPEC.md` §3/§4/Phase-2/RA-01/RA-02/RA-07 | **Carried forward** into RUNTIME §8 + INV-R13; surfaced via NODE-EDITOR §4/§5. |
| S10 | "`docs/prism/*.md` are NOT on disk … `notes/prism-spec-extract.md` is the single source of truth" | `../../CLAUDE.md:28` (pre-hardening) | **FALSE claim corrected** — `kkl/CLAUDE.md` now points to the canonical-3; the extract is superseded (extract of the archived PixiJS-era specs). |
| S11 | "Renderer migration … Status: IN PROGRESS via Ralph loop on branch `prism-renderer-ralph`" | `../../CLAUDE.md:7` (pre-hardening) | **Corrected** — migration is DONE; `kkl/CLAUDE.md` updated. (Marker/hook/branch cleanup is STEP-3, §6.) |

---

## 4. CINEMATIC-PRIMITIVES-LIBRARY reconciled against the Canvas 300+ catalog

- The CPL specifies **9 primitives** (`orbit`, `depth-rotate`, `dissolve-morph`, `displacement-transition`, `parallax-scroll`, `magnetic-cursor`, `particle-emerge`, `fly-through`, `kinetic-text`) + 6 TSL shaders, under a "fixed library, codegen selects by name, no bespoke" framing.
- The Canvas spec (§2 decision 6, §8.3) defines a **300+ primitive catalog AND from-scratch authoring** (users and AI), every primitive implementing the `Animatable` contract.
- **Reconciliation (no deletion):** the CPL's 9 are the **shipped seed set / extension base** of the canvas catalog — a subset, each expressible as an `Animatable` with a `ControlSchema`. The CPL is **retained** (supporting tier) for those 9 parameter specs and the 6 TSL shaders. The CPL's "no bespoke scene animation" prohibition is **rescinded** (S4); a reconciliation header was added to the CPL noting this. **Overlap = the 9 seed primitives; extension = the rest of the 300+ catalog + bespoke authoring.**

---

## 5. Move list

### Performed by this pass (docs/prism/, in-scope)
- `PRISM-EDITOR-BUILD-SPEC.md` → `archive/PRISM-EDITOR-BUILD-SPEC.md` (+ SUPERSEDED header). `git mv`.
- `PRISM-RENDERER-MIGRATION-SPEC.md` → `archive/PRISM-RENDERER-MIGRATION-SPEC.md` (+ SUPERSEDED header). `git mv`.
- `PRISM-MOCK-APP-BUILD-SPEC.md` → `archive/PRISM-MOCK-APP-BUILD-SPEC.md` (+ SUPERSEDED header; retains future-source value). `git mv`.
- `PRISM-ENGINE-SPEC-V3.md` — **not moved** (left in `docs/prism/`); FUTURE-SOURCE header added in place (engine tier).
- Created: `PRISM-RUNTIME-SPEC.md`, `PRISM-NODE-EDITOR-SPEC.md`, `SPEC-INDEX.md`; Reconciliation note added atop `PRISM-CANVAS-EDITOR-SPEC.md`; reconciliation header added atop `CINEMATIC-PRIMITIVES-LIBRARY.md`.

### Recommended but NOT performed (outside docs/prism/ — STEP-3 / out of this pass's edit scope)
These `notes/` files are superseded/historical; this hardening pass may not move files outside `docs/prism/`. Recommended archival in a follow-up:
- `notes/prism-spec-extract.md`, `notes/prism-renderer-spec-extract.md` — extracts of the now-archived PixiJS-era specs; superseded by the canonical-3.
- `notes/prism-mock-plan.md` — plan for the PixiJS mock build; historical.
- `notes/editor-build-gap-analysis.md`, `notes/editor-build-round-2-gap-analysis.md`, `notes/reconcile-codex-to-claude.md` — working analyses, historical (gap-analysis retains evidential value: it admits the 5-mode taxonomy was loop-invented).
- `notes/spec-amendments/0002-hub-mockup-background.md` — fold accepted clauses into RUNTIME/NODE-EDITOR background handling, then archive.
- The deeply-nested accidental duplicate trees (`kid-kode-landing/kid-kode-landing/…`, `notes/kid-kode-landing/`, stub `docs/prism/CLAUDE.md` copies) — pure cruft; delete after a glance.

---

## 6. Pending non-doc (STEP-3) actions — NOTED ONLY, not done here

This pass is **docs-only**. The following require editing markers / hooks / code / settings and are deliberately **not** performed:

1. **`.ralph-migration-active` marker** (root + `kid-kode-landing/`) still present → `../.claude/rules/prism-renderer-migration.md` and migration-only hooks still fire as if mid-migration. Migration is DONE — remove markers (and reconcile the rule files) once Logan confirms.
2. **Rescinded animation rule still enforced in code:** `src/lib/prism/codegen/verifier.ts` (`MISSING_PRIMITIVES_LOOP`) and `src/lib/prism/codegen/prompts.ts:38` ("DO NOT author bespoke shader code") encode the migration-era "must iterate the fixed primitive list" / no-bespoke posture. Per S4 this is rescinded in spec; the code must be loosened to permit bespoke `Animatable` authoring.
3. **Preview-as-compile in code:** `src/app/page.tsx` mounts `<PrismHost>` (player) XOR `<GraphScene>` (editor) by `viewMode === 'preview-app'` (`:547`–`:550`, `:663`–`:684`); `PrismHost` builds an independent mount. This is the F2/FP-R5 architecture RUNTIME §6.3 supersedes — a real refactor to one unified scene.
4. **Single-`three` split:** runtime player loads `three` from a CDN import-map while the editor bundles it (two `three` instances). RUNTIME INV-R1/RT-SC-02 require one bundled instance.
5. **Two parallel edit/save paths:** the Round-2 preview-store path coexists with the legacy `VisualPreview` regen-API path (which can render an empty-`Group` stand-in). NODE-EDITOR §9 / FP-NE-5 require one verifying path; the legacy path → future-source (engine-tier regeneration).
6. **Hook drift to fix (operator):** `dependency-allowlist-check.sh` is currently **unwired** (the package.json/import supply-chain guardrail is off); two dangling Stop/UserPromptSubmit references to `.disabled` kripverify scripts in `Design-trials/.claude/settings.json`. (Per `AUDIT_REPORT.md` §3.) FP-12/FP-14 in `anti-drift-check.sh` correctly enforce the 3-mode set already.
7. **Wrong-branch reference:** `kkl/CLAUDE.md` "Push to `origin/prism-main`" corrected to the active `prism-editor-build`; confirm the loop scripts agree.

---

## 7. Dangling references (cited as authoritative but absent from the repo)

Named at `archive/PRISM-RENDERER-MIGRATION-SPEC.md:552`–`554` as "still authoritative for non-renderer concerns" but **not on disk anywhere**: `DIFFUSION-ENGINE-SPEC.md`, `PRISM_ENGINE_BROWSER_BASED_SPEC.md`, `Editor_UI_Rough_Spec`. Also: there is intentionally **no standalone caption spec** (anchor §0/§9 — the caption format is part of the future unified Engine+Harness+Runtime spec). These are FUTURE-SOURCE references that currently dangle; tracked in `notes/SPEC-HARDENING-RESIDUALS.md`.

---

*End of SPEC-INDEX.md*
