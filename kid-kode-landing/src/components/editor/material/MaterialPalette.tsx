'use client';

// MaterialPalette — the in-canvas, ZERO-DOM material LIBRARY (spec §7). Browse by
// FAMILY: a row of worn-alloy family tabs (click to switch); the active family's
// materials fill a glass shelf below as live spinning preview swatches (§7.1).
// Clicking a swatch APPLIES that material to the displays. All chrome — no build
// nodes here.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { buildCubeGeometry, buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { EngravedText } from '@/components/editor/primitive/EngravedText';
import { ClickCatcher } from '@/components/editor/primitive/ClickCatcher';
import { MaterialSwatch } from './MaterialSwatch';
import { buildMaterialFromDef } from './material-build';
import { getMaterial, materialsByFamily, populatedFamilies } from './material-registry';
import { useMaterialStore } from './use-material-store';
import type { MaterialFamily } from './material-types';

// ── one worn-alloy family tab ────────────────────────────────────────────────────
const RING_MAT = new THREE.MeshBasicMaterial({ color: '#9fd8ff', toneMapped: false });
const FAMILY_TINT: Record<string, string> = {
  Metals: '#c9a85e', Stones: '#9aa0a8', Glass: '#a9d6df', Gems: '#c41e45',
  Woods: '#8a5a33', Ceramics: '#bcd6c4', Fabrics: '#9c1f30', Exotic: '#b59cff', Generated: '#7fd0ff',
};

function FamilyTab({
  family, maps, active, position, onPick,
}: {
  family: MaterialFamily; maps: WornMaps; active: boolean; position: [number, number, number]; onPick: (f: MaterialFamily) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const size = 0.52;
  const geo = useMemo(() => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: 0.09, bevel: 0.04, radius: 0, segments: 4, cutouts: [] }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial();
    const def = getMaterial('metal.worn-gunmetal');
    const built = def ? buildMaterialFromDef(def, { [`worn:gunmetal`]: maps }) : m;
    built.color = new THREE.Color(FAMILY_TINT[family] ?? '#ffffff');
    return built;
  }, [maps, family]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => { const mesh = meshRef.current; if (mesh && active) mesh.rotation.y += 0.01; });
  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        geometry={geo}
        material={material}
        castShadow
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(family); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      />
      {active && (
        <mesh material={RING_MAT} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[size * 0.95, 0.013, 8, 32]} />
        </mesh>
      )}
      <EngravedText position={[0, -size * 0.86, 0.02]} fontSize={0.11} letterSpacing={0.04} maxWidth={2.0}>
        {family.toUpperCase()}
      </EngravedText>
    </group>
  );
}

// ── the glass library shelf behind the active swatches ──────────────────────────
function Shelf({ y, width, height }: { y: number; width: number; height: number }) {
  const geo = useMemo(() => buildPaneGeometry({ width, height, depth: 0.28, cornerRadius: 0.28, bevel: 0.05, radius: 0, segments: 20, cutouts: [] }), [width, height]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={[0, y, -0.5]} raycast={() => null}>
      <meshPhysicalMaterial transmission={1} thickness={0.55} ior={1.5} roughness={0.07} metalness={0} clearcoat={1} clearcoatRoughness={0.2} attenuationColor={'#9fb0c4'} attenuationDistance={0.7} envMapIntensity={1.0} specularIntensity={0.6} transparent />
    </mesh>
  );
}

// layout: rows of swatches centered on x.
function gridPositions(count: number, perRow: number, y0: number, rowStep: number, colStep: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const colOffset = (inRow - 1) / 2;
    const col = i - row * perRow;
    out.push([(col - colOffset) * colStep, y0 - row * rowStep, 0.1]);
  }
  return out;
}

export function MaterialPalette({ mapSets }: { mapSets: Record<string, WornMaps> }) {
  const activeFamily = useMaterialStore((s) => s.activeFamily);
  const selectedMaterialId = useMaterialStore((s) => s.selectedMaterialId);
  const setActiveFamily = useMaterialStore((s) => s.setActiveFamily);
  const setMaterial = useMaterialStore((s) => s.setMaterial);

  const families = useMemo(() => populatedFamilies(), []);
  const entries = useMemo(() => materialsByFamily(activeFamily), [activeFamily]);

  // family tab row (y = 0.5), spread across the stage.
  const tabSpan = 15.2;
  const tabStep = families.length > 1 ? tabSpan / (families.length - 1) : 0;
  const tabY = 0.6;

  // active-family swatch grid (below the tabs).
  const perRow = Math.min(6, Math.max(1, entries.length));
  const positions = gridPositions(entries.length, perRow, -1.6, 1.85, 1.62);
  const rows = Math.ceil(entries.length / perRow);
  const shelfH = 0.6 + rows * 1.85;
  const shelfY = -1.6 - ((rows - 1) * 1.85) / 2 + 0.15;
  const wornGun = mapSets['worn:gunmetal'];

  return (
    <group>
      {/* family tabs */}
      <EngravedText position={[0, tabY + 0.95, 0.02]} fontSize={0.16} letterSpacing={0.22}>
        MATERIAL LIBRARY
      </EngravedText>
      {wornGun && families.map((f, i) => (
        <FamilyTab
          key={f}
          family={f}
          maps={wornGun}
          active={f === activeFamily}
          position={[-tabSpan / 2 + i * tabStep, tabY, 0.1]}
          onPick={setActiveFamily}
        />
      ))}

      {/* active family shelf + swatches */}
      <Shelf y={shelfY} width={Math.min(16, perRow * 1.7 + 1.0)} height={shelfH} />
      <ClickCatcher width={Math.min(16, perRow * 1.7 + 1.0)} height={shelfH} position={[0, shelfY, -0.34]} />
      {entries.map((def, i) => (
        <MaterialSwatch
          key={def.id}
          def={def}
          mapSets={mapSets}
          active={def.id === selectedMaterialId}
          position={positions[i]}
          onPick={setMaterial}
        />
      ))}
    </group>
  );
}
