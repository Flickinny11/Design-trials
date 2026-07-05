'use client';

// FluidEngravedText — a WebGPU-native, drop-in replacement for the chassis
// `EngravedText` (drei <Text> / Troika) for the /fluid-lab scene.
//
// WHY: /fluid-lab renders on a `three/webgpu` WebGPURenderer. Troika's <Text> is a
// raw ShaderMaterial → "THREE.NodeBuilder: Material ShaderMaterial is not
// compatible" and renders nothing. This builds the label as a real MSDF TextObject
// (the SAME proven path HubLabels uses in production) with a cool steel fill + dark
// outline + faint glow — the engraved-into-glass intaglio read, in one mesh group.
// No Troika, no drei <Text>, no raw ShaderMaterial, no DOM, no <Html>.
//
// Props are IDENTICAL to EngravedText so it is a literal drop-in.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { TextSpec } from '@/lib/prism-graph/types';
import { createTextObject } from '@/lib/prism/text/text-object';
import { useFluidFont, FLUID_FONT_FAMILY, FLUID_FONT_WEIGHT } from './use-fluid-font';

export interface FluidEngravedTextProps {
  children: string;
  position?: [number, number, number];
  fontSize?: number;
  letterSpacing?: number;
  maxWidth?: number;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
}

export function FluidEngravedText({
  children,
  position = [0, 0, 0],
  fontSize = 0.2,
  letterSpacing = 0.08,
  anchorX = 'center',
}: FluidEngravedTextProps) {
  const atlas = useFluidFont();

  const handle = useMemo(() => {
    if (!atlas) return null;
    const spec: TextSpec = {
      content: children,
      fontFamily: FLUID_FONT_FAMILY,
      fontSize,
      fontWeight: FLUID_FONT_WEIGHT,
      // TextSpec letterSpacing is em-fraction; EngravedText props are world-ish —
      // /fontSize converts to the em fraction so spacing reads the same.
      letterSpacing: letterSpacing / fontSize,
      lineHeight: 1,
      align: anchorX === 'center' ? 'center' : anchorX === 'right' ? 'right' : 'left',
      // engraved-into-glass intaglio: cool steel fill, dark sunken rim, faint glow.
      fill: { kind: 'solid', color: '#cdddee' },
      outline: { color: '#05080e', width: 0.5 },
      glow: { color: '#bcd6ff', intensity: 0.16 },
      opacity: 1,
      decompose: 'line',
    };
    const h = createTextObject(spec, atlas, { lit: false });
    for (const unit of h.units) {
      const mat = unit.material as THREE.Material;
      mat.toneMapped = false;
      mat.depthWrite = false;
    }
    return h;
  }, [atlas, children, fontSize, letterSpacing, anchorX]);

  useEffect(() => () => handle?.dispose(), [handle]);

  if (!handle) return null;
  return (
    <group position={position}>
      <primitive object={handle.object} />
    </group>
  );
}
