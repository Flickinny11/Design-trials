'use client';

// PRISM MARKETING — PRIMARY 3D CTA (SHELL W6, DL10/DL12)
//
// The landing's key control (the hero "Build" action) as a real 3D object, not
// CSS — a machined gunmetal pad carrying a signal-red jewel, hover lifts with
// weight, press seats the jewel (a physical commit, DL6). The DOM <button>
// overlay owns interaction + a11y and carries the LABEL in DOM (never drawn in
// 3D) over a contrast plate, so text is always legible against the bright
// facet (the W4 legibility discipline). Self-contained: extends the shell's
// premium.ts materials (DL2), styled with .mk-cta3d* in marketing.css.

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
} from '../shell/showpiece/premium-materials';
import { usePrefersReducedMotion } from '../shell/builder/use-reduced-motion';

function Pad({
  hovered,
  pressed,
  pending,
  reduced,
}: {
  hovered: boolean;
  pressed: boolean;
  pending: boolean;
  reduced: boolean;
}) {
  const m = usePremiumMaterials();
  const rig = useRef<THREE.Group>(null);
  const jewel = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const lift = useRef(0);
  const seat = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const ease = 1 - Math.exp(-dt * 9);
    lift.current += ((pressed ? -0.12 : hovered ? 0.16 : 0) - lift.current) * ease;
    seat.current += ((pressed ? 1 : 0) - seat.current) * ease;
    if (rig.current) {
      rig.current.position.y = lift.current;
      if (!reduced) {
        rig.current.rotation.y = -0.3 + Math.sin(t * 0.55) * 0.2;
        rig.current.rotation.x = 0.12 + Math.sin(t * 0.48) * 0.05;
      } else {
        rig.current.rotation.set(0.12, -0.3, 0);
      }
    }
    if (jewel.current) {
      jewel.current.position.y = 0.12 - seat.current * 0.16;
      if (!reduced) jewel.current.rotation.y = t * 0.8;
    }
    if (ring.current) {
      if (pending && !reduced) ring.current.rotation.z -= dt * 4;
      ring.current.scale.setScalar(1 + seat.current * 0.12);
    }
  });

  return (
    <group ref={rig}>
      <mesh material={m.gunmetal} position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.66, 0.72, 0.18, 48]} />
      </mesh>
      <mesh ref={ring} material={m.chrome} position={[0, -0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.06, 18, 48]} />
      </mesh>
      <group ref={jewel} position={[0, 0.12, 0]}>
        <mesh material={m.redJewel}>
          <octahedronGeometry args={[0.42, 0]} />
        </mesh>
      </group>
    </group>
  );
}

export default function CtaButton3D({
  label,
  sublabel,
  pending = false,
  onClick,
  ariaLabel,
}: {
  label: string;
  sublabel?: string;
  pending?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const reduced = usePrefersReducedMotion();

  return (
    <div className="mk-cta3d" data-pending={pending ? 'true' : 'false'}>
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 44, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="mk-cta3d-canvas"
      >
        <StudioEnvironment />
        <StudioLights />
        <Pad hovered={hovered} pressed={pressed} pending={pending} reduced={reduced} />
      </Canvas>
      <button
        type="button"
        className="mk-cta3d-hit"
        aria-label={ariaLabel ?? label}
        disabled={pending}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onClick={onClick}
      >
        <span className="mk-cta3d-label">{pending ? 'Working…' : label}</span>
        {sublabel && !pending ? <span className="mk-cta3d-sub">{sublabel}</span> : null}
      </button>
    </div>
  );
}
