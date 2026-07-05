'use client';

// /library — the REVIEWABLE route for the Prism Library UX (P-6, spec §7).
//
// An isolated R3F <Canvas> on a WebGPURenderer (the /composite-lab + /fluid-lab
// factory; auto-falls-back to WebGL2) so the P-3 liquid-glass TSL surface + node
// materials work. It renders the in-canvas 3D LIBRARY/PALETTE — browsable +
// searchable, each entry a live 3D preview — plus the canvas it drops nodes onto and
// the Inspector. Matched to the founder-approved chassis aesthetic: studio IBL, AgX,
// real transmission glass — ZERO DOM/CSS/Tailwind/<Html>.
//
//   ?orbit=1       enable review auto-orbit (default off — the shelf reads head-on)
//   ?view=galaxy   open in galaxy (unbuilt) state (default: canvas / realized)

import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { useSearchParams } from 'next/navigation';
import { LibraryLabScene } from '@/components/editor/library/LibraryLabScene';
import { useLibraryStore } from '@/components/editor/library/use-library-store';

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

// Dev/verification rig: publishes the review camera + a world→CSS projector so a
// headless evaluate_script can drive the real in-canvas controls. Editor chrome.
function ReviewRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const gl = useThree((s) => s.gl);
  if (typeof window !== 'undefined') {
    (window as unknown as { __PRISM_LIB_CAM__?: unknown }).__PRISM_LIB_CAM__ = {
      camera,
      controls,
      set(px: number, py: number, pz: number, tx = -1, ty = 0, tz = 0) {
        camera.position.set(px, py, pz);
        const c = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
        if (c?.target) { c.target.set(tx, ty, tz); c.update(); } else camera.lookAt(tx, ty, tz);
      },
      project(x: number, y: number, z: number): [number, number] {
        const v = new THREE.Vector3(x, y, z).project(camera);
        const el = gl.domElement;
        return [(v.x * 0.5 + 0.5) * el.clientWidth, (1 - (v.y * 0.5 + 0.5)) * el.clientHeight];
      },
    };
  }
  return null;
}

function ViewParam() {
  const sp = useSearchParams();
  const setView = useLibraryStore((s) => s.setView);
  useEffect(() => {
    if (sp.get('view') === 'galaxy') setView('galaxy');
  }, [sp, setView]);
  return null;
}

function LibraryStage() {
  const sp = useSearchParams();
  const autoRotate = sp.get('orbit') === '1';
  return (
    <div data-library-stage data-testid="library-stage">
      <Canvas
        dpr={[1, 2]}
        gl={webgpuFactory as never}
        camera={{ position: [-1.5, 0, 21], fov: 38 }}
        data-testid="library-canvas"
      >
        <color attach="background" args={['#05060a']} />
        <ViewParam />
        <Suspense fallback={null}>
          <LibraryLabScene />
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          enablePan
          enableDamping
          dampingFactor={0.08}
          minDistance={8}
          maxDistance={52}
          target={[-1.5, 0, 0]}
        />
        <ReviewRig />
      </Canvas>
    </div>
  );
}

export default function LibraryPage() {
  // useSearchParams must sit under Suspense or `next build` errors.
  return (
    <Suspense fallback={<div data-library-stage />}>
      <LibraryStage />
    </Suspense>
  );
}
