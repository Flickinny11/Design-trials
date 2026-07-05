'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — THE REALIZED CANVAS INSTANCE (spec §0 / §7.3).
//
// Renders ONE library instance dropped on the canvas, branching by kind:
//   • primitive  — P-1 parametric geometry + (registry material by id OR the chassis
//                  glass/worn material). A "material display" is a sphere wearing a
//                  P-2 registry material.
//   • fluid      — a P-3 live liquid-glass surface (GPU field, self-contained).
//   • composite  — a P-4/P-5 SUBGRAPH: one member mesh per resolved member.
//
// Every realized group is TAGGED (userData.prismLibraryItem + prismNodeId) so the
// --library authorship probe proves each render maps to a backing node (Law 0). The
// GALAXY (unbuilt) state renders the same instances as dormant seed spheres.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { buildCubeGeometry, buildPaneGeometry, buildSphereGeometry } from '@/components/editor/primitive/primitive-geometry';
import { buildPrimitiveMaterial } from '@/components/editor/primitive/primitive-materials';
import { buildMaterialFromDef } from '@/components/editor/material/material-build';
import { getMaterial } from '@/components/editor/material/material-registry';
import { buildMemberMaterial } from '@/components/editor/composite/composite-materials';
import { compositeMembers, type CompositeMember, type CompositeSchema } from '@/components/editor/composite/composite-schema';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { FluidFieldSim } from '@/components/editor/fluid/fluid-sim';
import { buildFluidSurfaceMaterial } from '@/components/editor/fluid/fluid-material';
import type { PrimitiveSchema } from '@/components/editor/primitive/primitive-schema';
import type { FluidSchema } from '@/components/editor/fluid/fluid-schema';
import type { LibraryInstance } from './use-library-store';

const SELECT_MAT = new THREE.LineBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.92, toneMapped: false });
const LABELLED_ROLES = new Set(['nav-title', 'nav-tab', 'footer-link', 'card-title', 'card-cta']);

// ── primitive geometry from schema ───────────────────────────────────────────────
function primGeometry(schema: PrimitiveSchema): THREE.BufferGeometry {
  if (schema.kind === 'cube') return buildCubeGeometry(schema.params);
  if (schema.kind === 'sphere') return buildSphereGeometry(schema.params);
  const geo = buildPaneGeometry(schema.params);
  // remap pane UVs to 0..1 over the XY bbox so a tiling registry material doesn't seam.
  if (schema.material.materialId) normalizePaneUVs(geo);
  return geo;
}

function normalizePaneUVs(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const sx = bb.max.x - bb.min.x || 1;
  const sy = bb.max.y - bb.min.y || 1;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) / sx;
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / sy;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv.slice(), 2));
}

// ── PRIMITIVE / MATERIAL-DISPLAY node ────────────────────────────────────────────
function PrimitiveNode({
  schema, wornMaps, matSets, selected, onSelect,
}: {
  schema: PrimitiveSchema; wornMaps: Record<string, WornMaps>; matSets: Record<string, WornMaps>;
  selected: boolean; onSelect: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => primGeometry(schema), [schema.kind, JSON.stringify(schema.params), schema.material.materialId]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => {
    if (schema.material.materialId) {
      const def = getMaterial(schema.material.materialId);
      if (def) return buildMaterialFromDef(def, matSets);
    }
    return buildPrimitiveMaterial(schema.material, wornMaps);
  }, [JSON.stringify(schema.material), wornMaps, matSets]);
  useEffect(() => () => material.dispose(), [material]);

  const edges = useMemo(() => (selected ? new THREE.EdgesGeometry(geometry) : null), [selected, geometry]);
  useEffect(() => () => edges?.dispose(), [edges]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.prismLibraryItem = true;
    g.userData.prismNodeId = schema.nodeId;
    g.userData.prismKind = schema.kind;
    g.userData.prismDormant = false;
  }, [schema.nodeId, schema.kind]);

  const t = schema.transform;
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
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(schema.nodeId); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      />
      {edges && <lineSegments geometry={edges} material={SELECT_MAT} renderOrder={6} />}
    </group>
  );
}

// ── FLUID node (self-contained live liquid-glass; constant flowing phase) ─────────
function FluidNode({
  schema, selected, onSelect,
}: {
  schema: FluidSchema; selected: boolean; onSelect: (id: string) => void;
}) {
  const gl = useThree((s) => s.gl);
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const phase = useRef(0);

  const { sim, surf } = useMemo(() => {
    const s = new FluidFieldSim(128);
    const m = buildFluidSurfaceMaterial(s.fieldTexNode, s.size);
    return { sim: s, surf: m };
  }, []);
  useEffect(() => () => { sim.dispose(); surf.material.dispose(); }, [sim, surf]);

  useEffect(() => {
    surf.applyGlass({ ior: schema.params.ior, thickness: schema.params.thickness, tint: schema.params.tint, opacity: schema.params.opacity });
  }, [surf, schema.params.ior, schema.params.thickness, schema.params.tint, schema.params.opacity]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.prismLibraryItem = true;
    g.userData.prismNodeId = schema.nodeId;
    g.userData.prismKind = schema.kind;
    g.userData.prismDormant = false;
  }, [schema.nodeId, schema.kind]);

  useFrame((state, dt) => {
    // ease the liquid phase to a steady flowing state (a self-contained living surface).
    phase.current += (0.85 - phase.current) * Math.min(1, dt * 1.5);
    sim.setParams({
      viscosity: schema.params.viscosity, surfaceTension: schema.params.surfaceTension,
      flowSpeed: schema.params.flowSpeed, flowDirection: schema.params.flowDirection,
      patternWeights: schema.params.pattern === 'swirl' ? [0, 1, 0, 0] : schema.params.pattern === 'turbulent' ? [0, 0, 1, 0] : schema.params.pattern === 'radial' ? [0, 0, 0, 1] : [1, 0, 0, 0],
      turbulence: schema.params.turbulence, damping: schema.params.damping,
      liquidPhase: phase.current, reactsToInteraction: schema.params.reactsToInteraction ? 1 : 0,
    });
    surf.uniforms.liquidPhase.value = phase.current;
    sim.step(gl as unknown as THREE.WebGLRenderer, dt, state.clock.elapsedTime);
  });

  const t = schema.transform;
  return (
    <group ref={groupRef} position={[t.x, t.y, t.z]} rotation={[t.rotX, t.rotY, t.rotZ]} scale={t.scale}>
      <mesh
        ref={meshRef}
        material={surf.material}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(schema.nodeId); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      >
        <planeGeometry args={[schema.width, schema.height, 128, 128]} />
      </mesh>
      {selected && <FrameRect width={schema.width} height={schema.height} />}
    </group>
  );
}

// ── COMPOSITE member mesh (self-contained; no cross-store coupling) ──────────────
function MemberMesh({
  member, wornMaps, onSelect, compositeId,
}: {
  member: CompositeMember; wornMaps: Record<string, WornMaps>; onSelect: (id: string) => void; compositeId: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const params = { width: member.width, height: member.height, depth: member.depth, cornerRadius: member.cornerRadius, bevel: 0.04, radius: 0, segments: 18, cutouts: [] };
    return member.kind === 'cube' ? buildCubeGeometry(params) : buildPaneGeometry(params);
  }, [member.kind, member.width, member.height, member.depth, member.cornerRadius]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => buildMemberMaterial(member.material, wornMaps), [member.material, wornMaps]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.prismLibraryItem = true;
    g.userData.prismNodeId = member.memberId;
    g.userData.prismRole = member.role;
    g.userData.prismDormant = false;
  }, [member.memberId, member.role]);

  const labelVariant = member.material.startsWith('worn') ? 'bright' : 'engraved';
  return (
    <group ref={groupRef} position={[member.local.x, member.local.y, member.local.z]}>
      <mesh
        geometry={geometry}
        material={material}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(compositeId); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      />
      {LABELLED_ROLES.has(member.role) && (
        <CompositeText position={[0, 0, member.depth / 2 + 0.03]} fontSize={member.role === 'nav-title' ? 0.24 : 0.16} letterSpacing={0.04} variant={labelVariant}>
          {member.caption}
        </CompositeText>
      )}
    </group>
  );
}

function CompositeNode({
  schema, wornMaps, hubs, selected, onSelect,
}: {
  schema: CompositeSchema; wornMaps: Record<string, WornMaps>; hubs: import('@/components/editor/composite/composite-schema').LabHub[];
  selected: boolean; onSelect: (id: string) => void;
}) {
  const members = useMemo(() => compositeMembers(schema, hubs), [schema, hubs]);
  const r = schema.root;
  return (
    <group position={[r.x, r.y, r.z]}>
      {members.map((m) => (
        <MemberMesh key={m.memberId} member={m} wornMaps={wornMaps} onSelect={onSelect} compositeId={schema.compositeId} />
      ))}
      {selected && <FrameRect width={4.2} height={3.2} />}
    </group>
  );
}

// ── GALAXY (unbuilt) dormant seeds ───────────────────────────────────────────────
function DormantNode({
  instance, hubs, selected, onSelect,
}: {
  instance: LibraryInstance; hubs: import('@/components/editor/composite/composite-schema').LabHub[]; selected: boolean; onSelect: (id: string) => void;
}) {
  // seed positions: one per backing node (member for composites).
  const seeds = useMemo(() => {
    if (instance.kind === 'composite') {
      const r = instance.schema.root;
      return compositeMembers(instance.schema, hubs).map((m) => ({ id: m.memberId, pos: [r.x + m.local.x, r.y + m.local.y, r.z + m.local.z] as [number, number, number] }));
    }
    const t = instance.schema.transform;
    return [{ id: instance.schema.nodeId, pos: [t.x, t.y, t.z] as [number, number, number] }];
  }, [instance, hubs]);
  return (
    <>
      {seeds.map((s) => (
        <DormantSeed key={s.id} nodeId={s.id} pos={s.pos} selected={selected} onSelect={() => onSelect(instance.id)} />
      ))}
    </>
  );
}

function DormantSeed({ nodeId, pos, selected, onSelect }: { nodeId: string; pos: [number, number, number]; selected: boolean; onSelect: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: selected ? '#3a567a' : '#1d2c42', emissive: '#15314e', emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.2, transmission: 0.5, thickness: 0.5, ior: 1.4, clearcoat: 0.6 }), [selected]);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    const g = ref.current; if (!g) return;
    g.userData.prismLibraryItem = true; g.userData.prismNodeId = nodeId; g.userData.prismDormant = true;
  }, [nodeId]);
  useFrame((state) => { if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.3; });
  return (
    <group ref={ref} position={pos}>
      <mesh material={mat} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[0.42, 28, 20]} />
      </mesh>
    </group>
  );
}

// ── shared selection frame ───────────────────────────────────────────────────────
function FrameRect({ width, height }: { width: number; height: number }) {
  const obj = useMemo(() => {
    const w = width / 2 + 0.16, h = height / 2 + 0.16;
    const pts = [new THREE.Vector3(-w, -h, 0.25), new THREE.Vector3(w, -h, 0.25), new THREE.Vector3(w, h, 0.25), new THREE.Vector3(-w, h, 0.25), new THREE.Vector3(-w, -h, 0.25)];
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), SELECT_MAT);
  }, [width, height]);
  useEffect(() => () => obj.geometry.dispose(), [obj]);
  return <primitive object={obj} />;
}

// ── the public node ──────────────────────────────────────────────────────────────
export function LibraryCanvasNode({
  instance, wornMaps, matSets, hubs, viewMode, selected, onSelect,
}: {
  instance: LibraryInstance;
  wornMaps: Record<string, WornMaps>;
  matSets: Record<string, WornMaps>;
  hubs: import('@/components/editor/composite/composite-schema').LabHub[];
  viewMode: 'galaxy' | 'canvas';
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  if (viewMode === 'galaxy') return <DormantNode instance={instance} hubs={hubs} selected={selected} onSelect={onSelect} />;
  if (instance.kind === 'primitive') return <PrimitiveNode schema={instance.schema} wornMaps={wornMaps} matSets={matSets} selected={selected} onSelect={onSelect} />;
  if (instance.kind === 'fluid') return <FluidNode schema={instance.schema} selected={selected} onSelect={onSelect} />;
  return <CompositeNode schema={instance.schema} wornMaps={wornMaps} hubs={hubs} selected={selected} onSelect={onSelect} />;
}
