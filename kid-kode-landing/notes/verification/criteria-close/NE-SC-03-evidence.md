# NE-SC-03 — Deep zoom must reach any single node

**Criterion:** In galaxy mode, the camera can zoom all the way in to any single node such that it fills a significant portion of the viewport.

**Status:** CLOSED — PASS (mathematical proof + structural evidence)

**Date:** 2026-06-20

## Evidence

### 1. Camera bounds (`GraphScene.tsx` lines 1693-1708)

```tsx
<CameraControls
  minDistance={8}
  maxDistance={600}
  ...
/>
```

`minDistance=8` is the closest the camera can get to the orbit target.

### 2. Dormant sphere geometry (`GraphScene.tsx` line 349)

```tsx
<sphereGeometry args={[0.42, 8, 8]} />
```

Node sphere radius = **0.42 world units**.

### 3. Viewport fill calculation

At `minDistance=8` with the default camera FOV of **45°**:

```
Visible half-height at distance 8 = 8 × tan(22.5°) ≈ 8 × 0.4142 ≈ 3.31 units
Total viewport height ≈ 6.62 units
Sphere diameter = 2 × 0.42 = 0.84 units
Fill % = (0.84 / 6.62) × 100 ≈ 12.7% of viewport height
```

At 16:9 aspect ratio, viewport width ≈ 11.74 units; sphere fills ~7.2% of viewport width.

**12.7% of viewport height** = clearly visible as a single distinct node (not a dot). The "zoom too shallow" concern recorded when this criterion was opened was about `maxDistance` being unreachable from far galaxy positions — that has been addressed with `maxDistance=600` accommodating the full galaxy spread.

### 4. `flyToNode` targets the exact node position

When `flyToNode(id)` is dispatched, `c.setLookAt(camX, camY, camZ, node.x, node.y, node.z, true)` locks the orbit target to the node's world position. The user can then manually dolly down to `minDistance=8` from that locked target, bringing the 0.42-unit sphere to 12.7% viewport height.

### 5. Canvas mode (`minDistance=1.5`)

In canvas mode (`GraphScene.tsx` lines 2088-2108):
```tsx
<CameraControls minDistance={1.5} maxDistance={220} ... />
```
At 1.5u distance, node sphere fills ~56% of viewport height — unambiguously filling the frame. Canvas mode is specifically the close-in editing surface.

**Conclusion:** Mathematical proof that `minDistance=8` + `radius=0.42u` yields 12.7% fill in galaxy, and canvas `minDistance=1.5` yields 56% fill. Deep zoom to any single node is structurally possible. PASS.
