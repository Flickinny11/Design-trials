'use client';

// /editor — PRISM EDITOR INTEGRATION (I-1: the editor SHELL).
//
// A NEW route that renders the LIVE APP GRAPH (public/prism-mock/home/
// live-graph.json, loaded into useGraphSourceStore) in ONE WebGPU canvas, with
// the editor layout (docked glass panel zones), a free orbit/pan/zoom camera, and
// the galaxy ↔ canvas ↔ preview tri-state. ADDITIVE — it composes the proven lab
// pieces (the P-1 Pane primitive for docks, the node-realization path for the
// graph, the chassis studio IBL); it does NOT modify the lab routes.
//
// Same isolated WebGPURenderer factory as /library + /composite-lab (auto-falls
// back to WebGL2). Studio IBL + AgX tone-mapping + real transmission glass —
// ZERO DOM/CSS/Tailwind/<Html>.
//
//   ?view=galaxy|canvas|preview   open in a specific state (default: canvas)
//   ?hub=<hubId>                  open with a specific active hub
//   ?orbit=1                      enable review auto-orbit

import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { useSearchParams } from 'next/navigation';
import { EditorShellScene } from '@/components/editor-shell/EditorShellScene';
import {
  useEditorShellStore,
  type EditorShellView,
} from '@/components/editor-shell/use-editor-shell-store';

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

// Apply ?view / ?hub deep-link params to the shell store.
function UrlParams() {
  const sp = useSearchParams();
  useEffect(() => {
    const v = sp.get('view');
    if (v === 'galaxy' || v === 'canvas') useEditorShellStore.getState().setView(v as EditorShellView);
    else if (v === 'preview' || v === 'preview-app') useEditorShellStore.getState().setView('preview-app');
    const hub = sp.get('hub');
    if (hub) useEditorShellStore.getState().setActiveHub(hub);
  }, [sp]);
  return null;
}

function EditorStage() {
  const sp = useSearchParams();
  const autoRotate = sp.get('orbit') === '1';
  return (
    <div data-editor-stage data-testid="editor-stage">
      <Canvas
        dpr={[1, 2]}
        gl={webgpuFactory as never}
        camera={{ position: [0, 0, 27], fov: 40 }}
        data-testid="editor-canvas"
      >
        <color attach="background" args={['#05060a']} />
        <UrlParams />
        <Suspense fallback={null}>
          <EditorShellScene />
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate={autoRotate}
          autoRotateSpeed={0.35}
          enablePan
          enableDamping
          dampingFactor={0.08}
          minDistance={16}
          maxDistance={42}
          minPolarAngle={Math.PI * 0.28}
          maxPolarAngle={Math.PI * 0.72}
          minAzimuthAngle={-0.62}
          maxAzimuthAngle={0.62}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}

export default function EditorPage() {
  // useSearchParams must sit under Suspense or `next build` errors.
  return (
    <Suspense fallback={<div data-editor-stage />}>
      <EditorStage />
    </Suspense>
  );
}
