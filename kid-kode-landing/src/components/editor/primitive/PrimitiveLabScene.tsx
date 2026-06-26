'use client';

// PrimitiveLabScene — the R3F scene for /primitive-lab, in the founder-approved
// chassis glass language: studio IBL (real refraction/reflection), editorial dark
// backdrop, premium studio lighting, AgX — matched to /toolbar-chassis +
// /keyframe-editor so a primitive MATCHES the locked aesthetic by construction.
//
// Wave w-geo: renders the REALIZED (canvas) primitives from the lab graph store
// and proves parametric LIVE REBUILD. Later waves layer galaxy/canvas states,
// the instantiate palette, the in-canvas Inspector, and the authorship probe.
//
// Isolated editor-chrome — never the unified three/webgpu graph scene.

import { Suspense, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { StudioEnv } from '@/components/editor/chassis/StudioEnv';
import { useWornMaps } from './primitive-materials';
import { PrimitiveMesh } from './PrimitiveMesh';
import { useLabGraphStore } from './use-lab-graph-store';

// Editorial dark backdrop the glass refracts and milled cutouts reveal (chassis).
function Backdrop() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 512;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#262d3a');
    grad.addColorStop(0.5, '#141926');
    grad.addColorStop(1, '#05070c');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 512);
    const bloom = g.createRadialGradient(32, 300, 8, 32, 300, 300);
    bloom.addColorStop(0, 'rgba(120,150,200,0.16)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bloom;
    g.fillRect(0, 0, 64, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -6]} raycast={() => null}>
      <planeGeometry args={[60, 34]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// Calm the studio softbox so its reflection doesn't blow out the glass; swing the
// bright lobe to a broad soft satin sheen (premium glass), as in the chassis.
function EnvTune() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const prevI = scene.environmentIntensity;
    const prevR = scene.environmentRotation?.clone?.();
    scene.environmentIntensity = 0.46;
    if (scene.environmentRotation) scene.environmentRotation.set(0.3, -Math.PI * 0.32, 0);
    return () => {
      scene.environmentIntensity = prevI;
      if (prevR && scene.environmentRotation) scene.environmentRotation.copy(prevR);
    };
  }, [scene]);
  return null;
}

// Dev/verification probes — editor chrome, window access allowed (not runtime/node).
function SceneProbe() {
  const scene = useThree((s) => s.scene);
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_PRIM_SCENE__ = scene;
    w.__PRISM_PRIM_STORE__ = () => useLabGraphStore.getState();
  }
  return null;
}

// Realized primitives (canvas) — reads the store; rebuilds live as schemas change.
function Realized() {
  const wornMaps = useWornMaps();
  const schemas = useLabGraphStore((s) => s.schemas);
  const selectedId = useLabGraphStore((s) => s.selectedId);
  const select = useLabGraphStore((s) => s.select);
  return (
    <>
      {schemas.map((s) => (
        <PrimitiveMesh
          key={s.nodeId}
          schema={s}
          wornMaps={wornMaps}
          selected={s.nodeId === selectedId}
          onSelect={select}
        />
      ))}
    </>
  );
}

// One-time seed so the route opens with one of each primitive on screen
// (parametric pane + worn cube + worn sphere). Later the palette instantiates.
function useSeed() {
  useEffect(() => {
    const st = useLabGraphStore.getState();
    if (st.schemas.length === 0) {
      st.instantiate('pane');
      st.instantiate('cube');
      st.instantiate('sphere');
      st.select(null);
    }
  }, []);
}

export function PrimitiveLabScene() {
  useSeed();
  return (
    <>
      <SceneProbe />
      <StudioEnv />
      <EnvTune />
      <Backdrop />

      {/* Premium studio lighting — matched to the chassis: warm key (soft shadow),
          cool fill, raking light for the brushed grain, off-center rim spots. */}
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[5.5, 12.5, 6]}
        intensity={2.05}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.5}
        shadow-camera-far={48}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-7, -1, 7]} intensity={1.05} color="#bcd6ff" />
      <directionalLight position={[-2, 0.5, 9]} intensity={1.1} color="#fff7ec" />
      <spotLight position={[12, 6, -1]} angle={0.85} penumbra={1} intensity={52} distance={56} color="#cfe2ff" />
      <spotLight position={[-12, -3, -1]} angle={0.85} penumbra={1} intensity={30} distance={56} color="#e6c9ff" />

      <Suspense fallback={null}>
        <Realized />
      </Suspense>

      <ContactShadows
        position={[0, -3.2, 0]}
        opacity={0.45}
        scale={40}
        blur={2.6}
        far={6}
        resolution={1024}
        color="#000308"
      />
    </>
  );
}
