'use client';

// PRISM MARKETING — SINGLE 3D ICON ISLAND (SHELL W6, DL2/DL4/DL5)
//
// One machined icon in its own bounded orthographic canvas, for the landing's
// feature cards. EXTENDS the shell's premium.ts material language (it imports
// the single-sourced materials/studio/lights from premium-materials.tsx — it
// invents no parallel palette, DL2) and reuses the exact icon forms shipped in
// the W0 PremiumIconSet showpiece, so every icon reads as the same product
// family. NO icon packs, NO flat SVG, NO emoji (DL5). Idle sway keeps
// speculars traveling across the metal (DL4); reduced-motion holds the pose.

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
  type PremiumMaterials,
} from '../shell/showpiece/premium-materials';
import { usePrefersReducedMotion } from '../shell/builder/use-reduced-motion';

export type IconKey = 'build' | 'deploy' | 'integrate' | 'project' | 'chat' | 'settings';
type M = PremiumMaterials;

function IconBuild({ m }: { m: M }) {
  return (
    <group position={[0, -0.18, 0]}>
      <mesh material={m.gunmetal}>
        <boxGeometry args={[1.02, 0.3, 1.02]} />
      </mesh>
      <mesh material={m.chrome} position={[0, 0.46, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.64, 0.52, 0.64]} />
      </mesh>
      <mesh material={m.redJewel} position={[0, 0.98, 0]} rotation={[0, Math.PI / 7, 0]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
      </mesh>
    </group>
  );
}

function IconDeploy({ m }: { m: M }) {
  return (
    <group>
      <mesh material={m.gunmetal} position={[0, -0.62, 0]}>
        <cylinderGeometry args={[0.52, 0.58, 0.14, 48]} />
      </mesh>
      <mesh material={m.chrome} position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.075, 24, 72]} />
      </mesh>
      <mesh material={m.redJewel} position={[0, 0.42, 0]}>
        <octahedronGeometry args={[0.36, 0]} />
      </mesh>
    </group>
  );
}

function IconIntegrate({ m }: { m: M }) {
  return (
    <group>
      <mesh material={m.steel} position={[-0.24, 0, 0]} rotation={[0, Math.PI / 3.2, 0]}>
        <torusGeometry args={[0.4, 0.115, 24, 72]} />
      </mesh>
      <mesh material={m.chrome} position={[0.24, 0, 0]} rotation={[0, -Math.PI / 3.2, 0]}>
        <torusGeometry args={[0.4, 0.115, 24, 72]} />
      </mesh>
      <mesh material={m.redHot} position={[0, 0, 0.12]}>
        <sphereGeometry args={[0.11, 32, 32]} />
      </mesh>
    </group>
  );
}

const PRISM_EDGE_ANGLES = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
function IconProject({ m }: { m: M }) {
  return (
    <group>
      <mesh material={m.chrome} position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.56, 0.6, 0.1, 48]} />
      </mesh>
      <mesh material={m.redHot} position={[0, 0.02, 0]}>
        <tetrahedronGeometry args={[0.24, 0]} />
      </mesh>
      <mesh material={m.smokedGlass}>
        <cylinderGeometry args={[0.62, 0.62, 0.98, 3, 1]} />
      </mesh>
      {PRISM_EDGE_ANGLES.map((a) => (
        <mesh key={a} material={m.chrome} position={[0.62 * Math.sin(a), 0, 0.62 * Math.cos(a)]}>
          <cylinderGeometry args={[0.022, 0.022, 0.99, 12]} />
        </mesh>
      ))}
    </group>
  );
}

function IconSettings({ m }: { m: M }) {
  const teeth = useMemo(() => {
    const arr: { x: number; z: number; rot: number }[] = [];
    const N = 22;
    for (let i = 0; i < N; i += 1) {
      const a = (i / N) * Math.PI * 2;
      arr.push({ x: Math.cos(a) * 0.52, z: Math.sin(a) * 0.52, rot: -a });
    }
    return arr;
  }, []);
  return (
    <group position={[0, -0.05, 0]}>
      <mesh material={m.gunmetal}>
        <cylinderGeometry args={[0.5, 0.53, 0.52, 48]} />
      </mesh>
      {teeth.map((t, i) => (
        <mesh key={i} material={m.gunmetalLit} position={[t.x, 0, t.z]} rotation={[0, t.rot, 0]}>
          <boxGeometry args={[0.07, 0.5, 0.055]} />
        </mesh>
      ))}
      <mesh material={m.chrome} position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.34, 0.36, 0.12, 48]} />
      </mesh>
      <mesh material={m.redJewel} position={[0.2, 0.4, 0]}>
        <boxGeometry args={[0.24, 0.05, 0.07]} />
      </mesh>
    </group>
  );
}

function IconChat({ m }: { m: M }) {
  return (
    <group>
      <mesh material={m.gunmetal} position={[-0.1, 0.14, -0.12]}>
        <boxGeometry args={[1.06, 0.68, 0.12]} />
      </mesh>
      <mesh material={m.brushed} position={[0.14, -0.18, 0.06]}>
        <boxGeometry args={[0.9, 0.56, 0.12]} />
      </mesh>
      {[-0.2, 0, 0.2].map((x, i) => (
        <mesh key={i} material={i === 1 ? m.redHot : m.redJewel} position={[0.14 + x, -0.18, 0.16]}>
          <sphereGeometry args={[0.055, 24, 24]} />
        </mesh>
      ))}
    </group>
  );
}

const FORMS: Record<IconKey, (props: { m: M }) => React.ReactElement> = {
  build: IconBuild,
  deploy: IconDeploy,
  integrate: IconIntegrate,
  project: IconProject,
  chat: IconChat,
  settings: IconSettings,
};

function IconRig({ icon, reduced }: { icon: IconKey; reduced: boolean }) {
  const m = usePremiumMaterials();
  const group = useRef<THREE.Group>(null);
  const Form = FORMS[icon];
  useFrame(({ clock }) => {
    if (!group.current) return;
    if (reduced) {
      group.current.rotation.set(0.14, -0.38, 0);
      return;
    }
    const t = clock.getElapsedTime();
    group.current.rotation.y = -0.38 + Math.sin(t * 0.55) * 0.32;
    group.current.rotation.x = 0.14 + Math.sin(t * 0.5) * 0.06;
  });
  return (
    <group ref={group} scale={1.15}>
      <Form m={m} />
    </group>
  );
}

/** Bounded lazy 3D icon. Mount via next/dynamic(ssr:false) inside a lazy /
 *  intersection wrapper so live WebGL contexts stay bounded (DL8). */
export default function PremiumIcon3D({ icon }: { icon: IconKey }) {
  const reduced = usePrefersReducedMotion();
  return (
    <Canvas
      dpr={[1, 2]}
      orthographic
      camera={{ position: [0, 0, 10], zoom: 46, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      frameloop={reduced ? 'demand' : 'always'}
      style={{ width: '100%', height: '100%' }}
    >
      <StudioEnvironment />
      <StudioLights />
      <IconRig icon={icon} reduced={reduced} />
    </Canvas>
  );
}
