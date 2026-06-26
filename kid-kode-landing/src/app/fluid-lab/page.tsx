'use client';

// /fluid-lab — the REVIEWABLE route for the Prism Fluid System (P-3).
//
// An isolated R3F <Canvas> on a WebGPURenderer (the bg-lab factory — TSL + WebGPU
// compute where available, auto-falling-back to WebGL2). It renders customizable
// GPU FLUIDS — a ping-pong wave-equation field driving liquid-glass surfaces (and,
// on real WebGPU, MLS-MPM particle volumes), each a real NODE, tuned LIVE. Matched
// to the founder-approved chassis aesthetic: studio IBL, AgX, real transmission
// glass — never DOM, never cartoonish plastic.
//
//   ?orbit=1       enable review auto-orbit (default off — fluids read head-on)
//   ?view=galaxy   open in galaxy (unbuilt) state (default: canvas / realized)

import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { useSearchParams } from 'next/navigation';
import { FluidLabScene } from '@/components/editor/fluid/FluidLabScene';
import { useFluidStore } from '@/components/editor/fluid/use-fluid-store';

async function webgpuFactory(props: { canvas?: HTMLCanvasElement } & Record<string, unknown>) {
  const renderer = new WebGPURenderer({
    ...(props as object),
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  } as ConstructorParameters<typeof WebGPURenderer>[0]);
  await renderer.init();
  const r = renderer as unknown as {
    toneMapping: THREE.ToneMapping;
    toneMappingExposure: number;
    outputColorSpace: THREE.ColorSpace;
    setClearColor: (c: number, a: number) => void;
  };
  r.toneMapping = THREE.AgXToneMapping;
  r.toneMappingExposure = 1.12;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x05060a, 1);
  return renderer as unknown as THREE.WebGLRenderer;
}

// Dev/verification rig: publishes the review camera + controls so an
// evaluate_script can frame deterministic capture angles. Editor chrome.
function ReviewRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const gl = useThree((s) => s.gl);
  if (typeof window !== 'undefined') {
    (window as unknown as { __PRISM_FLUID_CAM__?: unknown }).__PRISM_FLUID_CAM__ = {
      camera,
      controls,
      set(px: number, py: number, pz: number, tx = 1.5, ty = 0.2, tz = 0) {
        camera.position.set(px, py, pz);
        const c = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
        if (c?.target) {
          c.target.set(tx, ty, tz);
          c.update();
        } else {
          camera.lookAt(tx, ty, tz);
        }
      },
      // world → CSS pixel projection for verification (drive real Inspector faders).
      project(x: number, y: number, z: number): [number, number] {
        const v = new THREE.Vector3(x, y, z).project(camera);
        const el = gl.domElement;
        const w = el.clientWidth, h = el.clientHeight;
        return [(v.x * 0.5 + 0.5) * w, (1 - (v.y * 0.5 + 0.5)) * h];
      },
    };
  }
  return null;
}

function ViewParam() {
  const sp = useSearchParams();
  const setView = useFluidStore((s) => s.setView);
  useEffect(() => {
    if (sp.get('view') === 'galaxy') setView('galaxy');
  }, [sp, setView]);
  return null;
}

function FluidLabStage() {
  const sp = useSearchParams();
  const autoRotate = sp.get('orbit') === '1';

  return (
    <div data-fluid-stage data-testid="fluid-stage">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={webgpuFactory as never}
        camera={{ position: [1.5, 0.4, 17.5], fov: 34 }}
        data-testid="fluid-canvas"
      >
        <color attach="background" args={['#05060a']} />
        <ViewParam />
        <Suspense fallback={null}>
          <FluidLabScene />
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          enablePan
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={42}
          target={[1.5, 0.2, 0]}
        />
        <ReviewRig />
      </Canvas>
    </div>
  );
}

export default function FluidLabPage() {
  // useSearchParams must sit under Suspense or `next build` errors.
  return (
    <Suspense fallback={<div data-fluid-stage />}>
      <FluidLabStage />
    </Suspense>
  );
}
