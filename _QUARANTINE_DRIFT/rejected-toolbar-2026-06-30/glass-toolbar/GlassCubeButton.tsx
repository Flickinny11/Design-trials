'use client';

// GlassCubeButton — a CLEAR GLASS cube seated in the pane's milled cutout, holding
// a bespoke 3D icon suspended inside it. On HOVER the whole cube RAISES toward the
// viewer (smooth critically-damped lift + slight scale) and its icon energizes
// (faster idle spin). Real transmission glass (shares the renderer's single
// transmission pass — fast for all 14), NOT glassmorphism, NOT CSS.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { CUBE, CUBE_CORNER, type PlacedButton } from '../chassis/chassis-config';
import { makeButtonGlass } from './glass-toolbar-materials';
import { PrismIcon } from './PrismIcon';

const RAISE = 0.3; // how far the cube lifts toward the viewer on hover (world units)
const HOVER_SCALE = 1.07;

export function GlassCubeButton({
  btn,
  onHover,
  onSelect,
}: {
  btn: PlacedButton;
  onHover?: (b: PlacedButton | null) => void;
  onSelect?: (b: PlacedButton) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const iconSpin = useRef<THREE.Group>(null);
  const hovered = useRef(false);
  const glass = useMemo(() => makeButtonGlass(btn.color), [btn.color]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const targetZ = hovered.current ? RAISE : 0;
    const targetS = hovered.current ? HOVER_SCALE : 1;
    g.position.z = THREE.MathUtils.damp(g.position.z, targetZ, 9, dt);
    const s = THREE.MathUtils.damp(g.scale.x, targetS, 9, dt);
    g.scale.setScalar(s);
    const spin = iconSpin.current;
    if (spin) {
      spin.rotation.y += dt * (hovered.current ? 1.5 : 0.35);
      spin.rotation.x = Math.sin(state.clock.elapsedTime * 0.6 + btn.x) * 0.12;
    }
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hovered.current = true;
    onHover?.(btn);
    if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hovered.current = false;
    onHover?.(null);
    if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.(btn);
  };

  return (
    <group ref={group} position={[btn.x, btn.y, 0]}>
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
      <group ref={iconSpin} scale={1.45}>
        <PrismIcon glyph={btn.fn.glyph} color={btn.color} />
      </group>
    </group>
  );
}
