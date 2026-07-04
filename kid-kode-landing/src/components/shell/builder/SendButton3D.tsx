'use client';

// PRISM SHELL — SEND / STOP OBJECT BUTTON (SHELL W1, DL12)
//
// The chat composer's primary control, rendered as a real 3D object: a
// signal-red octahedron jewel over a machined gunmetal pad (SEND) that
// morphs — with physical weight, never a snap — into a red-hot STOP cube
// while a turn is streaming. The DOM <button> overlay carries interaction +
// a11y; pressing while streaming ACTUALLY aborts the stream (the wave gate's
// interruptibility proof rides this control).

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from './use-reduced-motion';

function SendStopForms({
  streaming,
  disabled,
  hovered,
  pressed,
  reduced,
}: {
  streaming: boolean;
  disabled: boolean;
  hovered: boolean;
  pressed: boolean;
  reduced: boolean;
}) {
  const m = usePremiumMaterials();
  const rig = useRef<THREE.Group>(null);
  const sendRef = useRef<THREE.Group>(null);
  const stopRef = useRef<THREE.Group>(null);
  const lift = useRef(0);
  const morph = useRef(0); // 0 = send jewel, 1 = stop cube

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const ease = 1 - Math.exp(-dt * 9);
    morph.current += ((streaming ? 1 : 0) - morph.current) * ease;
    const liftTarget = pressed ? -0.1 : hovered && !disabled ? 0.14 : 0;
    lift.current += (liftTarget - lift.current) * ease;

    if (rig.current) {
      rig.current.position.y = lift.current;
      const dim = disabled && !streaming ? 0.88 : 1;
      rig.current.scale.setScalar(dim);
      if (!reduced) {
        rig.current.rotation.y = -0.32 + Math.sin(t * 0.6) * 0.24;
        rig.current.rotation.x = 0.12 + Math.sin(t * 0.5) * 0.05;
      } else {
        rig.current.rotation.set(0.12, -0.32, 0);
      }
    }
    if (sendRef.current) {
      const s = Math.max(0.0001, 1 - morph.current);
      sendRef.current.scale.setScalar(s);
      if (!reduced) sendRef.current.rotation.y = t * 0.7;
    }
    if (stopRef.current) {
      const pulse = !reduced && streaming ? 1 + Math.sin(t * 6) * 0.06 : 1;
      stopRef.current.scale.setScalar(Math.max(0.0001, morph.current) * pulse);
    }
  });

  return (
    <group ref={rig}>
      {/* machined pad — constant across both states */}
      <mesh material={m.gunmetal} position={[0, -0.62, 0]}>
        <cylinderGeometry args={[0.62, 0.68, 0.16, 48]} />
      </mesh>
      <mesh material={m.chrome} position={[0, -0.52, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 48]} />
      </mesh>
      {/* SEND — red jewel octahedron */}
      <group ref={sendRef} position={[0, 0.08, 0]}>
        <mesh material={m.redJewel}>
          <octahedronGeometry args={[0.44, 0]} />
        </mesh>
      </group>
      {/* STOP — red-hot cube (the square is the stop glyph, as an object) */}
      <group ref={stopRef} position={[0, 0.05, 0]}>
        <mesh material={m.redHot}>
          <boxGeometry args={[0.55, 0.55, 0.55]} />
        </mesh>
      </group>
    </group>
  );
}

export default function SendButton3D({
  streaming,
  disabled,
  onSend,
  onStop,
}: {
  streaming: boolean;
  /** No sendable input staged (ignored while streaming — stop always works). */
  disabled: boolean;
  onSend: () => void;
  onStop: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const reduced = usePrefersReducedMotion();

  return (
    <div className="bw1-sendbtn" data-streaming={streaming ? 'true' : 'false'}>
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 27, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="bw1-sendbtn-canvas"
      >
        <StudioEnvironment />
        <StudioLights intensity={disabled && !streaming ? 0.5 : 1} />
        <SendStopForms
          streaming={streaming}
          disabled={disabled}
          hovered={hovered}
          pressed={pressed}
          reduced={reduced}
        />
      </Canvas>
      <button
        type="button"
        className="bw1-sendbtn-hit"
        aria-label={streaming ? 'Stop the streaming response' : 'Send message'}
        aria-keyshortcuts={streaming ? 'Escape' : 'Enter'}
        disabled={disabled && !streaming}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onClick={() => (streaming ? onStop() : onSend())}
      />
    </div>
  );
}
