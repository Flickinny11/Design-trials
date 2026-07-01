'use client';

// GlassRailPane — the founder-agreed glass: a single FLAT PANE of real glass with
// REAL THICKNESS, beveled visible edges/corners, and one rounded-square SOCKET
// milled THROUGH it per button (the cube seats into its socket). Vertical column.
// MeshPhysicalMaterial transmission → genuine refraction off the studio env. This
// is the chassis-pane idiom the founder approved — NOT a fat capsule, NOT CSS,
// NOT glassmorphism.

import { useMemo } from 'react';
import * as THREE from 'three';
import { BAR_W, TOKEN_R, buttonY, barHeight } from './config';

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

const PANE_W = BAR_W * 0.88; // flat pane width
const PANE_THICK = 0.46; // real glass thickness
const BEVEL = 0.065; // front/back rim rounding (milled-glass feel)
const SOCKET = TOKEN_R * 2.28; // milled cutout side (cube seats inside)
const OUTER_R = PANE_W * 0.085; // glass pane corner radius: pane, not capsule
const SOCKET_R = TOKEN_R * 0.12; // small milled radius, still reads square/cube

export function GlassRailPane({ n }: { n: number }) {
  const { geometry, edges } = useMemo(() => {
    const h = barHeight(n);
    const shape = new THREE.Shape();
    roundedRect(shape, 0, 0, PANE_W, h, OUTER_R);
    // one milled socket per button, at the button's world-Y
    for (let i = 0; i < n; i++) {
      const hole = new THREE.Path();
      roundedRect(hole, 0, buttonY(i, n), SOCKET, SOCKET, SOCKET_R);
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: PANE_THICK - BEVEL * 2,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 4,
      curveSegments: 22,
    });
    geo.center(); // straddle z=0 → symmetric front↔back glass
    geo.computeVertexNormals();
    return { geometry: geo, edges: new THREE.EdgesGeometry(geo, 18) };
  }, [n]);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={1}
          thickness={0.95}
          ior={1.52}
          roughness={0.035}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.08}
          attenuationColor="#eef8ff"
          attenuationDistance={10}
          envMapIntensity={2.25}
          specularIntensity={1}
          opacity={0.52}
          transparent
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edges} raycast={() => null}>
        <lineBasicMaterial
          color="#f7fbff"
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <mesh position={[0.08, -0.04, -PANE_THICK * 0.95]} raycast={() => null}>
        <planeGeometry args={[PANE_W * 0.9, barHeight(n) * 0.97]} />
        <meshBasicMaterial
          color="#030507"
          transparent
          opacity={0.012}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
