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
    // Steel — a mid-luminance machined metal between gunmetal and chrome, for
    // forms that must hold their own against a chrome sibling (integrate).
    const steel = new THREE.MeshStandardMaterial({
      color: '#6a707a',
      metalness: 0.92,
      roughness: 0.3,
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
    return { gunmetal, gunmetalLit, steel, chrome, brushed, redJewel, redHot, smokedGlass };
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
    // Turntable sway around a 3/4 hero pose — every icon holds a readable
    // angle at every instant (a full spin leaves some form edge-on in any
    // given frame) while speculars keep traveling across the metal (DL4).
    group.current.rotation.y = -0.38 + Math.sin(t * 0.55 + phase) * 0.32;
    group.current.rotation.x = 0.14 + Math.sin(t * 0.5 + phase) * 0.06;
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

/** INTEGRATE — interlocked steel + chrome links with a red junction bead.
 *  The dark link is lifted to steel (not gunmetal) and the pair sits tighter
 *  so the LUMINANCE center coincides with the geometric center — the bright
 *  chrome ring no longer drags the perceived center off the label
 *  (advocate round-2 should-fix). */
function IconIntegrate({ m }: { m: Materials }) {
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

/** PROJECT — the prism itself: a smoked-glass triangular prism over a chrome
 *  base with a hot red core refracting inside. Three machined chrome edge
 *  rails keep the silhouette CRISP at icon size — pure transmission glass
 *  read as defocus next to its metal siblings (advocate round-2 should-fix). */
const PRISM_EDGE_ANGLES = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
function IconProject({ m }: { m: Materials }) {
  return (
    <group>
      <mesh material={m.chrome} position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.56, 0.6, 0.1, 48]} />
      </mesh>
      <mesh material={m.redHot} position={[0, 0.02, 0]}>
        <tetrahedronGeometry args={[0.24, 0]} />
      </mesh>
      <mesh material={m.smokedGlass} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.98, 3, 1]} />
      </mesh>
      {PRISM_EDGE_ANGLES.map((a) => (
        <mesh
          key={a}
          material={m.chrome}
          position={[0.62 * Math.sin(a), 0, 0.62 * Math.cos(a)]}
        >
          <cylinderGeometry args={[0.022, 0.022, 0.99, 12]} />
        </mesh>
      ))}
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
//
// The camera is ORTHOGRAPHIC and each icon's position derives from the live
// viewport, so world x/y map linearly onto the DOM label grid (3 columns × 2
// rows) — every icon sits exactly over its engraved label at any aspect. A
// perspective camera would project the edge cells inward off their labels
// (advocate round-1 MUST-FIX). Depth still reads through material shading,
// IBL speculars, and per-icon idle rotation.

const GRID: {
  key: string;
  col: number; // 0..2 — matches .sw0-icon-labels columns
  row: number; // 0 top, 1 bottom
  Icon: (props: { m: Materials }) => React.ReactElement;
}[] = [
  { key: 'build', col: 0, row: 0, Icon: IconBuild },
  { key: 'deploy', col: 1, row: 0, Icon: IconDeploy },
  { key: 'integrate', col: 2, row: 0, Icon: IconIntegrate },
  { key: 'project', col: 0, row: 1, Icon: IconProject },
  { key: 'settings', col: 1, row: 1, Icon: IconSettings },
  { key: 'chat', col: 2, row: 1, Icon: IconChat },
];

function IconField() {
  const m = useMaterials();
  const { width: vw, height: vh } = useThree((s) => s.viewport);
  useEffect(() => () => {
    for (const mat of Object.values(m)) mat.dispose();
  }, [m]);
  // Cell centers in world units (ortho ⇒ linear map to the DOM overlay grid).
  const cellW = vw / 3;
  const cellH = vh / 2;
  // Icons are authored ~±0.95 world units around the origin; 0.46 keeps the
  // tallest form (build's keystone) inside the stage with margin while the
  // labels keep the bottom band of each cell.
  const scale = Math.min(cellW, cellH) * 0.46;
  return (
    <>
      {GRID.map(({ key, col, row, Icon }, i) => (
        <IconRig
          key={key}
          position={[(col - 1) * cellW, (row === 0 ? 1 : -1) * (cellH / 2), 0]}
          phase={i * 0.9}
        >
          <group scale={scale}>
            <Icon m={m} />
          </group>
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
      orthographic
      camera={{ position: [0, 0, 10], zoom: 100, near: 0.1, far: 100 }}
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
