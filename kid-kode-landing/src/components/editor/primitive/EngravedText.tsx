'use client';

// EngravedText — text cut INTO glass, the founder-approved chassis intaglio
// technique generalized (see chassis/EngravedLabel). A directional V-GROOVE built
// from three stacked copies: a dark SHADOW wall offset up, a cool FROSTED-GLASS
// fill (steel tint, NOT white), and a bright HIGHLIGHT rim offset down. All copies
// render OPAQUE + alpha-tested so a transmission pane in front captures them.
//
// In-engine Troika SDF text (drei <Text>) — NEVER DOM, NEVER drei <Html>.

import { Text } from '@react-three/drei';

const FONT = '/fonts/Inter-Variable.ttf';

export interface EngravedTextProps {
  children: string;
  position?: [number, number, number];
  fontSize?: number;
  letterSpacing?: number;
  maxWidth?: number;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
}

export function EngravedText({
  children,
  position = [0, 0, 0],
  fontSize = 0.2,
  letterSpacing = 0.08,
  maxWidth,
  anchorX = 'center',
  anchorY = 'middle',
}: EngravedTextProps) {
  const common = {
    font: FONT,
    fontSize,
    anchorX,
    anchorY,
    letterSpacing,
    ...(maxWidth ? { maxWidth } : {}),
    'material-transparent': false,
    'material-alphaTest': 0.3,
    'material-toneMapped': false,
  } as const;
  return (
    <group position={position}>
      {/* shadowed upper wall — dark, offset up + deepest */}
      <Text {...common} position={[0.008, 0.018, -0.012]} color="#04060b" renderOrder={1}>
        {children}
      </Text>
      {/* frosted-glass etch fill — cool steel tint (NOT white) */}
      <Text {...common} position={[0, 0, 0]} color="#88a0b8" renderOrder={2}>
        {children}
      </Text>
      {/* lit lower wall — bright frosted highlight rim, offset down + proud */}
      <Text {...common} position={[-0.006, -0.016, 0.013]} color="#eef5fd" renderOrder={3}>
        {children}
      </Text>
    </group>
  );
}
