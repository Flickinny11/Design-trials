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

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import {
  BAR_W,
  BAR_D,
  GLASS_TINT,
  GLASS_ATTENUATION,
} from './config';
import { useShellGeometry, SHELL_URL } from './glb';

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
  const barMeshRef = useRef<THREE.Mesh>(null);
  // The GENERATED shell GLB form, scaled-to-fit the rail box. The warp + the
  // transmission material ride on THIS geometry (spec TB-1/TB-2). The vertex
  // count varies with the generated mesh, so the warp's basePos cache keys off it.
  const shellGeo = useShellGeometry(BAR_W, height, BAR_D);
  // Rest positions of the bar's vertices, cached so the per-frame liquid BEND
  // displaces from the original shape (never accumulates).
  const basePos = useRef<Float32Array | null>(null);
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
      // Clear glass: the geometric vertex warp (below) carries the "liquid bend";
      // the refraction churn is kept LOW + tightly capped on interaction so it
      // never shatters into shards and the sunk buttons read crisply through it.
      m.temporalDistortion = 0.03 + s.e * 0.05;
      m.distortion = 0.04 + s.e * 0.04;
    }

    // ── Real liquid BEND: displace the bar's vertices so the glass body visibly
    // undulates like a ribbon of liquid (a traveling sine along its length warps
    // X, a phase-shifted wave warps Z), leaning toward the cursor. This is a true
    // geometric deformation — not a rigid tilt — so the toolbar reads as warping
    // liquid glass (DESIGN LAW B.1). The buttons are separate meshes, so the glass
    // flexes over its sunk controls. ───────────────────────────────────────────
    const mesh = barMeshRef.current;
    if (mesh && mesh.geometry) {
      const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      if (!basePos.current || basePos.current.length !== arr.length) {
        basePos.current = arr.slice();
      }
      const b = basePos.current;
      // Gentle, legible undulation (still clearly a warping liquid ribbon, TB-2)
      // — calmer than the first pass so the sunk buttons read through the glass.
      const bendAmp = 0.035 + s.e * 0.04;
      const zAmp = 0.016 + s.e * 0.018; // gentler Z so the front face doesn't bulge over the icons
      const lean = s.px * 0.1;
      for (let i = 0; i < arr.length; i += 3) {
        const by = b[i + 1];
        arr[i] = b[i] + Math.sin(by * 1.15 + t * 1.4) * bendAmp + lean;
        arr[i + 2] = b[i + 2] + Math.cos(by * 0.85 + t * 1.05) * zAmp;
      }
      attr.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
  });

  // Re-arm the warp's rest-position cache whenever the shell geometry changes
  // (e.g. rail height changed → a fresh scaled geometry).
  useEffect(() => {
    basePos.current = null;
    const mesh = barMeshRef.current;
    if (mesh) mesh.userData.glbSource = SHELL_URL; // verification: the form is the GLB
  }, [shellGeo]);

  return (
    <group ref={group}>
      <mesh ref={barMeshRef} geometry={shellGeo} raycast={NOOP_RAYCAST} castShadow>
        {/* Real transmission glass: volumetric, refractive, iridescent —
            layered onto the GENERATED shell form (spec §6). */}
        <MeshTransmissionMaterial
          ref={matRef as never}
          transmission={1}
          thickness={1.1}
          roughness={0.08}
          ior={1.42}
          chromaticAberration={0.015}
          anisotropy={0.18}
          distortion={0.04}
          distortionScale={0.3}
          temporalDistortion={0.03}
          attenuationColor={GLASS_ATTENUATION}
          attenuationDistance={2.8}
          color={GLASS_TINT}
          envMapIntensity={2.2}
          clearcoat={1}
          clearcoatRoughness={0.08}
          // soap-film iridescence on the glass (MeshPhysicalMaterial passthrough)
          iridescence={0.5}
          iridescenceIOR={1.3}
          iridescenceThicknessRange={[140, 680]}
          backside
          backsideThickness={0.8}
          samples={10}
          resolution={1024}
        />
      </mesh>

      {/* Inner luminous core — a thin slab the glass refracts so the body holds
          colored light (reads as real volume, not a hollow shell). */}
      <mesh position={[0, 0, -BAR_D * 0.22]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[BAR_W * 0.4, height * 0.94, 0.04]} />
        <meshBasicMaterial map={coreTex} transparent opacity={0.32} />
      </mesh>
    </group>
  );
}
