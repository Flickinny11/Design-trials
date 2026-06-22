# FIX2 — The configurator watch into the graph (G1 + G4)

**Run:** 2026-06-22 · branch `prism-editor-build` · model claude-opus-4-8 · ULTRACODE
**Commits:** `989ce91e` (W1) · `94c951fd` (W2) · this report (W3)
**Verdict:** ✅ COMPLETE — the hero watch is now a genuine, node-authored, editable graph node with **zero regression**.

---

## 1. What this fixed (the CRITICAL audit item)

The FOUNDATION AUDIT (`AUDIT-INTEGRITY-REPORT.md` C1/H1) found the configurator
watch — **the literal hero of the app** — was HARDCODED: a React/R3F component
(`AtelierWatchRig.tsx`) mounted as a JSX sibling of the node map in `GraphScene`,
tagged `userData.prismHardcodedArtifact:'configurator-watch'`, with **no graph
node and no codeRef**, its behavior wired through dead node refs + a
`window.__ATELIER_RIG__` imperative bridge. This violated **PRISM-MASTER-SPEC
Law 0** ("every artifact is a node"), and FIX1's node-authorship gate flagged it.

FIX2 wired it **through the node system** (not a re-skin): the watch is now the
graph node **`orr-atelier-watch`** (`codeRef: 'builtin:atelier-watch'`), rendered
through the existing-but-unused `coderef-factory`/`buildPerNodeFactory` path — the
**first real use** of codeRef in this app (was 0/331). **The payoff: the watch is
finally a selectable, editable NODE in the canvas editor** — the thing we could
never test.

---

## 2. What became a node + how it mounts via codeRef (G1)

### The node
`public/prism-mock/home/live-graph.json` gains **one composite node**:
```
orr-atelier-watch · parentHubId s6-atelier · codeRef 'builtin:atelier-watch'
  · renderMode mesh · scenePosition {0, 0.15, 0.42} (= the old PIVOT_CENTER)
  · intent.caption "ORRERY No.7 — the configurable atelier watch…"
```

### The factory (the headless port)
`src/lib/prism/atelier/watch-node-factory.ts` (618 lines) — a faithful, **headless**
`createNode(config, ctx): THREE.Object3D` port of the former rig. SAME generated
GLB parts (`case-gen`/`bezel-gen`/`crown-gen` + `tourbillon`), SAME materials/
finishes, SAME dial-stack geometry, SAME cinematic motion. React-coupling resolved:

| React dep (old rig) | Headless replacement (node factory) |
|---|---|
| `useGLTF` | `ctx.glbLoader.loadGLB` → async graft (default-factory pattern) |
| `useFrame` | `getSharedDriverHub().frame.add` — `SceneDriverHost` ticks it every rendered frame; not ticked in galaxy (correct: the watch only animates in the built scene) |
| `useConfiguratorStore(hook)` | `useConfiguratorStore.getState()` + `.subscribe()` |
| `useThree().scene` (night dim) | lazy walk up `.parent` to the `Scene` on first frame |
| `useThree().camera` (godray billboard / parallax) | **eliminated** — godray is a static additive shaft (camera is head-on in the atelier → visually identical); parallax reads pointer NDC from the DriverHub |
| canvas pointer listeners | the slim `AtelierInputController` (editor-shell, owns the DOM) forwards drags via the node handle |

**Interactivity is gated on `ctx.drivers`** (present only for the scene-layout
surface, which canvas + preview-app share one cached instance of) → exactly ONE
interactive watch exists; the galaxy/topology instance is a static selectable
artifact. No double-bound frame loop or handle.

### The registry (why a bundled factory works in Next)
`resolveCodeRef(url)` does a runtime `import(url)`, which a Next/webpack bundle
cannot resolve from a literal string key. So bundled factories register in
`src/lib/prism/runtime/factories/coderef-registry.ts`
(`'builtin:atelier-watch' → createWatchNode`); `resolveCodeRef` consults the
registry **before** the dynamic URL import. Real-URL codeRefs still fall through.

### The mount path (verified end-to-end by the criteria reviewer)
`hasArtifactData` true for codeRef nodes → `AssembledSceneNode` mounts
`<ArtifactNode>` → `buildPerNodeFactory` → `resolveCodeRef` (registry hit) →
`createWatchNode` produces the renderables. The mounted root is tagged with the
authoring id in the factory **and** by `AssembledSceneNode` (which stamps
`userData.prismNodeId` + registers it in `__PRISM_EDITOR_NODE_GROUPS__`), so the
node-authorship probe counts it as node-authored (42 renderables).

### Removed
The `<AtelierWatchRig>` JSX sibling + its `prismHardcodedArtifact` tag are gone
from `GraphScene`; `AtelierWatchRig.tsx` is retired to `.bak`. `'configurator-watch'`
dropped from `EXPECTED_HARDCODED_ARTIFACTS` (node-authorship.ts) + the gate script.

---

## 3. Dead-ref reconciliation (G4)

`config.ts` referenced **30 dead per-part nodeIds** across 7 material layers
(`orr-atelier-watch-{case,bezel,dial,crown,lug-*,mk-*,hand-*,strap-*}`), all
ABSENT from the live graph (the applier's scene-walk silently no-op'd on them —
the rig actually self-dressed from the store). Reconciliation: every material
layer's `nodeIds` re-pointed to the real composite node `['orr-atelier-watch']`.
**0 dead refs remain** (grep across `src/` finds only one documentation comment).

`applier.ts` documents the node-driven model: the watch SELF-APPLIES finishes via
its factory's store subscription; `applyConfiguratorToScene`'s material-walk is a
graceful no-op fallback that now addresses the real node id (the price/summary/
reason **text** appliers — which target the real `orr-atelier-price/-summary/
-reason` nodes — are unchanged and still work).

### The remaining bridge (justified)
`window.__ATELIER_RIG__` remains — but it is now **written BY the node factory**
(not a hardcoded sibling) and consumed by `actions.ts` (flip/explode/loupe/save),
`AtelierDragController` (`.pivot` hit-test), and `AtelierInputController` (drag
input). This is **transitional input/inspect plumbing**: input is inherently
DOM-coupled (the spec's own `SceneDriverHost` owns pointer input for all nodes),
so the watch reading drag input via a control handle fed by the editor shell is
consistent with the driver model. The **artifacts + their finish behavior are
real-node-driven**; the bridge carries only imperative verbs (flip/explode/night/
drag) and the pivot reference. A future pass can promote "drag" to a first-class
DriverHub pointer input and retire the handle entirely.

---

## 4. THE PAYOFF — the watch is a selectable, editable node

`w3-PAYOFF-watch-selected-editable.png` (canvas mode): the watch is **selected**
(`selectedNodeId === 'orr-atelier-watch'`) with a transform gizmo + selection
ring; the **Inspector** is open titled "Orr Atelier Watch" with VISUAL/MATERIAL/
BEHAVIOR/FUNCTIONS/INTEGRATIONS tabs, a BUILT badge, Clone / Change Artifact /
Save & Rebuild, a live webgpu preview, and **Position X/Y/Z = 0.00/0.15/0.42**
(exactly its scenePosition). The watch that was untestable is now first-class.

---

## 5. No-regression matrix (every behavior, with frames)

| Behavior | Mechanism (node-driven) | Result | Frame |
|---|---|---|---|
| Render (default) | codeRef factory → 42 renderables | premium hero, navy dial + gold orrery, steel case, sapphire, strap | `w1-s6-watch-headon.png` |
| Live finish swap | store `setLayer` → factory `.subscribe` → `applyBuild` | dial→Aventurine, case→Black DLC; **price 80,000→75,800**; summary updates | `w1-s6-watch-swap.png` |
| Exploded view | `__ATELIER_RIG__.explode` → staggered tier remap | case/bezel/dial/fanned-indices/crystal separate at 3/4 pose | `w2-explode.png` |
| Caseback flip | `.flip` → pivot→π + movement visible | exhibition back reveals the tourbillon movement | `w2-flip-caseback.png` |
| Day/night lume | `.night` → emissive ramp + IBL dim (lazy scene-walk) | hands+indices ignite blue, dial glows, **price→80,300**; night-off restores env→~1.0 | `w2-night-lume.png` |
| Drag turntable | `AtelierInputController` → `.dragBy` | yaw 0→2.88 | (verified via evaluate) |
| Price/summary | text appliers on real text nodes | live updates across all swaps | (in swap/night frames) |
| Save / restore | `actions.ts` → store `serialize`/`restore` + localStorage | round-trip restores the saved dial | (verified via evaluate) |

All driven with **0 console/page errors**.

---

## 6. Gate verdicts (all GREEN)

- **Cold-load gate** (fresh `rm -rf .next` restart, Chrome DevTools MCP): canvas
  present (1440×809), 0 console errors, all 38 network requests 200/301/304 (no
  `_next` 404, no 5xx), no stuck loader. **PASS.**
- **node-authorship-gate.mjs --strict-orphans**: `configurator-watch` **NOT
  flagged** (only `hub-transition` + `orrery-complication` remain, expected for
  G2/G3); no fresh Law-0 drift; **177 node-authored artifacts, all in graph**;
  watch renders content (not an orphan); 0 page errors. **10/11 ok · 0 hard-fail.**
  (The 1 soft WARN is pre-existing async MSDF text-warming, non-fatal.) JSON:
  `notes/verification/fix2/node-authorship-gate-strict.json`.
- **tsc gate**: 9 total / baseline 10 / **0 new**. PASS.
- **prism-criteria-reviewer** (node-authorship-aware, fresh context): **PASS — no
  MUST-FIX, no SHOULD-FIX.** All 7 criteria MEET (Law 0/node-authorship genuine,
  FP-05 scope correct, FP-12/14/15 no drift, INV-17 non-destructive, codeRef
  contract satisfied, 0 dead refs, INV-18 additive).
- **user-advocate** (judges as a user, from evidence): **PLEASED · gate PASS**
  (schema-validated). Zero visible/functional regression; every claimed behavior
  shown in a cited frame; now a coherent editable node.

---

## 7. Honest flags

1. **[pre-existing, non-blocking] Translucent gray sheared quad behind SAVE/RESET**
   on the price plaque. The user-advocate **proved this is pre-existing** — the
   identical artifact appears in pre-port hardcoded baselines (`/tmp/w1-atelier.jpg`,
   `/tmp/w2-clean.jpg`, hours before the port) — so it is NOT a FIX2 regression. It
   belongs to the configurator's button-UI nodes (`orr-atelier-btn-*`), not the
   watch. Worth a follow-up cleanup; out of scope for this watch task.
2. **[transitional, justified] `window.__ATELIER_RIG__` bridge** remains for
   imperative inspect/input verbs (§3). The artifacts + finishes are node-driven;
   the bridge is editor-shell input plumbing consistent with the driver model.
3. **[non-fatal] MSDF text-warm WARN** in the authorship gate — atelier text nodes
   warm glyphs async; a pre-existing timing artifact, not introduced by FIX2.
4. **In scope but untouched (correct):** the orrery complication (G2) and hub
   transition (G3) remain hardcoded — their own greenlight sessions. The arrival
   hero `orr-arrival-watch` (s1, a different product-hero node) is untouched.

---

PRISM-FIX2-WATCH: RUN COMPLETE
