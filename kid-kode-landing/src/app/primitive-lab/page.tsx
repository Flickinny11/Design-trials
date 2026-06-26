'use client';

// /primitive-lab — the REVIEWABLE route for the Prism Primitive System (P-1).
//
// An isolated R3F WebGL <Canvas> (the proven toolbar-chassis / keyframe-editor
// idiom — it never touches the unified three/webgpu graph scene) renders the
// parametric, schema-driven primitives (Pane / Cube / Sphere), each a real NODE,
// reshaped live via an in-canvas Inspector. AgX tone mapping, sRGB output, soft
// shadows, a real studio environment for refraction/reflection — matched to the
// founder-approved chassis aesthetic.
//
// ZERO DOM UI: no Tailwind, no className styling, no inline style on chrome — the
// stage is sized by the route's global primitive-lab.css and EVERYTHING visible
// lives inside the canvas. The container uses a data-attribute, not a class.
//
//   ?orbit=1   enable review auto-orbit (default off — primitives read head-on)
//   ?view=galaxy   open in galaxy (unbuilt) state (default: canvas / realized)

import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSearchParams } from 'next/navigation';
import { PrimitiveLabScene } from '@/components/editor/primitive/PrimitiveLabScene';
import { useLabGraphStore } from '@/components/editor/primitive/use-lab-graph-store';

// Dev/verification rig: publishes the review camera + controls so an
// evaluate_script can frame deterministic capture angles. Editor chrome — window
// access is fine here (not runtime/node code).
function ReviewRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  if (typeof window !== 'undefined') {
    (window as unknown as { __PRISM_PRIM_CAM__?: unknown }).__PRISM_PRIM_CAM__ = {
      camera,
      controls,
      set(px: number, py: number, pz: number, tx = 0, ty = 0.2, tz = 0) {
        camera.position.set(px, py, pz);
        const c = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
        if (c?.target) {
          c.target.set(tx, ty, tz);
          c.update();
        } else {
          camera.lookAt(tx, ty, tz);
        }
      },
    };
  }
  return null;
}

function ViewParam() {
  const sp = useSearchParams();
  const setView = useLabGraphStore((s) => s.setView);
  useEffect(() => {
    if (sp.get('view') === 'galaxy') setView('galaxy');
  }, [sp, setView]);
  return null;
}

function PrimitiveLabStage() {
  const sp = useSearchParams();
  const autoRotate = sp.get('orbit') === '1';

  return (
    <div data-primitive-stage data-testid="primitive-stage">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        camera={{ position: [0, 0.2, 19.5], fov: 33 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.AgXToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
        data-testid="primitive-canvas"
      >
        <color attach="background" args={['#05060a']} />
        <ViewParam />
        <Suspense fallback={null}>
          <PrimitiveLabScene />
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          enablePan
          enableDamping
          dampingFactor={0.08}
          minDistance={5}
          maxDistance={40}
          target={[0, 0.2, 0]}
        />
        <ReviewRig />
      </Canvas>
    </div>
  );
}

export default function PrimitiveLabPage() {
  // useSearchParams must sit under Suspense or `next build` errors.
  return (
    <Suspense fallback={<div data-primitive-stage />}>
      <PrimitiveLabStage />
    </Suspense>
  );
}
