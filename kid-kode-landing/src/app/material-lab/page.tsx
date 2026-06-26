'use client';

// /material-lab — the REVIEWABLE route for the Prism MATERIAL SYSTEM (P-2).
//
// An isolated R3F WebGL <Canvas> (the proven toolbar-chassis / keyframe-editor /
// primitive-lab idiom — it never touches the unified three/webgpu graph scene)
// renders the curated material library on three display primitives under ONE shared
// studio environment, browsable by family, applied live. AgX tone mapping, sRGB
// output, soft shadows, a real studio IBL for refraction/reflection — matched to
// the founder-approved chassis aesthetic.
//
// ZERO DOM UI: no Tailwind, no className styling, no inline style on chrome — the
// stage is sized by material-lab.css and EVERYTHING visible lives in the canvas.
//
//   ?orbit=1   enable review auto-orbit (default off)

import { Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSearchParams } from 'next/navigation';
import { MaterialLabScene } from '@/components/editor/material/MaterialLabScene';

// Dev/verification rig: publishes the review camera + controls for deterministic
// capture angles. Editor chrome — window access fine (not runtime/node code).
function ReviewRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  if (typeof window !== 'undefined') {
    (window as unknown as { __PRISM_MAT_CAM__?: unknown }).__PRISM_MAT_CAM__ = {
      camera,
      controls,
      set(px: number, py: number, pz: number, tx = 0, ty = 0, tz = 0) {
        camera.position.set(px, py, pz);
        const c = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
        if (c?.target) { c.target.set(tx, ty, tz); c.update(); }
        else camera.lookAt(tx, ty, tz);
      },
    };
  }
  return null;
}

function MaterialLabStage() {
  const sp = useSearchParams();
  const autoRotate = sp.get('orbit') === '1';
  return (
    <div data-material-stage data-testid="material-stage">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        camera={{ position: [0.2, 0.0, 22.5], fov: 36 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.AgXToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
        data-testid="material-canvas"
      >
        <color attach="background" args={['#05060a']} />
        <Suspense fallback={null}>
          <MaterialLabScene />
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          enablePan
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={44}
          target={[0, 0, 0]}
        />
        <ReviewRig />
      </Canvas>
    </div>
  );
}

export default function MaterialLabPage() {
  return (
    <Suspense fallback={<div data-material-stage />}>
      <MaterialLabStage />
    </Suspense>
  );
}
