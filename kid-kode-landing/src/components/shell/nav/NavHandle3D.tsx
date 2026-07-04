'use client';

// PRISM SHELL — SLIDE-OUT NAV HANDLE (SHELL W4, E13, DL11/DL12)
//
// The far-LEFT edge affordance that reveals the global navigation: a REAL 3D
// machined pull from the shared premium-materials canon (DL11 — rendered, not
// CSS). A gunmetal lever body carries a signal-red jewel grip; on hover it
// slides out of the edge with weight (DL6, sprung ease) and the jewel warms —
// the physical "grab me" of a drawer pull. ONE canvas / one GL context for the
// whole global affordance (the DL8 rider — never a live context per control).
// Reduced motion holds it slightly proud and still. Ortho camera so the lever
// stays pixel-locked to the edge strip at any viewport height (W0 idiom).

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from '../builder/use-reduced-motion';

function HandleForm({
  revealed,
  reduced,
}: {
  revealed: boolean;
  reduced: boolean;
}) {
  const m = usePremiumMaterials();
  const rig = useRef<THREE.Group>(null);
  const jewel = useRef<THREE.Mesh>(null);
  const out = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const ease = 1 - Math.exp(-dt * 8);
    const target = revealed ? 1 : reduced ? 0.35 : 0;
    out.current += (target - out.current) * ease;
    if (rig.current) {
      // Slides out of the left edge as it is grabbed; a touch of sprung tilt.
      rig.current.position.x = -0.5 + out.current * 0.6;
      rig.current.rotation.z = reduced ? 0 : Math.sin(t * 0.6) * 0.03 - out.current * 0.06;
    }
    if (jewel.current) {
      const mat = jewel.current.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity = 0.4 + out.current * 1.1;
    }
  });

  return (
    <group ref={rig}>
      {/* Machined lever body — a tall rounded pillar seated in the edge. */}
      <mesh material={m.gunmetal} position={[0, 0, 0]}>
        <capsuleGeometry args={[0.22, 1.5, 8, 24]} />
      </mesh>
      <mesh material={m.chrome} position={[0, 0, 0.02]}>
        <capsuleGeometry args={[0.1, 1.5, 6, 16]} />
      </mesh>
      {/* Signal-red jewel grip at the pull point. */}
      <mesh ref={jewel} material={m.redJewel} position={[0, 0, 0.16]}>
        <icosahedronGeometry args={[0.26, 0]} />
      </mesh>
    </group>
  );
}

export default function NavHandle3D({ revealed }: { revealed: boolean }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="nav3-handle-canvas" aria-hidden>
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 8], zoom: 92, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <StudioEnvironment />
        <StudioLights intensity={0.9} />
        <HandleForm revealed={revealed} reduced={reduced} />
      </Canvas>
    </div>
  );
}
