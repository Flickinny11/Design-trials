'use client';

// PRISM SHELL — NAV DRAWER EMBLEM (SHELL W4, E13 / DL16)
//
// A small real 3D Prism mark at the head of the slide-out drawer — richness
// over void (DL16), the same bespoke prism form the integrations hero orbits
// (BrandMark 'prism'). Mounts only while the drawer is open (the parent gates
// it), so the affordance costs one GL context at rest (the edge handle) and a
// second only during the brief open window.

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from '../builder/use-reduced-motion';
import { BrandMark } from '../intake/BrandMark3D';

function Spin({ reduced }: { reduced: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current && !reduced) g.current.rotation.y += dt * 0.5;
  });
  return (
    <group ref={g} scale={0.9}>
      <BrandMark mark="prism" />
    </group>
  );
}

export default function NavEmblem3D() {
  const reduced = usePrefersReducedMotion();
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.3, 3.2], fov: 40, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <StudioEnvironment />
      <StudioLights intensity={0.9} />
      <Spin reduced={reduced} />
    </Canvas>
  );
}
