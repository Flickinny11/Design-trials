'use client';

// FluidPalette — the in-canvas ADD palette + view toggle (spec §5 instantiation,
// §7 library UX). Bottom: two worn-alloy add buttons that instantiate a fluid node
// (Node Law: creating the node + rendering it are one action). Top: a galaxy/canvas
// mode toggle so the two-state law (dormant seed ⇄ realized fluid) is reachable
// in-canvas. Zero DOM; MSDF labels; matched to the chassis. WebGPU-safe.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { applyWornMaterial, useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';
import { SPIN_DURATION, SPIN_TURNS, easeInOutCubic } from '@/components/editor/chassis/chassis-config';
import { buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { FluidEngravedText } from './FluidEngravedText';
import { useFluidStore } from './use-fluid-store';

const TWO_PI = Math.PI * 2;
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));
const RING_MAT = new THREE.MeshBasicMaterial({ color: '#9fd8ff', toneMapped: false });

function CubeButton({ maps, position, tint, onClick, active, size = 0.52 }: {
  maps: WornMaps; position: [number, number, number]; tint?: string; onClick: () => void; active?: boolean; size?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });
  const geo = useMemo(() => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: size * 0.13, bevel: 0.04, radius: 0, segments: 5, cutouts: [] }), [size]);
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps); if (tint) m.color = new THREE.Color(tint); return m; }, [maps, tint]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => {
    const mesh = meshRef.current; if (!mesh) return;
    elapsed.current = state.clock.elapsedTime;
    const s = spin.current;
    if (s.active) { const t = (elapsed.current - s.start) / SPIN_DURATION; if (t >= 1) { mesh.rotation.x = 0; s.active = false; } else mesh.rotation.x = easeInOutCubic(t) * REST_TURNS * TWO_PI; }
  });
  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        geometry={geo}
        material={material}
        onPointerOver={(e) => { e.stopPropagation(); spin.current.active = true; spin.current.start = elapsed.current; document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
      />
      {active && (
        <mesh material={RING_MAT} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[size * 0.92, 0.012, 8, 28]} />
        </mesh>
      )}
    </group>
  );
}

export function FluidPalette() {
  const maps = useWornMaps();
  const instantiate = useFluidStore((s) => s.instantiate);
  const viewMode = useFluidStore((s) => s.viewMode);
  const setView = useFluidStore((s) => s.setView);

  return (
    <>
      {/* view toggle (top) */}
      <group position={[1.5, 6.7, 0]}>
        <group position={[-0.9, 0, 0]}>
          <CubeButton maps={maps.gunmetal} tint="#bcd0e6" active={viewMode === 'galaxy'} position={[0, 0, 0]} size={0.46} onClick={() => setView('galaxy')} />
          <FluidEngravedText position={[0, -0.46, 0]} fontSize={0.11} letterSpacing={0.06}>GALAXY</FluidEngravedText>
        </group>
        <group position={[0.9, 0, 0]}>
          <CubeButton maps={maps.sapphire} tint="#a9d6ff" active={viewMode === 'canvas'} position={[0, 0, 0]} size={0.46} onClick={() => setView('canvas')} />
          <FluidEngravedText position={[0, -0.46, 0]} fontSize={0.11} letterSpacing={0.06}>CANVAS</FluidEngravedText>
        </group>
      </group>

      {/* add palette (bottom) */}
      <group position={[-2.2, -6.2, 0]}>
        <group position={[-1.1, 0, 0]}>
          <CubeButton maps={maps.emerald} tint="#a9d6df" position={[0, 0, 0]} onClick={() => instantiate('surface')} />
          <FluidEngravedText position={[0, -0.52, 0]} fontSize={0.12} letterSpacing={0.05}>+ LIQUID GLASS</FluidEngravedText>
        </group>
        <group position={[1.1, 0, 0]}>
          <CubeButton maps={maps.bronze} tint="#d8c2a0" position={[0, 0, 0]} onClick={() => instantiate('volume')} />
          <FluidEngravedText position={[0, -0.52, 0]} fontSize={0.12} letterSpacing={0.05}>+ VOLUME</FluidEngravedText>
        </group>
      </group>
    </>
  );
}
