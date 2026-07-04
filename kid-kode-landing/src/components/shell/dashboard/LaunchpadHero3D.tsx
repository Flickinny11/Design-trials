'use client';

// PRISM SHELL — LAUNCHPAD HERO SHOWPIECE (SHELL W4, S3 focal point / DL10/DL16)
//
// The dashboard's visual focal point: one 3D moment that reads as "an idea
// becoming a built world." A signal-red faceted prism rises inside a chrome
// gyroscope of machined rings over a gunmetal pedestal, with small chrome
// shards drawn up toward it — creation, not decoration. ONE shared canvas
// (DL8), photoreal material + ambient refraction (DL10), reduced-motion holds
// it. The prompt field + primary 3D build button live in DOM beside it.

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from '../builder/use-reduced-motion';

function HeroRig({ reduced }: { reduced: boolean }) {
  const m = usePremiumMaterials();
  const ringA = useRef<THREE.Group>(null);
  const ringB = useRef<THREE.Group>(null);
  const prism = useRef<THREE.Group>(null);
  const shards = useRef<THREE.Group>(null);

  const shardData = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        a: (i / 7) * Math.PI * 2,
        r: 1.4 + (i % 3) * 0.22,
        y0: -1.1 - (i % 4) * 0.3,
        s: 0.06 + (i % 3) * 0.02,
      })),
    [],
  );
  // One material per shard (per-shard opacity fade), created once + disposed.
  const shardMats = useMemo(
    () =>
      shardData.map(
        () =>
          new THREE.MeshPhysicalMaterial({
            color: '#cfd6e0',
            metalness: 1,
            roughness: 0.24,
            transparent: true,
          }),
      ),
    [shardData],
  );
  useEffect(() => () => shardMats.forEach((mm) => mm.dispose()), [shardMats]);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    if (prism.current) {
      prism.current.rotation.y = reduced ? 0.5 : t * 0.5;
      prism.current.position.y = reduced ? 0.1 : Math.sin(t * 0.9) * 0.06 + 0.1;
    }
    if (!reduced) {
      if (ringA.current) ringA.current.rotation.z += dt * 0.4;
      if (ringB.current) ringB.current.rotation.x += dt * 0.3;
      if (shards.current) {
        shards.current.children.forEach((c, i) => {
          const d = shardData[i];
          const yy = ((t * 0.4 + i * 0.5) % 2.2);
          c.position.y = d.y0 + yy;
          (c as THREE.Mesh).rotation.z = t * 0.8 + i;
          const mat = (c as THREE.Mesh).material as THREE.Material;
          mat.opacity = Math.max(0, 1 - yy / 2.2);
        });
      }
    }
  });

  return (
    <group>
      <mesh material={m.gunmetal} position={[0, -1.15, 0]}>
        <cylinderGeometry args={[1.05, 1.2, 0.24, 64]} />
      </mesh>
      <mesh material={m.chrome} position={[0, -1.02, 0]}>
        <cylinderGeometry args={[0.82, 0.82, 0.05, 64]} />
      </mesh>

      {/* Chrome gyroscope rings */}
      <group ref={ringA}>
        <mesh material={m.brushed} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.25, 0.03, 16, 96]} />
        </mesh>
      </group>
      <group ref={ringB}>
        <mesh material={m.chrome} rotation={[0, 0, Math.PI / 3]}>
          <torusGeometry args={[1.05, 0.025, 16, 96]} />
        </mesh>
      </group>

      {/* The rising red prism */}
      <group ref={prism} position={[0, 0.1, 0]}>
        <mesh material={m.redJewel}>
          <octahedronGeometry args={[0.62, 0]} />
        </mesh>
        <mesh material={m.redHot} scale={0.34}>
          <octahedronGeometry args={[0.62, 0]} />
        </mesh>
      </group>

      {/* Chrome shards drawn upward */}
      <group ref={shards}>
        {shardData.map((d, i) => (
          <mesh
            key={i}
            material={shardMats[i]}
            position={[Math.cos(d.a) * d.r, d.y0, Math.sin(d.a) * d.r]}
          >
            <tetrahedronGeometry args={[d.s * 2.2, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function LaunchpadHero3D() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="dw-hero-canvas" aria-hidden>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.6, 5.4], fov: 42, near: 0.1, far: 100 }}
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
