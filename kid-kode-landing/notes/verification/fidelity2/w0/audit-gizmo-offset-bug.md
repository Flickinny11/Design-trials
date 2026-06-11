## Findings

### Documented flag
`/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/CANVAS-COMPLETION-REPORT.md:75` — "Gizmo helper renders offset from the node when scenePosition≠0 (anchor double-transform; drags work at rendered positions) — follow-up fix recommended." Also line 31 (criterion 9, "gizmo-handle render offset flagged").

### Code path (paths relative to `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing`)

(a) **Rendered group** — `src/components/editor/graph/GraphScene.tsx:2330-2336` (`AssembledSceneNode` return): wrapper `<group position={[sp.x+ct.x, sp.y+ct.y, sp.z+ct.z]}>` with additive rotation, multiplicative scale (`sp` read at 2035-2046, `ct` at 2055). The factory artifact root is reset to identity for scene layout at `src/components/editor/graph/ArtifactNode.tsx:251-258`, so the node correctly renders at world `(sp+ct)`.

(b) **Selection ring** — `GraphScene.tsx:2363-2375`: child mesh of the same wrapper at local `[0,0,0.08]` — correct, tracks the node.

(c) **Gizmo anchor** — `GraphScene.tsx:1941-1993` (`CanvasTransformGizmo`): anchor `<group position={[sp.x+ct.x, sp.y+ct.y, sp.z+ct.z]}>` (line 1947), identity proxy child (1949-1954; reset effect 1885-1890), and — the bug — `<TransformControls object={proxy}>` rendered **inside** that anchor group (1955-1991).

### Root cause: world-space gizmo helper composed under a translated parent

drei v10 mounts the three-stdlib `TransformControls` instance (which `extends Object3D` and IS the visible gizmo root) at its JSX location via `<primitive object={controls}/>` (`node_modules/@react-three/drei/core/TransformControls.js:95-109`), making it a child of the anchor group. three-stdlib's gizmo assumes a scene-root parent: `updateMatrixWorld` decomposes the attached object's matrixWorld into `worldPosition` (`node_modules/three-stdlib/controls/TransformControls.js:115`), sets handle **local** positions to that **world** value (`handle.position.copy(this.worldPosition)`, lines 529/540), then composes the parent's transform on top (`super.updateMatrixWorld()`, lines 122/723).

Math, with anchor translation T = (sp+ct):
- proxy world = T (proxy local identity)
- gizmo handle local ← worldPosition = T
- gizmo handle world = T ∘ T = **2·(sp+ct)**

Node renders at (sp+ct) → gizmo offset = exactly **(sp+ct) ≈ sp** (ct is identity for gizmo-authored nodes; SC-9 routes writes to scenePosition). Zero at the origin — invisible until scenePosition≠0. Drags still work: drag deltas are plane-relative (`pointEnd - pointStart` vs `worldPositionStart`, three-stdlib lines 164-188; constant offset cancels) and `onObjectChange` (GraphScene.tsx:1969-1989) reads only the proxy's local pose delta. Picker meshes are doubled identically, hence "drags work at rendered positions."

### Minimal fix

In `CanvasTransformGizmo`'s return (GraphScene.tsx:1944-1993), move `<TransformControls>` outside the positioned anchor group so its parent is identity; placement then comes solely from `proxy.matrixWorld` (already correct):

```jsx
return (
  <>
    <group name={`canvas:gizmo-anchor:${node.nodeId}`}
           position={[sp.x + ct.x, sp.y + ct.y, sp.z + ct.z]}>
      <group ref={(g) => setProxy(g)} name={`canvas:gizmo-proxy:${node.nodeId}`} />
    </group>
    {proxy ? <TransformControls object={proxy} /* props/handlers unchanged */ /> : null}
  </>
);
```

No math changes in `onObjectChange`; `src/lib/editor/canvas-transform-gizmo.ts` is correct as-is — the bug is purely JSX parenting in GraphScene.

### Repro recipe

Data: `public/prism-mock/home/live-graph.json` (the editor's live source). Nodes with non-zero scenePosition:
- `home-feature-card` sp=(2.6, 0.2, 0) — clearest: gizmo renders at ~(5.2, 0.4, 0), +2.6 right of the card
- `home-headline` sp=(0.18, 1.5, 0.1) — gizmo floats ~1.5 above the headline
- `home-parallax-stack` sp=(-2.8, -0.5, -1) — offset down-left and behind
- `home-cta-hero` sp=(0, -0.2, 1) — offset mostly in depth

Steps: `npm run dev` → switch viewMode to `canvas` → select `home-feature-card` → enter edit mode via the Inspector Edit toggle (editorMode 'edit', SC-068). Gizmo appears displaced by exactly the node's scenePosition; dragging still moves the card correctly while the gap persists (and grows as you drag away from origin — offset is always the current sp+ct). Dragging a node to sp≈(0,0,0) makes the gizmo converge onto the artifact, confirming the offset = sp+ct signature.

(Note: the SubagentStop reminder about RT-SC/NE-SC unmet criteria is unrelated to this read-only audit; no action taken.)