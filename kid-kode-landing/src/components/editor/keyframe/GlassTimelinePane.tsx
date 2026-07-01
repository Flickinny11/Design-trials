'use client';

// GlassTimelinePane — the single thick PANE OF GLASS for the timeline, in the
// exact language of the founder-approved chassis: an extruded rounded-rect
// THREE.Shape (real thickness, beveled rim) with one long thin rounded-rect
// channel MILLED THROUGH it per track (the TIME ruler + each property track).
// These are true ExtrudeGeometry cuts (Shape.holes) — never painted lines — so
// the channel walls read as milled glass and worn-cube knobs ride inside them.
//
// Material: MeshPhysicalMaterial transmission (real refraction off the studio
// environment), matched to the chassis glass.

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  CHANNEL_CORNER,
  CHANNEL_H,
  LAYOUT,
  PANE_CORNER,
  PANE_EDGE_BEVEL,
  PANE_THICK,
} from './keyframe-config';

// Append a centered rounded-rect contour to a Shape or Path.
function roundedRect(ctx: THREE.Shape | THREE.Path, cx: number, cy: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2 - 1e-3, w / 2 - 1e-3);
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  ctx.lineTo(x + w, y + h - rr);
  ctx.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  ctx.lineTo(x + rr, y + h);
  ctx.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  ctx.lineTo(x, y + rr);
  ctx.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
}

// Channel center x + width: the live track span plus end-room so a knob seated at
// the extreme value/time never clips the milled end-cap.
const CHANNEL_END_PAD = 0.5;
export const CHANNEL_CX = (LAYOUT.trackLeftX + LAYOUT.trackRightX) / 2;
export const CHANNEL_W = LAYOUT.trackSpan + CHANNEL_END_PAD * 2;

export function GlassTimelinePane() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    roundedRect(shape, 0, 0, LAYOUT.paneW, LAYOUT.paneH, PANE_CORNER);

    // One milled channel per groove: the TIME ruler + every property track.
    const rows = [LAYOUT.rulerY, ...LAYOUT.tracks.map((t) => t.y)];
    for (const y of rows) {
      const hole = new THREE.Path();
      roundedRect(hole, CHANNEL_CX, y, CHANNEL_W, CHANNEL_H, CHANNEL_CORNER);
      shape.holes.push(hole);
    }

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: PANE_THICK - PANE_EDGE_BEVEL * 2,
      bevelEnabled: true,
      bevelThickness: PANE_EDGE_BEVEL,
      bevelSize: PANE_EDGE_BEVEL,
      bevelSegments: 4,
      curveSegments: 24,
    });
    geo.center();
    geo.computeVertexNormals();
    return geo;
  }, []);

  // FINISH F-1 — clear glass → PREMIUM SMOKED dark glass (the toolbar rail's
  // proven recipe: dark attenuation for visible body + depth, stronger env
  // response for ambient refraction off the studio light). Red/black/white:
  // this is the black-glass mass the chrome knobs + red jewels sit in.
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        color={'#eaeef5'}
        transmission={1}
        thickness={0.7}
        ior={1.5}
        roughness={0.1}
        metalness={0}
        clearcoat={0.5}
        clearcoatRoughness={0.35}
        attenuationColor={'#141922'}
        attenuationDistance={1.35}
        envMapIntensity={1.65}
        specularIntensity={0.7}
        transparent
      />
    </mesh>
  );
}
