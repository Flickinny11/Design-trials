'use client';

// DropdownNode — the nav's dropdown MENU member (spec §4.1) + its bound menu items.
//
// A "Menu ▾" trigger on the bar toggles the dropdown; the panel EXPANDS top-anchored
// (spec §4 / §3.3). Wave-1 renders the panel as the approved transmission glass; the
// expand timeline (dropdownPhase 0→1: thin closed slab → full open panel) + the
// per-item reveal are already wired here so Wave-3 only swaps the panel surface for
// the P-3 liquid-glass FluidSurface (the "go liquid" flow). The menu items are the
// SAME bound view as the tabs (one per hub) — auto-populated, never hardcoded.
//
// Each rendered piece is TAGGED with Node-Law userData so the authorship probe sees
// the dropdown + menu items as backing nodes.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { FluidFieldSim } from '@/components/editor/fluid/fluid-sim';
import { buildFluidSurfaceMaterial } from '@/components/editor/fluid/fluid-material';
import { CompositeText } from './CompositeText';
import { buildMemberMaterial } from './composite-materials';
import { useCompositeStore } from './use-composite-store';
import { NAV, type CompositeMember } from './composite-schema';

const smoothstep = (e: number) => e * e * (3 - 2 * e);

// DropdownLiquidPanel — the dropdown surface IS the P-3 liquid glass (spec §3.3 /
// §4): a GPU fluid field (FluidFieldSim) drives the transmission-glass normal +
// relief so the panel FLOWS + refracts as it opens. The dropdown's expand phase IS
// the liquid-glass timeline (liquidPhase 0 = settled slab → 1 = fully flowing) — the
// canonical "any glass element can go liquid" instance. The group scale (in
// DropdownNode) does the top-anchored size reveal; this drives the flow.
const LIQUID_PARAMS = {
  viscosity: 0.72,
  surfaceTension: 0.6,
  flowSpeed: 0.7,
  flowDirection: Math.PI * 0.5,
  patternWeights: [0, 1, 0, 0] as [number, number, number, number],
  turbulence: 0.34,
  damping: 0.985,
  reactsToInteraction: 0,
};

function DropdownLiquidPanel({ width, height, compositeId, onSelect }: { width: number; height: number; compositeId: string; onSelect: (id: string) => void }) {
  const gl = useThree((s) => s.gl);
  const { sim, surf } = useMemo(() => {
    const s = new FluidFieldSim(128);
    const m = buildFluidSurfaceMaterial(s.fieldTexNode, s.size);
    return { sim: s, surf: m };
  }, []);
  useEffect(() => {
    surf.applyGlass({ ior: 1.45, thickness: 1.4, tint: '#bfe3ea', opacity: 1 });
    return () => { sim.dispose(); surf.material.dispose(); };
  }, [sim, surf]);

  useFrame((state, dt) => {
    const st = useCompositeStore.getState();
    const phase = st.expandedCompositeId === compositeId ? st.dropdownPhase : 0;
    if (phase <= 0.005) return; // sim idles while the dropdown is closed (perf)
    sim.setParams({ ...LIQUID_PARAMS, liquidPhase: phase });
    surf.uniforms.liquidPhase.value = phase;
    sim.step(gl as unknown as THREE.WebGLRenderer, Math.min(dt, 1 / 30), state.clock.elapsedTime);
  });

  return (
    <mesh material={surf.material} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(compositeId); }}>
      <planeGeometry args={[width, height, 128, 128]} />
    </mesh>
  );
}

function MenuItem({ member, anchor, compositeId, revealRef, index }: { member: CompositeMember; anchor: { x: number; y: number; z: number }; compositeId: string; revealRef: React.MutableRefObject<number[]>; index: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const geo = useMemo(
    () => buildPaneGeometry({ width: member.width, height: member.height, depth: member.depth, cornerRadius: member.cornerRadius, bevel: 0.02, radius: 0, segments: 10, cutouts: [] }),
    [member.width, member.height, member.depth, member.cornerRadius],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ transmission: 0.85, thickness: 0.4, ior: 1.48, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.2, attenuationColor: new THREE.Color(member.manual ? '#a9d6ff' : '#cfe0ee'), attenuationDistance: 1.6, envMapIntensity: 1, transparent: true });
    return m;
  }, [member.manual]);
  useEffect(() => () => mat.dispose(), [mat]);

  // offset of this menu item relative to the dropdown anchor group.
  const local: [number, number, number] = [member.local.x - anchor.x, member.local.y - anchor.y, member.local.z - anchor.z];

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.prismCompositeMember = true;
    g.userData.prismNodeId = member.memberId;
    g.userData.prismRole = member.role;
    g.userData.prismCompositeId = compositeId;
    g.userData.prismDormant = false;
  }, [member.memberId, member.role, compositeId]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const reveal = revealRef.current[index] ?? 0;
    mat.opacity = THREE.MathUtils.clamp(reveal, 0, 1);
    g.visible = reveal > 0.02;
  });

  return (
    <group ref={groupRef} position={local}>
      <mesh geometry={geo} material={mat} />
      <CompositeText position={[0, 0, member.depth / 2 + 0.02]} fontSize={0.15} letterSpacing={0.03} variant="engraved">
        {member.caption}
      </CompositeText>
    </group>
  );
}

export interface DropdownNodeProps {
  dropdown: CompositeMember;
  menuItems: CompositeMember[];
  compositeId: string;
  maps: Record<string, WornMaps>;
  selected: boolean;
  onSelect: (compositeId: string) => void;
}

export function DropdownNode({ dropdown, menuItems, compositeId, maps, selected, onSelect }: DropdownNodeProps) {
  const panelRef = useRef<THREE.Group>(null);
  const toggleDropdown = useCompositeStore((s) => s.toggleDropdown);
  const itemRevealRef = useRef<number[]>([]);

  // a small worn-alloy trigger chip on the bar (the "Menu ▾" affordance).
  const triggerGeo = useMemo(() => buildPaneGeometry({ width: NAV.menuW, height: NAV.tabH, depth: NAV.tabDepth, cornerRadius: 0.14, bevel: 0.03, radius: 0, segments: 12, cutouts: [] }), []);
  useEffect(() => () => triggerGeo.dispose(), [triggerGeo]);
  const triggerMat = useMemo(() => buildMemberMaterial('worn-gunmetal', maps), [maps]);
  useEffect(() => () => triggerMat.dispose(), [triggerMat]);

  // tag the dropdown panel as a backing node (Node Law).
  useEffect(() => {
    const g = panelRef.current;
    if (!g) return;
    g.userData.prismCompositeMember = true;
    g.userData.prismNodeId = dropdown.memberId;
    g.userData.prismRole = dropdown.role;
    g.userData.prismCompositeId = compositeId;
    g.userData.prismDormant = false;
  }, [dropdown.memberId, dropdown.role, compositeId]);

  const anchor = dropdown.local;

  // EXPAND reveal — read the phase LIVE (the timeline driver mutates it each frame).
  useFrame(() => {
    const st = useCompositeStore.getState();
    const phase = st.expandedCompositeId === compositeId ? st.dropdownPhase : 0;
    const e = smoothstep(THREE.MathUtils.clamp(phase, 0, 1));
    const g = panelRef.current;
    if (g) {
      const sy = 0.06 + 0.94 * e;
      g.scale.set(0.82 + 0.18 * e, sy, 1);
      // top-anchored grow-down: keep the top edge fixed at the dropdown anchor top.
      g.position.y = anchor.y + (dropdown.height / 2) * (1 - sy);
      g.visible = phase > 0.01;
    }
    // staggered per-item reveal as the panel opens.
    const n = menuItems.length;
    itemRevealRef.current = menuItems.map((_, i) => {
      const start = 0.25 + (i / Math.max(1, n)) * 0.6;
      return THREE.MathUtils.clamp((phase - start) / 0.25, 0, 1);
    });
  });

  return (
    <group>
      {/* trigger ─ "Menu ▾" on the bar, above the dropdown anchor column */}
      <group position={[anchor.x, 0, NAV.tabZ]}>
        <mesh
          geometry={triggerGeo}
          material={triggerMat}
          onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); toggleDropdown(compositeId); }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
        />
        <CompositeText position={[0, 0, NAV.tabDepth / 2 + 0.03]} fontSize={0.16} letterSpacing={0.04} variant="bright">
          Menu
        </CompositeText>
      </group>

      {/* dropdown panel (P-3 liquid glass) + bound menu items (revealed on expand) */}
      <group ref={panelRef} position={[anchor.x, anchor.y, anchor.z]} visible={false}>
        <DropdownLiquidPanel width={dropdown.width} height={dropdown.height} compositeId={compositeId} onSelect={onSelect} />
        {menuItems.map((m, i) => (
          <MenuItem key={m.memberId} member={m} anchor={anchor} compositeId={compositeId} revealRef={itemRevealRef} index={i} />
        ))}
        {selected && <DropdownEdge width={dropdown.width} height={dropdown.height} />}
      </group>
    </group>
  );
}

const EDGE_MAT = new THREE.LineBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.85, toneMapped: false });
function DropdownEdge({ width, height }: { width: number; height: number }) {
  const obj = useMemo(() => {
    const w = width / 2 + 0.06, h = height / 2 + 0.06;
    const pts = [new THREE.Vector3(-w, -h, 0.04), new THREE.Vector3(w, -h, 0.04), new THREE.Vector3(w, h, 0.04), new THREE.Vector3(-w, h, 0.04), new THREE.Vector3(-w, -h, 0.04)];
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), EDGE_MAT);
  }, [width, height]);
  useEffect(() => () => obj.geometry.dispose(), [obj]);
  return <primitive object={obj} />;
}
