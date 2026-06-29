'use client';

// PRISM WORKSPACE COMPLETION — W-2: the node-editor SECTION sub-tabs.
//
// A compact in-engine glass segmented control docked at the top of the NODE
// editor surface, switching the per-node editor between its four sections:
//   PURPOSE      — the W-1 schema/behavior/caption surface (the node's meaning);
//   FUNCTIONS    — branded action tiles attached to the node (D1/D2);
//   INTEGRATIONS — connected platforms (one-click auth, reference-only, D3);
//   DATA         — the node's data/backend model + persistence (C3).
// Same approved vocabulary as the GALAXY/CANVAS/PREVIEW tri-state switch (glass
// tile + engraved MSDF label + worn-metal active bar + an invisible hit-plane
// for reliable trusted-pointer clicks). ZERO DOM. Editor CHROME — not a graph
// node. Drives useCapabilityStore.section.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { buildPaneGeometry, buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { applyWornMaterial, useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { makeDockGlass } from './editor-shell-glass';
import { useCapabilityStore, type NodeEditorSection } from './use-capability-store';

const SECTIONS: { section: NodeEditorSection; label: string; tint: string }[] = [
  { section: 'purpose', label: 'PURPOSE', tint: '#9fd0ff' },
  { section: 'functions', label: 'FUNCTIONS', tint: '#caa06a' },
  { section: 'integrations', label: 'INTEGRATE', tint: '#9fe7c4' },
  { section: 'data', label: 'DATA', tint: '#d6b8ff' },
];

const SEG_W = 0.58;
const SEG_H = 0.3;
const GAP = 0.06;
const LABEL_SIZE = 0.054;

const TILE_GEO = buildPaneGeometry({
  width: SEG_W,
  height: SEG_H,
  depth: 0.14,
  cornerRadius: 0.07,
  bevel: 0.02,
  radius: 0.5,
  segments: 12,
  cutouts: [],
});
const BAR_GEO = buildCubeGeometry({
  width: SEG_W * 0.66,
  height: 0.035,
  depth: 0.05,
  cornerRadius: 0.015,
  bevel: 0.01,
  radius: 0.5,
  segments: 4,
  cutouts: [],
});

function SectionTab({
  section,
  label,
  tint,
  x,
  active,
  maps,
}: {
  section: NodeEditorSection;
  label: string;
  tint: string;
  x: number;
  active: boolean;
  maps: WornMaps | undefined;
}) {
  const glass = useMemo(() => makeDockGlass(active ? 'clear' : 'smoke'), [active]);
  const bar = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial();
    if (maps) applyWornMaterial(m, maps);
    m.roughness = 1;
    m.clearcoat = 0.1;
    if (active) {
      m.color = new THREE.Color(tint);
      m.emissive = new THREE.Color(tint);
      m.emissiveIntensity = 0.5;
    } else {
      m.color = new THREE.Color('#5a6675');
      m.emissive = new THREE.Color('#0a0e14');
      m.emissiveIntensity = 0;
    }
    return m;
  }, [maps, active, tint]);
  useEffect(() => () => { glass.dispose(); bar.dispose(); }, [glass, bar]);

  return (
    <group position={[x, 0, active ? 0.06 : 0]}>
      {/* invisible hit plane — reliable trusted-pointer clicks through the glass */}
      <mesh
        position={[0, 0, 0.22]}
        onClick={(e) => { e.stopPropagation(); useCapabilityStore.getState().setSection(section); }}
        onPointerDown={(e) => { e.stopPropagation(); }}
        userData={{ prismNodeSection: section }}
      >
        <planeGeometry args={[SEG_W, SEG_H]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh geometry={TILE_GEO} material={glass} />
      <CompositeText position={[0, 0.025, 0.14]} fontSize={LABEL_SIZE} variant={active ? 'bright' : 'engraved'}>
        {label}
      </CompositeText>
      <mesh geometry={BAR_GEO} material={bar} position={[0, -0.105, 0.1]} />
    </group>
  );
}

/** The 4-way section sub-tabs. `position` is the dock-relative anchor (placed by
 *  EditorInspectorDock just under the NODE/VISUAL switch). */
export function EditorNodeTabs({ position }: { position: [number, number, number] }) {
  const section = useCapabilityStore((s) => s.section);
  const wornMaps = useWornMaps();
  const gun = wornMaps['gunmetal'];
  const span = SECTIONS.length * SEG_W + (SECTIONS.length - 1) * GAP;
  const x0 = -span / 2 + SEG_W / 2;
  return (
    <group position={position}>
      {SECTIONS.map((s, i) => (
        <SectionTab
          key={s.section}
          section={s.section}
          label={s.label}
          tint={s.tint}
          x={x0 + i * (SEG_W + GAP)}
          active={section === s.section}
          maps={gun}
        />
      ))}
    </group>
  );
}
