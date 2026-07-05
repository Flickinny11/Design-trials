'use client';

// PRISM MARKETING — TEMPLATE THUMBNAIL JEWEL (SHELL W6, E2 gallery / DL2/DL10)
//
// Each gallery template card carries a real 3D signature jewel tinted with the
// template's accent, floating over a machined chrome disc — a per-template
// "signature jewel" that reads as one product family (the dashboard's project
// gallery uses the same idea). Extends the shell premium.ts materials (DL2);
// reduced-motion holds the pose; lazy-mounted behind a poster (DL8).

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
} from '../shell/showpiece/premium-materials';
import { usePrefersReducedMotion } from '../shell/builder/use-reduced-motion';

function Jewel({ accent, reduced }: { accent: string; reduced: boolean }) {
  const m = usePremiumMaterials();
  const rig = useRef<THREE.Group>(null);
  const jewelMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(accent),
        metalness: 0.3,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        emissive: new THREE.Color(accent),
        emissiveIntensity: 0.35,
      }),
    [accent],
  );
  useEffect(() => () => jewelMat.dispose(), [jewelMat]);

  useFrame(({ clock }, dt) => {
    if (!rig.current) return;
    if (reduced) {
      rig.current.rotation.set(0.2, 0.6, 0);
      return;
    }
    rig.current.rotation.y += dt * 0.5;
    rig.current.rotation.x = 0.2 + Math.sin(clock.getElapsedTime() * 0.8) * 0.05;
  });

  return (
    <group>
      <mesh material={m.chrome} position={[0, -0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.05, 20, 64]} />
      </mesh>
      <mesh material={m.gunmetal} position={[0, -0.66, 0]}>
        <cylinderGeometry args={[0.5, 0.56, 0.08, 48]} />
      </mesh>
      <group ref={rig} position={[0, 0.05, 0]}>
        <mesh material={jewelMat}>
          <icosahedronGeometry args={[0.6, 0]} />
        </mesh>
      </group>
    </group>
  );
}

export default function TemplateJewel3D({ accent }: { accent: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.3, 3.2], fov: 42, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <StudioEnvironment />
      <StudioLights />
      <Jewel accent={accent} reduced={reduced} />
    </Canvas>
  );
}
