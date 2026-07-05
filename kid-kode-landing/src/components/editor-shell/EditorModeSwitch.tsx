'use client';

// PRISM EDITOR INTEGRATION — I-1: the GALAXY ↔ CANVAS ↔ PREVIEW tri-state switch.
//
// An in-engine glass segmented control (ZERO DOM) that moves the editor between
// the three states of the one continuous scene: galaxy (the unbuilt graph),
// canvas (the 3D editing surface), preview (the running app placeholder). Each
// segment is a real clickable glass tile with an engraved MSDF label and a
// worn-metal active indicator; clicking sets useEditorShellStore.view and the
// viewport changes. Built from the same approved vocabulary as the docks.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { buildPaneGeometry, buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { applyWornMaterial, useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { makeDockGlass } from './editor-shell-glass';
import { useEditorShellStore, type EditorShellView } from './use-editor-shell-store';

const SEGMENTS: { view: EditorShellView; label: string }[] = [
  { view: 'galaxy', label: 'GALAXY' },
  { view: 'canvas', label: 'CANVAS' },
  { view: 'preview-app', label: 'PREVIEW' },
];

const SEG_W = 2.5;
const SEG_H = 0.92;
const GAP = 0.12;
const SWITCH_Z = 1.35;
const SWITCH_Y = 4.55;

const TILE_GEO = buildPaneGeometry({
  width: SEG_W,
  height: SEG_H,
  depth: 0.34,
  cornerRadius: 0.18,
  bevel: 0.04,
  radius: 0.5,
  segments: 20,
  cutouts: [],
});
const BAR_GEO = buildCubeGeometry({
  width: SEG_W * 0.7,
  height: 0.08,
  depth: 0.1,
  cornerRadius: 0.03,
  bevel: 0.02,
  radius: 0.5,
  segments: 6,
  cutouts: [],
});

function Segment({
  view,
  label,
  x,
  active,
  maps,
  onPick,
}: {
  view: EditorShellView;
  label: string;
  x: number;
  active: boolean;
  maps: WornMaps | undefined;
  onPick: (v: EditorShellView) => void;
}) {
  const glass = useMemo(() => makeDockGlass(active ? 'clear' : 'smoke'), [active]);
  const bar = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial();
    if (maps) applyWornMaterial(m, maps);
    m.roughness = 1;
    m.clearcoat = 0.1;
    if (active) {
      m.color = new THREE.Color('#caa06a');
      m.emissive = new THREE.Color('#7a5a2a');
      m.emissiveIntensity = 0.55;
    } else {
      m.color = new THREE.Color('#5a6675');
      m.emissive = new THREE.Color('#0a0e14');
      m.emissiveIntensity = 0;
    }
    return m;
  }, [maps, active]);
  useEffect(() => () => { glass.dispose(); bar.dispose(); }, [glass, bar]);

  return (
    <group position={[x, 0, active ? 0.12 : 0]}>
      {/* invisible hit plane for reliable trusted-pointer clicks through glass */}
      <mesh
        position={[0, 0, 0.4]}
        onClick={(e) => { e.stopPropagation(); onPick(view); }}
        onPointerDown={(e) => { e.stopPropagation(); }}
        userData={{ prismEditorSwitch: view }}
      >
        <planeGeometry args={[SEG_W, SEG_H]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh geometry={TILE_GEO} material={glass} />
      <CompositeText position={[0, 0.05, 0.3]} fontSize={0.26} variant={active ? 'bright' : 'engraved'}>
        {label}
      </CompositeText>
      <mesh geometry={BAR_GEO} material={bar} position={[0, -0.3, 0.22]} />
    </group>
  );
}

export function EditorModeSwitch() {
  const view = useEditorShellStore((s) => s.view);
  const setView = useEditorShellStore((s) => s.setView);
  const wornMaps = useWornMaps();
  const gun = wornMaps['gunmetal'];
  const span = SEGMENTS.length * SEG_W + (SEGMENTS.length - 1) * GAP;
  const x0 = -span / 2 + SEG_W / 2;
  return (
    <group position={[0, SWITCH_Y, SWITCH_Z]}>
      {SEGMENTS.map((s, i) => (
        <Segment
          key={s.view}
          view={s.view}
          label={s.label}
          x={x0 + i * (SEG_W + GAP)}
          active={view === s.view}
          maps={gun}
          onPick={setView}
        />
      ))}
    </group>
  );
}
