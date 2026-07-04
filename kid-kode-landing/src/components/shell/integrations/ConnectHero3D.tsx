'use client';

// PRISM SHELL — "CONNECT ANYTHING" HERO SHOWPIECE (SHELL W3, DL10 hero moment)
//
// The one 3D moment on the Integrations surface (DL10 — worn-metal / real-mark
// showpieces on hero moments only; the catalog + lists below stay clean-but-
// premium 2D). A signal-red Prism prism at the centre with REAL brand marks
// (bespoke 3D forms, DL15) orbiting on chrome filaments — the literal picture
// of "connect anything, one click." One shared canvas (DL8 rider);
// reduced-motion holds it still.

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from '../builder/use-reduced-motion';
import { BrandMark } from '../intake/BrandMark3D';

const ORBIT_MARKS = ['stripe', 'slack', 'supabase', 'github', 'vercel', 'openai'] as const;
const RADIUS = 2.35;

function Filament({ target }: { target: THREE.Vector3 }) {
  const m = usePremiumMaterials();
  const { position, quaternion, length } = useMemo(() => {
    const len = target.length();
    const mid = target.clone().multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      target.clone().normalize(),
    );
    return { position: mid, quaternion: q, length: len };
  }, [target]);
  return (
    <mesh position={position} quaternion={quaternion} material={m.chrome}>
      <cylinderGeometry args={[0.012, 0.012, length, 10]} />
    </mesh>
  );
}

function HeroRig({ reduced }: { reduced: boolean }) {
  const ring = useRef<THREE.Group>(null);
  const core = useRef<THREE.Group>(null);
  const m = usePremiumMaterials();

  const marks = useMemo(
    () =>
      ORBIT_MARKS.map((mark, i) => {
        const a = (i / ORBIT_MARKS.length) * Math.PI * 2;
        const pos = new THREE.Vector3(
          Math.cos(a) * RADIUS,
          Math.sin(a) * 0.55,
          Math.sin(a) * RADIUS,
        );
        return { mark, pos };
      }),
    [],
  );

  useFrame((_, dt) => {
    if (reduced) return;
    if (ring.current) ring.current.rotation.y += dt * 0.18;
    if (core.current) core.current.rotation.y -= dt * 0.28;
  });

  return (
    <group>
      {/* Chrome base ring the marks orbit above */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={m.brushed}>
        <torusGeometry args={[RADIUS, 0.02, 12, 96]} />
      </mesh>
      {/* Central Prism prism */}
      <group ref={core} scale={1.35}>
        <BrandMark mark="prism" />
      </group>
      {/* Orbiting real marks + connective filaments */}
      <group ref={ring}>
        {marks.map(({ mark, pos }) => (
          <group key={mark}>
            <Filament target={pos} />
            <group position={pos} scale={0.5}>
              <BrandMark mark={mark} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

export default function ConnectHero3D() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="ig-hero-canvas" aria-hidden>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.4, 6.2], fov: 42, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <StudioEnvironment />
        <StudioLights />
        <HeroRig reduced={reduced} />
      </Canvas>
    </div>
  );
}
