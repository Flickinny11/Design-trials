'use client';
// THREE-D-BACKGROUNDS — isolation lab (dev/verification only).
//
// Renders a single background preset full-screen on a plain WebGPU canvas with
// NO app content, so each procedural layer can be seen + tuned in isolation and
// the numeric harness can measure a clean frame. A small reference frame at the
// origin gives scale. `?preset=brass-nebula&density=0.8&only=nebula|particles`
// drives it; `?orbit=1` slowly arcs the camera so parallax is visible.

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { useSearchParams } from 'next/navigation';
import type { PrismHub } from '@/lib/prism-graph/types';
import { applyBackgroundPreset } from '@/lib/editor/backgrounds/presets';
import { HubBackgroundStack } from '@/components/editor/graph/backgrounds/HubBackgroundStack';

async function webgpuFactory(props: { canvas?: HTMLCanvasElement } & Record<string, unknown>) {
  const renderer = new WebGPURenderer({
    ...(props as object),
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  } as ConstructorParameters<typeof WebGPURenderer>[0]);
  await renderer.init();
  (renderer as unknown as { setClearColor: (c: number, a: number) => void }).setClearColor(0x04050a, 1);
  return renderer as unknown as THREE.WebGLRenderer;
}

// Publishes a rolling average frame time (ms) so the harness can read frame
// budget per tier (C4). Verification-only.
function FrameTimeProbe() {
  const acc = useRef({ n: 0, sum: 0, last: 0 });
  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000;
    const a = acc.current;
    if (a.last > 0) {
      a.sum += now - a.last;
      a.n += 1;
      // Rolling window of the last ~120 frames.
      if (a.n > 120) {
        a.sum *= 119 / 120;
        a.n = 119;
      }
      (globalThis as { __BG_FRAME_MS__?: number }).__BG_FRAME_MS__ = a.sum / a.n;
    }
    a.last = now;
  });
  return null;
}

// Publishes a world→screen projection fn so the parallax harness can measure
// the on-screen pixel delta of known near/far world points across two camera
// waypoints (C1). Verification-only.
function ProjectProbe() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  useFrame(() => {
    const W = size.width * (dpr || 1);
    const H = size.height * (dpr || 1);
    (globalThis as { __BG_PROJECT__?: (x: number, y: number, z: number) => [number, number] }).__BG_PROJECT__ = (
      x,
      y,
      z,
    ) => {
      const v = new THREE.Vector3(x, y, z).project(camera);
      return [(v.x * 0.5 + 0.5) * W, (1 - (v.y * 0.5 + 0.5)) * H];
    };
  });
  return null;
}

function CameraRig({
  orbit,
  pose,
  parallel,
}: {
  orbit: boolean;
  pose: { x: number; y: number; z: number };
  parallel: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!orbit) {
      // Fixed pose (used by the parallax harness to capture matched waypoints).
      camera.position.set(pose.x, pose.y, pose.z);
      // parallel = pure pan (look straight down -z) so near/far parallax is
      // horizontal + measurable; otherwise aim at the origin.
      if (parallel) camera.lookAt(pose.x, pose.y, -100);
      else camera.lookAt(0, 0, 0);
      return;
    }
    t.current += delta * 0.25;
    const r = 12;
    camera.position.set(Math.sin(t.current) * r, Math.sin(t.current * 0.5) * 2, Math.cos(t.current) * r);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function BgLabPage() {
  // useSearchParams must sit under a Suspense boundary or `next build` errors.
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#04050a' }} />}>
      <BgLabInner />
    </Suspense>
  );
}

function BgLabInner() {
  const sp = useSearchParams();
  const preset = sp.get('preset') || 'brass-nebula';
  const only = sp.get('only'); // 'nebula' | 'particles' | null
  const orbit = sp.get('orbit') === '1';
  const tierParam = (sp.get('tier') as 'T0' | 'T1' | 'T2' | null) || null;
  const pose = {
    x: Number(sp.get('camx') ?? '0') || 0,
    y: Number(sp.get('camy') ?? '0') || 0,
    z: Number(sp.get('camz') ?? '12') || 12,
  };
  const params = useMemo(() => {
    const p: Record<string, number | string> = {};
    for (const k of ['density', 'drift', 'depthSpread', 'intensity', 'palette']) {
      const v = sp.get(k);
      if (v != null) p[k] = k === 'palette' ? v : Number(v);
    }
    return p;
  }, [sp]);

  const hub = useMemo<PrismHub>(() => {
    let bg = applyBackgroundPreset(preset, params);
    if (only === 'nebula') bg = bg.filter((l) => l.kind === 'volumetric-nebula');
    if (only === 'particles') bg = bg.filter((l) => l.kind === 'particle-field');
    if (only === 'plate') bg = bg.filter((l) => l.kind === 'parallax-plane' || l.kind === 'image');
    return {
      hubId: 'lab',
      title: 'lab',
      layout: { viewportWidth: 1440, viewportHeight: 900, contentHeight: 900, backgroundColor: '#04050a' },
      background: bg,
    };
  }, [preset, params, only]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#04050a' }}>
      <Canvas dpr={[1, 2]} gl={webgpuFactory as never} camera={{ position: [0, 0, 12], fov: 45, near: 0.1, far: 2000 }}>
        <Suspense fallback={null}>
          <CameraRig orbit={orbit} pose={pose} parallel={sp.get('look') === 'parallel'} />
          <FrameTimeProbe />
          <ProjectProbe />
          <HubBackgroundStack hub={hub} forceTier={tierParam} flatPlate={sp.get('flatplate') === '1'} />
          {/* reference frame at origin for scale (small wire box) */}
          <mesh>
            <boxGeometry args={[2, 2, 2]} />
            <meshBasicMaterial color="#1ec8ff" wireframe transparent opacity={0.5} />
          </mesh>
        </Suspense>
      </Canvas>
      <div style={{ position: 'absolute', left: 12, top: 10, font: '11px monospace', color: '#a8a79e' }}>
        bg-lab · {preset} · {only || 'all-layers'} {orbit ? '· orbit' : ''}
      </div>
    </div>
  );
}
