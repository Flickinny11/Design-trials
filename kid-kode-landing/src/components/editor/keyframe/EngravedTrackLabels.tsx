'use client';

// EngravedTrackLabels — each track's name cut INTO the glass at the left gutter,
// plus engraved second-ticks along the TIME ruler and the editor title engraved
// into the bottom band. Same intaglio technique as the chassis EngravedLabel: a
// 3-copy V-groove (dark shadow wall offset up + deepest, cool frosted-steel fill,
// bright highlight rim offset down + proud), recessed BEHIND the front glass face
// so the transmission pane frosts over it. All copies OPAQUE + alpha-tested (a
// transmission pane does not capture transparent text).

import { Text } from '@react-three/drei';
import {
  DURATION_S,
  FONT_URL,
  FRONT_Z,
  LAYOUT,
  PANE_W,
  SIDE_PAD,
  timeToX,
} from './keyframe-config';

const RECESS = 0.07;
const BASE_Z = FRONT_Z - RECESS;

// One intaglio label: pass the visible copy's props; renders the 3-copy groove.
function Engraved({
  x,
  y,
  text,
  fontSize,
  anchorX = 'center',
  fill = '#9aa1ac',
}: {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  anchorX?: 'left' | 'center' | 'right';
  fill?: string;
}) {
  const common = {
    font: FONT_URL,
    fontSize,
    anchorX,
    anchorY: 'middle' as const,
    letterSpacing: 0.1,
    'material-transparent': false,
    'material-alphaTest': 0.3,
    'material-toneMapped': false,
  };
  return (
    <group position={[x, y, 0]}>
      <Text {...common} position={[0.009, 0.02, BASE_Z - 0.01]} color="#04060b" renderOrder={1}>
        {text}
      </Text>
      <Text {...common} position={[0, 0, BASE_Z]} color={fill} renderOrder={2}>
        {text}
      </Text>
      <Text {...common} position={[-0.007, -0.016, BASE_Z + 0.014]} color="#eef5fd" renderOrder={3}>
        {text}
      </Text>
    </group>
  );
}

// FINISH F-1 — engraved fills move off the blue-greys onto the CHROME whites
// (Sora face via FONT_URL); the title band carries the one engraved SIGNAL-RED
// accent. Red / black / white only.
export function EngravedTrackLabels() {
  const labelX = -PANE_W / 2 + SIDE_PAD + 0.18;
  return (
    <>
      {/* TIME ruler label + second ticks */}
      <Engraved x={labelX} y={LAYOUT.rulerY} text="TIME" fontSize={0.23} anchorX="left" fill="#bcc2ca" />
      {Array.from({ length: DURATION_S + 1 }, (_, s) => (
        <Engraved
          key={s}
          x={timeToX(s)}
          y={LAYOUT.rulerY - 0.005}
          text={`${s}s`}
          fontSize={0.15}
          fill="#878d95"
        />
      ))}
      {/* per-track names */}
      {LAYOUT.tracks.map((t) => (
        <Engraved key={t.id} x={labelX} y={t.y} text={t.label} fontSize={0.26} anchorX="left" fill="#c6ccd4" />
      ))}
    </>
  );
}

export function EngravedTitle() {
  return (
    <Engraved
      x={0}
      y={LAYOUT.bottomBandY}
      text="KEYFRAME  ·  TIMELINE"
      fontSize={0.2}
      fill="#d3222e"
    />
  );
}
