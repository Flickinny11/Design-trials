# FIX2 — Configurator watch into the graph (G1 + G4) — design

## The architecture decision

The watch (`AtelierWatchRig.tsx`, ~660 lines) is a deeply React/R3F-coupled
component (`useThree`/`useFrame`/`useGLTF`/`useConfiguratorStore`). The codeRef
path expects a plain synchronous `createNode(config, ctx): THREE.Object3D`
invoked OUTSIDE React by `buildPerNodeFactory`. **0/331 nodes carry a codeRef —
this is its first live use.**

Chosen: a **genuine headless port** (not a re-skin, not a portal of the React
rig under a node shell). Resolves the React-coupling like so:

| React dependency | Headless replacement |
|---|---|
| `useGLTF(url)` | `ctx.glbLoader.loadGLB(url)` → async graft (mirrors default-factory) |
| `useFrame((s,dt)=>…)` | `getSharedDriverHub().frame.add(dtMs=>…)` — `SceneDriverHost` ticks it every rendered frame; not ticked in galaxy (correct: watch only animates in the built scene) |
| `useConfiguratorStore(s=>s.build)` | `useConfiguratorStore.getState().build` + `.subscribe()` (zustand, headless-safe) |
| `useThree().camera` (godray billboard, parallax, raycast) | **eliminated** in the node: godray is a static additive shaft (camera is head-on in atelier — visually identical); parallax reads pointer NDC from the DriverHub; pointer-drag + catalog-skip raycast live in a slim React input controller that owns the canvas (see below) |
| `useThree().scene` (night-dim shared lights by name) | lazy walk up `.parent` to the `Scene` on first frame |
| global pointer listeners on `gl.domElement`/`window` | a slim **`AtelierInputController`** React component (editor-shell, like `SceneDriverHost`) translates real drags → calls on the node's control handle |

### Why `src/lib/prism/atelier/` is allowed to touch `window`
The FP-05 DOM-discipline hook (`anti-drift-check.sh`) scopes to
`src/lib/prism/runtime/*`, `…/mock-app-source/nodes/*`, `…/components/prism-player/*`
ONLY. `atelier/` is exempt (proven: `actions.ts` already uses
`window.localStorage`/`navigator.clipboard`). The node factory lives in
`atelier/` and may write `window.__ATELIER_RIG__`. The runtime files it edits
(`coderef-factory.ts`) stay window-free.

### The codeRef registry (why)
`resolveCodeRef(url)` does a runtime `import(url)`, which cannot reach a bundled
TS module in Next/webpack. So bundled factories register in a tiny
`coderef-registry.ts` (`codeRef key → CreateNodeFn`); `resolveCodeRef` consults
it before attempting a dynamic URL import. The watch node's
`codeRef = 'builtin:atelier-watch'`.

## Why the gate will pass
`computeSceneAuthorship` flags the watch today because its JSX mount host carries
`userData.prismHardcodedArtifact:'configurator-watch'` and it is absent from
`__PRISM_EDITOR_NODE_GROUPS__`. After FIX2:
- the watch is a real node → `AssembledSceneNode` auto-stamps
  `userData.prismNodeId` and registers it in `__PRISM_EDITOR_NODE_GROUPS__`;
- the `prismHardcodedArtifact` tag + the JSX sibling are removed;
- `'configurator-watch'` is dropped from `EXPECTED_HARDCODED_ARTIFACTS`
  (node-authorship.ts) and `EXPECTED_HARDCODED` (gate script).
Orrery + hub-transition remain flagged (expected — separate G2/G3).

## Wave 2 (G4) — dead refs
`config.ts` layers reference `orr-atelier-watch-{case,bezel,dial,crown,lug-*,…}`
nodeIds that are ABSENT from the live graph (dead). The watch is now ONE
composite node `orr-atelier-watch`; the factory dresses itself from the store
(the always-live path). Reconcile by re-pointing the layer `nodeIds` at the real
`orr-atelier-watch` node (so the applier's scene-walk addresses a real node) and
removing every dead id. `actions.ts`/`AtelierDragController` keep the
`__ATELIER_RIG__` handle (now WRITTEN BY THE NODE) — documented transitional
input/inspect bridge.
