'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — THE LIBRARY SCENE (spec §7).
//
// The R3F scene for /library, in the founder-approved chassis glass language: one
// shared studio IBL (StudioEnv), a rich editorial backdrop (so transmission glass has
// content to refract — the P-3 lesson), premium studio lighting, AgX. Runs on the
// WebGPURenderer (the /composite-lab + /fluid-lab factory; auto-falls-back to WebGL2)
// so the P-3 liquid-glass TSL surface + node materials work.
//
// Composition: the in-canvas PALETTE (left) browses every section with live previews;
// dropping a tile instantiates a node on the CANVAS (center); selecting it opens the
// INSPECTOR (right); the dogfooded NODE-EDITOR panel proves the chrome is built from
// the Pane primitive. Two-state (INV-0.1): galaxy = unbuilt seeds, canvas = realized.

import { Suspense, useEffect, useMemo } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StudioEnv } from '@/components/editor/chassis/StudioEnv';
import { useWornMaps } from '@/components/editor/chassis/materials';
import { useMaterialMapSets } from '@/components/editor/material/material-build';
import { LibraryPalette } from './LibraryPalette';
import { LibraryCanvasNode } from './LibraryCanvasNode';
import { LibraryInspector } from './LibraryInspector';
import { LibraryDogfoodPanel } from './LibraryDogfoodPanel';
import { DragGhost } from './DragGhost';
import { useLibraryStore, CHROME_PANE_ID } from './use-library-store';

const PALETTE_POS: [number, number, number] = [-8.4, 0, 0];
const INSPECTOR_POS: [number, number, number] = [8.6, 0, 0];

// Rich editorial backdrop so the transmission glass has CONTENT to refract.
function Backdrop() {
  const select = useLibraryStore((s) => s.select);
  const tex = useMemo(() => {
    const W = 1024, H = 640;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#33415a'); grad.addColorStop(0.5, '#1a2233'); grad.addColorStop(1, '#06080f');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const bloom = g.createRadialGradient(W * 0.42, H * 0.38, 20, W * 0.42, H * 0.38, H * 0.85);
    bloom.addColorStop(0, 'rgba(150,190,240,0.30)'); bloom.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bloom; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) {
      const x = (i + 0.5) * (W / 18) + (i % 2 ? 9 : -9);
      const bw = 6 + (i % 3) * 5;
      const lg = g.createLinearGradient(x - bw, 0, x + bw, 0);
      lg.addColorStop(0, 'rgba(120,170,220,0)');
      lg.addColorStop(0.5, `rgba(${184 + (i % 5) * 8},214,248,0.55)`);
      lg.addColorStop(1, 'rgba(120,170,220,0)');
      g.fillStyle = lg; g.fillRect(x - bw, 0, bw * 2, H);
    }
    const orbCols = ['rgba(120,210,235,0.5)', 'rgba(235,180,120,0.42)', 'rgba(165,150,235,0.42)', 'rgba(150,235,200,0.4)'];
    for (let r = 0; r < 3; r++) for (let cI = 0; cI < 5; cI++) {
      const fx = (cI + (r % 2 ? 0.5 : 0)) / 5 + 0.06, fy = (r + 0.5) / 3, rad = 34 + ((r + cI) % 3) * 16;
      const og = g.createRadialGradient(fx * W, fy * H, 2, fx * W, fy * H, rad);
      og.addColorStop(0, orbCols[(r * 5 + cI) % orbCols.length]); og.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = og; g.beginPath(); g.arc(fx * W, fy * H, rad, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return (
    <mesh position={[1, 0, -5]} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(null); }}>
      <planeGeometry args={[80, 46]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function EnvTune() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const prevI = scene.environmentIntensity;
    scene.environmentIntensity = 0.8;
    if (scene.environmentRotation) scene.environmentRotation.set(0.3, -Math.PI * 0.32, 0);
    return () => { scene.environmentIntensity = prevI; };
  }, [scene]);
  return null;
}

// Window-keystroke capture for the search bar (zero DOM input; MaterialPromptPanel idiom).
function SearchKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useLibraryStore.getState();
      if (!st.searchFocused) return;
      if (e.key === 'Escape' || e.key === 'Enter') { st.focusSearch(false); e.preventDefault(); return; }
      if (e.key === 'Backspace') { st.backspaceSearch(); e.preventDefault(); return; }
      if (e.key.length === 1 && /[\w \-.]/.test(e.key)) { st.typeSearch(e.key); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}

// NODE LAW probe — editor chrome (window access allowed here, not runtime/node).
function LibraryProbe() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_LIB_SCENE__ = scene;
    w.__PRISM_LIB_STORE__ = () => useLibraryStore.getState();
    w.__PRISM_LIB_BACKEND__ = () => {
      const b = (gl as unknown as { backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean } }).backend;
      return { isWebGPU: !!b?.isWebGPUBackend, isWebGL: !!b?.isWebGLBackend };
    };
    // instantiate an entry by catalog id (the store path a tile click uses).
    w.__PRISM_LIB_INSTANTIATE__ = (entryId: string, pos?: { x: number; y: number }) => {
      const st = useLibraryStore.getState();
      const entry = st.catalog().find((e) => e.id === entryId);
      if (!entry) return null;
      return st.instantiate(entry, pos);
    };
    w.__PRISM_LIB_AUTHORSHIP__ = () => {
      const rendered: { nodeId: string | null; kind: string; dormant: boolean }[] = [];
      scene.traverse((o) => {
        if (o.userData?.prismLibraryItem) {
          rendered.push({ nodeId: o.userData.prismNodeId ?? null, kind: o.userData.prismKind ?? o.userData.prismRole ?? 'unknown', dormant: !!o.userData.prismDormant });
        }
      });
      const st = useLibraryStore.getState();
      const nodeIds = st.nodes().map((n) => n.nodeId);
      const orphans = rendered.filter((r) => !r.nodeId || !nodeIds.includes(r.nodeId));
      const unrealizedInCanvas = st.viewMode === 'canvas' ? nodeIds.filter((id) => !rendered.some((r) => r.nodeId === id && !r.dormant)) : [];
      return { view: st.viewMode, renderedCount: rendered.length, rendered, nodeIds, orphans, unrealizedInCanvas, ok: orphans.length === 0 && unrealizedInCanvas.length === 0 };
    };
    w.__PRISM_LIB_AUTHORSHIP_SELFTEST__ = () => {
      const nodeIds = useLibraryStore.getState().nodes().map((n) => n.nodeId);
      const synthetic = [{ nodeId: nodeIds[0] ?? '__none__' }, { nodeId: '__orphan__' }, { nodeId: null }];
      const caught = synthetic.filter((r) => !r.nodeId || !nodeIds.includes(r.nodeId));
      return { live: caught.length === 2, caughtCount: caught.length };
    };
    // visible palette tiles → world centers (for a trusted-pointer drag-to-canvas).
    w.__PRISM_LIB_TILE_POS__ = () => {
      const out: { entryId: string; world: [number, number, number] }[] = [];
      const v = new THREE.Vector3();
      scene.traverse((o) => {
        if (o.userData?.prismLibTile) { o.getWorldPosition(v); out.push({ entryId: o.userData.prismLibTile, world: [v.x, v.y, v.z] }); }
      });
      return out;
    };
    // inspector fader knob world positions (for a trusted-pointer fader drag).
    w.__PRISM_LIB_INSPECTOR_MAP__ = () => {
      const faders: { key: string; world: [number, number, number] }[] = [];
      const v = new THREE.Vector3();
      scene.traverse((o) => {
        if (o.userData?.prismLibFader) { o.getWorldPosition(v); faders.push({ key: o.userData.prismLibFader, world: [v.x, v.y, v.z] }); }
      });
      const st = useLibraryStore.getState();
      return { open: !!st.selectedId, selectedId: st.selectedId, channelW: 2.7, faders };
    };
  }
  return null;
}

function NodeLayer() {
  const wornMaps = useWornMaps();
  const matSets = useMaterialMapSets();
  const instances = useLibraryStore((s) => s.instances);
  const hubs = useLibraryStore((s) => s.hubs);
  const viewMode = useLibraryStore((s) => s.viewMode);
  const selectedId = useLibraryStore((s) => s.selectedId);
  const select = useLibraryStore((s) => s.select);
  return (
    <>
      {instances.filter((inst) => inst.id !== CHROME_PANE_ID).map((inst) => (
        <LibraryCanvasNode
          key={inst.id}
          instance={inst}
          wornMaps={wornMaps}
          matSets={matSets}
          hubs={hubs}
          viewMode={viewMode}
          selected={inst.id === selectedId}
          onSelect={select}
        />
      ))}
    </>
  );
}

function Worn() {
  const matSets = useMaterialMapSets();
  const hubs = useLibraryStore((s) => s.hubs);
  return (
    <>
      <NodeLayer />
      <LibraryPalette position={PALETTE_POS} matSets={matSets} hubs={hubs} />
      <LibraryDogfoodPanel />
      <LibraryInspector position={INSPECTOR_POS} matSets={matSets} />
      <DragGhost matSets={matSets} hubs={hubs} />
    </>
  );
}

// Seed the dogfooded chrome pane (a real Pane primitive node) + a couple of canvas
// instances so the workspace reads as a live library on cold load.
function useSeed() {
  useEffect(() => {
    const st = useLibraryStore.getState();
    // the dogfooded NODE-EDITOR chrome pane (a real Pane primitive node) is always
    // present, even before the user drops anything (§7.4).
    st.registerChromePane({ x: 1.0, y: -4.0 });
    if (st.instances.filter((i) => i.id !== CHROME_PANE_ID).length === 0) {
      const cat = st.catalog();
      const pane = cat.find((e) => e.id === 'prim:pane');
      const gold = cat.find((e) => e.id === 'mat:metal.gold');
      if (pane) st.instantiate(pane, { x: -1.6, y: 1.8 });
      if (gold) st.instantiate(gold, { x: 2.6, y: 1.6 });
      useLibraryStore.getState().select(null);
    }
  }, []);
}

export function LibraryLabScene() {
  useSeed();
  return (
    <>
      <LibraryProbe />
      <SearchKeys />
      <StudioEnv />
      <EnvTune />
      <Backdrop />

      {/* No shadow maps / ContactShadows on the WebGPU node renderer (P-3 lesson). */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[5.5, 12.5, 6]} intensity={2.05} color="#fff3e2" />
      <directionalLight position={[-7, -1, 7]} intensity={1.05} color="#bcd6ff" />
      <directionalLight position={[-2, 0.5, 9]} intensity={1.1} color="#fff7ec" />
      <spotLight position={[12, 6, -1]} angle={0.85} penumbra={1} intensity={52} distance={56} color="#cfe2ff" />
      <spotLight position={[-12, -3, -1]} angle={0.85} penumbra={1} intensity={30} distance={56} color="#e6c9ff" />

      <Suspense fallback={null}>
        <Worn />
      </Suspense>
    </>
  );
}
