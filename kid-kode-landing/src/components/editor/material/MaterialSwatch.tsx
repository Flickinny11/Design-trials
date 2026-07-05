'use client';

// MaterialSwatch — ONE library entry as a live, spinning 3D preview (spec §7.1 —
// "each entry a live spinning 3D preview, same mechanic as the cube buttons"). A
// rounded preview cube wears the material under the shared IBL; hover spins it
// end-over-end (the chassis mechanic) so the user reads the surface in motion;
// click APPLIES the material to the displays. The active entry shows a selection
// ring; an engraved label names it. This is library CHROME, not a build node — it
// is deliberately NOT tagged prismPrimitive.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { SPIN_DURATION, SPIN_TURNS, easeInOutCubic } from '@/components/editor/chassis/chassis-config';
import { buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { EngravedText } from '@/components/editor/primitive/EngravedText';
import { buildMaterialFromDef } from './material-build';
import type { MaterialDef } from './material-types';

const RING_MAT = new THREE.MeshBasicMaterial({ color: '#9fd8ff', toneMapped: false });
const TWO_PI = Math.PI * 2;
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));

export function MaterialSwatch({
  def,
  mapSets,
  active,
  position,
  size = 0.62,
  onPick,
}: {
  def: MaterialDef;
  mapSets: Record<string, WornMaps>;
  active: boolean;
  position: [number, number, number];
  size?: number;
  onPick: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });

  const geo = useMemo(
    () => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: size * 0.16, bevel: 0.04, radius: 0, segments: 5, cutouts: [] }),
    [size],
  );
  useEffect(() => () => geo.dispose(), [geo]);

  const material = useMemo(() => buildMaterialFromDef(def, mapSets), [def, mapSets]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    elapsed.current = state.clock.elapsedTime;
    const s = spin.current;
    if (s.active) {
      const tt = (elapsed.current - s.start) / SPIN_DURATION;
      if (tt >= 1) { mesh.rotation.x = 0; s.active = false; }
      else mesh.rotation.x = easeInOutCubic(tt) * REST_TURNS * TWO_PI;
    } else if (active) {
      // a slow idle turn marks the current selection in the shelf.
      mesh.rotation.y += 0.004;
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        geometry={geo}
        material={material}
        castShadow
        onPointerOver={(e) => { e.stopPropagation(); if (!spin.current.active) { spin.current.active = true; spin.current.start = elapsed.current; } document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(def.id); }}
      />
      {active && (
        <mesh material={RING_MAT} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[size * 0.92, 0.014, 8, 36]} />
        </mesh>
      )}
      <EngravedText position={[0, -size * 0.92, 0.02]} fontSize={0.12} letterSpacing={0.02} maxWidth={size * 2.1}>
        {def.label.toUpperCase()}
      </EngravedText>
    </group>
  );
}
