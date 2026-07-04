'use client';

// VerticalGlassPane — single-column variant of GlassPane for the in-canvas
// toolbar. One pane of glass with real thickness + a rounded-square cutout
// milled through it per button. Real MeshPhysicalMaterial transmission (NOT
// glassmorphism, NOT CSS).

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  VLAYOUT,
  VCOL_PANE_THICK,
  VCOL_PANE_CORNER,
  VCOL_PANE_EDGE_BEVEL,
  HOLE,
} from './vertical-layout';

const HOLE_CORNER = 0.15;

function roundedRect(
  ctx: THREE.Shape | THREE.Path,
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number,
) {
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

export function VerticalGlassPane() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    roundedRect(shape, 0, 0, VLAYOUT.paneW, VLAYOUT.paneH, VCOL_PANE_CORNER);
    for (const b of VLAYOUT.buttons) {
      const hole = new THREE.Path();
      roundedRect(hole, 0, b.y, HOLE, HOLE, HOLE_CORNER);
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: VCOL_PANE_THICK - VCOL_PANE_EDGE_BEVEL * 2,
      bevelEnabled: true,
      bevelThickness: VCOL_PANE_EDGE_BEVEL,
      bevelSize: VCOL_PANE_EDGE_BEVEL,
      bevelSegments: 4,
      curveSegments: 24,
    });
    geo.center();
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
        clearcoatRoughness={0.17}
        attenuationColor={'#dbe8f2'}
        attenuationDistance={1.8}
        envMapIntensity={1.05}
        specularIntensity={0.7}
        transparent
      />
    </mesh>
  );
}
