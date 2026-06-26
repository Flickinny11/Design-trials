'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — THE INSPECTOR (spec §7.3).
//
// Select a canvas instance → this in-canvas glass panel exposes its schema. Wave-1
// surfaces the schema readout + REMOVE + SAVE-TO-LIBRARY; wave-2 adds the live
// faders (geometry/material params) + the material swatch picker. The panel glass is
// the P-1 Pane primitive (buildPaneGeometry) — dogfood by construction. A ClickCatcher
// behind the controls keeps panel clicks from falling through to the backdrop.

import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';
import { buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeChip } from '@/components/editor/composite/CompositeChip';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useLibraryStore, type LibraryInstance, CHROME_PANE_ID } from './use-library-store';

const PANEL_W = 3.8;
const PANEL_H = 9.2;

const PANEL_MAT = new THREE.MeshPhysicalMaterial({
  transmission: 1, thickness: 0.7, ior: 1.5, roughness: 0.06, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0.18, attenuationColor: new THREE.Color('#dbe8f2'),
  attenuationDistance: 1.7, envMapIntensity: 1.05, specularIntensity: 0.7, transparent: true,
});
const CATCHER_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

function schemaLines(inst: LibraryInstance): string[] {
  if (inst.kind === 'primitive') {
    const p = inst.schema.params;
    const base = [`KIND  ${inst.schema.kind.toUpperCase()}`];
    if (inst.schema.kind === 'sphere') base.push(`RADIUS  ${p.radius.toFixed(2)}`, `SEGMENTS  ${Math.round(p.segments)}`);
    else base.push(`W ${p.width.toFixed(2)}  H ${p.height.toFixed(2)}`, `D ${p.depth.toFixed(2)}  R ${p.cornerRadius.toFixed(2)}`);
    if (inst.schema.material.materialId) base.push(`MATERIAL  ${inst.schema.material.materialId}`);
    else base.push(`MATERIAL  ${inst.schema.material.kind}`);
    return base;
  }
  if (inst.kind === 'fluid') {
    const p = inst.schema.params;
    return [`KIND  ${inst.schema.kind.toUpperCase()}`, `VISCOSITY  ${p.viscosity.toFixed(2)}`, `FLOW  ${p.flowSpeed.toFixed(2)}`, `IOR  ${p.ior.toFixed(2)}`, `THICK  ${p.thickness.toFixed(2)}`];
  }
  return [`TEMPLATE  ${inst.schema.templateId.toUpperCase()}`, `SUBGRAPH`, `MEMBERS  ${inst.schema.staticMembers.length || 'derived'}`];
}

export function LibraryInspector({ position }: { position: [number, number, number]; matSets: Record<string, WornMaps> }) {
  const wornMaps = useWornMaps();
  const selectedId = useLibraryStore((s) => s.selectedId);
  const inst = useLibraryStore((s) => s.instances.find((i) => i.id === s.selectedId));
  const remove = useLibraryStore((s) => s.remove);
  const saveSelected = useLibraryStore((s) => s.saveSelectedAsTemplate);

  const panelGeo = useMemo(() => buildPaneGeometry({ width: PANEL_W, height: PANEL_H, depth: 0.3, cornerRadius: 0.3, bevel: 0.05, radius: 0, segments: 18, cutouts: [] }), []);

  if (!inst) return null;
  const lines = schemaLines(inst);
  const caption = inst.kind === 'composite' ? inst.schema.caption : inst.schema.caption;
  const isChrome = inst.id === CHROME_PANE_ID;

  return (
    <group position={position}>
      <mesh geometry={panelGeo} material={PANEL_MAT} />
      <mesh material={CATCHER_MAT} position={[0, 0, -0.1]} onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()}>
        <planeGeometry args={[PANEL_W, PANEL_H]} />
      </mesh>

      <CompositeText position={[0, PANEL_H / 2 - 0.7, 0.18]} fontSize={0.26} letterSpacing={0.05} variant="bright">
        {caption.toUpperCase()}
      </CompositeText>
      <CompositeText position={[0, PANEL_H / 2 - 1.2, 0.18]} fontSize={0.12} letterSpacing={0.18} variant="engraved">
        INSPECTOR · SCHEMA
      </CompositeText>

      {lines.map((ln, i) => (
        <CompositeText key={i} position={[-PANEL_W / 2 + 0.4, PANEL_H / 2 - 2.1 - i * 0.6, 0.18]} fontSize={0.16} letterSpacing={0.02} anchorX="left" variant="engraved">
          {ln}
        </CompositeText>
      ))}

      {/* actions */}
      <group position={[0, -PANEL_H / 2 + 1.1, 0.2]}>
        <CompositeChip maps={wornMaps.emerald ?? Object.values(wornMaps)[0]} position={[-0.95, 0, 0]} size={0.5} onClick={() => saveSelected()} label="SAVE" labelVariant="bright" />
        {!isChrome && (
          <CompositeChip maps={wornMaps.oxblood ?? Object.values(wornMaps)[0]} position={[0.95, 0, 0]} size={0.5} onClick={() => remove(inst.id)} label="REMOVE" labelVariant="bright" />
        )}
      </group>
    </group>
  );
}
