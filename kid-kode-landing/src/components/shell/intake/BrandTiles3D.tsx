'use client';

// PRISM SHELL — BRAND TILES (SHELL W2, DL15 + DL8)
//
// Integration + deploy tiles: real 3D brand marks (BrandMark3D, DL15) on ONE
// shared canvas (DL8 rider). Same ortho + CSS-grid-matched layout as
// CardOptions3D; DOM buttons carry interaction, label, hint, and selection.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from '../builder/use-reduced-motion';
import { BrandMark } from './BrandMark3D';

export interface BrandTile {
  id: string;
  mark: string;
  label: string;
  hint?: string;
}

function columnsFor(count: number): number {
  if (count <= 2) return count;
  if (count <= 4) return 2;
  return 3;
}

function TileCell({
  index,
  cols,
  rows,
  selected,
  hovered,
  reduced,
  children,
}: {
  index: number;
  cols: number;
  rows: number;
  selected: boolean;
  hovered: boolean;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const { width: vw, height: vh } = useThree((s) => s.viewport);
  const rig = useRef<THREE.Group>(null);
  const lift = useRef(0);
  const scale = useRef(1);
  const m = usePremiumMaterials();
  const cellW = vw / cols;
  const cellH = vh / rows;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cx = -vw / 2 + cellW * (col + 0.5);
  // Sit the mark in the upper part of the cell, label pinned below it.
  const cy = vh / 2 - cellH * (row + 0.5) + cellH * 0.16;
  const base = Math.min(cellW * 0.4, cellH * 0.44);

  useFrame((_, dt) => {
    if (!rig.current) return;
    const liftTarget = hovered ? 0.16 : selected ? 0.08 : 0;
    const scaleTarget = selected ? 1.12 : hovered ? 1.06 : 1;
    const ease = 1 - Math.exp(-dt * 10);
    lift.current += (liftTarget - lift.current) * ease;
    scale.current += (scaleTarget - scale.current) * ease;
    // Parent group is already at the cell centre; offset only by the lift.
    rig.current.position.y = lift.current * base;
    rig.current.scale.setScalar(base * scale.current);
    if (!reduced) rig.current.rotation.y += dt * 0.35;
  });

  return (
    <group position={[cx, cy, 0]}>
      <group ref={rig}>{children}</group>
      {selected ? (
        <mesh material={m.redHot} position={[0, -cellH * 0.34, 0.6]}>
          <sphereGeometry args={[base * 0.12, 20, 20]} />
        </mesh>
      ) : null}
    </group>
  );
}

function TilesScene({
  tiles,
  selectedIds,
  hovered,
  reduced,
}: {
  tiles: readonly BrandTile[];
  selectedIds: string[];
  hovered: string | null;
  reduced: boolean;
}) {
  const cols = columnsFor(tiles.length);
  const rows = Math.ceil(tiles.length / cols);
  return (
    <>
      {tiles.map((tile, i) => (
        <TileCell
          key={tile.id}
          index={i}
          cols={cols}
          rows={rows}
          selected={selectedIds.includes(tile.id)}
          hovered={hovered === tile.id}
          reduced={reduced}
        >
          <BrandMark mark={tile.mark} />
        </TileCell>
      ))}
    </>
  );
}

export default function BrandTiles3D({
  tiles,
  selectedIds,
  onToggle,
  ariaLabel,
}: {
  tiles: readonly BrandTile[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  ariaLabel: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();
  const cols = useMemo(() => columnsFor(tiles.length), [tiles.length]);

  return (
    <div className="iv-tiles" style={{ ['--iv-cols' as string]: cols }} role="group" aria-label={ariaLabel}>
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 48, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="iv-tiles-canvas"
        style={{ position: 'absolute', inset: 0 }}
      >
        <StudioEnvironment />
        <StudioLights />
        <TilesScene tiles={tiles} selectedIds={selectedIds} hovered={hovered} reduced={reduced} />
      </Canvas>
      <div className="iv-tiles-hits">
        {tiles.map((tile) => {
          const on = selectedIds.includes(tile.id);
          return (
            <button
              key={tile.id}
              type="button"
              className="iv-tile-hit"
              data-selected={on ? 'true' : 'false'}
              aria-pressed={on}
              onMouseEnter={() => setHovered(tile.id)}
              onMouseLeave={() => setHovered((h) => (h === tile.id ? null : h))}
              onClick={() => onToggle(tile.id)}
            >
              <span className="iv-tile-label">{tile.label}</span>
              {tile.hint ? <span className="iv-tile-hint">{tile.hint}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
