'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — THE IN-CANVAS LIBRARY PALETTE (spec §7, NO DOM).
//
// A 3D-native, browsable + searchable shelf. A worn-alloy instrument backing carries
// the section tabs (Primitives · Composites · Materials · Saved), the search bar, the
// materials family sub-tabs, and a grid of LIVE 3D preview tiles. Selecting a section
// / family / search query re-filters the grid; clicking a tile instantiates it as a
// node on the canvas (wave-1) — wave-2 adds the pointer drag-to-place. Every control
// is the founder-approved chassis vocabulary (worn cubes, milled glass, MSDF labels).

import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';
import { buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeChip } from '@/components/editor/composite/CompositeChip';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import type { LabHub } from '@/components/editor/composite/composite-schema';
import { useLibraryStore } from './use-library-store';
import { LIBRARY_SECTIONS, SECTION_LABEL, materialGroups, filterEntries, type LibrarySection } from './library-catalog';
import { LibraryTile } from './LibraryTile';
import { LibrarySearchBar } from './LibrarySearchBar';

const SHELF_W = 6.0;
const SHELF_H = 12.6;
const COLS = 3;
const COL_X = [-1.7, 0, 1.7];
const ROW_TOP = 1.4;
const ROW_PITCH = 1.95;
const MAX_TILES = 18;

const SECTION_TINT: Record<LibrarySection, string> = {
  primitives: '#7fd6c0',
  composites: '#9fb4ff',
  materials: '#ffce8a',
  saved: '#ff9fb4',
};

const SHELF_MAT = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#10151f'), metalness: 0.82, roughness: 0.42,
  clearcoat: 0.4, clearcoatRoughness: 0.5, envMapIntensity: 0.85,
});
const SHELF_RIM_MAT = new THREE.LineBasicMaterial({ color: '#5a6f9c', toneMapped: false, transparent: true, opacity: 0.5 });

function ShelfBacking() {
  // a clean dark brushed-metal instrument panel (the chassis worn-alloy bar, smoothed
  // to read premium at shelf scale) with a thin bright rim — tiles pop against it.
  const geo = useMemo(() => buildPaneGeometry({ width: SHELF_W, height: SHELF_H, depth: 0.34, cornerRadius: 0.36, bevel: 0.07, radius: 0, segments: 24, cutouts: [] }), []);
  const rimGeo = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  return (
    <group position={[0, 0, -0.55]}>
      <mesh geometry={geo} material={SHELF_MAT} />
      <lineSegments geometry={rimGeo} material={SHELF_RIM_MAT} renderOrder={5} />
    </group>
  );
}

export function LibraryPalette({ position, matSets, hubs }: { position: [number, number, number]; matSets: Record<string, WornMaps>; hubs: LabHub[] }) {
  const wornMaps = useWornMaps();
  const section = useLibraryStore((s) => s.section);
  const family = useLibraryStore((s) => s.family);
  const query = useLibraryStore((s) => s.query);
  const setSection = useLibraryStore((s) => s.setSection);
  const setFamily = useLibraryStore((s) => s.setFamily);
  const instantiate = useLibraryStore((s) => s.instantiate);
  const beginDrag = useLibraryStore((s) => s.beginDrag);
  const catalog = useLibraryStore((s) => s.catalog);
  const rev = useLibraryStore((s) => s.rev);

  const groups = useMemo(() => materialGroups(), []);

  // resolve the filtered, paged entries for the active section/family/search.
  const tiles = useMemo(() => {
    let entries = catalog().filter((e) => e.section === section);
    if (section === 'materials') entries = entries.filter((e) => e.group === family);
    entries = filterEntries(entries, query);
    return entries.slice(0, MAX_TILES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, family, query, rev]);

  const showFamilies = section === 'materials';
  const gridTop = showFamilies ? ROW_TOP - 1.5 : ROW_TOP;

  return (
    <group position={position}>
      <ShelfBacking />

      {/* header */}
      <CompositeText position={[0, SHELF_H / 2 - 0.7, 0.25]} fontSize={0.34} letterSpacing={0.14} variant="bright">
        LIBRARY
      </CompositeText>

      {/* SECTION TABS */}
      <group position={[0, SHELF_H / 2 - 1.7, 0.3]}>
        {LIBRARY_SECTIONS.map((s, i) => {
          const x = -2.25 + i * 1.5;
          return (
            <group key={s}>
              <CompositeChip
                maps={wornMaps.sapphire ?? Object.values(wornMaps)[0]}
                position={[x, 0, 0]}
                size={0.56}
                tint={section === s ? SECTION_TINT[s] : undefined}
                active={section === s}
                onClick={() => setSection(s)}
              />
              <CompositeText position={[x, -0.56, 0]} fontSize={0.1} letterSpacing={0.02} variant="bright">
                {SECTION_LABEL[s]}
              </CompositeText>
            </group>
          );
        })}
      </group>

      {/* SEARCH — focus + window-keystroke capture (listener lives in the scene). */}
      <LibrarySearchBar position={[0, SHELF_H / 2 - 3.1, 0.3]} />

      {/* FAMILY SUB-TABS (materials only) */}
      {showFamilies && (
        <group position={[0, SHELF_H / 2 - 4.2, 0.3]}>
          {groups.map((g, i) => {
            const col = i % 5;
            const row = Math.floor(i / 5);
            const x = -2.4 + col * 1.2;
            const y = -row * 0.78;
            return (
              <group key={g} position={[x, y, 0]} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setFamily(g); }}>
                <CompositeText position={[0, 0, 0]} fontSize={0.115} letterSpacing={0.02} variant={family === g ? 'bright' : 'engraved'}>
                  {g.toUpperCase()}
                </CompositeText>
                {family === g && <FamilyUnderline />}
              </group>
            );
          })}
        </group>
      )}

      {/* TILE GRID */}
      <group position={[0, gridTop, 0.4]}>
        {tiles.map((entry, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          return (
            <LibraryTile
              key={entry.id}
              entry={entry}
              position={[COL_X[col], -row * ROW_PITCH, 0]}
              wornMaps={wornMaps}
              matSets={matSets}
              hubs={hubs}
              onActivate={(en) => instantiate(en)}
              onPressStart={(en, e) => beginDrag(en.id, { x: e.point.x, y: e.point.y, z: e.point.z })}
            />
          );
        })}
        {tiles.length === 0 && (
          <CompositeText position={[0, -0.4, 0]} fontSize={0.16} letterSpacing={0.05} variant="engraved">
            NO MATCHES
          </CompositeText>
        )}
      </group>
    </group>
  );
}

const UL_MAT = new THREE.MeshBasicMaterial({ color: '#ffce8a', toneMapped: false });
function FamilyUnderline() {
  return (
    <mesh material={UL_MAT} position={[0, -0.12, 0]}>
      <planeGeometry args={[0.9, 0.022]} />
    </mesh>
  );
}
