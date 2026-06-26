'use client';

// MaterialLabScene — the R3F scene for /material-lab, in the founder-approved
// chassis language: ONE shared studio IBL (StudioEnv) so every library material
// refracts/reflects correctly, editorial backdrop, premium studio lighting, AgX —
// matched to /toolbar-chassis + /keyframe-editor + /primitive-lab by construction.
//
// Three display primitives (pane / cube / sphere) — real backing NODES — wear the
// selected material so it reads on flat, boxed, and round geometry at once. The
// MaterialPalette browses the library by family and applies on click. Isolated
// editor-chrome (window/three access fine) — never the unified graph scene.

import { Suspense, useEffect, useMemo } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { StudioEnv } from '@/components/editor/chassis/StudioEnv';
import { EngravedText } from '@/components/editor/primitive/EngravedText';
import { MaterialDisplay } from './MaterialDisplay';
import { MaterialPalette } from './MaterialPalette';
import { MaterialInspector } from './MaterialInspector';
import { useMaterialMapSets } from './material-build';
import { getMaterial } from './material-registry';
import { useMaterialStore } from './use-material-store';

function Backdrop() {
  const selectDisplay = useMaterialStore((s) => s.selectDisplay);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 512;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#3c4658');
    grad.addColorStop(0.5, '#222a3c');
    grad.addColorStop(1, '#070a11');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 512);
    const bloom = g.createRadialGradient(32, 200, 8, 32, 200, 380);
    bloom.addColorStop(0, 'rgba(165,195,238,0.40)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bloom; g.fillRect(0, 0, 64, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -4.6]} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); selectDisplay(null); }}>
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
    scene.environmentIntensity = 0.74;
    if (scene.environmentRotation) scene.environmentRotation.set(0.3, -Math.PI * 0.32, 0);
    return () => {
      scene.environmentIntensity = prevI;
      if (prevR && scene.environmentRotation) scene.environmentRotation.copy(prevR);
    };
  }, [scene]);
  return null;
}

// Dev/verification probes — editor chrome (window access allowed).
function MatProbe() {
  const scene = useThree((s) => s.scene);
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_MAT_SCENE__ = scene;
    w.__PRISM_MAT_STORE__ = () => useMaterialStore.getState();
    w.__PRISM_MAT_APPLY__ = (id: string) => useMaterialStore.getState().setMaterial(id);
    w.__PRISM_MAT_SET_FAMILY__ = (f: string) => useMaterialStore.getState().setActiveFamily(f as never);
    w.__PRISM_MAT_OVERRIDE__ = (patch: Record<string, number>) => useMaterialStore.getState().updateOverride(patch);

    // NODE LAW probe (spec §0): every tagged display primitive must map to a
    // backing node; an orphan (rendered without a node) → ok:false → gate FAILS.
    w.__PRISM_MAT_AUTHORSHIP__ = () => {
      const rendered: { nodeId: string | null; kind: string; materialId: string | null }[] = [];
      scene.traverse((o) => {
        if (o.userData?.prismPrimitive) {
          rendered.push({ nodeId: o.userData.prismNodeId ?? null, kind: o.userData.prismKind ?? 'unknown', materialId: o.userData.prismMaterialId ?? null });
        }
      });
      const st = useMaterialStore.getState();
      const nodeIds = st.nodes().map((n) => n.nodeId);
      const orphans = rendered.filter((r) => !r.nodeId || !nodeIds.includes(r.nodeId));
      const unrealized = nodeIds.filter((id) => !rendered.some((r) => r.nodeId === id));
      return {
        renderedCount: rendered.length, rendered, nodeIds, orphans, unrealized,
        selectedMaterialId: st.selectedMaterialId,
        ok: orphans.length === 0 && unrealized.length === 0,
      };
    };
    w.__PRISM_MAT_AUTHORSHIP_SELFTEST__ = () => {
      const nodeIds = useMaterialStore.getState().nodes().map((n) => n.nodeId);
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

function Displays({ mapSets }: { mapSets: Record<string, import('@/components/editor/chassis/materials').WornMaps> }) {
  const displays = useMaterialStore((s) => s.displays);
  const selectedDisplayId = useMaterialStore((s) => s.selectedDisplayId);
  const selectDisplay = useMaterialStore((s) => s.selectDisplay);
  return (
    <>
      {displays.map((d) => (
        <MaterialDisplay
          key={d.nodeId}
          schema={d}
          mapSets={mapSets}
          selected={d.nodeId === selectedDisplayId}
          spin={d.kind !== 'pane'}
          onSelect={selectDisplay}
        />
      ))}
    </>
  );
}

function SelectedCaption() {
  const id = useMaterialStore((s) => s.selectedMaterialId);
  const def = getMaterial(id);
  if (!def) return null;
  return (
    <group position={[0, 5.05, 0]}>
      <EngravedText position={[0, 0, 0.02]} fontSize={0.34} letterSpacing={0.05}>
        {def.label.toUpperCase()}
      </EngravedText>
      <EngravedText position={[0, -0.5, 0.02]} fontSize={0.15} letterSpacing={0.26}>
        {`${def.family.toUpperCase()} · MATERIAL`}
      </EngravedText>
    </group>
  );
}

function Content() {
  const mapSets = useMaterialMapSets();
  return (
    <>
      <SelectedCaption />
      <Displays mapSets={mapSets} />
      <MaterialPalette mapSets={mapSets} />
      <MaterialInspector mapSets={mapSets} />
    </>
  );
}

export function MaterialLabScene() {
  return (
    <>
      <MatProbe />
      <StudioEnv />
      <EnvTune />
      <Backdrop />

      <ambientLight intensity={0.55} />
      <directionalLight
        position={[5.5, 12.5, 6]}
        intensity={2.05}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={0.5}
        shadow-camera-far={52}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-7, -1, 7]} intensity={1.05} color="#bcd6ff" />
      <directionalLight position={[-2, 0.5, 9]} intensity={1.1} color="#fff7ec" />
      <spotLight position={[12, 6, -1]} angle={0.85} penumbra={1} intensity={52} distance={56} color="#cfe2ff" />
      <spotLight position={[-12, -3, -1]} angle={0.85} penumbra={1} intensity={30} distance={56} color="#e6c9ff" />

      <Suspense fallback={null}>
        <Content />
      </Suspense>

      <ContactShadows position={[0, -5.4, 0]} opacity={0.38} scale={46} blur={2.6} far={6} resolution={1024} color="#000308" />
    </>
  );
}
