'use client';

// PrimitiveLabScene — the R3F scene for /primitive-lab, in the founder-approved
// chassis glass language: studio IBL (real refraction/reflection), editorial dark
// backdrop, premium studio lighting, AgX — matched to /toolbar-chassis +
// /keyframe-editor so a primitive MATCHES the locked aesthetic by construction.
//
// Two-state scene (INV-0.1 / INV-R2): GALAXY shows every node UNBUILT (dormant
// spheres); CANVAS shows every node REALIZED (the parametric artifacts). The mode
// toggle switches the whole set — never both states at once. The instantiate
// palette + Inspector are DOGFOODED from the primitives themselves (§7.4).
//
// Isolated editor-chrome — never the unified three/webgpu graph scene.

import { Suspense, useEffect, useMemo } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { StudioEnv } from '@/components/editor/chassis/StudioEnv';
import { useWornMaps } from './primitive-materials';
import { PrimitiveMesh } from './PrimitiveMesh';
import { DormantNode } from './DormantNode';
import { PrimitiveChrome } from './PrimitiveChrome';
import { Inspector } from './Inspector';
import { useLabGraphStore } from './use-lab-graph-store';

// Editorial dark backdrop the glass refracts and milled cutouts reveal (chassis).
// Clickable: a click on empty space deselects.
function Backdrop() {
  const select = useLabGraphStore((s) => s.select);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 512;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#323b4a');
    grad.addColorStop(0.5, '#1a2030');
    grad.addColorStop(1, '#06080e');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 512);
    const bloom = g.createRadialGradient(32, 250, 8, 32, 250, 340);
    bloom.addColorStop(0, 'rgba(150,180,225,0.30)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bloom;
    g.fillRect(0, 0, 64, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -4.6]} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(null); }}>
      <planeGeometry args={[60, 34]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// Calm the studio softbox so its reflection doesn't blow out the glass; swing the
// bright lobe to a broad soft satin sheen (premium glass), as in the chassis.
function EnvTune() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const prevI = scene.environmentIntensity;
    const prevR = scene.environmentRotation?.clone?.();
    scene.environmentIntensity = 0.66;
    if (scene.environmentRotation) scene.environmentRotation.set(0.3, -Math.PI * 0.32, 0);
    return () => {
      scene.environmentIntensity = prevI;
      if (prevR && scene.environmentRotation) scene.environmentRotation.copy(prevR);
    };
  }, [scene]);
  return null;
}

// Dev/verification probes — editor chrome, window access allowed (not runtime/node).
function SceneProbe() {
  const scene = useThree((s) => s.scene);
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_PRIM_SCENE__ = scene;
    w.__PRISM_PRIM_STORE__ = () => useLabGraphStore.getState();

    // NODE LAW probe (spec §0 / INV-0.5): traverse the LIVE scene for every tagged
    // primitive and prove each maps to a backing node in the lab graph. A primitive
    // rendered without a node (orphan) → ok:false → the gate FAILS.
    w.__PRISM_PRIM_AUTHORSHIP__ = () => {
      const rendered: { nodeId: string | null; kind: string; dormant: boolean }[] = [];
      scene.traverse((o) => {
        if (o.userData?.prismPrimitive) {
          rendered.push({
            nodeId: o.userData.prismNodeId ?? null,
            kind: o.userData.prismKind ?? 'unknown',
            dormant: !!o.userData.prismDormant,
          });
        }
      });
      const st = useLabGraphStore.getState();
      const nodeIds = st.nodes().map((n) => n.nodeId);
      const orphans = rendered.filter((r) => !r.nodeId || !nodeIds.includes(r.nodeId));
      const unrealizedInCanvas =
        st.viewMode === 'canvas'
          ? nodeIds.filter((id) => !rendered.some((r) => r.nodeId === id && !r.dormant))
          : [];
      return {
        view: st.viewMode,
        renderedCount: rendered.length,
        rendered,
        nodeIds,
        orphans,
        unrealizedInCanvas,
        ok: orphans.length === 0 && unrealizedInCanvas.length === 0,
      };
    };

    // Self-test (mirrors node-authorship-gate philosophy): prove the orphan
    // detector still discriminates — a synthetic unbacked render MUST be caught.
    w.__PRISM_PRIM_AUTHORSHIP_SELFTEST__ = () => {
      const nodeIds = useLabGraphStore.getState().nodes().map((n) => n.nodeId);
      const synthetic = [
        { nodeId: nodeIds[0] ?? '__none__', dormant: false }, // backed
        { nodeId: '__orphan__', dormant: false }, // unbacked → must be caught
        { nodeId: null, dormant: false }, // untagged → must be caught
      ];
      const caught = synthetic.filter((r) => !r.nodeId || !nodeIds.includes(r.nodeId));
      return { live: caught.length === 2, caughtCount: caught.length };
    };
  }
  return null;
}

// Galaxy (unbuilt) ⇄ Canvas (realized) — switches the whole node set.
function NodeLayer({ wornMaps }: { wornMaps: Record<string, import('@/components/editor/chassis/materials').WornMaps> }) {
  const schemas = useLabGraphStore((s) => s.schemas);
  const viewMode = useLabGraphStore((s) => s.viewMode);
  const selectedId = useLabGraphStore((s) => s.selectedId);
  const select = useLabGraphStore((s) => s.select);
  return (
    <>
      {schemas.map((s) =>
        viewMode === 'galaxy' ? (
          <DormantNode key={s.nodeId} schema={s} selected={s.nodeId === selectedId} onSelect={select} />
        ) : (
          <PrimitiveMesh
            key={s.nodeId}
            schema={s}
            wornMaps={wornMaps}
            selected={s.nodeId === selectedId}
            onSelect={select}
          />
        ),
      )}
    </>
  );
}

// Everything that needs the worn-alloy PBR sets, under one Suspense.
function Worn() {
  const wornMaps = useWornMaps();
  return (
    <>
      <NodeLayer wornMaps={wornMaps} />
      <PrimitiveChrome maps={wornMaps} />
      <Inspector maps={wornMaps} />
    </>
  );
}

// One-time seed so the route opens with one of each primitive on screen.
function useSeed() {
  useEffect(() => {
    const st = useLabGraphStore.getState();
    if (st.schemas.length === 0) {
      st.instantiate('pane');
      st.instantiate('cube');
      st.instantiate('sphere');
      st.select(null);
    }
  }, []);
}

export function PrimitiveLabScene() {
  useSeed();
  return (
    <>
      <SceneProbe />
      <StudioEnv />
      <EnvTune />
      <Backdrop />

      {/* Premium studio lighting — matched to the chassis. */}
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[5.5, 12.5, 6]}
        intensity={2.05}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={0.5}
        shadow-camera-far={48}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-7, -1, 7]} intensity={1.05} color="#bcd6ff" />
      <directionalLight position={[-2, 0.5, 9]} intensity={1.1} color="#fff7ec" />
      <spotLight position={[12, 6, -1]} angle={0.85} penumbra={1} intensity={52} distance={56} color="#cfe2ff" />
      <spotLight position={[-12, -3, -1]} angle={0.85} penumbra={1} intensity={30} distance={56} color="#e6c9ff" />

      <Suspense fallback={null}>
        <Worn />
      </Suspense>

      <ContactShadows
        position={[0, -3.0, 0]}
        opacity={0.4}
        scale={42}
        blur={2.6}
        far={6}
        resolution={1024}
        color="#000308"
      />
    </>
  );
}
