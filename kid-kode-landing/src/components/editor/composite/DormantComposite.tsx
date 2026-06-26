'use client';

// DormantComposite — the GALAXY (unbuilt) state of a composite SUBGRAPH (INV-0.1 /
// INV-R2): every member node shown as a dormant glass seed at its place in the
// assembly, captioned. The SAME nodes realize as the assembled composite in CANVAS.
// Each seed carries Node-Law userData so the authorship gate sees the dormant
// subgraph as fully node-backed (tabs included — the bound view derives in galaxy too).

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CompositeText } from './CompositeText';
import { compositeMembers, type CompositeSchema, type LabHub } from './composite-schema';

const SEED_MAT = () =>
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#bfe3ea'),
    transmission: 0.82,
    thickness: 0.8,
    ior: 1.45,
    roughness: 0.14,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
    attenuationColor: new THREE.Color('#bfe3ea'),
    attenuationDistance: 0.8,
    emissive: new THREE.Color('#2a5670'),
    emissiveIntensity: 0.3,
    transparent: true,
  });

function Seed({ memberId, role, position, radius }: { memberId: string; role: string; position: [number, number, number]; radius: number }) {
  const ref = useRef<THREE.Group>(null);
  const mat = useMemo(SEED_MAT, []);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.userData.prismCompositeMember = true;
    g.userData.prismNodeId = memberId;
    g.userData.prismRole = role;
    g.userData.prismDormant = true;
  }, [memberId, role]);
  return (
    <group ref={ref} position={position}>
      <mesh material={mat}>
        <sphereGeometry args={[radius, 24, 24]} />
      </mesh>
    </group>
  );
}

export interface DormantCompositeProps {
  composite: CompositeSchema;
  hubs: LabHub[];
  selected: boolean;
  onSelect: (compositeId: string) => void;
  /** WORLD root (effectiveRoot) — overrides composite.root when stacked (P-5 §6.1). */
  worldRoot?: { x: number; y: number; z: number };
}

export function DormantComposite({ composite, hubs, selected, onSelect, worldRoot }: DormantCompositeProps) {
  const members = useMemo(() => compositeMembers(composite, hubs), [composite, hubs]);
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.08;
  });
  const r = worldRoot ?? composite.root;
  return (
    <group
      position={[r.x, r.y, r.z]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(composite.compositeId); }}
    >
      <group ref={groupRef}>
        {members.map((m) => (
          <Seed
            key={m.memberId}
            memberId={m.memberId}
            role={m.role}
            position={[m.local.x, m.local.y, m.local.z]}
            radius={Math.max(0.12, Math.min(0.34, Math.min(m.width, m.height) * 0.2))}
          />
        ))}
      </group>
      <CompositeText position={[0, composite.templateId === 'nav-header' ? 1.1 : 2.6, 0]} fontSize={0.2} letterSpacing={0.05} variant="bright">
        {composite.caption.toUpperCase()}
      </CompositeText>
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <torusGeometry args={[Math.max(2.2, NAV_HALF(composite)), 0.03, 10, 64]} />
          <meshBasicMaterial color="#9fd8ff" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function NAV_HALF(c: CompositeSchema): number {
  if (c.templateId === 'nav-header') return 5.0;
  if (c.templateId === 'footer') return 4.6;
  return 2.4;
}
