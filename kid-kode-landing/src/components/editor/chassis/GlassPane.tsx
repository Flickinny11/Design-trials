'use client';

// GlassPane — the single pane of glass with REAL THICKNESS and a rounded-rect
// cutout milled through it for each button. Built from an extruded rounded-rect
// THREE.Shape with one Path hole per button, with a small bevel so the front/back
// rim and the milled cutout edges read as real thick glass (not a sharp slab).
//
// Material: MeshPhysicalMaterial transmission (real refraction + reflection off
// the scene environment) — clear liquid glass with a faint smoke tint.

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  LAYOUT,
  PANE_THICK,
  PANE_CORNER,
  PANE_EDGE_BEVEL,
  HOLE,
  HOLE_CORNER,
} from './chassis-config';

// Append a rounded-rect contour (centered at cx,cy) to a Shape or Path.
function roundedRect(ctx: THREE.Shape | THREE.Path, cx: number, cy: number, w: number, h: number, r: number) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  ctx.lineTo(x + w, y + h - r);
  ctx.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  ctx.lineTo(x + r, y + h);
  ctx.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  ctx.lineTo(x, y + r);
  ctx.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
}

export function GlassPane() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    roundedRect(shape, 0, 0, LAYOUT.paneW, LAYOUT.paneH, PANE_CORNER);

    // One milled cutout per placed button (grid sections).
    for (const b of LAYOUT.buttons) {
      const hole = new THREE.Path();
      roundedRect(hole, b.x, b.y, HOLE, HOLE, HOLE_CORNER);
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
    geo.center(); // straddle z=0 so the pane is symmetric front↔back
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        transmission={1}
        thickness={0.7}
        ior={1.5}
        roughness={0.05}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.05}
        attenuationColor={'#dbe8f2'}
        attenuationDistance={1.8}
        envMapIntensity={1.5}
        specularIntensity={1}
        transparent
      />
    </mesh>
  );
}
