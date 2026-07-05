'use client';

// CompositeText — a WebGPU-native MSDF label for /composite-lab, the SAME proven
// path HubLabels + FluidEngravedText use (resolveTextAtlas + createTextObject). NOT
// Troika / drei <Text> (raw ShaderMaterial → "not compatible" on the node renderer)
// and never DOM / <Html>.
//
// Two legibility variants so labels read on both surfaces:
//   • 'engraved' — cool steel fill + dark sunken rim (intaglio on clear glass).
//   • 'bright'   — luminous warm-white fill (reads on dark worn-alloy faces).

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { TextSpec } from '@/lib/prism-graph/types';
import { createTextObject } from '@/lib/prism/text/text-object';
import { useCompositeFont, COMPOSITE_FONT_FAMILY, COMPOSITE_FONT_WEIGHT } from './use-composite-font';

export type CompositeTextVariant = 'engraved' | 'bright';

export interface CompositeTextProps {
  children: string;
  position?: [number, number, number];
  fontSize?: number;
  letterSpacing?: number;
  anchorX?: 'left' | 'center' | 'right';
  variant?: CompositeTextVariant;
}

export function CompositeText({
  children,
  position = [0, 0, 0],
  fontSize = 0.2,
  letterSpacing = 0.05,
  anchorX = 'center',
  variant = 'engraved',
}: CompositeTextProps) {
  const atlas = useCompositeFont();

  const handle = useMemo(() => {
    if (!atlas) return null;
    const fill: TextSpec['fill'] =
      variant === 'bright' ? { kind: 'solid', color: '#fef3e4' } : { kind: 'solid', color: '#d7e6f4' };
    const spec: TextSpec = {
      content: children,
      fontFamily: COMPOSITE_FONT_FAMILY,
      fontSize,
      fontWeight: COMPOSITE_FONT_WEIGHT,
      letterSpacing: letterSpacing / fontSize,
      lineHeight: 1,
      align: anchorX === 'center' ? 'center' : anchorX === 'right' ? 'right' : 'left',
      fill,
      outline: { color: variant === 'bright' ? '#1c130a' : '#05080e', width: 0.5 },
      glow: { color: variant === 'bright' ? '#ffd9a8' : '#bcd6ff', intensity: 0.16 },
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
  }, [atlas, children, fontSize, letterSpacing, anchorX, variant]);

  useEffect(() => () => handle?.dispose(), [handle]);

  if (!handle) return null;
  return (
    <group position={position} renderOrder={7}>
      <primitive object={handle.object} />
    </group>
  );
}
