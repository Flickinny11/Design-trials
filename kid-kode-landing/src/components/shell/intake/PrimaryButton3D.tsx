'use client';

// PRISM SHELL — PRIMARY OBJECT BUTTON (SHELL W2, DL12)
//
// The intake's primary CTAs (Start · Approve & build) as real 3D objects, not
// CSS (DL11/DL12). A machined gunmetal pad carries a signal-red jewel; hover
// lifts with weight, press seats the jewel into its chrome ring (a physical
// "commit", DL6), and a `pending` state spins a chrome ring while the server
// finalizes. The DOM <button> overlay owns interaction + a11y. Secondary
// controls (Back / Skip / Edit) stay clean-but-premium DOM per decision A.

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from '../builder/use-reduced-motion';

function ButtonForm({
  kind,
  disabled,
  pending,
  hovered,
  pressed,
  reduced,
}: {
  kind: 'go' | 'seal';
  disabled: boolean;
  pending: boolean;
  hovered: boolean;
  pressed: boolean;
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
    const liftTarget = pressed ? -0.12 : hovered && !disabled ? 0.16 : 0;
    lift.current += (liftTarget - lift.current) * ease;
    const seatTarget = pressed || (kind === 'seal' && pending) ? 1 : 0;
    seat.current += (seatTarget - seat.current) * ease;

    if (rig.current) {
      rig.current.position.y = lift.current;
      rig.current.scale.setScalar(disabled ? 0.9 : 1);
      if (!reduced) {
        rig.current.rotation.y = -0.3 + Math.sin(t * 0.55) * 0.2;
        rig.current.rotation.x = 0.12 + Math.sin(t * 0.48) * 0.05;
      } else {
        rig.current.rotation.set(0.12, -0.3, 0);
      }
    }
    if (jewel.current) {
      jewel.current.position.y = 0.12 - seat.current * 0.16;
      if (!reduced && kind === 'go') jewel.current.rotation.y = t * 0.8;
    }
    if (ring.current) {
      if (pending && !reduced) ring.current.rotation.z -= dt * 4;
      const rs = 1 + seat.current * 0.12;
      ring.current.scale.setScalar(rs);
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
        {kind === 'seal' ? (
          <mesh material={m.redJewel}>
            <icosahedronGeometry args={[0.4, 0]} />
          </mesh>
        ) : (
          <mesh material={m.redJewel}>
            <octahedronGeometry args={[0.42, 0]} />
          </mesh>
        )}
      </group>
    </group>
  );
}

export default function PrimaryButton3D({
  label,
  sublabel,
  kind = 'go',
  disabled = false,
  pending = false,
  onClick,
  ariaLabel,
}: {
  label: string;
  sublabel?: string;
  kind?: 'go' | 'seal';
  disabled?: boolean;
  pending?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const reduced = usePrefersReducedMotion();

  return (
    <div className="iv-cta" data-disabled={disabled ? 'true' : 'false'} data-pending={pending ? 'true' : 'false'}>
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 42, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="iv-cta-canvas"
      >
        <StudioEnvironment />
        <StudioLights intensity={disabled ? 0.55 : 1} />
        <ButtonForm
          kind={kind}
          disabled={disabled}
          pending={pending}
          hovered={hovered}
          pressed={pressed}
          reduced={reduced}
        />
      </Canvas>
      <button
        type="button"
        className="iv-cta-hit"
        aria-label={ariaLabel ?? label}
        disabled={disabled || pending}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onClick={onClick}
      >
        <span className="iv-cta-label">{pending ? 'Working…' : label}</span>
        {sublabel && !pending ? <span className="iv-cta-sub">{sublabel}</span> : null}
      </button>
    </div>
  );
}
