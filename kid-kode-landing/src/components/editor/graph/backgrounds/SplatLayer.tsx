// THREE-D-BACKGROUNDS — captured-environment splat layer (A5 / C7).
//
// A photoreal CAPTURED environment rendered as 3D GAUSSIAN SPRITES in the single
// WebGPU scene (INV-1). Each gaussian is an instanced billboard whose 3D position
// is UNPROJECTED on the GPU from an RGBD pair (a fal-captured scene + its
// depth-anything depth map): the depth texture is sampled in `positionNode` to
// push each grid sample to its real Z, and the image texture colours it. The
// camera-journey flies THROUGH the captured volume with true parallax. Soft
// gaussian falloff (quad uv) + the gaussian count gives the 3DGS look.
//
// Spark 2.0 (`@sparkjsdev/spark`) was evaluated as the loader for true
// `.spz`/`.sog` 3DGS captures (its `SplatLoader`/`PackedSplats` unpack gaussian
// arrays). It is NOT a dependency here: Spark RENDERS via WebGL2 by deliberate
// design (World Labs) and the editor runs a single WebGPURenderer (INV-1, no 2nd
// renderer), so Spark cannot draw into this scene. This layer therefore renders
// captured data NATIVELY under WebGPU. The `{position[], rgba[], scale[]}` array
// shape Spark's loader produces is the documented swap-in for the GPU RGBD
// unprojection below (drive instanced positions/colours from decoded gaussian
// arrays instead of the depth texture) under a WebGL2 renderer.
// Gated to T2 (`minTier`), with the procedural nebula as the T0/T1 fallback.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SpriteNodeMaterial } from 'three/webgpu';
import {
  uniform,
  instanceIndex,
  texture as tslTexture,
  uv,
  vec2,
  vec3,
  float,
  floor,
  sin,
  length as tslLength,
  smoothstep,
} from 'three/tsl';
import type { BackgroundLayerParams } from '@/lib/prism-graph/types';
import type { TierBudget } from '@/lib/editor/backgrounds/tier';

type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const PLANE_W = 42;
const PLANE_H = 24;

function useImageTexture(url: string | null | undefined): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (cancelled) { t.dispose(); return; }
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        setTex((p) => { p?.dispose(); return t; });
      },
      undefined,
      () => !cancelled && setTex(null),
    );
    return () => { cancelled = true; };
  }, [url]);
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

export interface SplatLayerProps {
  sourceUrl: string;
  depthMapUrl: string;
  params: BackgroundLayerParams;
  budget: TierBudget;
  z?: number;
  renderOrder?: number;
}

export function SplatLayer({ sourceUrl, depthMapUrl, params, budget, z = -26, renderOrder = -2 }: SplatLayerProps) {
  const imageTex = useImageTexture(sourceUrl);
  const depthTex = useImageTexture(depthMapUrl);
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const uniforms = useMemo(() => ({ uTime: uniform(0) }), []);

  const depthSpread = typeof params.depthSpread === 'number' ? params.depthSpread : 0.7;

  const built = useMemo(() => {
    if (!imageTex || !depthTex) return null;
    // Grid resolution scales with the tier budget (gaussian count). Each grid
    // sample → one unprojected gaussian. (~T2 320×180 ≈ 57.6k, T1 ~28k.)
    const gw = budget.particleCount >= 12000 ? 320 : budget.particleCount >= 6000 ? 224 : 150;
    const gh = Math.round(gw * (PLANE_H / PLANE_W));
    const count = gw * gh;
    // Less z-explosion so adjacent samples don't separate into visible rows; the
    // gaussian footprint is oversized vs the grid pitch so neighbours OVERLAP
    // into a continuous surface (the splat read, not a scan-line point cloud).
    const depthRange = 10 + depthSpread * 16;
    const gaussSize = (PLANE_W / gw) * 5.0;

    const mat = new SpriteNodeMaterial({ transparent: true, depthWrite: false });

    // Per-instance grid uv from instanceIndex (GPU): gx = i % gw, gy = i / gw.
    const fi: TNode = (instanceIndex as TNode).toFloat();
    const gy: TNode = floor(fi.div(gw));
    const gx: TNode = fi.sub(gy.mul(gw));
    const su: TNode = gx.div(gw - 1);
    const sv: TNode = gy.div(gh - 1);
    const sampleUv: TNode = vec2(su, sv);

    // Unproject: x/y across the plane, z from the depth map (bright = near).
    const depthVal: TNode = (tslTexture(depthTex, sampleUv) as TNode).r;
    const px: TNode = su.sub(0.5).mul(PLANE_W);
    const py: TNode = float(0.5).sub(sv).mul(PLANE_H);
    const pz: TNode = depthVal.sub(0.5).mul(depthRange);
    // A whisper of GPU drift so the captured volume breathes (not frozen).
    const drift: TNode = sin(uniforms.uTime.mul(0.2).add(fi.mul(0.013))).mul(0.18);
    (mat as unknown as { positionNode: unknown }).positionNode = vec3(px, py.add(drift), pz);
    (mat as unknown as { scaleNode: unknown }).scaleNode = float(gaussSize);

    // Colour from the captured image at this gaussian's grid uv.
    (mat as unknown as { colorNode: unknown }).colorNode = (tslTexture(imageTex, sampleUv) as TNode).rgb;
    // Soft round gaussian falloff over the billboard quad.
    const q: TNode = uv() as TNode;
    const disc: TNode = smoothstep(float(0.5), float(0.08), tslLength(q.sub(vec2(0.5, 0.5))));
    (mat as unknown as { opacityNode: unknown }).opacityNode = disc;

    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const idm = new THREE.Matrix4();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, idm);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return { mesh, count };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageTex, depthTex, budget.particleCount, depthSpread]);

  useEffect(() => {
    if (!built) return;
    const w = globalThis as { __PRISM_BG_SPLAT_COUNT__?: number };
    w.__PRISM_BG_SPLAT_COUNT__ = built.count;
    return () => {
      built.mesh.geometry.dispose();
      (built.mesh.material as THREE.Material).dispose();
      delete (globalThis as { __PRISM_BG_SPLAT_COUNT__?: number }).__PRISM_BG_SPLAT_COUNT__;
    };
  }, [built]);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta * (typeof params.drift === 'number' ? 0.4 + params.drift : 0.6);
  });

  if (!built) return null;
  return <primitive ref={meshRef} object={built.mesh} position={[0, 0, z]} renderOrder={renderOrder} />;
}
