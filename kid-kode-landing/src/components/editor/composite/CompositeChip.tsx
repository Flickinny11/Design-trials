'use client';

// CompositeChip — a worn-alloy CUBE button with hover-spin + an optional active
// ring + an engraved label. The founder-approved chassis / keyframe button
// vocabulary (the SAME idiom as FluidInspector's Chip), reused across the composite
// palette + binding inspector so every control MATCHES /toolbar-chassis.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import { SPIN_DURATION, SPIN_TURNS, easeInOutCubic } from '@/components/editor/chassis/chassis-config';
import { buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeText } from './CompositeText';

const TWO_PI = Math.PI * 2;
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));
const RING_MAT = new THREE.MeshBasicMaterial({ color: '#9fd8ff', toneMapped: false });

export interface CompositeChipProps {
  maps: WornMaps;
  position: [number, number, number];
  onClick: () => void;
  label?: string;
  labelVariant?: 'engraved' | 'bright';
  active?: boolean;
  tint?: string;
  size?: number;
}

export function CompositeChip({ maps, position, onClick, label, labelVariant = 'bright', active, tint, size = 0.5 }: CompositeChipProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });
  const geo = useMemo(() => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: size * 0.14, bevel: 0.04, radius: 0, segments: 5, cutouts: [] }), [size]);
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps); if (tint) m.color = new THREE.Color(tint); return m; }, [maps, tint]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    elapsed.current = state.clock.elapsedTime;
    const s = spin.current;
    if (s.active) {
      const t = (elapsed.current - s.start) / SPIN_DURATION;
      if (t >= 1) { mesh.rotation.x = 0; s.active = false; } else mesh.rotation.x = easeInOutCubic(t) * REST_TURNS * TWO_PI;
    }
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
      {label && (
        <CompositeText position={[0, -size * 0.5 - 0.18, 0]} fontSize={0.12} letterSpacing={0.05} variant={labelVariant}>
          {label}
        </CompositeText>
      )}
    </group>
  );
}
