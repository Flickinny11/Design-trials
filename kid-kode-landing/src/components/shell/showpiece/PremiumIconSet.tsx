'use client';

// PRISM SHELL — PREMIUM 3D ICON SET (SHELL W0 showpiece, DL2/DL4/DL5)
//
// Six custom geometric icons — build / deploy / integrate / project /
// settings / chat — machined from primitives in the premium.ts RED/BLACK/
// WHITE material language: gunmetal housing, brushed chrome, signal-red
// jewels, one smoked-glass prism. True shading via a LOCAL procedural
// RoomEnvironment IBL (PMREM) + key/rim lights; slow idle rotation so light
// visibly moves across the metal (DL4: "if light doesn't move, it doesn't
// ship"). NO icon packs, NO flat SVG, NO emoji (DL5).
//
// This is a bounded, lazy showpiece island inside a DOM shell surface —
// exactly the carve-out the Prime Boundary allows (spec §0; DL4/DL5). It is
// NOT engine interior: it renders no graph state and speaks no contract.
// Zero remote assets (VERIFICATION-STANDARD §8): the environment is
// generated procedurally on the GPU, never fetched.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CHROME,
  GUNMETAL,
  GUNMETAL_LIT,
  RED_DEEP,
  RED_HOT,
  SIGNAL_RED,
  SMOKED_GLASS,
} from '@/components/shell/design/prism-premium-tokens';

// ── Local procedural IBL (no remote HDRI — the 2026-06-29 crash class) ──────

function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    return () => {
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

// ── Shared machined materials (premium.ts recipes) ───────────────────────────

function useMaterials() {
  return useMemo(() => {
    const gunmetal = new THREE.MeshStandardMaterial({
      color: GUNMETAL,
      metalness: 0.92,
      roughness: 0.34,
    });
    const gunmetalLit = new THREE.MeshStandardMaterial({
      color: GUNMETAL_LIT,
      metalness: 0.9,
      roughness: 0.42,
    });
    const chrome = new THREE.MeshPhysicalMaterial({
      color: CHROME,
      metalness: 1,
      roughness: 0.18,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
    });
    const brushed = new THREE.MeshPhysicalMaterial({
      color: CHROME,
      metalness: 0.95,
      roughness: 0.38,
    });
    const redJewel = new THREE.MeshPhysicalMaterial({
      color: SIGNAL_RED,
      metalness: 0.25,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: new THREE.Color(RED_DEEP),
      emissiveIntensity: 0.55,
    });
    const redHot = new THREE.MeshStandardMaterial({
      color: RED_HOT,
      emissive: new THREE.Color(RED_HOT),
      emissiveIntensity: 1.4,
      metalness: 0.1,
      roughness: 0.4,
    });
    const smokedGlass = new THREE.MeshPhysicalMaterial({
      color: SMOKED_GLASS.color,
      transmission: SMOKED_GLASS.transmission,
      attenuationColor: new THREE.Color(SMOKED_GLASS.attenuationColor),
      attenuationDistance: SMOKED_GLASS.attenuationDistance,
      envMapIntensity: SMOKED_GLASS.envMapIntensity,
      metalness: 0,
      roughness: 0.08,
      ior: 1.5,
      thickness: 0.7,
    });
    return { gunmetal, gunmetalLit, chrome, brushed, redJewel, redHot, smokedGlass };
  }, []);
}
type Materials = ReturnType<typeof useMaterials>;

// ── Icon rig: slow idle rotation with per-icon phase ─────────────────────────

function IconRig({
  position,
  phase,
  children,
}: {
  position: [number, number, number];
  phase: number;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = phase + t * 0.35;
    group.current.rotation.x = Math.sin(t * 0.5 + phase) * 0.07;
  });
  return (
    <group position={position}>
      <group ref={group}>{children}</group>
    </group>
  );
}

// ── The six icons ────────────────────────────────────────────────────────────

/** BUILD — a rising machined stack: gunmetal foundation, chrome course
 *  turned 45°, red keystone. */
function IconBuild({ m }: { m: Materials }) {
  return (
    <group position={[0, -0.18, 0]}>
      <mesh material={m.gunmetal} position={[0, 0, 0]}>
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

/** DEPLOY — a red octahedron lifting through a chrome launch ring off a
 *  gunmetal pad. */
function IconDeploy({ m }: { m: Materials }) {
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

/** INTEGRATE — interlocked gunmetal + chrome links with a red junction bead. */
function IconIntegrate({ m }: { m: Materials }) {
  return (
    <group>
      <mesh material={m.gunmetalLit} position={[-0.27, 0, 0]} rotation={[0, Math.PI / 3.2, 0]}>
        <torusGeometry args={[0.4, 0.115, 24, 72]} />
      </mesh>
      <mesh material={m.chrome} position={[0.27, 0, 0]} rotation={[0, -Math.PI / 3.2, 0]}>
        <torusGeometry args={[0.4, 0.115, 24, 72]} />
      </mesh>
      <mesh material={m.redHot} position={[0, 0, 0.12]}>
        <sphereGeometry args={[0.11, 32, 32]} />
      </mesh>
    </group>
  );
}

/** PROJECT — the prism itself: a smoked-glass triangular prism over a chrome
 *  base with a hot red core refracting inside. */
function IconProject({ m }: { m: Materials }) {
  return (
    <group>
      <mesh material={m.chrome} position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.56, 0.6, 0.1, 48]} />
      </mesh>
      <mesh material={m.redHot} position={[0, 0.02, 0]}>
        <tetrahedronGeometry args={[0.2, 0]} />
      </mesh>
      <mesh material={m.smokedGlass} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.98, 3, 1]} />
      </mesh>
    </group>
  );
}

/** SETTINGS — a knurled machined knob with chrome cap and red index mark. */
function IconSettings({ m }: { m: Materials }) {
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

/** CHAT — two machined message slabs, red typing beads on the front face. */
function IconChat({ m }: { m: Materials }) {
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

// ── The set — 3 × 2 grid inside one canvas ──────────────────────────────────

const GRID: {
  key: string;
  position: [number, number, number];
  Icon: (props: { m: Materials }) => React.ReactElement;
}[] = [
  { key: 'build', position: [-2.4, 1.15, 0], Icon: IconBuild },
  { key: 'deploy', position: [0, 1.15, 0], Icon: IconDeploy },
  { key: 'integrate', position: [2.4, 1.15, 0], Icon: IconIntegrate },
  { key: 'project', position: [-2.4, -1.25, 0], Icon: IconProject },
  { key: 'settings', position: [0, -1.25, 0], Icon: IconSettings },
  { key: 'chat', position: [2.4, -1.25, 0], Icon: IconChat },
];

function IconField() {
  const m = useMaterials();
  useEffect(() => () => {
    for (const mat of Object.values(m)) mat.dispose();
  }, [m]);
  return (
    <>
      {GRID.map(({ key, position, Icon }, i) => (
        <IconRig key={key} position={position} phase={i * 0.9}>
          <Icon m={m} />
        </IconRig>
      ))}
    </>
  );
}

/** Bounded, lazy 3D icon showpiece. Mount via next/dynamic (ssr: false). */
export default function PremiumIconSet() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 7.4], fov: 35 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <StudioEnvironment />
      <directionalLight position={[3.5, 5, 4]} intensity={1.6} color={'#ffffff'} />
      <pointLight position={[-4, -1.5, -3]} intensity={26} distance={14} color={SIGNAL_RED} />
      <pointLight position={[4.5, 2.5, 3.5]} intensity={9} distance={16} color={'#f6f8fb'} />
      <IconField />
    </Canvas>
  );
}
