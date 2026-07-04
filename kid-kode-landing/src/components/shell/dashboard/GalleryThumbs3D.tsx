'use client';

// PRISM SHELL — GALLERY 3D THUMBNAILS (SHELL W4, S3 / DL8 rider)
//
// Real 3D thumbnails for the project gallery — NOT placeholders (an S3 MUST-
// FIX). Each card's mini is a live rendered object off the real GPU whose form
// + signature jewel are derived from the project id (project-signature.ts), so
// the cards read as a shelf of distinct machined objects. ONE canvas / one GL
// context overlays the whole card grid (the DL8 rider — never a live context
// per card); the canvas covers the grid box so the minis scroll pinned to
// their cards for free. DOM cards above carry name/meta/actions + the hit area.
// Reduced motion holds every mini still.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
  type PremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from '../builder/use-reduced-motion';
import {
  projectSignature,
  type SignatureJewel,
  type SignatureScene,
} from '@/lib/shell/project-signature';

function jewelMaterial(m: PremiumMaterials, jewel: SignatureJewel) {
  switch (jewel) {
    case 'chrome':
      return m.chrome;
    case 'champagne':
      return m.brushed;
    case 'sapphire':
      return m.smokedGlass;
    default:
      return m.redJewel;
  }
}

function SignatureForm({
  scene,
  jewel,
  m,
}: {
  scene: SignatureScene;
  jewel: SignatureJewel;
  m: PremiumMaterials;
}) {
  const j = jewelMaterial(m, jewel);
  switch (scene) {
    case 'orbital':
      return (
        <group>
          <mesh material={m.gunmetal}>
            <icosahedronGeometry args={[0.5, 0]} />
          </mesh>
          <mesh material={m.chrome} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.78, 0.05, 16, 64]} />
          </mesh>
          <mesh material={j} position={[0.78, 0, 0]}>
            <octahedronGeometry args={[0.18, 0]} />
          </mesh>
        </group>
      );
    case 'lattice':
      return (
        <group rotation={[0.2, 0, 0.15]}>
          {[-0.34, 0, 0.34].map((x) => (
            <mesh key={x} material={m.steel} position={[x, 0, 0]}>
              <boxGeometry args={[0.16, 1.0, 0.16]} />
            </mesh>
          ))}
          <mesh material={j} position={[0, 0, 0.2]}>
            <boxGeometry args={[0.9, 0.22, 0.22]} />
          </mesh>
        </group>
      );
    case 'monolith':
      return (
        <group>
          <mesh material={m.gunmetal}>
            <boxGeometry args={[0.62, 1.0, 0.62]} />
          </mesh>
          <mesh material={j} position={[0, 0.62, 0]}>
            <octahedronGeometry args={[0.3, 0]} />
          </mesh>
        </group>
      );
    case 'facet':
      return (
        <group>
          <mesh material={m.chrome}>
            <dodecahedronGeometry args={[0.6, 0]} />
          </mesh>
          <mesh material={j} scale={0.55}>
            <dodecahedronGeometry args={[0.6, 0]} />
          </mesh>
        </group>
      );
    case 'obelisk':
    default:
      return (
        <group>
          <mesh material={m.steel} position={[0, -0.1, 0]}>
            <coneGeometry args={[0.42, 1.0, 4]} />
          </mesh>
          <mesh material={j} position={[0, 0.62, 0]}>
            <icosahedronGeometry args={[0.2, 0]} />
          </mesh>
        </group>
      );
  }
}

function ThumbCell({
  id,
  index,
  cols,
  rows,
  hovered,
  reduced,
}: {
  id: string;
  index: number;
  cols: number;
  rows: number;
  hovered: boolean;
  reduced: boolean;
}) {
  const { width: vw, height: vh } = useThree((s) => s.viewport);
  const rig = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const lift = useRef(0);
  const m = usePremiumMaterials();
  const sig = projectSignature(id);

  const cellW = vw / cols;
  const cellH = vh / rows;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cx = -vw / 2 + cellW * (col + 0.5);
  // Mini sits in the card's upper thumbnail band; name/meta occupy the lower
  // third of the DOM card below it.
  const cy = vh / 2 - cellH * (row + 0.5) + cellH * 0.18;
  const base = Math.min(cellW * 0.34, cellH * 0.34);

  useFrame((_, dt) => {
    if (rig.current) {
      const liftTarget = hovered ? 0.14 : 0;
      const ease = 1 - Math.exp(-dt * 9);
      lift.current += (liftTarget - lift.current) * ease;
      rig.current.position.y = lift.current * base;
      rig.current.scale.setScalar(base * (hovered ? 1.08 : 1));
    }
    if (inner.current && !reduced) {
      inner.current.rotation.y += dt * (0.25 + sig.phase * 0.35);
    } else if (inner.current) {
      inner.current.rotation.y = -0.4 + sig.phase;
    }
  });

  return (
    <group position={[cx, cy, 0]}>
      <group ref={rig}>
        <group ref={inner} rotation={[0.16, 0, 0]}>
          <SignatureForm scene={sig.scene} jewel={sig.jewel} m={m} />
        </group>
      </group>
    </group>
  );
}

export default function GalleryThumbs3D({
  projectIds,
  cols,
  hoveredIndex,
}: {
  projectIds: string[];
  cols: number;
  hoveredIndex: number | null;
}) {
  const reduced = usePrefersReducedMotion();
  const rows = Math.max(1, Math.ceil(projectIds.length / cols));
  return (
    <div className="dw-thumbs-canvas" aria-hidden>
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <StudioEnvironment />
        <StudioLights intensity={0.95} />
        {projectIds.map((id, i) => (
          <ThumbCell
            key={id}
            id={id}
            index={i}
            cols={cols}
            rows={rows}
            hovered={hoveredIndex === i}
            reduced={reduced}
          />
        ))}
      </Canvas>
    </div>
  );
}
