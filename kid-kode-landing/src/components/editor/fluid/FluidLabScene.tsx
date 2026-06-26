'use client';

// FluidLabScene — the R3F scene for /fluid-lab, in the founder-approved chassis
// glass language: ONE shared studio IBL (StudioEnv) so the liquid glass refracts a
// real environment, editorial backdrop, premium studio lighting, AgX — matched to
// /toolbar-chassis + /material-lab + /primitive-lab by construction.
//
// Two-state (INV-0.1 / INV-R2): GALAXY shows every fluid node UNBUILT (dormant
// seeds); CANVAS shows them REALIZED (live GPU-simulated liquid glass). The
// liquid-glass timeline (spec §3.3) is driven once here. Isolated editor-chrome —
// window/three access is fine (not runtime/node code). It runs on a WebGPURenderer
// (bg-lab factory) which auto-falls-back to WebGL2.

import { Suspense, useEffect, useMemo } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StudioEnv } from '@/components/editor/chassis/StudioEnv';
import { FluidEngravedText } from './FluidEngravedText';
import { FluidMesh } from './FluidMesh';
import { DormantFluid } from './DormantFluid';
import { FluidInspector } from './FluidInspector';
import { FluidPalette } from './FluidPalette';
import { useFluidStore } from './use-fluid-store';

// A rich, high-contrast editorial backdrop — bright light bars + glowing orbs over
// a deep gradient — so the liquid glass has detailed CONTENT to refract + distort
// (a flat gradient makes refraction invisible). The flow bends these features → the
// fluid motion reads through the glass.
function Backdrop() {
  const select = useFluidStore((s) => s.select);
  const tex = useMemo(() => {
    const W = 1024, H = 640;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#39455a');
    grad.addColorStop(0.5, '#1b2334');
    grad.addColorStop(1, '#06080f');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    // soft cool bloom
    const bloom = g.createRadialGradient(W * 0.5, H * 0.42, 20, W * 0.5, H * 0.42, H * 0.8);
    bloom.addColorStop(0, 'rgba(150,190,240,0.34)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bloom; g.fillRect(0, 0, W, H);
    // DENSE bright vertical light bars across the FULL width (the refraction reads
    // these as flowing streaks wherever a glass panel sits over them).
    const NBARS = 18;
    for (let i = 0; i < NBARS; i++) {
      const x = (i + 0.5) * (W / NBARS) + (i % 2 ? 9 : -9);
      const bw = 6 + (i % 3) * 5;
      const lg = g.createLinearGradient(x - bw, 0, x + bw, 0);
      lg.addColorStop(0, 'rgba(120,170,220,0)');
      lg.addColorStop(0.5, `rgba(${184 + (i % 5) * 8},${214},${248},0.62)`);
      lg.addColorStop(1, 'rgba(120,170,220,0)');
      g.fillStyle = lg; g.fillRect(x - bw, 0, bw * 2, H);
    }
    // glowing orbs (warm + cool jewels) tiled densely for colourful refraction
    const orbCols = [
      'rgba(120,210,235,0.6)', 'rgba(235,180,120,0.5)',
      'rgba(165,150,235,0.5)', 'rgba(150,235,200,0.46)', 'rgba(235,150,180,0.46)',
    ];
    for (let r = 0; r < 3; r++) {
      for (let cI = 0; cI < 5; cI++) {
        const fx = (cI + (r % 2 ? 0.5 : 0.0)) / 5 + 0.06;
        const fy = (r + 0.5) / 3;
        const rad = 34 + ((r + cI) % 3) * 16;
        const col = orbCols[(r * 5 + cI) % orbCols.length];
        const og = g.createRadialGradient(fx * W, fy * H, 2, fx * W, fy * H, rad);
        og.addColorStop(0, col);
        og.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = og; g.beginPath(); g.arc(fx * W, fy * H, rad, 0, Math.PI * 2); g.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -3.8]} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(null); }}>
      <planeGeometry args={[64, 38]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function EnvTune() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const prevI = scene.environmentIntensity;
    const prevR = scene.environmentRotation?.clone?.();
    scene.environmentIntensity = 0.78;
    if (scene.environmentRotation) scene.environmentRotation.set(0.3, -Math.PI * 0.32, 0);
    return () => {
      scene.environmentIntensity = prevI;
      if (prevR && scene.environmentRotation) scene.environmentRotation.copy(prevR);
    };
  }, [scene]);
  return null;
}

// Single driver for the liquid-glass expand timeline (spec §3.3): advances the
// global phase 0→1 over ~1.4s when triggered, then stops.
function LiquidGlassTimeline() {
  const playing = useFluidStore((s) => s.liquidGlassPlaying);
  useFrame((_, dt) => {
    if (!playing) return;
    const st = useFluidStore.getState();
    const next = Math.min(1, st.liquidGlassPhase + dt / 1.4);
    st.setLiquidGlassPhase(next);
    if (next >= 1) st.setLiquidGlassPlaying(false);
  });
  return null;
}

// Dev/verification probes — editor chrome (window access allowed).
function FluidProbe() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_FLUID_SCENE__ = scene;
    w.__PRISM_FLUID_STORE__ = () => useFluidStore.getState();
    w.__PRISM_FLUID_SET_PARAM__ = (nodeId: string, patch: Record<string, unknown>) =>
      useFluidStore.getState().updateParam(nodeId, patch as never);
    w.__PRISM_FLUID_TRIGGER_LIQUID__ = () => useFluidStore.getState().triggerLiquidGlass();
    w.__PRISM_FLUID_SET_PHASE__ = (v: number) => useFluidStore.getState().setLiquidGlassPhase(v);
    w.__PRISM_FLUID_BACKEND__ = () => {
      const b = (gl as unknown as { backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean } }).backend;
      return { isWebGPU: !!b?.isWebGPUBackend, isWebGL: !!b?.isWebGLBackend };
    };

    // NODE LAW probe (spec §0): every tagged fluid render maps to a backing node.
    w.__PRISM_FLUID_AUTHORSHIP__ = () => {
      const rendered: { nodeId: string | null; kind: string; dormant: boolean }[] = [];
      scene.traverse((o) => {
        if (o.userData?.prismFluid) {
          rendered.push({
            nodeId: o.userData.prismNodeId ?? null,
            kind: o.userData.prismKind ?? 'unknown',
            dormant: !!o.userData.prismDormant,
          });
        }
      });
      const st = useFluidStore.getState();
      const nodeIds = st.nodes().map((n) => n.nodeId);
      const orphans = rendered.filter((r) => !r.nodeId || !nodeIds.includes(r.nodeId));
      const unrealized =
        st.viewMode === 'canvas'
          ? nodeIds.filter((id) => !rendered.some((r) => r.nodeId === id && !r.dormant))
          : [];
      return {
        view: st.viewMode, renderedCount: rendered.length, rendered, nodeIds, orphans, unrealized,
        ok: orphans.length === 0 && unrealized.length === 0,
      };
    };
    w.__PRISM_FLUID_AUTHORSHIP_SELFTEST__ = () => {
      const nodeIds = useFluidStore.getState().nodes().map((n) => n.nodeId);
      const synthetic = [
        { nodeId: nodeIds[0] ?? '__none__' },
        { nodeId: '__orphan__' },
        { nodeId: null },
      ];
      const caught = synthetic.filter((r) => !r.nodeId || !nodeIds.includes(r.nodeId));
      return { live: caught.length === 2, caughtCount: caught.length };
    };
  }
  return null;
}

function FluidNodes() {
  const schemas = useFluidStore((s) => s.schemas);
  const viewMode = useFluidStore((s) => s.viewMode);
  const selectedId = useFluidStore((s) => s.selectedId);
  const select = useFluidStore((s) => s.select);
  return (
    <>
      {schemas.map((s) =>
        viewMode === 'galaxy' ? (
          <DormantFluid key={s.nodeId} schema={s} selected={s.nodeId === selectedId} onSelect={select} />
        ) : (
          <FluidMesh key={s.nodeId} schema={s} selected={s.nodeId === selectedId} onSelect={select} />
        ),
      )}
    </>
  );
}

function SelectedCaption() {
  const schema = useFluidStore((s) => s.schemas.find((x) => x.nodeId === s.selectedId));
  if (!schema) return null;
  return (
    <group position={[0, 5.4, 0]}>
      <FluidEngravedText position={[0, 0, 0.02]} fontSize={0.32} letterSpacing={0.05}>
        {schema.caption.toUpperCase()}
      </FluidEngravedText>
      <FluidEngravedText position={[0, -0.48, 0.02]} fontSize={0.14} letterSpacing={0.24}>
        {`${schema.kind === 'surface' ? 'LIQUID GLASS' : 'FLUID VOLUME'} · NODE`}
      </FluidEngravedText>
    </group>
  );
}

// One-time seed so the route opens with a liquid-glass surface + a fluid volume.
function useSeed() {
  useEffect(() => {
    const st = useFluidStore.getState();
    if (st.schemas.length === 0) {
      st.instantiate('surface');
      st.instantiate('volume');
      // re-read fresh state (the snapshot above predates the instantiates) and
      // select the liquid-glass surface so the Inspector opens on it by default.
      const fresh = useFluidStore.getState();
      const surfaceId = fresh.schemas.find((s) => s.kind === 'surface')?.nodeId ?? fresh.schemas[0]?.nodeId ?? null;
      fresh.select(surfaceId);
    }
  }, []);
}

export function FluidLabScene() {
  useSeed();
  return (
    <>
      <FluidProbe />
      <StudioEnv />
      <EnvTune />
      <Backdrop />
      <LiquidGlassTimeline />

      {/* No shadow maps / ContactShadows: those use classic depth + ShaderMaterials
          that the WebGPU node renderer rejects. Premium read comes from the IBL +
          studio lights refracting through the liquid glass. */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[5.5, 12.5, 6]} intensity={2.05} color="#fff3e2" />
      <directionalLight position={[-7, -1, 7]} intensity={1.05} color="#bcd6ff" />
      <directionalLight position={[-2, 0.5, 9]} intensity={1.1} color="#fff7ec" />
      <spotLight position={[12, 6, -1]} angle={0.85} penumbra={1} intensity={52} distance={56} color="#cfe2ff" />
      <spotLight position={[-12, -3, -1]} angle={0.85} penumbra={1} intensity={30} distance={56} color="#e6c9ff" />

      <SelectedCaption />
      <Suspense fallback={null}>
        <FluidNodes />
        <FluidPalette />
        <FluidInspector />
      </Suspense>
    </>
  );
}
