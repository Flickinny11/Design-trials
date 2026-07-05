'use client';

// DormantFluid — the GALAXY (unbuilt) state of a fluid node (INV-0.1 / INV-R2): a
// dormant glass seed sphere with a faint inner glow, captioned. The SAME node that
// realizes as a flowing liquid-glass surface in CANVAS. Carries the Node-Law
// userData so the authorship gate sees the dormant render as node-backed.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { FluidEngravedText } from './FluidEngravedText';
import type { FluidSchema } from './fluid-schema';

export function DormantFluid({
  schema,
  selected,
  onSelect,
}: {
  schema: FluidSchema;
  selected: boolean;
  onSelect: (nodeId: string | null) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(schema.params.tint),
        transmission: 0.85,
        thickness: 1.2,
        ior: schema.params.ior,
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
        attenuationColor: new THREE.Color(schema.params.tint),
        attenuationDistance: 0.9,
        emissive: new THREE.Color('#3a6f8a'),
        emissiveIntensity: selected ? 0.6 : 0.28,
        transparent: true,
      }),
    [schema.params.tint, schema.params.ior, selected],
  );
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.4;
  });

  const t = schema.transform;
  return (
    <group position={[t.x, t.y, t.z]}>
      <group
        ref={ref}
        userData={{ prismFluid: true, prismNodeId: schema.nodeId, prismKind: schema.kind, prismDormant: true }}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onSelect(schema.nodeId); }}
      >
        <mesh material={mat}>
          <sphereGeometry args={[0.92, 48, 48]} />
        </mesh>
        {selected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.16, 0.02, 10, 48]} />
            <meshBasicMaterial color="#9fd8ff" toneMapped={false} />
          </mesh>
        )}
      </group>
      <FluidEngravedText position={[0, -1.5, 0]} fontSize={0.18} letterSpacing={0.04}>
        {schema.caption.toUpperCase()}
      </FluidEngravedText>
    </group>
  );
}
