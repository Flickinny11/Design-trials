'use client';

// PRISM MARKETING — SHARED WEBGPU CANVAS (SHELL W9)
//
// One canvas convention for every W9 marketing showpiece: the product's real
// renderer — three/webgpu with its automatic WebGL2 backend fallback — mounted
// through the R3F v9 async `gl` factory. WebGPU-FIRST (founder-verified fact,
// 2026-07-05: r171+ production-grade; r184 installed; PMREMGenerator +
// dispersion + TSL compute all present in three.webgpu.js). The resolved
// backend is stamped on window.__PRISM_MK_BACKEND__ for verification, and
// children can gate WebGPU-only work (compute particles) via useForgeBackend.

import { Canvas, useThree, type CanvasProps } from '@react-three/fiber';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type * as THREE from 'three';

type ForgeBackend = 'webgpu' | 'webgl2' | 'unknown';

const BackendContext = createContext<ForgeBackend>('unknown');
export function useForgeBackend(): ForgeBackend {
  return useContext(BackendContext);
}

async function webgpuFactory(
  props: { canvas?: HTMLCanvasElement } & Record<string, unknown>,
): Promise<THREE.WebGLRenderer> {
  const mod = (await import('three/webgpu')) as unknown as {
    WebGPURenderer: new (params: Record<string, unknown>) => THREE.WebGLRenderer & {
      init?: () => Promise<void>;
      backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean };
    };
  };
  const renderer = new mod.WebGPURenderer({
    canvas: props?.canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  if (typeof renderer.init === 'function') await renderer.init();
  if (typeof window !== 'undefined') {
    const b = renderer.backend;
    (window as unknown as { __PRISM_MK_BACKEND__?: string }).__PRISM_MK_BACKEND__ =
      b?.isWebGPUBackend ? 'webgpu' : b?.isWebGLBackend ? 'webgl2' : 'unknown';
  }
  return renderer as unknown as THREE.WebGLRenderer;
}

function BackendProbe({ onResolve }: { onResolve: (b: ForgeBackend) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const b = (gl as unknown as { backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean } })
      .backend;
    onResolve(b?.isWebGPUBackend ? 'webgpu' : b?.isWebGLBackend ? 'webgl2' : 'unknown');
  }, [gl, onResolve]);
  return null;
}

export default function MarketingCanvas({
  children,
  onReady,
  ...props
}: {
  children: ReactNode;
  /** Fires once the canvas has created its first frame (fade-in gate). */
  onReady?: () => void;
} & Omit<CanvasProps, 'children' | 'gl'>) {
  const [backend, setBackend] = useState<ForgeBackend>('unknown');
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={webgpuFactory as never}
      onCreated={() => onReady?.()}
      {...props}
    >
      <BackendProbe onResolve={setBackend} />
      <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>
    </Canvas>
  );
}
