'use client';

// DormantNode — the GALAXY state of a primitive node: the node UNBUILT (spec
// INV-0.1 "Galaxy = the node UNBUILT (dormant sphere)"). A dark polished seed
// sphere with a faint inner core that hints at the unbuilt potential, tinted by
// kind so a node reads at galaxy glance. It is the SAME node as the realized
// canvas artifact — one cannot exist without the other (INV-0.1). Tagged for the
// authorship probe so the gate proves a galaxy seed is node-backed too.
//
// Two-state invariant (INV-R2 / FP-R2): a node is shown EITHER as a dormant
// sphere (galaxy) OR realized (canvas) — never both at once. The scene switches
// the whole set by viewMode.

import { useEffect, useMemo, useRef } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { EngravedText } from './EngravedText';
import type { PrimitiveSchema } from './primitive-schema';

const CORE_TINT: Record<string, string> = {
  pane: '#7fb2ff',
  cube: '#9ad0ff',
  sphere: '#c79a5a',
};

const SHELL_MAT = new THREE.MeshPhysicalMaterial({
  color: '#28303d',
  metalness: 0.55,
  roughness: 0.42,
  clearcoat: 0.5,
  clearcoatRoughness: 0.4,
  envMapIntensity: 0.7,
});

const RING_MAT = new THREE.MeshBasicMaterial({ color: '#9fd8ff', toneMapped: false });

export interface DormantNodeProps {
  schema: PrimitiveSchema;
  selected: boolean;
  onSelect: (nodeId: string) => void;
}

export function DormantNode({ schema, selected, onSelect }: DormantNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CORE_TINT[schema.kind] ?? '#9ad0ff',
        emissive: new THREE.Color(CORE_TINT[schema.kind] ?? '#9ad0ff'),
        emissiveIntensity: 1.4,
        roughness: 0.3,
        metalness: 0.2,
        transparent: true,
        opacity: 0.92,
      }),
    [schema.kind],
  );
  useEffect(() => () => coreMat.dispose(), [coreMat]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.prismPrimitive = true;
    g.userData.prismNodeId = schema.nodeId;
    g.userData.prismKind = schema.kind;
    g.userData.prismDormant = true;
  }, [schema.nodeId, schema.kind]);

  const t = schema.transform;
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(schema.nodeId);
  };

  return (
    <group ref={groupRef} position={[t.x, t.y, t.z]}>
      <mesh
        material={SHELL_MAT}
        castShadow
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.62, 40, 24]} />
      </mesh>
      {/* dormant core — the unbuilt potential */}
      <mesh material={coreMat}>
        <sphereGeometry args={[0.2, 24, 16]} />
      </mesh>
      {selected && (
        <mesh material={RING_MAT} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.82, 0.012, 8, 48]} />
        </mesh>
      )}
      <EngravedText position={[0, -0.95, 0]} fontSize={0.16}>
        {schema.caption}
      </EngravedText>
    </group>
  );
}
