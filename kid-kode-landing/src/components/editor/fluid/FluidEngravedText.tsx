'use client';

// FluidEngravedText — a WebGPU-native, drop-in replacement for the chassis
// `EngravedText` (drei <Text> / Troika) for the /fluid-lab scene.
//
// WHY: /fluid-lab renders on a `three/webgpu` WebGPURenderer. Troika's <Text>
// is a raw ShaderMaterial → "THREE.NodeBuilder: Material ShaderMaterial is not
// compatible" and renders nothing. This component reproduces EngravedText's
// 3-layer engraved intaglio look (dark shadow offset up/back, cool steel fill,
// bright highlight offset down/proud) with MSDF meshes built from a NodeMaterial
// via `three-msdf-text-webgpu`. No Troika, no drei <Text>, no raw
// ShaderMaterial, no DOM, no <Html>.
//
// Props are IDENTICAL to EngravedText so it is a literal drop-in.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFluidFont, ATLAS_EM_PX } from './use-fluid-font';

export interface FluidEngravedTextProps {
  children: string;
  position?: [number, number, number];
  fontSize?: number;
  letterSpacing?: number;
  maxWidth?: number;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
}

// Engraved intaglio palette + per-layer offsets — mirrors EngravedText exactly
// (dark shadow wall up/back, cool steel fill, bright highlight rim down/proud).
const LAYERS = [
  { color: '#03050a', offset: [0.009, 0.02, -0.012] as const, renderOrder: 1 },
  { color: '#b8c8dc', offset: [0, 0, 0] as const, renderOrder: 2 },
  { color: '#f4f9ff', offset: [-0.007, -0.018, 0.014] as const, renderOrder: 3 },
];

// MSDF geometry is laid out in atlas px (one em ≈ ATLAS_EM_PX units when we pass
// fontSize: ATLAS_EM_PX to createText). EngravedText's offsets are authored in
// WORLD units at fontSize ~0.2, so they are applied OUTSIDE the px→world group
// scale (on each layer group) to stay world-sized regardless of fontSize.

export function FluidEngravedText({
  children,
  position = [0, 0, 0],
  fontSize = 0.2,
  letterSpacing = 0.08,
  maxWidth,
  anchorX = 'center',
  anchorY = 'middle',
}: FluidEngravedTextProps) {
  const handle = useFluidFont();

  // Build the three tinted MSDF meshes once per (content, sizing, align, handle).
  // letterSpacing/fontSize are Troika-style world/em units; convert to the
  // package's px space using ATLAS_EM_PX (we lay out at fontSize: ATLAS_EM_PX and
  // scale the group by fontSize/ATLAS_EM_PX, so spacing/width are also ×ATLAS_EM_PX).
  const built = useMemo(() => {
    if (!handle) return null;

    const align = anchorX === 'center' ? 'center' : anchorX === 'right' ? 'right' : 'left';
    const meshes: THREE.Mesh[] = [];

    for (const layer of LAYERS) {
      let obj: THREE.Object3D;
      try {
        obj = handle.createText(children, {
          fontSize: ATLAS_EM_PX,
          color: layer.color,
          align,
          letterSpacingPx: letterSpacing * ATLAS_EM_PX,
          ...(maxWidth !== undefined ? { maxWidthPx: maxWidth * ATLAS_EM_PX } : {}),
        });
      } catch {
        // createText throws only if the atlas isn't loaded; handle is ready here,
        // but guard anyway so a transient failure renders nothing rather than crash.
        return null;
      }

      const mesh = obj as THREE.Mesh;
      // Tint via the MSDFTextNodeMaterial color setter; toneMapped:false keeps the
      // engraved palette crisp (parity with EngravedText's material-toneMapped=false).
      const mat = mesh.material as THREE.Material & { color?: THREE.Color | string };
      if (mat) {
        if ('color' in mat && mat.color !== undefined) {
          (mat as unknown as { color: THREE.Color }).color = new THREE.Color(layer.color);
        }
        mat.toneMapped = false;
      }
      mesh.renderOrder = layer.renderOrder;
      meshes.push(mesh);
    }

    // Anchor: MSDF geometry defaults to verticalAlign:"top" (grows -y down from
    // origin) and the requested textAlign for x. Measure the first mesh's
    // geometry bounding box (in px space) and compute a px-space offset so the
    // group honors anchorX/anchorY. All three layers share the same content/
    // sizing → same box, so one measurement anchors the whole group.
    const probe = meshes[0];
    probe.geometry.computeBoundingBox();
    const box = probe.geometry.boundingBox ?? new THREE.Box3();
    const min = box.min;
    const max = box.max;
    const w = max.x - min.x;
    const h = max.y - min.y;

    // X: with textAlign offsets already applied in-geometry, 'center' boxes are
    // ~symmetric about 0 and 'right' end at 0; align our anchor to the box edges.
    let offX = 0;
    if (anchorX === 'left') offX = -min.x;
    else if (anchorX === 'center') offX = -(min.x + w / 2);
    else offX = -max.x;

    // Y: box spans [min.y (bottom), max.y (top)]. Offset so the requested vertical
    // anchor sits at local y=0.
    let offY = 0;
    if (anchorY === 'top') offY = -max.y;
    else if (anchorY === 'middle') offY = -(min.y + h / 2);
    else offY = -min.y; // bottom

    return { meshes, offX, offY };
  }, [handle, children, fontSize, letterSpacing, maxWidth, anchorX, anchorY]);

  // Dispose geometries (and materials) on unmount / rebuild. The atlas texture is
  // owned by the shared FontAtlasHandle — never disposed here.
  const builtRef = useRef(built);
  builtRef.current = built;
  useEffect(() => {
    return () => {
      const current = builtRef.current;
      if (!current) return;
      for (const mesh of current.meshes) {
        mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    };
  }, [built]);

  if (!built) return null;

  // px→world scale so callers keep passing EngravedText-style world-unit fontSizes.
  const worldScale = fontSize / ATLAS_EM_PX;

  return (
    <group position={position}>
      {/* px→world scale + measured anchor offset (offsets are in px space, so they
          live INSIDE the scaled group). */}
      <group scale={worldScale} position={[built.offX, built.offY, 0]}>
        {LAYERS.map((layer, i) => (
          // Per-layer engraved offset is authored in WORLD units → divide by the
          // group scale so it stays world-sized after the px→world scale applies.
          <group
            key={layer.color}
            position={[
              layer.offset[0] / worldScale,
              layer.offset[1] / worldScale,
              layer.offset[2] / worldScale,
            ]}
          >
            <primitive object={built.meshes[i]} />
          </group>
        ))}
      </group>
    </group>
  );
}
