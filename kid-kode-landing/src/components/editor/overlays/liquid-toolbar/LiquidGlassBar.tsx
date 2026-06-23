'use client';

// LiquidGlassBar — the toolbar AS a photoreal 3D liquid-glass object (DESIGN
// LAW B.1). A rounded volumetric slab rendered with a real transmission/
// refraction material (drei MeshTransmissionMaterial = MeshPhysicalMaterial +
// a transmission FBO pass), so it has genuine volumetric depth, transparency,
// chromatic aberration and soap-film iridescence — NOT a CSS frosted panel.
//
// It "warps and bends like real liquid glass with movement": a phase-shifted
// multi-axis breathing wobble plus a pointer-follow bend (the slab leans toward
// the cursor), layered on top of the material's own animated `temporalDistortion`
// (which liquefies the refraction every frame). The mesh is raycast-transparent
// (`raycast={() => null}`) so the buttons sunk inside it receive all pointer
// events through the glass.

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import {
  BAR_W,
  BAR_D,
  GLASS_TINT,
  GLASS_ATTENUATION,
} from './config';

const NOOP_RAYCAST = () => null;

export interface LiquidGlassBarProps {
  height: number; // world height of the bar
  /** 0..1 overall "energy" — rises while a button is hovered/pressed so the
   *  glass visibly ripples harder in response to interaction. */
  energy?: number;
}

export function LiquidGlassBar({ height, energy = 0 }: LiquidGlassBarProps) {
  const group = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const { pointer } = useThree();
  // Smoothed pointer + energy so the bend/ripple is liquid, never jittery.
  const smooth = useRef({ px: 0, py: 0, e: 0 });

  // A soft inner "core" gradient the glass refracts — gives the body internal
  // color/light instead of looking hollow. Cheap vertical gradient texture.
  const coreTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#2b4a78');
    grad.addColorStop(0.5, '#16243d');
    grad.addColorStop(1.0, '#3a2c66');
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const s = smooth.current;
    // Critically-damped follow of pointer + energy.
    const k = 1 - Math.pow(0.0015, dt);
    s.px += (pointer.x - s.px) * k;
    s.py += (pointer.y - s.py) * k;
    s.e += (energy - s.e) * (1 - Math.pow(0.02, dt));

    // Idle breathing wobble (phase-shifted axes → it bends, not just rotates),
    // amplified by interaction energy.
    const amp = 0.035 + s.e * 0.05;
    g.rotation.x = Math.sin(t * 0.6) * amp * 0.5 + s.py * 0.13;
    g.rotation.y = Math.sin(t * 0.45 + 1.3) * amp + s.px * 0.22;
    g.rotation.z = Math.sin(t * 0.8 + 2.1) * amp * 0.35;
    // Liquid breathing of the body (non-uniform → the slab visibly swells/bends).
    g.scale.x = 1 + Math.sin(t * 0.9) * 0.012 * (1 + s.e);
    g.scale.y = 1 + Math.sin(t * 0.7 + 0.6) * 0.01;
    g.position.z = Math.sin(t * 0.5) * 0.03;

    // Drive the material's animated distortion harder while interacting so the
    // refraction churns like disturbed liquid.
    const m = matRef.current as unknown as {
      temporalDistortion?: number;
      distortion?: number;
    } | null;
    if (m) {
      m.temporalDistortion = 0.18 + s.e * 0.5;
      m.distortion = 0.28 + s.e * 0.35;
    }
  });

  return (
    <group ref={group}>
      <RoundedBox
        args={[BAR_W, height, BAR_D]}
        radius={Math.min(BAR_W, BAR_D) * 0.42}
        smoothness={8}
        steps={2}
        raycast={NOOP_RAYCAST}
      >
        {/* Real transmission glass: volumetric, refractive, iridescent. */}
        <MeshTransmissionMaterial
          ref={matRef as never}
          transmission={1}
          thickness={1.4}
          roughness={0.08}
          ior={1.45}
          chromaticAberration={0.07}
          anisotropy={0.32}
          distortion={0.28}
          distortionScale={0.45}
          temporalDistortion={0.18}
          attenuationColor={GLASS_ATTENUATION}
          attenuationDistance={2.4}
          color={GLASS_TINT}
          envMapIntensity={2.2}
          clearcoat={1}
          clearcoatRoughness={0.08}
          // soap-film iridescence on the glass (MeshPhysicalMaterial passthrough)
          iridescence={0.65}
          iridescenceIOR={1.32}
          iridescenceThicknessRange={[120, 760]}
          backside
          backsideThickness={0.8}
          samples={8}
          resolution={512}
        />
      </RoundedBox>

      {/* Inner luminous core — a thin slab the glass refracts so the body holds
          colored light (reads as real volume, not a hollow shell). */}
      <mesh position={[0, 0, -BAR_D * 0.18]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[BAR_W * 0.42, height * 0.94, 0.04]} />
        <meshBasicMaterial map={coreTex} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
