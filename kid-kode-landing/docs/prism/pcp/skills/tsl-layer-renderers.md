# SKILL: tsl-layer-renderers — TSL-shaded surfaces inside Prism node modules

> Deep guide (Amendment A registry, retrieved per node class — not inline in
> L1). Teaches TSL usage INSIDE the Prism runtime specifically: allowlist
> imports only, Node materials from `three/webgpu`, shader nodes from
> `three/tsl`, WebGL2-fallback-safe idioms. Every snippet obeys the
> createNode contract (sync return, `userData.cleanup`).

## Import discipline (the #1 TSL crash in W-BAKE)

Materials come from `three/webgpu`; shader NODES come from `three/tsl`.
Mixing them up throws at module-execute time:

```js
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial, DoubleSide } from 'three/webgpu'; // materials + THREE classes
import { uv, vec3, float, mix, smoothstep, uniform, time, sin } from 'three/tsl';           // nodes
```

`MeshStandardNodeMaterial` from `'three/tsl'` = crash. Raw GLSL/WGSL strings,
`ShaderMaterial`, `RawShaderMaterial` = forbidden (verifier + runtime).

## Layer 1 — the graded stage backdrop (kills FLAT_VOID)

A 7×6-unit plane at z≈-2.5 with an engineered vertical gradient from the
spec's gradientStops:

```js
import { Mesh, PlaneGeometry } from 'three/webgpu';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uv, vec3, mix, smoothstep, float } from 'three/tsl';

function makeStage() {
  const geo = new PlaneGeometry(7, 6);
  const mat = new MeshBasicNodeMaterial();
  const v = uv().y;
  const lo = vec3(0.043, 0.043, 0.063);  // #0b0b10
  const mid = vec3(0.063, 0.063, 0.090); // #101017
  const hi = vec3(0.086, 0.086, 0.114);  // #16161d
  mat.colorNode = mix(mix(lo, mid, smoothstep(float(0.0), float(0.55), v)), hi, smoothstep(float(0.55), float(1.0), v));
  const m = new Mesh(geo, mat);
  m.position.z = -2.5;
  return m;
}
```

WHY: a lit gradient reads as a stage; a flat `#000` clear color reads as
"nothing rendered" (DL16). Hex→vec3 is `channel/255` — compute the numbers,
don't guess.

## Layer 2 — emissive accent core (self-lit focal element)

```js
const core = new MeshStandardNodeMaterial();
core.colorNode = vec3(1.0, 0.165, 0.22);            // #ff2a38 accent
core.emissiveNode = vec3(1.0, 0.165, 0.22).mul(1.8); // ≤2.3 — AgX red-clips above ~2.5
```

WHY: on a dark stage the brightest element carries the composition (grammar
corpus: "the fluid IS the light source"). Cap emissive at 2.3 — tone mapping
clips hotter warm emissives to orange mush.

## Layer 3 — animated surfaces (time-driven, no ticker needed)

TSL `time` animates in the shader — zero JS per frame, survives WebGL2
fallback:

```js
import { time, sin, uv, float } from 'three/tsl';
const pulse = sin(time.mul(1.4)).mul(0.5).add(0.5);      // 0..1
mat.emissiveNode = accent.mul(pulse.mul(0.8).add(1.2));   // 1.2..2.0 breathing glow
```

For uniforms you drive from gsap instead:

```js
const hover = uniform(0);         // JS-side handle
mat.opacityNode = hover.mul(0.4).add(0.6);
// later: gsap.to(hover, { value: 1, duration: 0.3, ease: 'power2.out' })
```

## Layer 4 — parallax-plane displacement (the renderMode contract)

`renderMode: 'parallax-plane'` must displace by the depth map:

```js
const geo = new PlaneGeometry(3.2, 2.0, 64, 64); // tessellated — displacement needs vertices
const mat = new MeshStandardNodeMaterial();
ctx.textureLoader.loadTexture(config.imageUrl).then((tex) => { mat.map = tex; mat.needsUpdate = true; });
ctx.textureLoader.loadTexture(config.depthMapUrl).then((depth) => {
  mat.displacementMap = depth;      // satisfies the verifier + real displacement
  mat.displacementScale = 0.35;     // 0.25–0.45 — beyond that edges tear
  mat.needsUpdate = true;
});
```

## Layer 5 — glass (transmission + the two lights it needs)

```js
import { MeshPhysicalNodeMaterial, PointLight } from 'three/webgpu';
const glass = new MeshPhysicalNodeMaterial();
glass.transmission = 0.95; glass.ior = 1.5; glass.thickness = 0.4;
glass.roughness = 0.08; glass.iridescence = 0.6;
// Glass over a dark stage VANISHES without these two:
const rim = new PointLight(0xff2a38, 0.9); rim.position.set(-1.6, 0.4, -0.8); // back-rim, accent
group.add(rim); // node-local light — bounded intensity ≤1.5, always disposed via cleanup
```

## WebGL2-fallback caveats (the capture/runtime floor)

- TSL compiles to GLSL on the WebGL2 fallback — everything above works, but
  `three-msdf-text-webgpu`'s NodeMaterial does NOT (use `ctx.fontAtlas`,
  which handles the fallback; never import the package).
- `material.map` hot-swap AFTER first render may not recompile on WebGPU —
  assign maps inside the loader `.then` and set `needsUpdate = true`
  immediately, before the mesh's first visible frame where possible.

## Cleanup contract

Every geometry/material/texture you create is disposed in
`userData.cleanup()`; node-local lights are removed from their parent there
too. TSL nodes themselves need no disposal — the material owning them does.
