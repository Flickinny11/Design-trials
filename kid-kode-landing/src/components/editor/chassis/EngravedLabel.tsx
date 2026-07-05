'use client';

// EngravedLabel — a section label cut INTO the glass panel. Built entirely
// in-engine (Troika SDF text via drei <Text> — NOT DOM, NOT drei <Html>, NOT an
// overlay). Two things make it read as ENGRAVED GLASS rather than a white sticker:
//
//  1. RECESSED into the glass body. The label group sits a little BEHIND the front
//     glass face (z = FRONT_Z - RECESS), so the thin front layer of the
//     transmission pane refracts/frosts over it — the type looks frozen inside the
//     glass, with real depth, instead of painted on top.
//  2. A directional V-GROOVE built from three stacked copies: a dark SHADOW wall
//     offset UP (the recessed groove's shaded upper wall, since the key light is
//     above), a cool FROSTED-GLASS fill (steel tint, NOT white — so it reads as
//     etched glass catching ambient), and a bright HIGHLIGHT rim offset DOWN (the
//     lit lower wall). Together they catch light like a real intaglio engraving.
//
// All copies render OPAQUE + alpha-tested so the transmission glass captures them
// (transparent text is NOT captured — the pane would hide it).

import { Text } from '@react-three/drei';
import { FRONT_Z, type PlacedLabel } from './chassis-config';

const FONT = '/fonts/Inter-Variable.ttf';
const RECESS = 0.07;            // how deep the engraving sits inside the front glass face
const BASE_Z = FRONT_Z - RECESS;

function fontSizeFor(label: PlacedLabel): number {
  const n = Math.max(1, label.text.length);
  return Math.max(0.17, Math.min(0.34, label.width / (n * 0.6)));
}

export function EngravedLabel({ label }: { label: PlacedLabel }) {
  const fs = fontSizeFor(label);
  const common = {
    font: FONT,
    fontSize: fs,
    anchorX: 'center' as const,
    anchorY: 'middle' as const,
    letterSpacing: 0.13,
    maxWidth: label.width * 1.6,
    'material-transparent': false,
    'material-alphaTest': 0.3,
    'material-toneMapped': false,
  };
  return (
    <group position={[label.x, label.y, 0]}>
      {/* shadowed UPPER wall of the engraved groove — dark, offset up + deepest */}
      <Text {...common} position={[0.009, 0.02, BASE_Z - 0.01]} color="#04060b" renderOrder={1}>
        {label.text}
      </Text>
      {/* frosted-glass etch fill — cool steel tint (NOT white), the engraved surface */}
      <Text {...common} position={[0, 0, BASE_Z]} color="#88a0b8" renderOrder={2}>
        {label.text}
      </Text>
      {/* lit LOWER wall — bright frosted highlight rim, offset down + proud */}
      <Text {...common} position={[-0.007, -0.018, BASE_Z + 0.014]} color="#eef5fd" renderOrder={3}>
        {label.text}
      </Text>
    </group>
  );
}
