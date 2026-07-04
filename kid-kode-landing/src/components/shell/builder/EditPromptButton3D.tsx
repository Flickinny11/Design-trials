'use client';

// PRISM SHELL — "EDIT WITH PROMPT" OBJECT BUTTON (SHELL W1, DL12)
//
// The Inspector's primary action for a selected node, rendered as a real 3D
// object: a chrome stylus wedge poised over a gunmetal slab with a red-hot
// contact bead — the machined glyph for "write on this node". Clicking
// issues the `open-prompt-edit` contract command for the selection (the
// Visual-Edit round-trip's shell side). DOM label + button carry a11y.

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from './use-reduced-motion';

function StylusForm({
  hovered,
  pressed,
  reduced,
}: {
  hovered: boolean;
  pressed: boolean;
  reduced: boolean;
}) {
  const m = usePremiumMaterials();
  const rig = useRef<THREE.Group>(null);
  const stylus = useRef<THREE.Group>(null);
  const lift = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const ease = 1 - Math.exp(-dt * 10);
    const liftTarget = pressed ? -0.08 : hovered ? 0.12 : 0;
    lift.current += (liftTarget - lift.current) * ease;
    if (rig.current) {
      rig.current.position.y = lift.current;
      if (!reduced) {
        rig.current.rotation.y = -0.42 + Math.sin(t * 0.55) * 0.26;
        rig.current.rotation.x = 0.16 + Math.sin(t * 0.48) * 0.05;
      } else {
        rig.current.rotation.set(0.16, -0.42, 0);
      }
    }
    if (stylus.current && !reduced) {
      // the stylus hovers — a writing hand's poise, settling when pressed
      stylus.current.position.y = 0.18 + (pressed ? -0.1 : Math.sin(t * 1.6) * 0.035);
    }
  });

  return (
    <group ref={rig} position={[0, -0.05, 0]}>
      {/* node slab */}
      <mesh material={m.gunmetal} position={[0, -0.42, 0]}>
        <boxGeometry args={[1.15, 0.18, 0.8]} />
      </mesh>
      <mesh material={m.gunmetalLit} position={[0, -0.3, 0]}>
        <boxGeometry args={[0.95, 0.07, 0.62]} />
      </mesh>
      {/* red contact bead where the stylus writes */}
      <mesh material={m.redHot} position={[-0.18, -0.2, 0.05]}>
        <sphereGeometry args={[0.075, 20, 20]} />
      </mesh>
      {/* chrome stylus wedge */}
      <group ref={stylus} position={[0, 0.18, 0]} rotation={[0, 0, -0.72]}>
        <mesh material={m.chrome} position={[0.12, 0.22, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.85, 24]} />
        </mesh>
        <mesh material={m.steel} position={[0.12, -0.28, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.075, 0.22, 24]} />
        </mesh>
      </group>
    </group>
  );
}

export default function EditPromptButton3D({
  label,
  onActivate,
}: {
  label: string;
  onActivate: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const reduced = usePrefersReducedMotion();

  return (
    <div className="bw1-editbtn">
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 34, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="bw1-editbtn-canvas"
      >
        <StudioEnvironment />
        <StudioLights />
        <StylusForm hovered={hovered} pressed={pressed} reduced={reduced} />
      </Canvas>
      <button
        type="button"
        className="bw1-editbtn-hit"
        aria-label={label}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onClick={onActivate}
      >
        <span className="bw1-editbtn-label">{label}</span>
      </button>
    </div>
  );
}
