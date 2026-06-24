'use client';

// /keyframe-editor — the reviewable route for the Prism Keyframe / Timeline editor.
//
// An isolated R3F WebGL <Canvas> (the proven Glb3DPreview / toolbar-chassis idiom
// — it never touches the unified three/webgpu graph scene) renders the founder's
// glass language: a thick glass timeline pane with channels milled through it,
// worn-alloy fader knobs riding the channels, engraved track labels, a worn-metal
// playhead, and the bound node artifact that animates as the timeline is
// scrubbed / played. AgX tone mapping, sRGB output, soft shadows, a real studio
// environment for refraction/reflection.
//
// ZERO DOM UI: no Tailwind, no className styling, no inline style on chrome — the
// stage is sized by the route's global keyframe-editor.css and EVERYTHING visible
// lives inside the canvas. The container uses a data-attribute, not a class.
//
//   ?orbit=1   enable review auto-orbit (default: off — a timeline reads head-on)

import { Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSearchParams } from 'next/navigation';
import { KeyframeScene } from '@/components/editor/keyframe/KeyframeScene';

// Dev/verification rig: publishes the review camera + controls so an
// evaluate_script can frame deterministic capture angles. Editor chrome — window
// access is fine here (not runtime/node code).
function ReviewRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  if (typeof window !== 'undefined') {
    (window as unknown as { __PRISM_KEYFRAME_CAM__?: unknown }).__PRISM_KEYFRAME_CAM__ = {
      camera,
      controls,
      set(px: number, py: number, pz: number, tx = 0, ty = 1, tz = 0) {
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

function KeyframeStage() {
  const sp = useSearchParams();
  const autoRotate = sp.get('orbit') === '1';

  return (
    <div data-keyframe-stage data-testid="keyframe-stage">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        camera={{ position: [0, 1.2, 19], fov: 33 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.AgXToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
        data-testid="keyframe-canvas"
      >
        <color attach="background" args={['#05060a']} />
        <Suspense fallback={null}>
          <KeyframeScene />
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          enablePan
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={30}
          target={[0, 1, 0]}
        />
        <ReviewRig />
      </Canvas>
    </div>
  );
}

export default function KeyframeEditorPage() {
  // useSearchParams must sit under Suspense or `next build` errors.
  return (
    <Suspense fallback={<div data-keyframe-stage />}>
      <KeyframeStage />
    </Suspense>
  );
}
