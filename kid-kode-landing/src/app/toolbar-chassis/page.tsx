'use client';

// /toolbar-chassis — the REVIEWABLE route for the Prism Toolbar Chassis.
//
// An isolated R3F WebGL <Canvas> (the proven Glb3DPreview idiom — it never
// touches the unified three/webgpu graph scene) renders the founder's locked
// vision: a thick glass pane with a milled cutout per button, each holding a
// rounded cube of editorial stone/metal. AgX tone mapping, sRGB output, soft
// shadows, a real studio environment for refraction/reflection.
//
// ZERO DOM UI: no Tailwind, no className styling, no inline style on chrome — the
// stage is sized by the route's global chassis.css and EVERYTHING visible lives
// inside the canvas. The container uses a data-attribute, not a styling class.
//
//   ?spin=0   freeze the review camera auto-orbit (deterministic capture)

import { Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSearchParams } from 'next/navigation';
import { ChassisScene } from '@/components/editor/chassis/ChassisScene';

// Dev/verification rig: publishes the review camera + controls so an
// evaluate_script can frame deterministic capture angles (overview, material
// close-ups, spin sequence). Editor chrome — window access is fine here.
function ReviewRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  if (typeof window !== 'undefined') {
    (window as unknown as { __PRISM_CHASSIS_CAM__?: unknown }).__PRISM_CHASSIS_CAM__ = {
      camera,
      controls,
      set(px: number, py: number, pz: number, tx = 0, ty = 0, tz = 0) {
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

function ChassisStage() {
  const sp = useSearchParams();
  const autoRotate = sp.get('spin') !== '0';

  return (
    <div data-chassis-stage data-testid="chassis-stage">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        camera={{ position: [0, 0.4, 15.5], fov: 30 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.AgXToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
        data-testid="chassis-canvas"
      >
        <color attach="background" args={['#05060a']} />
        <Suspense fallback={null}>
          <ChassisScene />
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
          enablePan
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={20}
          target={[0, 0, 0]}
        />
        <ReviewRig />
      </Canvas>
    </div>
  );
}

export default function ToolbarChassisPage() {
  // useSearchParams must sit under Suspense or `next build` errors.
  return (
    <Suspense fallback={<div data-chassis-stage />}>
      <ChassisStage />
    </Suspense>
  );
}
