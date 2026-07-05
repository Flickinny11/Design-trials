'use client';

// VerticalEngravedLabel — a section label engraved into the glass pane (one per
// section in the vertical chassis layout). Built entirely in-engine (Troika SDF
// text via drei <Text>), recessed into the front face so the transmission glass
// refracts/frosts over it — reads as a real intaglio engraving, not painted-on
// type.

import { Text } from '@react-three/drei';
import { VCOL_FRONT_Z, type VPlacedLabel } from './vertical-layout';

const FONT = '/fonts/Inter-Variable.ttf';
const RECESS = 0.07;
const BASE_Z = VCOL_FRONT_Z - RECESS;

export function VerticalEngravedLabel({ label }: { label: VPlacedLabel }) {
  // small, premium uppercase letterforms
  const fs = 0.13;
  const common = {
    font: FONT,
    fontSize: fs,
    anchorX: 'center' as const,
    anchorY: 'middle' as const,
    letterSpacing: 0.16,
    maxWidth: label.width * 2.0,
    'material-transparent': false,
    'material-alphaTest': 0.3,
    'material-toneMapped': false,
  };
  return (
    <group position={[0, label.y, 0]}>
      {/* shadowed upper wall (dark, offset up + deepest) */}
      <Text {...common} position={[0.006, 0.012, BASE_Z - 0.008]} color="#04060b" renderOrder={1}>
        {label.text}
      </Text>
      {/* frosted-glass etch fill (cool steel tint) */}
      <Text {...common} position={[0, 0, BASE_Z]} color="#88a0b8" renderOrder={2}>
        {label.text}
      </Text>
      {/* bright frosted highlight rim (offset down + proud) */}
      <Text {...common} position={[-0.004, -0.011, BASE_Z + 0.012]} color="#eef5fd" renderOrder={3}>
        {label.text}
      </Text>
    </group>
  );
}
