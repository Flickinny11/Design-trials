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
const FRAME_W = 0.086; // brushed-chrome bezel width around the glass slab

export function GlassRailPane({ n }: { n: number }) {
  // PREMIUM ELEVATION (2026-07-01) — the rail reads as a machined instrument:
  // a SMOKED dark-glass slab (real transmission + attenuation → visible body and
  // ambient refraction) framed by a brushed-CHROME bezel (real metal edges +
  // depth). The founder-approved glass idiom, elevated from clear Apple-glass to
  // premium photoreal smoked glass in a chrome frame.
  const { geometry, edges, frame } = useMemo(() => {
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

    // Brushed-chrome bezel: a thin metal frame hugging the outer rim, drawn
    // proud of the glass so it reads as a machined edge wrapping the slab.
    const frameShape = new THREE.Shape();
    roundedRect(frameShape, 0, 0, PANE_W + FRAME_W * 0.9, h + FRAME_W * 0.9, OUTER_R + FRAME_W * 0.4);
    const frameHole = new THREE.Path();
    roundedRect(
      frameHole,
      0,
      0,
      PANE_W - FRAME_W * 1.2,
      h - FRAME_W * 1.2,
      Math.max(0.02, OUTER_R - FRAME_W * 0.6),
    );
    frameShape.holes.push(frameHole);
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: PANE_THICK * 1.02,
      bevelEnabled: true,
      bevelThickness: BEVEL * 0.9,
      bevelSize: BEVEL * 0.9,
      bevelSegments: 3,
      curveSegments: 22,
    });
    frameGeo.center();
    frameGeo.computeVertexNormals();

    return { geometry: geo, edges: new THREE.EdgesGeometry(geo, 18), frame: frameGeo };
  }, [n]);

  return (
    <group>
      {/* SMOKED dark-glass slab — real transmission, dark attenuation for body */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#eaeef5"
          transmission={1}
          thickness={1.15}
          ior={1.5}
          roughness={0.05}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.06}
          attenuationColor="#141922"
          attenuationDistance={3.1}
          envMapIntensity={2.7}
          specularIntensity={1}
          opacity={0.74}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Brushed-chrome bezel frame (real machined metal edge + depth) */}
      <mesh geometry={frame} castShadow receiveShadow raycast={() => null}>
        <meshPhysicalMaterial
          color="#c8cfd9"
          metalness={1}
          roughness={0.26}
          clearcoat={1}
          clearcoatRoughness={0.12}
          envMapIntensity={1.9}
        />
      </mesh>

      {/* Polished glass edge catch-light along the sockets + rim */}
      <lineSegments geometry={edges} raycast={() => null}>
        <lineBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Dark instrument backing → the smoked glass reads over depth, not air */}
      <mesh position={[0.06, -0.03, -PANE_THICK * 0.98]} raycast={() => null}>
        <planeGeometry args={[PANE_W * 0.92, barHeight(n) * 0.98]} />
        <meshBasicMaterial
          color="#04060a"
          transparent
          opacity={0.16}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
