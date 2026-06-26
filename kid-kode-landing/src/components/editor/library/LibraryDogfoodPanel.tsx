'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — DOGFOOD: the NODE-EDITOR chrome panel (spec §7.4).
//
// "Enough = not enough" made structural: this chrome panel's glass pane is LITERALLY
// the P-1 Pane primitive — the SAME buildPaneGeometry + glass material a customer
// places, backed by a real registered node (id CHROME_PANE_ID). On top of it sits a
// mini node-graph built from MORE primitives (worn-alloy cube "nodes" + glass
// connectors + MSDF labels). Clicking the panel selects the chrome pane NODE, so the
// Inspector shows the chrome itself is a node (INV-0.1 — even the chrome is a node).

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { type ThreeEvent } from '@react-three/fiber';
import { applyWornMaterial, useWornMaps } from '@/components/editor/chassis/materials';
import { buildCubeGeometry, buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useLibraryStore, CHROME_PANE_ID } from './use-library-store';

const PANE_MAT = new THREE.MeshPhysicalMaterial({
  transmission: 1, thickness: 0.7, ior: 1.5, roughness: 0.05, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0.17, attenuationColor: new THREE.Color('#dbe8f2'),
  attenuationDistance: 1.8, envMapIntensity: 1.05, specularIntensity: 0.7, transparent: true,
});
const SELECT_MAT = new THREE.LineBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.92, toneMapped: false });
const WIRE_MAT = new THREE.MeshPhysicalMaterial({
  transmission: 0.9, thickness: 0.3, ior: 1.45, roughness: 0.08, metalness: 0, clearcoat: 1,
  attenuationColor: new THREE.Color('#9fe9ff'), attenuationDistance: 0.8, emissive: new THREE.Color('#1d3346'), emissiveIntensity: 0.4, transparent: true,
});

const MINI_NODES = [
  { label: 'INPUT', x: -2.3, key: 'sapphire' },
  { label: 'TRANSFORM', x: 0, key: 'emerald' },
  { label: 'OUTPUT', x: 2.3, key: 'bronze' },
];

function MiniNode({ x, label, maps }: { x: number; label: string; maps: import('@/components/editor/chassis/materials').WornMaps }) {
  const geo = useMemo(() => buildCubeGeometry({ width: 0.52, height: 0.52, depth: 0.4, cornerRadius: 0.09, bevel: 0.03, radius: 0, segments: 5, cutouts: [] }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps); return m; }, [maps]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group position={[x, 0.15, 0.32]}>
      <mesh geometry={geo} material={mat} />
      <CompositeText position={[0, -0.5, 0.05]} fontSize={0.12} letterSpacing={0.02} variant="bright">{label}</CompositeText>
    </group>
  );
}

export function LibraryDogfoodPanel() {
  const wornMaps = useWornMaps();
  const inst = useLibraryStore((s) => s.instances.find((i) => i.id === CHROME_PANE_ID));
  const viewMode = useLibraryStore((s) => s.viewMode);
  const selected = useLibraryStore((s) => s.selectedId === CHROME_PANE_ID);
  const select = useLibraryStore((s) => s.select);
  const groupRef = useRef<THREE.Group>(null);

  const paneGeo = useMemo(() => (inst && inst.kind === 'primitive' ? buildPaneGeometry(inst.schema.params) : null), [inst]);
  useEffect(() => () => paneGeo?.dispose(), [paneGeo]);
  const edges = useMemo(() => (selected && paneGeo ? new THREE.EdgesGeometry(paneGeo) : null), [selected, paneGeo]);
  useEffect(() => () => edges?.dispose(), [edges]);

  // wire connectors between the mini nodes (built from thin glass bars — primitives).
  const wireGeo = useMemo(() => new THREE.BoxGeometry(1.78, 0.05, 0.05), []);
  useEffect(() => () => wireGeo.dispose(), [wireGeo]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.prismLibraryItem = true;
    g.userData.prismNodeId = CHROME_PANE_ID;
    g.userData.prismKind = 'pane';
    g.userData.prismDormant = viewMode === 'galaxy';
  }, [viewMode]);

  if (!inst || inst.kind !== 'primitive' || !paneGeo) return null;
  const t = inst.schema.transform;

  return (
    <group ref={groupRef} position={[t.x, t.y, t.z]}>
      {/* the chrome glass pane — the SAME Pane primitive a customer places. */}
      <mesh
        geometry={paneGeo}
        material={PANE_MAT}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(CHROME_PANE_ID); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      />
      {edges && <lineSegments geometry={edges} material={SELECT_MAT} renderOrder={6} />}

      {/* title — names the dogfood explicitly. */}
      <CompositeText position={[0, 0.86, 0.2]} fontSize={0.2} letterSpacing={0.06} variant="bright">NODE EDITOR</CompositeText>
      <CompositeText position={[0, 0.56, 0.2]} fontSize={0.1} letterSpacing={0.04} variant="engraved">
        THIS GLASS PANE IS A PANE PRIMITIVE · NODE
      </CompositeText>

      {/* the mini node-graph, built from primitives (worn cubes + glass wires). */}
      <mesh geometry={wireGeo} material={WIRE_MAT} position={[-1.15, 0.15, 0.3]} />
      <mesh geometry={wireGeo} material={WIRE_MAT} position={[1.15, 0.15, 0.3]} />
      {MINI_NODES.map((n) => (
        <MiniNode key={n.label} x={n.x} label={n.label} maps={wornMaps[n.key] ?? Object.values(wornMaps)[0]} />
      ))}
    </group>
  );
}
