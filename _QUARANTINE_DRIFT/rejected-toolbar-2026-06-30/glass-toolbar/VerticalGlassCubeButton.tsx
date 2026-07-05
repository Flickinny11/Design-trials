'use client';

// VerticalGlassCubeButton — the vertical-toolbar variant of GlassCubeButton.
// Real CLEAR GLASS cube seated in its milled cutout. On HOVER the cube RAISES
// toward the viewer (smooth critically-damped lift + slight scale) and its
// bespoke 3D icon spins faster. When the tool is the active toolbar group, the
// cube glows with a steady accent rim so the user sees which mode is on.
//
// Same activeGroup / onToggleGroup contract as the LiquidGlass toolbar it
// replaces, so every editor action is unchanged — chrome-only swap.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
// Vertical-toolbar cube size: bigger than the chassis CUBE so it fills more of
// the milled cutout (the chassis is HOLE=0.8 → max safe = HOLE/√2 ≈ 0.566 to
// keep a spinning cube's diagonal inside the hole).
const CUBE = 0.55;
import { makeButtonGlass } from './glass-toolbar-materials';
import { PrismIcon } from './PrismIcon';
import type { ChassisFn } from '../chassis/chassis-config';

const CUBE_CORNER = 0.075;
const RAISE = 0.30; // how far the cube lifts toward the viewer on hover
const ACTIVE_RAISE = 0.14; // smaller persistent lift when the tool is active
const HOVER_SCALE = 1.07;
const ACTIVE_SCALE = 1.04;

export interface VerticalGlassCubeButtonProps {
  fn: ChassisFn;
  color: string;
  y: number;
  active: boolean;
  wired: boolean;
  onActivate: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

export function VerticalGlassCubeButton({
  fn,
  color,
  y,
  active,
  wired,
  onActivate,
  onHoverChange,
}: VerticalGlassCubeButtonProps) {
  const group = useRef<THREE.Group>(null);
  const iconSpin = useRef<THREE.Group>(null);
  const hovered = useRef(false);
  const glass = useMemo(() => makeButtonGlass(color), [color]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const lit = hovered.current || active;
    const targetZ = hovered.current ? RAISE : active ? ACTIVE_RAISE : 0;
    const targetS = hovered.current ? HOVER_SCALE : active ? ACTIVE_SCALE : 1;
    g.position.z = THREE.MathUtils.damp(g.position.z, targetZ, 9, dt);
    const s = THREE.MathUtils.damp(g.scale.x, targetS, 9, dt);
    g.scale.setScalar(s);
    const spin = iconSpin.current;
    if (spin) {
      spin.rotation.y += dt * (lit ? 1.5 : 0.35);
      spin.rotation.x = Math.sin(state.clock.elapsedTime * 0.6 + y) * 0.12;
    }
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hovered.current = true;
    onHoverChange?.(true);
    if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hovered.current = false;
    onHoverChange?.(false);
    if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onActivate();
  };

  return (
    <group ref={group} position={[0, y, 0]}>
      <RoundedBox
        args={[CUBE, CUBE, CUBE]}
        radius={CUBE_CORNER}
        smoothness={6}
        material={glass}
        castShadow
        onPointerOver={over}
        onPointerOut={out}
        onClick={click}
      />
      <group ref={iconSpin} scale={1.85}>
        <PrismIcon glyph={fn.glyph} color={color} />
      </group>
      {!wired && (
        <mesh position={[CUBE * 0.32, CUBE * 0.32, CUBE * 0.5 + 0.04]}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshStandardMaterial color="#9fd0ff" emissive="#9fd0ff" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
}
