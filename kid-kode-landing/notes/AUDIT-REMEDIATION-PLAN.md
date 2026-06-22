# PRISM FOUNDATION AUDIT — WAVE 3: REMEDIATION PLAN + SAFE FIXES

**Date:** 2026-06-22 · **Branch:** `prism-editor-build`
**Inputs:** `AUDIT-INTEGRITY-REPORT.md` (violations), `AUDIT-SPEC-REPORT.md` (spec root cause), `PRISM-MASTER-SPEC.md` (the law to bring the build to).

---

## SAFE-FIX VERDICT (read first)

**The safe, mechanical, auto-applicable fix set for the app is essentially empty — by design.** Every CRITICAL/HIGH integrity violation is **structural** (a hardcoded React/Three artifact must become a graph node, or an orphan node must be given a real artifact). Per the audit contract ("DO NOT perform the large scene→node re-architecture autonomously"; "if unsure a fix is safe, it is NOT"), all of these are flagged **NEEDS GREENLIGHT** below rather than executed. The genuinely-safe fixes that *were* applied are docs-only and already landed in Waves 1–2:

- ✅ **Caption coverage** — already 331/331; no captioner pass needed.
- ✅ **The missing design law** — `PRISM-MASTER-SPEC.md` **Law 0** ("every artifact is a node") + the verification corollary now codify the rule whose absence caused the drift. This is the durable preventative fix.
- ✅ **Spec index currency** — `SPEC-INDEX.md` updated.

The runtime plumbing needed for the big fixes **already exists**: `buildPerNodeFactory` (`src/lib/prism/runtime/factories/coderef-factory.ts`) is wired into both `ArtifactNode.tsx:35,110` and `mount-graph.ts:45,355`, and `hasArtifactData` returns `true` for any node with a `codeRef` (`ArtifactNode.tsx:95`). So the watch/orrery/transition *can* be authored as `codeRef` nodes today — the path is built and unused (0/331 nodes carry a codeRef). That lowers the re-architecture from "build a runtime" to "write factory modules + author nodes + remove direct imports + verify."

---

## NEEDS GREENLIGHT — structural fixes (do NOT auto-apply)

### G1 — Configurator watch → graph node(s) `[CRITICAL · effort L · risk MED]`
**Now:** `AtelierWatchRig.tsx` renders the whole watch from hardcoded GLB urls + procedural geometry, mounted as a JSX sibling at `GraphScene.tsx:4169`, dressed from `useConfiguratorStore`. s6-atelier has **zero** watch-part nodes.
**To comply (Master Law 0 + RUNTIME INV-R5/§4):**
1. Add watch node(s) to the s6-atelier hub in `live-graph.json` — either one composite `orr-atelier-watch` node, or the part nodes `config.ts` already references (`orr-atelier-watch-case/-bezel/-dial/-crown/-lug-*`), each with `parentHubId: 's6-atelier'`, a `scenePosition`, an `intent.caption`, and a `codeRef` pointing at a factory module.
2. Refactor `AtelierWatchRig` into a `createNode(config, ctx): THREE.Object3D` factory module (synchronous, `userData.cleanup()`, GLB loads via cached `ctx` loaders) registered for that `codeRef`. The configurator store reads stay — but routed through the node's built artifact, not a sibling component.
3. Remove the direct `<AtelierWatchRig>` import + mount from `GraphScene.tsx:120,4169`.
4. **Verify:** the watch renders in preview-app from the node, `userData.nodeId` is set, the static `product-hero` watch is no longer double-rendered, all SC-V-A criteria still pass, tsc 0-new, clean cold load.
**Risk:** MED — touches the live scene + configurator behavior; the codeRef path is built but unexercised at this complexity. Keep behind a branch; verify per-step.

### G2 — Orrery complication → graph node `[CRITICAL · effort M · risk MED]`
**Now:** `OrreryComplicationRig.tsx` hardcodes `PLANETS[]` + procedural sun/rings/planets, mounted at `GraphScene.tsx:4171`.
**To comply:** add an `orr-celestia-orrery` node to s4-celestia with a `codeRef` to an `OrreryComplication` factory (move the `PLANETS[]` data onto the node config or its caption/schema); render via `createNode`; remove the direct import/mount; keep the `window.__ORRERY__` scrub as a driver bound to the node. **Verify** SC-V-O1..O3 + cold load.

### G3 — Hub transition → sanctioned primitive / node `[CRITICAL · effort M · risk MED]`
**Now:** `HubSceneTransition.tsx` is a hardcoded React/Three curtain with in-component TSL, mounted at `GraphScene.tsx:4397`.
**To comply:** the transition is a *scene-camera* effect — the canonical mechanism is the **`fly-through` cinematic primitive at hub-manager level** (CPL §lines 211-229), or a `global`-hub node carrying the curtain artifact via `codeRef`. Re-home the curtain into one of those; remove the hardcoded sibling. **Verify** SC-V-FX1 + cold load. *(The retired DOM `HubMorphTransition.tsx` is already dead — leave it or delete in a cleanup commit.)*

### G4 — Atelier behavior controllers + dead node refs → node behavior `[HIGH · effort M · risk MED]`
**Now:** `AtelierApplier` + `AtelierDragController` are headless controllers mounted outside the graph; `src/lib/prism/atelier/config.ts:76,85,94,128` + `src/lib/prism/atelier/applier.ts:41` target nodeIds (`orr-atelier-watch-bezel/-crown/-case/-dial/-lug-*`) **absent** from the graph (dead targets); behavior runs through `window.__ATELIER_RIG__`. *(Note: these are the `src/lib/prism/atelier/` `.ts` files — distinct from the `.tsx` rigs in `src/components/atelier/`.)*
**To comply (after G1 creates the watch nodes):** point the applier/drag logic at the real watch node(s) by `userData.nodeId`; remove the dead `config.ts` refs or replace with the real ids; ideally express the part/finish/drag behavior in the node's `intent.behaviorSpec`/functionBinding rather than the imperative bridge. **Verify** SC-V-A1/A2.
**Risk:** MED — coupled to G1; do them together.

### G5 — 7 orphan nodes get a real artifact (or are removed) `[CRITICAL · effort S–M · risk LOW–MED]`
**Now:** `orr-arrival-dust`, `orr-movement-rings`, `orr-celestia-starfield`, `orr-celestia-galaxy`, `orr-celestia-orbits`, `orr-acquire-sweep` (renderMode `plane`, **no** `meshPrimitive`/`materialSpec`/`sourceAsset`/`codeRef`) render a wrong glass bubble in canvas and **nothing** in preview-app; `orr-atelier-reason` (renderMode `text`, `textSpec.content=""`) renders nothing.
**Why not auto-fixed:** giving them an artifact means **authoring a visual** (which ambient shader? what text?) — a design decision, not a mechanical edit; and per RUNTIME INV-R5 a node with no artifact must *stay a sphere*, so silently fabricating one is its own anti-pattern.
**To comply — two clean options per node, Logan picks:**
- (a) **Author the intended artifact:** give each ambience plane a `materialSpec` (TSL nebula/starfield/orbit shader) or a `codeRef` to an ambience primitive; give `orr-atelier-reason` real `textSpec.content` (its `intent.caption` describes the intended copy). Effort S–M each.
- (b) **Remove the dead nodes** if the ambience is meant to come from the hub `background[]` layer (which already carries nebula/particle layers) — the planes may be redundant duplicates of hub backgrounds. Effort S.
**Risk:** LOW for (b) on the 6 ambience planes if confirmed redundant with `background[]`; MED for (a) (new visuals must clear the art gate). **This is the smallest, most tractable greenlight item — a good first fix.**

---

## STEP-3 / pre-existing items (carried from SPEC-INDEX §6 — not introduced by this audit)

These are documented spec-vs-code lags, listed for completeness; each is its own scoped change, NEEDS GREENLIGHT:
- **S3a** Rescinded "no-bespoke-animation" rule still enforced in `src/lib/prism/codegen/verifier.ts` (`MISSING_PRIMITIVES_LOOP`) + `prompts.ts` — loosen to permit bespoke `Animatable` authoring (CANVAS §2-dec-6). `[M]`
- **S3b** Preview-as-compile: `page.tsx` mounts `PrismHost` (separate build) XOR `GraphScene` by `viewMode` — RUNTIME §6.3/INV-R4 want one unified scene. `[L]`
- **S3c** Single-`three` split: runtime CDN import-map vs editor bundle — RUNTIME INV-R1/RT-SC-02 want one bundled instance. `[M]`
- **S3d** Verification upgrade: per Master Law 0 corollary, replace name/count-only SC-O signals with **node-authorship** assertions (object carries `userData.nodeId` + graph has that node with a real factory). `[S]` — *this one is low-risk and high-value; recommend doing it next to prevent the drift from passing future gates.*
- **S3e** Cruft (SPEC-INDEX §5): doubled `kid-kode-landing/kid-kode-landing/` tree, `*.bak-*` files. Delete after a glance. `[S]` — not auto-deleted (the operator's standing rule is to preserve backups; deletion is a judgment call).

---

## RECOMMENDED ORDER (for a future greenlit run)

1. **S3d** (node-authorship verification) — cheap, prevents regressions, makes the rest gradable.
2. **G5(b/a)** (orphan nodes) — smallest structural fix; proves the per-node authoring loop end-to-end.
3. **G1 + G4** (watch → node + its behavior) — the centerpiece; highest value.
4. **G2** (orrery → node), **G3** (transition → primitive).
5. **S3a/S3b/S3c** (the canonical-3 code-vs-spec lags) as a separate hardening pass.

Each step: one focused Opus-4.8 session (or a dynamic workflow for the larger ones), TDD where sensible, `prism-criteria-reviewer` + `user-advocate` gates, `/prism-verify` cold-load evidence, tsc 0-new, commit + push.

---

*End Wave 3 Remediation Plan. Summary + verdict → `AUDIT-MASTER-REPORT.md`.*
