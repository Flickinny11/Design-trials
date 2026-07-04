'use client';

// PRISM SHELL — CARD OPTIONS (SHELL W2, DL8/DL11/DL14)
//
// One Decision Card's visual options as real 3D objects on a SINGLE shared
// canvas (DL8 rider: one GL context for the whole option set, never one per
// tile). An ortho camera + a CSS-grid-matched cell layout keep each glyph
// centred in its DOM hit cell; the DOM buttons carry interaction + a11y +
// selection state. Only the currently-visible card mounts a canvas, so the
// intake never runs more than a couple of contexts.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
  type PremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from '../builder/use-reduced-motion';
import { OptionGlyph } from './OptionGlyph';
import type { CardOption } from '@/lib/shell/intake/intake-model';

function columnsFor(count: number): number {
  if (count <= 2) return count;
  if (count <= 4) return 2;
  return 3;
}

function CellRig({
  index,
  cols,
  rows,
  selected,
  hovered,
  pressed,
  reduced,
  children,
}: {
  index: number;
  cols: number;
  rows: number;
  selected: boolean;
  hovered: boolean;
  pressed: boolean;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const { width: vw, height: vh } = useThree((s) => s.viewport);
  const rig = useRef<THREE.Group>(null);
  const bead = useRef<THREE.Mesh>(null);
  const lift = useRef(0);
  const scale = useRef(1);
  const m = usePremiumMaterials();

  const cellW = vw / cols;
  const cellH = vh / rows;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cx = -vw / 2 + cellW * (col + 0.5);
  // Sit the glyph in the upper part of the cell so the DOM label (pinned to
  // the cell's bottom edge) stays clear of it.
  const cy = vh / 2 - cellH * (row + 0.5) + cellH * 0.16;
  const base = Math.min(cellW * 0.42, cellH * 0.46);

  useFrame(({ clock }, dt) => {
    if (!rig.current) return;
    const t = clock.getElapsedTime();
    const liftTarget = pressed ? -0.08 : hovered ? 0.16 : selected ? 0.08 : 0;
    const scaleTarget = selected ? 1.14 : hovered ? 1.07 : 1;
    const ease = 1 - Math.exp(-dt * 10);
    lift.current += (liftTarget - lift.current) * ease;
    scale.current += (scaleTarget - scale.current) * ease;
    // Parent group is already at the cell centre; offset only by the lift.
    rig.current.position.y = lift.current * base;
    rig.current.scale.setScalar(base * scale.current);
    if (!reduced) {
      rig.current.rotation.y = -0.3 + Math.sin(t * 0.5 + index * 1.3) * 0.26;
      rig.current.rotation.x = 0.1 + Math.sin(t * 0.42 + index * 1.3) * 0.05;
    } else {
      rig.current.rotation.set(0.1, -0.3, 0);
    }
    if (bead.current) {
      const pulse = selected && !reduced ? 1 + Math.sin(t * 5) * 0.12 : 1;
      bead.current.scale.setScalar((selected ? 1 : 0.0001) * pulse);
    }
  });

  return (
    <group position={[cx, cy, 0]}>
      <group ref={rig} position={[0, 0, 0]}>
        {children}
      </group>
      <mesh ref={bead} material={m.redHot} position={[0, -cellH * 0.32, 0.4]}>
        <sphereGeometry args={[base * 0.11, 20, 20]} />
      </mesh>
    </group>
  );
}

function OptionsScene({
  options,
  selectedIds,
  hovered,
  pressed,
  reduced,
}: {
  options: readonly CardOption[];
  selectedIds: string[];
  hovered: string | null;
  pressed: string | null;
  reduced: boolean;
}) {
  const m: PremiumMaterials = usePremiumMaterials();
  const cols = columnsFor(options.length);
  const rows = Math.ceil(options.length / cols);
  return (
    <>
      {options.map((opt, i) => (
        <CellRig
          key={opt.id}
          index={i}
          cols={cols}
          rows={rows}
          selected={selectedIds.includes(opt.id)}
          hovered={hovered === opt.id}
          pressed={pressed === opt.id}
          reduced={reduced}
        >
          <OptionGlyph glyph={opt.glyph ?? 'orb'} m={m} />
        </CellRig>
      ))}
    </>
  );
}

export default function CardOptions3D({
  options,
  selectedIds,
  onToggle,
}: {
  options: readonly CardOption[];
  selectedIds: string[];
  onToggle: (optionId: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();
  const cols = useMemo(() => columnsFor(options.length), [options.length]);

  return (
    <div className="iv-options" style={{ ['--iv-cols' as string]: cols }}>
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 46, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="iv-options-canvas"
        style={{ position: 'absolute', inset: 0 }}
      >
        <StudioEnvironment />
        <StudioLights />
        <OptionsScene
          options={options}
          selectedIds={selectedIds}
          hovered={hovered}
          pressed={pressed}
          reduced={reduced}
        />
      </Canvas>
      <div className="iv-options-hits">
        {options.map((opt) => {
          const on = selectedIds.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              className="iv-option-hit"
              data-selected={on ? 'true' : 'false'}
              aria-pressed={on}
              onMouseEnter={() => setHovered(opt.id)}
              onMouseLeave={() => {
                setHovered((h) => (h === opt.id ? null : h));
                setPressed((p) => (p === opt.id ? null : p));
              }}
              onPointerDown={() => setPressed(opt.id)}
              onPointerUp={() => setPressed((p) => (p === opt.id ? null : p))}
              onClick={() => onToggle(opt.id)}
            >
              <span className="iv-option-label">{opt.label}</span>
              {opt.hint ? <span className="iv-option-hint">{opt.hint}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
