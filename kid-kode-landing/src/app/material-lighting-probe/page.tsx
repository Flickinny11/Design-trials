'use client';

// /material-lighting-probe — the Phase-D verification surface for the Prism
// Material + Lighting subsystem (canvas-spec §10 Lighting + §11 Material).
//
// Client-only (WebGPU): the probe scene is dynamically imported with ssr:false
// so `three/webgpu` never runs on the server. `scripts/verify-material-lighting.mjs`
// drives this page (reads `window.__mlProbe`, toggles lights, screenshots the
// lit sphere vs. the unlit image plane vs. the shadow-catching ground).

import dynamic from 'next/dynamic';

const ProbeScene = dynamic(
  () => import('@/components/editor/material-lighting-probe/ProbeScene'),
  {
    ssr: false,
    loading: () => <div style={{ color: '#fff', padding: 24 }}>Loading probe…</div>,
  },
);

export default function MaterialLightingProbePage() {
  return <ProbeScene />;
}
