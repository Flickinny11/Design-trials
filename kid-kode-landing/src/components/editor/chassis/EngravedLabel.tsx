'use client';

// EngravedLabel — a section label cut INTO the glass panel. Built entirely
// in-engine (Troika SDF text via drei <Text> — NOT DOM, NOT drei <Html>, NOT an
// overlay). Rendered OPAQUE + alpha-tested so the glyphs are captured by the
// transmission glass (transparent text is NOT — the pane would hide it). The look
// is a recessed engraving: a dark groove-shadow copy offset UP (the shadowed top
// wall of a groove lit from above) sits behind a bright frosted etch offset DOWN
// (the lit bottom wall) — so the type reads as cut into the glass and CATCHES
// LIGHT, seated right at the front face.

import { Text } from '@react-three/drei';
import { FRONT_Z, type PlacedLabel } from './chassis-config';

const FONT = '/fonts/Inter-Variable.ttf';

function fontSizeFor(label: PlacedLabel): number {
  const n = Math.max(1, label.text.length);
  return Math.max(0.16, Math.min(0.32, label.width / (n * 0.62)));
}

export function EngravedLabel({ label }: { label: PlacedLabel }) {
  const fs = fontSizeFor(label);
  return (
    <group position={[label.x, label.y, 0]}>
      {/* shadowed top wall of the engraved groove — dark, offset up + behind */}
      <Text
        font={FONT}
        fontSize={fs}
        position={[0, 0.011, FRONT_Z + 0.004]}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
        maxWidth={label.width * 1.5}
        color="#04070c"
        material-transparent={false}
        material-alphaTest={0.28}
        material-toneMapped={false}
      >
        {label.text}
      </Text>
      {/* lit bottom wall / frosted etch — bright, offset down, just proud of glass */}
      <Text
        font={FONT}
        fontSize={fs}
        position={[0, -0.006, FRONT_Z + 0.016]}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
        maxWidth={label.width * 1.5}
        color="#dde8f4"
        material-transparent={false}
        material-alphaTest={0.28}
        material-toneMapped={false}
        renderOrder={3}
      >
        {label.text}
      </Text>
    </group>
  );
}
