# PRISM FOUNDATION AUDIT — MASTER REPORT

**Date:** 2026-06-22 · **Branch:** `prism-editor-build` · **Model:** claude-opus-4-8 · **Mode:** analysis + SAFE fixes only (no scene→node re-architecture performed)
**Verification:** clean cold load confirmed (1 WebGPU canvas, not stuck on init, 0 console errors, 0 `_next` 404s, all requests 200/301/304) · tsc gate GREEN (9 total, baseline 10, **0 new**) · `prism-criteria-reviewer` soundness pass = **SOUND-WITH-NITS, no MUST-FIX**.

---

## HEADLINE — `MOSTLY-SOUND-WITH-FIXES`, with the centerpiece on `NEEDS-GREENLIGHT-REFACTOR`

The Prism runtime **substrate is sound and working**: 331 graph nodes, all tethered to hubs and all carrying a populated `intent.caption` (cold-model-readable), rendering through a clean graph-driven path (`page.tsx → GraphScene (nodes.map) → ArtifactNode`) in which text, mesh, and procedural-plane render modes are first-class without any `codeRef`. Headers, footers, nav, brand, the static hero watches, and the 3D hub backgrounds are all correctly represented (backgrounds as hub-data per Ruler §1). The spec corpus is already hardened and **internally coherent — no spec contradicts the runtime model.**

The foundation's **flagship content is not yet graph-native.** The three signature interactive artifacts — the **configurator watch (the literal hero of the app), the orrery complication, and the hub-transition curtain** — are hardcoded React/Three components rendered as JSX siblings of the node map in `GraphScene.tsx`, with no node and no `codeRef`. This directly violates the central invariant (Ruler §1 "the node graph IS the system"; RUNTIME INV-R5/FP-R3 "built modes render the literal artifacts contained in nodes"; CANVAS §1.2 "a node added in Canvas MUST create a graph node"). Bringing them into the graph is a **structural re-architecture** — flagged NEEDS GREENLIGHT, not auto-applied.

## CRITICAL VIOLATIONS: **3 hardcoded-artifact + 1 orphan-node class (7 nodes)**

| # | Violation | Where |
|---|---|---|
| C1 | **Configurator watch is not a node** (hardcoded GLB urls + procedural geo, dressed from `useConfiguratorStore`) | `AtelierWatchRig.tsx` → `GraphScene.tsx:120,4169` |
| C2 | **Orrery complication is not a node** (hardcoded `PLANETS[]` + procedural geo) | `OrreryComplicationRig.tsx` → `GraphScene.tsx:121,4171` |
| C3 | **Hub transition is not a node** (hardcoded React/Three + in-component TSL) | `HubSceneTransition.tsx` → `GraphScene.tsx:31,4397` |
| C4 | **7 orphan nodes render nothing** in preview-app (6 ambience planes + 1 empty-text node) | `orr-arrival-dust`, `orr-movement-rings`, `orr-celestia-starfield/-galaxy/-orbits`, `orr-acquire-sweep`, `orr-atelier-reason` |

Plus **HIGH** H1 (hero-watch behavior in hardcoded controllers + dead node refs in `src/lib/prism/atelier/config.ts`/`applier.ts`) and H2 (no auto-caption/behaviorSpec — *deferred future-engine work per Ruler §0/§9, not a broken-foundation item*).

## WHAT WAS SAFELY FIXED (docs-only — no risky app change)

The safe, mechanical, auto-applicable fix set for the **app** is essentially empty by design: every integrity violation is structural, and the audit contract forbids autonomous scene→node re-architecture. The durable safe fixes that landed:

- **`PRISM-MASTER-SPEC.md` — Law 0 "every artifact is a node"** + a verification corollary (SC must assert node *authorship*, not object *name*). This codifies the exact rule whose absence caused the drift — the preventative fix.
- **`SPEC-INDEX.md`** updated to include the 3 post-index specs (`-V2`, the two `ORRERY-NO7-*`) + `DESIGN-REFERENCES.md` + the master front-door pointer.
- Caption coverage confirmed 331/331 (no captioner pass needed).

**Deliberate deviation (documented in `AUDIT-SPEC-REPORT.md` §4):** the prompt asked to write one master spec and archive the rest to `_archive/`. Doing so literally would have archived the Ruler + canonical-3 — a destructive teardown of a deliberate, hardened, supersession-tabled hierarchy. Instead the master spec is a **capstone front-door** that preserves that hierarchy and defers all runtime-truth to it. Nothing was archived; `NODE-EDITOR-SPEC` vs `-V2` are not duplicates (V2 is additive).

## WHAT NEEDS GREENLIGHT (structural — see `AUDIT-REMEDIATION-PLAN.md`)

The runtime plumbing already exists (`buildPerNodeFactory`/`coderef-factory.ts` is wired but unused — 0/331 nodes carry a codeRef), so these are tractable, not from-scratch:

- **G1** Watch → graph node(s) with a `codeRef` factory `[L · MED]` · **G4** its behavior + dead refs `[M · MED]`
- **G2** Orrery → node `[M · MED]` · **G3** Transition → `fly-through` primitive / node `[M · MED]`
- **G5** 7 orphan nodes → real artifact or remove if redundant with hub `background[]` `[S–M · LOW–MED]` *(smallest, best first fix)*
- **S3d** Upgrade SC verification to assert node-authorship `[S]` *(cheap, prevents regressions — recommend next)*
- Pre-existing STEP-3 lags (S3a rescinded-animation rule still in code, S3b preview-as-compile `PrismHost`, S3c single-`three` split) carried for completeness.

**Recommended order:** S3d → G5 → G1+G4 → G2/G3 → S3a/b/c. Each as a focused Opus-4.8 session or dynamic workflow with `/prism-verify` evidence gates.

## REPORTS

- **Integrity (Wave 1):** [`AUDIT-INTEGRITY-REPORT.md`](./AUDIT-INTEGRITY-REPORT.md)
- **Spec coherence (Wave 2):** [`AUDIT-SPEC-REPORT.md`](./AUDIT-SPEC-REPORT.md)
- **Remediation (Wave 3):** [`AUDIT-REMEDIATION-PLAN.md`](./AUDIT-REMEDIATION-PLAN.md)
- **Consolidated spec (front-door):** [`../docs/prism/PRISM-MASTER-SPEC.md`](../docs/prism/PRISM-MASTER-SPEC.md)
- **Cold-load evidence:** `notes/ralph-snapshots/audit-2026-06-22/cold-load.png`

---

PRISM-AUDIT: RUN COMPLETE
