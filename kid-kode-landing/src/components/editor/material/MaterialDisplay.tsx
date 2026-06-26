'use client';

// MaterialDisplay — ONE display primitive (pane / cube / sphere) realized with the
// currently-selected library material (+ live overrides) under the shared studio
// IBL. Geometry comes from the same parametric builders as P-1; the surface is
// built from the registry MaterialDef via buildMaterialFromDef. The group is TAGGED
// (userData.prismPrimitive + prismNodeId) so the Node-Law probe proves it is a real
// backing node (spec §0). Selectable for the Inspector (W-APPLY).

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { WornMaps } from '@/components/editor/chassis/materials';
import {
  buildCubeGeometry,
  buildPaneGeometry,
  buildSphereGeometry,
} from '@/components/editor/primitive/primitive-geometry';
import type { PrimitiveSchema } from '@/components/editor/primitive/primitive-schema';
import { getMaterial, LEGACY_KIND_TO_ID } from './material-registry';
import { buildMaterialFromDef } from './material-build';
import type { MaterialParams } from './material-types';

const SELECT_MAT = new THREE.LineBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.95, toneMapped: false });

function buildGeometry(schema: PrimitiveSchema): THREE.BufferGeometry {
  if (schema.kind === 'pane') return buildPaneGeometry(schema.params);
  if (schema.kind === 'cube') return buildCubeGeometry(schema.params);
  return buildSphereGeometry(schema.params);
}

export function MaterialDisplay({
  schema,
  mapSets,
  selected,
  spin,
  onSelect,
}: {
  schema: PrimitiveSchema;
  mapSets: Record<string, WornMaps>;
  selected: boolean;
  spin: boolean;
  onSelect: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const geo = useMemo(() => buildGeometry(schema), [JSON.stringify(schema.params), schema.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);

  const materialId = schema.material.materialId ?? LEGACY_KIND_TO_ID[schema.material.kind] ?? 'metal.worn-gunmetal';
  const overrides = schema.material.overrides;
  const material = useMemo(() => {
    const def = getMaterial(materialId);
    if (!def) return new THREE.MeshPhysicalMaterial({ color: '#888' });
    return buildMaterialFromDef(def, mapSets, overrides as Partial<MaterialParams> | undefined);
  }, [materialId, JSON.stringify(overrides), mapSets]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => material.dispose(), [material]);

  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 28), [geo]);
  useEffect(() => () => edges.dispose(), [edges]);

  const t = schema.transform;
  useFrame((_, dt) => {
    const g = groupRef.current;
    if (g && spin) g.rotation.y += dt * 0.35;
  });

  return (
    <group
      ref={groupRef}
      position={[t.x, t.y, t.z]}
      rotation={[t.rotX, t.rotY, t.rotZ]}
      scale={t.scale}
      onUpdate={(self) => {
        self.userData.prismPrimitive = true;
        self.userData.prismNodeId = schema.nodeId;
        self.userData.prismKind = schema.kind;
        self.userData.prismDormant = false;
        self.userData.prismMaterialId = materialId;
      }}
    >
      <mesh
        geometry={geo}
        material={material}
        castShadow
        receiveShadow
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(schema.nodeId); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      />
      {selected && <lineSegments geometry={edges} material={SELECT_MAT} />}
    </group>
  );
}
