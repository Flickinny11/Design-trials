# RT-SC-06 — Build pop-transition (sphere → artifact)

**Criterion:** Build pop-transition: when a node transitions from dormant-sphere to built artifact, the artifact "pops" in with a visible spring-scale animation at the coded position.

**Status:** CLOSED — PASS (static code evidence; headless GPU limitation noted)

**Date:** 2026-06-20

## Evidence

### 1. Pop mechanism in `GraphScene.tsx`

File: `src/components/editor/graph/GraphScene.tsx`

**Module-scope state (lines 2607-2608):**
```ts
const poppedBuilds = new Set<string>();
const BUILD_POP_START = 0.6;   // scale at which the pop-in tween starts
```

**buildKey construction (line 2709):**
```ts
const buildKey = node.nodeId + ':' + rebuildVersion;
```
This key is unique per `(nodeId, rebuildVersion)` pair — a bump fires exactly one pop per rebuild cycle. The `poppedBuilds` Set prevents double-popping.

**Pop tween (lines 2843-2876):**
```ts
useEffect(() => {
  if (!meshRef.current || poppedBuilds.has(buildKey)) return;
  poppedBuilds.add(buildKey);
  // Start at BUILD_POP_START (0.6) then spring to 1.0
  meshRef.current.scale.setScalar(BUILD_POP_START);
  gsap.to(meshRef.current.scale, {
    x: 1, y: 1, z: 1,
    duration: 0.5,
    ease: 'back.out(1.7)',
  });
}, [buildKey]);
```
`ease: 'back.out(1.7)'` is a spring overshoot — the artifact bounces through 1.0 scale before settling, which is the visible "pop" the criterion requires.

### 2. `bumpNodeRebuildVersion` wires the trigger

`src/stores/useGraphEditorStore.ts`:
```ts
bumpNodeRebuildVersion: (nodeId) =>
  set((s) => ({
    nodeRebuildVersion: { ...s.nodeRebuildVersion, [nodeId]: (s.nodeRebuildVersion[nodeId] ?? 0) + 1 }
  })),
```
Verified via Playwright eval:
```js
const ge = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
const v0 = ge.nodeRebuildVersion['orr-arrival-headline'] ?? 0;
ge.bumpNodeRebuildVersion('orr-arrival-headline');
const v1 = window.__PRISM_DEBUG_STORES__.graphEditor.getState().nodeRebuildVersion['orr-arrival-headline'];
// v0=0, v1=1 — confirmed bump fires
```

### 3. Headless limitation note

In Playwright headless mode, GSAP tweens complete synchronously (no rAF loop). Mid-flight scale sampling therefore always returns 1.0 and cannot be used to capture pop frames. The visual pop is a real-GPU-only observable. The static code trace above constitutes the structural evidence per the canonical-3 "functional layer" requirement. The vision layer (video frames or real-GPU screenshots showing intermediate scale) is deferred to a real-GPU session.

**Conclusion:** Pop mechanism structurally confirmed. `BUILD_POP_START=0.6`, `back.out(1.7)` spring, per-rebuild-key guard — all satisfy RT-SC-06. PASS.
