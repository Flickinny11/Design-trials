'use client';

// PrimitiveMesh — the REALIZED (canvas) form of ONE primitive node. Geometry is
// generated from the node's schema NUMBERS and rebuilt LIVE whenever a param
// changes (spec §1.1) — pane via ExtrudeGeometry+holes, cube via RoundedBox,
// sphere via SphereGeometry. The surface is the founder-approved glass / worn-alloy
// material. The realized group is TAGGED (userData.prismPrimitive + prismNodeId)
// so the node-authorship probe can prove every rendered artifact has a backing
// node (spec §0 / INV-0.5) by traversing the live scene — not by trusting a list.
//
// Isolated editor-chrome — window/three access is fine (not runtime/node code).

import { useEffect, useMemo, useRef } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { buildCubeGeometry, buildPaneGeometry, buildSphereGeometry } from './primitive-geometry';
import { buildPrimitiveMaterial } from './primitive-materials';
import type { PrimitiveSchema } from './primitive-schema';

const SELECT_MAT = new THREE.LineBasicMaterial({
  color: '#9fd8ff',
  transparent: true,
  opacity: 0.95,
  toneMapped: false,
});

function buildGeometry(schema: PrimitiveSchema): THREE.BufferGeometry {
  if (schema.kind === 'pane') return buildPaneGeometry(schema.params);
  if (schema.kind === 'cube') return buildCubeGeometry(schema.params);
  return buildSphereGeometry(schema.params);
}

export interface PrimitiveMeshProps {
  schema: PrimitiveSchema;
  wornMaps: Record<string, WornMaps>;
  selected: boolean;
  onSelect: (nodeId: string) => void;
}

export function PrimitiveMesh({ schema, wornMaps, selected, onSelect }: PrimitiveMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Live geometry — rebuilt whenever any geometry param changes (cutouts, size,
  // thickness, corner radius, segments). Old geometry disposed on swap.
  const paramKey = JSON.stringify(schema.params) + schema.kind;
  const geometry = useMemo(() => buildGeometry(schema), [paramKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Live material — rebuilt when the material descriptor (or maps) change.
  const matKey = JSON.stringify(schema.material);
  const material = useMemo(
    () => buildPrimitiveMaterial(schema.material, wornMaps),
    [matKey, wornMaps], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => material.dispose(), [material]);

  // Selection edge overlay derived from the SAME geometry.
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 25), [geometry]);
  useEffect(() => () => edges.dispose(), [edges]);

  // NODE LAW tag — the authorship probe reads these off the live scene graph.
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.prismPrimitive = true;
    g.userData.prismNodeId = schema.nodeId;
    g.userData.prismKind = schema.kind;
  }, [schema.nodeId, schema.kind]);

  const t = schema.transform;
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(schema.nodeId);
  };

  return (
    <group
      ref={groupRef}
      position={[t.x, t.y, t.z]}
      rotation={[t.rotX, t.rotY, t.rotZ]}
      scale={t.scale}
    >
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          document.body.style.cursor = '';
        }}
      />
      {selected && <lineSegments geometry={edges} material={SELECT_MAT} renderOrder={5} />}
    </group>
  );
}
