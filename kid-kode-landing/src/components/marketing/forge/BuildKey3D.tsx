'use client';

// PRISM MARKETING — THE BUILD KEY (SHELL W9, DL12)
//
// The marketing surface's primary CTA as a REAL 3D object: a machined gunmetal
// housing carrying a red-lacquer key with a chrome seam — a physical control
// you press to start a build. The DOM <button> overlay owns interaction, the
// LABEL, and a11y (the W6 advocate lesson: crisp type never lives inside the
// render), so the object carries materiality while the text stays razor sharp.
// Hover lifts the key with weight; press seats it (DL6). Falls back to a
// machined SVG still + the same DOM button on low-GPU / render failure.

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  StudioEnvironment,
  StudioLights,
} from '../../shell/showpiece/premium-materials';
import { usePrefersReducedMotion } from '../../shell/builder/use-reduced-motion';
import {
  CHROME,
  GUNMETAL,
  RED_DEEP,
  RED_HOT,
  SIGNAL_RED,
} from '@/components/shell/design/prism-premium-tokens';

function KeyForm({ hovered, pressed, reduced }: { hovered: boolean; pressed: boolean; reduced: boolean }) {
  const rig = useRef<THREE.Group>(null);
  const cap = useRef<THREE.Group>(null);
  const lift = useRef(0);

  const baseGeo = useMemo(() => new RoundedBoxGeometry(3.6, 0.5, 1.42, 4, 0.12), []);
  const capGeo = useMemo(() => new RoundedBoxGeometry(3.28, 0.44, 1.14, 4, 0.14), []);
  const mats = useMemo(() => {
    const gunmetal = new THREE.MeshStandardMaterial({ color: GUNMETAL, metalness: 0.92, roughness: 0.34 });
    const chrome = new THREE.MeshPhysicalMaterial({
      color: CHROME,
      metalness: 1,
      roughness: 0.18,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
    });
    const lacquer = new THREE.MeshPhysicalMaterial({
      color: SIGNAL_RED,
      metalness: 0.22,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      emissive: new THREE.Color(RED_DEEP),
      emissiveIntensity: 0.5,
    });
    return { gunmetal, chrome, lacquer };
  }, []);

  useFrame((_, dt) => {
    const ease = 1 - Math.exp(-dt * 10);
    const target = pressed ? -0.1 : hovered ? 0.12 : 0;
    lift.current += (target - lift.current) * ease;
    if (cap.current) cap.current.position.y = 0.3 + lift.current;
    if (mats.lacquer) {
      const glow = pressed ? 1.1 : hovered ? 0.85 : 0.5;
      mats.lacquer.emissiveIntensity += (glow - mats.lacquer.emissiveIntensity) * ease;
    }
    if (rig.current && !reduced) {
      // A barely-there idle sway so the object reads live, never restless.
      rig.current.rotation.x = 0.42 + Math.sin(performance.now() * 0.0004) * 0.015;
    }
  });

  return (
    <group ref={rig} rotation={[0.42, 0, 0]}>
      <mesh geometry={baseGeo} material={mats.gunmetal} />
      {/* Chrome seam collar */}
      <mesh material={mats.chrome} position={[0, 0.22, 0]}>
        <boxGeometry args={[3.4, 0.05, 1.24]} />
      </mesh>
      <group ref={cap} position={[0, 0.3, 0]}>
        <mesh geometry={capGeo} material={mats.lacquer} />
      </group>
    </group>
  );
}

/** Static machined still for low-GPU / pre-mount — same silhouette. */
function KeyPoster() {
  return (
    <svg viewBox="0 0 240 84" aria-hidden="true" className="mk-key-poster" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="mkk-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={RED_HOT} />
          <stop offset="60%" stopColor={SIGNAL_RED} />
          <stop offset="100%" stopColor={RED_DEEP} />
        </linearGradient>
        <linearGradient id="mkk-gun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b2b35" />
          <stop offset="100%" stopColor="#0b0b10" />
        </linearGradient>
      </defs>
      <rect x="8" y="30" width="224" height="46" rx="14" fill="url(#mkk-gun)" />
      <rect x="14" y="26" width="212" height="6" rx="3" fill="#9aa1ac" opacity="0.75" />
      <rect x="16" y="6" width="208" height="44" rx="12" fill="url(#mkk-red)" />
      <rect x="24" y="10" width="192" height="10" rx="5" fill="#ffffff" opacity="0.18" />
    </svg>
  );
}

export default function BuildKey3D({
  label,
  onClick,
  ariaLabel,
  pending = false,
  children,
}: {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
  pending?: boolean;
  /** Optional trailing glyph inside the DOM label (e.g. an arrow). */
  children?: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [live, setLive] = useState(false);
  const reduced = usePrefersReducedMotion();

  return (
    <div className="mk-key" data-live={live ? 'true' : 'false'} data-pending={pending ? 'true' : 'false'}>
      {!live ? <KeyPoster /> : null}
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 1.6, 8], zoom: 46, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={() => setLive(true)}
        className="mk-key-canvas"
        aria-hidden
      >
        <StudioEnvironment />
        <StudioLights intensity={0.95} />
        <KeyForm hovered={hovered} pressed={pressed} reduced={reduced} />
      </Canvas>
      <button
        type="button"
        className="mk-key-hit"
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
        <span className="mk-key-label">
          {pending ? 'Working…' : label}
          {!pending ? children : null}
        </span>
      </button>
    </div>
  );
}
