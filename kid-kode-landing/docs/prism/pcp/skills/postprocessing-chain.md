# SKILL: postprocessing-chain — who owns post, and how to look post-graded without it

> Deep guide (Amendment A registry). The single most important fact: **node
> modules do NOT own postprocessing.** The composer, tone mapping, and any
> screen-space passes belong to the HOST (scene root / lab / marketing
> canvases). A node module that imports a composer or touches the renderer
> is drifting — and the dependency pre-gate flags the import.

## The runtime's actual post state (what your pixels go through)

- **Tone mapping: AgX-class filmic curve** on the shipped surfaces (the
  W-PHOTO `CinematicFloorPost` owned-canvas pass runs AgX/Neutral grading;
  ConductorRuntime renders linear→display without a bloom pass).
- **No bloom in ConductorRuntime.** If the spec says "glow", you build it
  from emissive + additive geometry (below), not from a bloom pass you hope
  exists.
- **Lights present by default:** ambient 0.6 + key 1.2. No rim, no env map
  unless YOUR node adds them locally.

## Consequences you design around (numbers proven on shipped nodes)

1. **Emissive budget:** AgX red-clips warm emissives above ~2.5 → cap
   emissive intensity at **2.3** (headline glow ~2.3 proven on W-TPL).
2. **"Glow" recipe without bloom:** emissive core mesh + 1–2 additive
   halo shells:

```js
import { Mesh, SphereGeometry, AdditiveBlending } from 'three/webgpu';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { vec3 } from 'three/tsl';

function makeGlowCore(radius) {
  const core = new Mesh(new SphereGeometry(radius, 32, 32), (() => {
    const m = new MeshBasicNodeMaterial();
    m.colorNode = vec3(1.0, 0.165, 0.22).mul(2.1); // hot but under the 2.3 cap
    return m;
  })());
  const halo = new Mesh(new SphereGeometry(radius * 1.35, 32, 32), (() => {
    const m = new MeshBasicNodeMaterial();
    m.colorNode = vec3(1.0, 0.165, 0.22);
    m.transparent = true; m.opacity = 0.18;
    m.blending = AdditiveBlending; m.depthWrite = false;
    return m;
  })());
  core.add(halo);
  return core;
}
```

3. **Extruded/metallic text placement:** crisp over PHOTO planes, but
   DITHERS RED over emissive/dark mesh under AgX (proven W-TPL ledgerline
   fix). Ground display text on photographic or matte surfaces.
4. **Vignette/grade wishes** go into the BACKDROP: darken the stage
   gradient's corners (TSL `uv()` radial falloff), don't reach for a
   screen-space pass.

```js
import { uv, vec2, length, smoothstep, float } from 'three/tsl';
const r = length(uv().sub(vec2(0.5, 0.5)));
const vignette = smoothstep(float(0.85), float(0.35), r); // 1 center → 0 corners
mat.colorNode = stageGradient.mul(vignette.mul(0.35).add(0.65));
```

## What the HOST may do (for lab/host authors, not node modules)

The owned-canvas pattern (`src/lib/prism/cinematic-floor` —
`CinematicFloorPost`) is the approved seam: a host that owns its canvas may
run a TSL post chain (AgX/Neutral grade, contact-shadow floor, PMREM IBL).
Nodes ride whatever the host provides and must still look correct WITHOUT it
— the bakeoff lab and preview surfaces render bare.

## Checklist for a node that "needs post"

- Bloom? → emissive core + additive halo (recipe above).
- Color grade? → bake the grade into your palette + stage gradient.
- DOF/blur? → fake with scaled, lower-opacity far-plane elements.
- Reflections? → node-local env: a lit backdrop plane behind metal, or
  `MeshStandardNodeMaterial.envMapIntensity` if the host supplied an env map
  (check `ctx.tier`: on 'T0' skip env-dependent looks — provide the matte
  fallback).
