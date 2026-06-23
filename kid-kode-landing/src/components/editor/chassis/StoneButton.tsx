'use client';

// StoneButton — one rounded-cornered CUBE of editorial stone/metal, seated in its
// milled cutout. Sized (CUBE) so its rotating diagonal stays inside the hole (see
// CUBE_HALF_DIAGONAL < HOLE_HALF in chassis-config) — it never clips the glass.
//
// Wave 1: static seated cube + photoreal material. The hover-spin mechanic,
// see-through reveal, abstract face mark, and in-canvas tooltip land in Wave 3.

import { useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { CUBE, CUBE_CORNER, type ChassisButton } from './chassis-config';
import { applyStoneMaterial, applyMetalMaterial, type StoneMaps } from './materials';

export interface StoneButtonProps {
  btn: ChassisButton;
  x: number;
  stoneMaps?: StoneMaps;
}

export function StoneButton({ btn, x, stoneMaps }: StoneButtonProps) {
  const groupRef = useRef<THREE.Group>(null);

  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial();
    if (btn.kind === 'stone') applyStoneMaterial(mat, btn, stoneMaps);
    else applyMetalMaterial(mat, btn);
    return mat;
  }, [btn, stoneMaps]);

  return (
    <group ref={groupRef} position={[x, 0, 0]}>
      <RoundedBox
        args={[CUBE, CUBE, CUBE]}
        radius={CUBE_CORNER}
        smoothness={6}
        castShadow
        receiveShadow
        material={material}
      />
    </group>
  );
}
