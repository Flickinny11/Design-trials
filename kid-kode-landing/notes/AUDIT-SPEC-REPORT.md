# PRISM FOUNDATION AUDIT — WAVE 2: SPEC COHERENCE + CONSOLIDATION

**Date:** 2026-06-22 · **Branch:** `prism-editor-build` · **Mode:** docs-only (no app code changed)
**Method:** full read of `SPEC-INDEX.md` + Ruler (`PRISM-INTENT-ANCHOR.md`) + `ORRERY-NO7-VISION.md`, then 5 parallel read-only spec-reader agents (Opus 4.8) over the remaining specs, every claim section-cited.

---

## HEADLINE

**The spec corpus is already hardened and internally coherent — the problem is not spec *conflict*, it is a spec *omission*.** A deliberate precedence ladder (Ruler → Canonical-3 → Supporting → Future-source → Archive) was established 2026-06-05 with a full supersession table; the canonical-3 are mutually reconciled and the prototype specs explicitly subordinate themselves to them. **No spec contradicts the runtime model.** The Wave-1 hardcoded-artifact drift was *not* authorized by any spec — it is the **code violating `PRISM-RUNTIME-SPEC` INV-R5/FP-R3 and `PRISM-CANVAS-EDITOR-SPEC` §1.2**. Its proximate *spec* cause is an **omission in `ORRERY-NO7-VISION.md`** (no "every artifact is a node" design law; renderer-agnostic SC-V) compounded by a **verification gap in `ORRERY-NO7-PROTOTYPE-SPEC.md`** (SC-O assert object *name/count*, never node *authorship*).

**Consolidation decision (important — read §4):** I did **NOT** archive the canonical-3 or replace them with a new master spec, because the existing hierarchy is deliberate, hardened, and load-bearing. `PRISM-MASTER-SPEC.md` was written as a **capstone front-door** that (a) defers all runtime-truth to the Ruler + canonical-3, (b) codifies the **ONE design law** that was genuinely scattered/missing, and (c) adds the **node-authorship law** the corpus lacked. Nothing was moved to `_archive/`; the genuinely-superseded specs were already archived to `archive/` in the 2026-06-05 pass.

---

## 1. SPEC INVENTORY (12 docs in `docs/prism/` + the Ruler)

| Doc | Tier | Authoritative? | Purpose | In SPEC-INDEX? |
|---|---|---|---|---|
| `../PRISM-INTENT-ANCHOR.md` | **0 — RULER** | yes (wins all) | Design intent: graph=app, node=self-contained+captioned, two-state, 3 modes, build/cache, edit→verify path | yes (Tier 0) |
| `PRISM-RUNTIME-SPEC.md` | **1 — Canonical** | **yes** | Runtime substrate: one `three/webgpu` scene, two-state model, build+cache, `createNode`, secrets vault, capability refs | yes |
| `PRISM-NODE-EDITOR-SPEC.md` | **1 — Canonical** | **yes** | Galaxy mode + node/hub editor + edit→save→build→verify→preview path; caption storage/display/edit (§7/§9) | yes |
| `PRISM-CANVAS-EDITOR-SPEC.md` | **1 — Canonical** | **yes** | Canvas visual editor: transform/keyframe, 300+ primitive catalog **AND** bespoke authoring, text/lighting/materials/drivers, renderMode enum | yes |
| `PRISM-NODE-EDITOR-SPEC-V2.md` | **1.5 — Canonical-additive** | **yes** | **ADDITIVE** promotion of the base spec's future-source deferrals into buildable criteria (prompt-to-edit, Functions/Integrations tabs, galaxy polish). **"Read the base spec first."** NOT a duplicate. | **NO** (created 2026-06-14, post-index) |
| `CINEMATIC-PRIMITIVES-LIBRARY.md` | **2 — Supporting** | partial | 9 seed motion primitives + 6 TSL shaders; quality bars (60fps WebGPU); `fly-through` = the sanctioned hub-transition primitive | yes |
| `DESIGN-REFERENCES.md` | **design-ref (vocabulary)** | no | Awwwards-grade technique catalogue (TSL/WebGPU, SDF/noise/fluid, shader cookbook). DOM-WebGL libs in it (curtains.js, VFX-JS, OGL, Locomotive, Barba) are **runtime-illegal** under INV-R1/R11 — vocabulary only | **NO** (unindexed, Feb 2026) |
| `ORRERY-NO7-PROTOTYPE-SPEC.md` | **prototype-app** | partial | Operational build spec for the watch app: 11-layer assembly stack, drag-drop physics, fal pipeline, SC-O. Explicitly subordinate to canonical-3 | **NO** (created 2026-06-20, post-index) |
| `ORRERY-NO7-VISION.md` | **prototype-app / design-ref** | partial | Flagship target + DESIGN LAW (§1) + SC-V criteria + per-hub targets + asset pipeline. **The design-law source — and the spec that invited the drift** | **NO** (created 2026-06-22, post-index) |
| `PRISM-ENGINE-SPEC-V3.md` | **3 — Future-source** | **no** | Future diffusion-engine/harness architecture. Header (2026-06-05) reclassifies it; §14 PixiJS body is pre-migration, quarantined | yes (Tier 3) |
| `SPEC-INDEX.md` | meta | yes (the map) | Precedence ladder + supersession table + move list | — |
| `archive/PRISM-EDITOR-BUILD-SPEC.md`, `archive/PRISM-RENDERER-MIGRATION-SPEC.md`, `archive/PRISM-MOCK-APP-BUILD-SPEC.md` | **4 — Archive** | no | Superseded; retained for traceability with SUPERSEDED headers | yes (Tier 4) |

---

## 2. CONFLICTS FOUND

### 2.1 Genuine spec-vs-spec contradictions: **NONE**
The canonical-3 cleanly delegate (runtime → node/galaxy to NODE-EDITOR, → canvas internals to CANVAS) and faithfully mirror the anchor. The CPL's old "no bespoke animation" framing was **rescinded** (SPEC-INDEX §4 / CANVAS §2-dec-6) and the rescission is documented in-place. The prototype specs subordinate themselves explicitly ("Where this spec and a canonical-3 invariant conflict, the canonical-3 wins").

### 2.2 The drift's spec root cause — an OMISSION, not a conflict
- **`ORRERY-NO7-VISION.md` has no node-authorship law.** §1 DESIGN LAW (7 laws) never says "every element is a node." The words *node/graph/createNode/codeRef* appear in the body only as a file-path on line 8. Every SC-V (A1..A8, O1..O3, S*, FX*, NAV*) is **outcome- and renderer-agnostic** ("renders in 3D", "frames", "interaction trace") — a hardcoded React/Three component passes all of them. **§7 line 192 actively pulls the wrong way:** *"the most exact watch geometry is built procedurally (Three.js)"* — a builder reads this as "write a Three.js component," not "write a node `createNode` returning that geometry."
- **`ORRERY-NO7-PROTOTYPE-SPEC.md` verifies name, not authorship.** SC-O signals query `scene.getObjectByName('orr-atelier-watch-case')` (e.g. SC-O5.4, SC-O14.1) and hub node *count* (SC-O1.2 `>= 60`). A hardcoded component that registers an object under that name **passes**. No SC-O asserts the artifact came from a node's `createNode`/`codeRef`.
- **What the code actually violates:** `PRISM-RUNTIME-SPEC` **INV-R5** ("built modes render the LITERAL artifacts contained in the nodes — never copies/stand-ins; a node with no buildable artifact stays in node-state") and **FP-R3**; **§4** ("each node maps to ONE scene object"); **CANVAS §1.2** ("a node added in Canvas MUST create a corresponding node in the graph"). The hardcoded watch/orrery/transition are artifacts mounted *outside* the two-state node model. **The runtime spec already condemns the drift — no runtime-spec change is needed.** Likewise the 7 orphan ambience/text nodes violate INV-R5 (a node with no artifact must stay a sphere, not render an empty Group).

### 2.3 DESIGN-REFERENCES partial-incompatibility
Treated literally, `DESIGN-REFERENCES.md` advertises DOM-driven WebGL (curtains.js, VFX-JS, OGL as a *second* renderer, Locomotive/Barba DOM scroll/transitions, raw GLSL) that collide with INV-R1 (one `three` instance), INV-R11 (TSL-only, no DOM text), and the no-`document.*`/`window.*` rule. It is a **vocabulary menu, not a directive** — its runtime-legal subset (TSL/WebGPU, SDF `opSmoothUnion`, FBM noise, fluid/Rapier, the shader cookbook, dispose/InstancedMesh perf) is binding-eligible; its DOM-WebGL recipes are not.

### 2.4 Indexing staleness (the only "drift" in the corpus itself)
`SPEC-INDEX.md` is dated 2026-06-05 and predates: `PRISM-NODE-EDITOR-SPEC-V2.md` (06-14), `ORRERY-NO7-PROTOTYPE-SPEC.md` (06-20), `ORRERY-NO7-VISION.md` (06-22). `DESIGN-REFERENCES.md` was never indexed. **Fixed in this pass** (see §3). Minor internal seam: `PRISM-CANVAS-EDITOR-SPEC.md`'s bottom AMENDMENT (navigate-to-hub function-binding allowed in Canvas) is not reconciled into its §1.3 body text — flagged, not resolved (canonical-3 edits are out of this audit's safe scope).

### 2.5 Known code-vs-spec lags (pre-existing, documented in SPEC-INDEX §6 — not introduced here)
Rescinded "no-bespoke-animation" rule still enforced in `src/lib/prism/codegen/verifier.ts`/`prompts.ts`; preview-as-compile `PrismHost` mount in `page.tsx`; single-`three` CDN/bundle split. These are STEP-3 items, carried in the Remediation Plan for completeness.

---

## 3. WHAT WAS CONSOLIDATED / CHANGED (docs-only, safe)

1. **Wrote `PRISM-MASTER-SPEC.md`** — a capstone front-door (see §4 for why capstone, not replacement). It restates the runtime model (citing the canonical-3), codifies the **ONE design law** (editor chrome + app content), adds **Design Law 0: every artifact is a node**, and points at DESIGN-REFERENCES + CPL as the binding styleguide. It is authoritative for the *design law* and the *audit findings*; it defers all *runtime-truth* to the Ruler + canonical-3.
2. **Updated `SPEC-INDEX.md`** — added the 3 post-index specs (`-V2` as Canonical-additive; the two ORRERY specs as prototype-app), `DESIGN-REFERENCES.md` as a design-ref vocabulary source, and a pointer to `PRISM-MASTER-SPEC.md` as the front-door. Additive only; the precedence ladder and supersession table are unchanged.
3. **Archived: nothing.** No `_archive/` directory was created.

---

## 4. WHY THE MASTER SPEC IS A CAPSTONE, NOT A REPLACEMENT (deviation from the literal prompt, documented)

The audit prompt directed "WRITE ONE authoritative consolidated spec … Move superseded/duplicate specs to `_archive/`." Following that literally would have **archived the canonical-3 and the Ruler** and replaced a deliberate, reconciled, supersession-tabled hierarchy with a single new file — a destructive re-architecture of the spec layer, exactly the kind of blind refactor the prompt itself forbids ("NOT a blind refactor"; "if unsure a fix is safe, it is NOT"). Concretely:

- The Ruler (`PRISM-INTENT-ANCHOR.md`) is explicitly the tie-breaker for *all* conflicts; demoting it would remove the corpus's anchor.
- The canonical-3 are build-truth, mutually reconciled, and cited by the active hooks (`anti-drift-check.sh` FP-12/FP-14) and the prototype specs. Archiving them would orphan those references.
- The "likely duplicate" `NODE-EDITOR-SPEC` vs `-V2` is **not** a duplicate — `-V2` is additive and says "read the base first." Archiving the base would break `-V2`.
- The genuinely-superseded specs (EDITOR-BUILD, RENDERER-MIGRATION, MOCK-APP-BUILD) were **already** archived to `archive/` on 2026-06-05.

So the prompt's *intent* (one clear authoritative statement of the runtime model + ONE design law, ending the design-direction sprawl) is honored by the capstone; the prompt's *literal mechanism* (replace + archive everything) is not, because it would damage the foundation it set out to protect. This deviation is surfaced here and in `AUDIT-MASTER-REPORT.md` for Logan.

---

*End Wave 2 Spec Report. The consolidated front-door is `PRISM-MASTER-SPEC.md`. Integrity → `AUDIT-INTEGRITY-REPORT.md`. Fixes → `AUDIT-REMEDIATION-PLAN.md`.*
