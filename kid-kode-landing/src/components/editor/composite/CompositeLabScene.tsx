'use client';

// CompositeLabScene — the R3F scene for /composite-lab (P-4), in the founder-approved
// chassis glass language: ONE shared studio IBL (StudioEnv), editorial backdrop,
// premium studio lighting, AgX — matched to /toolbar-chassis + /fluid-lab. Runs on a
// WebGPURenderer (the /fluid-lab factory; auto-falls-back to WebGL2) because the
// dropdown reuses the P-3 liquid-glass TSL surface.
//
// Two-state (INV-0.1 / INV-R2): GALAXY shows every composite SUBGRAPH unbuilt
// (dormant seeds); CANVAS shows it REALIZED (the assembled nav / footer / card). The
// nav's tabs + dropdown items are the BOUND VIEW over the HUB nodes (the planet
// column). Isolated editor-chrome — window/three access is fine (not runtime/node).

import { Suspense, useEffect, useMemo } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StudioEnv } from '@/components/editor/chassis/StudioEnv';
import { CompositeText } from './CompositeText';
import { NavHeaderComposite } from './NavHeaderComposite';
import { GenericComposite } from './GenericComposite';
import { DormantComposite } from './DormantComposite';
import { HubPlanets } from './HubPlanets';
import { CompositePalette } from './CompositePalette';
import { CompositeInspector } from './CompositeInspector';
import { useCompositeStore } from './use-composite-store';
import { resolveNavTabs, compositeMembers, compositeEdges } from './composite-schema';
import { useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';

// Rich high-contrast editorial backdrop — light bars + glowing orbs over a deep
// gradient — so the transmission glass has CONTENT to refract (a flat backdrop makes
// refraction invisible; the P-3 lesson). Clicking empty space deselects.
function Backdrop() {
  const select = useCompositeStore((s) => s.select);
  const tex = useMemo(() => {
    const W = 1024, H = 640;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#39455a'); grad.addColorStop(0.5, '#1b2334'); grad.addColorStop(1, '#06080f');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const bloom = g.createRadialGradient(W * 0.5, H * 0.4, 20, W * 0.5, H * 0.4, H * 0.8);
    bloom.addColorStop(0, 'rgba(150,190,240,0.32)'); bloom.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bloom; g.fillRect(0, 0, W, H);
    const NBARS = 18;
    for (let i = 0; i < NBARS; i++) {
      const x = (i + 0.5) * (W / NBARS) + (i % 2 ? 9 : -9);
      const bw = 6 + (i % 3) * 5;
      const lg = g.createLinearGradient(x - bw, 0, x + bw, 0);
      lg.addColorStop(0, 'rgba(120,170,220,0)');
      lg.addColorStop(0.5, `rgba(${184 + (i % 5) * 8},214,248,0.6)`);
      lg.addColorStop(1, 'rgba(120,170,220,0)');
      g.fillStyle = lg; g.fillRect(x - bw, 0, bw * 2, H);
    }
    const orbCols = ['rgba(120,210,235,0.55)', 'rgba(235,180,120,0.46)', 'rgba(165,150,235,0.46)', 'rgba(150,235,200,0.42)', 'rgba(235,150,180,0.42)'];
    for (let r = 0; r < 3; r++) {
      for (let cI = 0; cI < 5; cI++) {
        const fx = (cI + (r % 2 ? 0.5 : 0)) / 5 + 0.06;
        const fy = (r + 0.5) / 3;
        const rad = 34 + ((r + cI) % 3) * 16;
        const col = orbCols[(r * 5 + cI) % orbCols.length];
        const og = g.createRadialGradient(fx * W, fy * H, 2, fx * W, fy * H, rad);
        og.addColorStop(0, col); og.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = og; g.beginPath(); g.arc(fx * W, fy * H, rad, 0, Math.PI * 2); g.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -4.2]} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(null); }}>
      <planeGeometry args={[68, 40]} />
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
    return () => { scene.environmentIntensity = prevI; if (prevR && scene.environmentRotation) scene.environmentRotation.copy(prevR); };
  }, [scene]);
  return null;
}

// The liquid-glass dropdown expand timeline driver (spec §3.3 / §4): advances
// dropdownPhase toward dropdownTarget over ~0.9s when playing, then stops.
function DropdownTimeline() {
  useFrame((_, dt) => {
    const st = useCompositeStore.getState();
    if (!st.dropdownPlaying) return;
    const dir = st.dropdownTarget === 1 ? 1 : -1;
    const next = THREE.MathUtils.clamp(st.dropdownPhase + (dir * dt) / 0.9, 0, 1);
    st.setDropdownPhase(next);
    if ((dir === 1 && next >= 1) || (dir === -1 && next <= 0)) st.setDropdownPlaying(false);
  });
  return null;
}

// Dev/verification probes — editor chrome (window access allowed).
function CompositeProbe() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_COMPOSITE_SCENE__ = scene;
    w.__PRISM_COMPOSITE_STORE__ = () => useCompositeStore.getState();
    w.__PRISM_COMPOSITE_BACKEND__ = () => {
      const b = (gl as unknown as { backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean } }).backend;
      return { isWebGPU: !!b?.isWebGPUBackend, isWebGL: !!b?.isWebGLBackend };
    };

    // NODE LAW / subgraph probe (spec §0): every tagged member render maps to a node.
    w.__PRISM_COMPOSITE_AUTHORSHIP__ = () => {
      const rendered: { nodeId: string | null; role: string; dormant: boolean }[] = [];
      scene.traverse((o) => {
        if (o.userData?.prismCompositeMember) {
          rendered.push({ nodeId: o.userData.prismNodeId ?? null, role: o.userData.prismRole ?? 'unknown', dormant: !!o.userData.prismDormant });
        }
      });
      const st = useCompositeStore.getState();
      const nodeIds = st.nodes().map((n) => n.nodeId);
      const orphans = rendered.filter((r) => !r.nodeId || !nodeIds.includes(r.nodeId));
      const unrealized = st.viewMode === 'canvas' ? nodeIds.filter((id) => !rendered.some((r) => r.nodeId === id && !r.dormant)) : [];
      return { view: st.viewMode, renderedCount: rendered.length, rendered, nodeIds, orphans, unrealized, ok: orphans.length === 0 && unrealized.length === 0 };
    };
    w.__PRISM_COMPOSITE_AUTHORSHIP_SELFTEST__ = () => {
      const nodeIds = useCompositeStore.getState().nodes().map((n) => n.nodeId);
      const synthetic = [{ nodeId: nodeIds[0] ?? '__none__' }, { nodeId: '__orphan__' }, { nodeId: null }];
      const caught = synthetic.filter((r) => !r.nodeId || !nodeIds.includes(r.nodeId));
      return { live: caught.length === 2, caughtCount: caught.length };
    };

    // BINDING probes (§4.2): the resolved tab view + the instantiated subgraph shape.
    w.__PRISM_NAV_TABS__ = (compositeId?: string) => {
      const st = useCompositeStore.getState();
      const c = compositeId ? st.composites.find((x) => x.compositeId === compositeId) : st.composites.find((x) => x.templateId === 'nav-header');
      if (!c?.binding) return null;
      const tabs = resolveNavTabs(st.hubs, c.binding);
      return { compositeId: c.compositeId, autoAdd: c.binding.autoAdd, hubCount: st.hubs.length, tabCount: tabs.length, labels: tabs.map((t) => t.label), keys: tabs.map((t) => t.key) };
    };
    w.__PRISM_COMPOSITE_SUBGRAPH__ = (compositeId?: string) => {
      const st = useCompositeStore.getState();
      const c = compositeId ? st.composites.find((x) => x.compositeId === compositeId) : st.composites[st.composites.length - 1];
      if (!c) return null;
      const members = compositeMembers(c, st.hubs);
      const edges = compositeEdges(c, st.hubs);
      return { compositeId: c.compositeId, templateId: c.templateId, memberCount: members.length, memberIds: members.map((m) => m.memberId), roles: members.map((m) => m.role), edgeCount: edges.length, bindingEdges: edges.filter((e) => e.kind === 'binding').length, parentEdges: edges.filter((e) => e.kind === 'parent').length };
    };
  }
  return null;
}

function NodeLayer({ maps }: { maps: Record<string, WornMaps> }) {
  const composites = useCompositeStore((s) => s.composites);
  const hubs = useCompositeStore((s) => s.hubs);
  const viewMode = useCompositeStore((s) => s.viewMode);
  const selectedId = useCompositeStore((s) => s.selectedId);
  const select = useCompositeStore((s) => s.select);
  return (
    <>
      {composites.map((c) =>
        viewMode === 'galaxy' ? (
          <DormantComposite key={c.compositeId} composite={c} hubs={hubs} selected={c.compositeId === selectedId} onSelect={select} />
        ) : c.templateId === 'nav-header' ? (
          <NavHeaderComposite key={c.compositeId} composite={c} hubs={hubs} maps={maps} selected={c.compositeId === selectedId} onSelect={select} />
        ) : (
          <GenericComposite key={c.compositeId} composite={c} maps={maps} selected={c.compositeId === selectedId} onSelect={select} />
        ),
      )}
    </>
  );
}

function SelectedCaption() {
  const composite = useCompositeStore((s) => s.composites.find((x) => x.compositeId === s.selectedId));
  if (!composite) return null;
  return (
    <group position={[0, 5.6, 0]}>
      <CompositeText position={[0, 0, 0.02]} fontSize={0.3} letterSpacing={0.05} variant="bright">
        {composite.caption.toUpperCase()}
      </CompositeText>
      <CompositeText position={[0, -0.46, 0.02]} fontSize={0.13} letterSpacing={0.22} variant="engraved">
        {`${composite.templateId.toUpperCase()} · SUBGRAPH`}
      </CompositeText>
    </group>
  );
}

function Worn() {
  const maps = useWornMaps();
  return (
    <>
      <NodeLayer maps={maps} />
      <CompositePalette />
      <CompositeInspector />
    </>
  );
}

// One-time seed: open with the canonical nav header over the sample hub set.
function useSeed() {
  useEffect(() => {
    const st = useCompositeStore.getState();
    if (st.composites.length === 0) {
      const id = st.instantiateComposite('nav-header');
      useCompositeStore.getState().select(id);
    }
  }, []);
}

export function CompositeLabScene() {
  useSeed();
  const select = useCompositeStore((s) => s.select);
  const hubs = useCompositeStore((s) => s.hubs);
  return (
    <>
      <CompositeProbe />
      <StudioEnv />
      <EnvTune />
      <Backdrop />
      <DropdownTimeline />

      {/* No shadow maps / ContactShadows on the WebGPU node renderer (P-3 lesson). */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[5.5, 12.5, 6]} intensity={2.05} color="#fff3e2" />
      <directionalLight position={[-7, -1, 7]} intensity={1.05} color="#bcd6ff" />
      <directionalLight position={[-2, 0.5, 9]} intensity={1.1} color="#fff7ec" />
      <spotLight position={[12, 6, -1]} angle={0.85} penumbra={1} intensity={52} distance={56} color="#cfe2ff" />
      <spotLight position={[-12, -3, -1]} angle={0.85} penumbra={1} intensity={30} distance={56} color="#e6c9ff" />

      <SelectedCaption />
      <HubPlanets hubs={hubs} onPick={() => select(null)} />
      <Suspense fallback={null}>
        <Worn />
      </Suspense>
    </>
  );
}
