'use client';
// GLB-LAB — isolation viewer for editor-chrome GLBs (dev/verification only).
//
// Renders ONE generated GLB centered + framed on a dark studio backdrop with a
// neutral Lightformer rig and contact shadow, so each toolbar form (shell /
// button / icon) can be judged for photoreal fidelity and screenshotted in
// isolation. Mirrors the proven Glb3DPreview isolated-canvas pattern (default
// WebGL renderer) — it deliberately never touches the unified three/webgpu
// graph scene.
//
//   ?file=btn-add            → /prism-mock/editor/meshes/btn-add.glb
//   ?url=/some/other.glb     → explicit url override
//   ?spin=0                  → freeze auto-rotate (deterministic capture)
//   ?bg=light                → light studio backdrop instead of dark

import { Suspense, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Bounds,
  Center,
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
  useGLTF,
} from '@react-three/drei';
import * as THREE from 'three';
import { useSearchParams } from 'next/navigation';

// Shipped (optimized) GLBs live in meshes/. The opt alias is retained so older
// ?opt=… links keep resolving to the same shipped dir.
const MESH_DIR = '/prism-mock/editor/meshes';
const MESH_DIR_OPT = '/prism-mock/editor/meshes';

const TOOLS = [
  'transform', 'selection', 'add', 'library', 'image', 'object3d', 'background',
  'changeArtifact', 'promptEdit', 'text', 'animation', 'function', 'lighting', 'build',
];

// One normalized + auto-rotating GLB in a grid cell.
function GridItem({ url, label, pos }: { url: string; label: string; pos: [number, number, number] }) {
  const gltf = useGLTF(url);
  const node = useMemo(() => {
    const s = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    s.position.sub(center);
    const k = 1.5 / (Math.max(size.x, size.y, size.z) || 1);
    const holder = new THREE.Group();
    holder.add(s); holder.scale.setScalar(k);
    return holder;
  }, [gltf]);
  const grp = useMemo(() => { const g = new THREE.Group(); g.add(node); return g; }, [node]);
  useFrame((_, dt) => { grp.rotation.y += dt * 0.7; });
  void label;
  return (
    <group position={pos}>
      <primitive object={grp} />
    </group>
  );
}

function Model({ url }: { url: string }) {
  const gltf = useGLTF(url);
  return (
    <Bounds fit clip observe margin={1.2}>
      <Center>
        <primitive object={gltf.scene} />
      </Center>
    </Bounds>
  );
}

function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} castShadow />
      <directionalLight position={[-5, 2, -3]} intensity={0.5} color="#bcd4ff" />
      <pointLight position={[0, -3, 4]} intensity={0.6} color="#ffd9a0" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.0} position={[0, 4, 4]} scale={[10, 7, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={0.9} position={[-5, 1, -4]} scale={[7, 7, 1]} color="#cfe0ff" />
        <Lightformer form="ring" intensity={0.8} position={[4, -2, 3]} scale={[5, 5, 1]} color="#ffe7bf" />
        <Lightformer form="rect" intensity={1.1} position={[0, -1, -6]} scale={[10, 6, 1]} color="#9fb6ff" />
      </Environment>
    </>
  );
}

function Grid({ kind, opt }: { kind: 'ic' | 'btn'; opt: boolean }) {
  const dir = opt ? MESH_DIR_OPT : MESH_DIR;
  const COLS = 5;
  return (
    <group>
      {TOOLS.map((t, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = (col - (COLS - 1) / 2) * 2.7;
        const y = (1 - row) * 2.85;
        return (
          <GridItem
            key={t}
            url={`${dir}/${kind}-${t}.glb`}
            label={t}
            pos={[x, y, 0]}
          />
        );
      })}
    </group>
  );
}

function GlbLabInner() {
  const sp = useSearchParams();
  const file = sp.get('file');
  const grid = sp.get('grid') as 'ic' | 'btn' | null;
  const opt = sp.get('opt') !== '0';
  const url = sp.get('url') || (file ? `${opt ? MESH_DIR_OPT : MESH_DIR}/${file}.glb` : '');
  const spin = sp.get('spin') !== '0';
  const light = sp.get('bg') === 'light';
  const [err, setErr] = useState<string | null>(null);

  const bg = light
    ? 'radial-gradient(circle at 50% 35%, #2a3142 0%, #11141d 75%)'
    : 'radial-gradient(circle at 50% 35%, #141a28 0%, #05070d 75%)';

  if (grid === 'ic' || grid === 'btn') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: bg }}>
        <Canvas shadows gl={{ alpha: false, antialias: true }} dpr={[1, 2]} camera={{ position: [0, 0, 16], fov: 38 }}>
          <color attach="background" args={[light ? '#11141d' : '#05070d']} />
          <StudioLights />
          <Suspense fallback={null}>
            <Grid kind={grid} opt={opt} />
          </Suspense>
        </Canvas>
        <div data-testid="glb-lab-label" style={{ position: 'fixed', left: 16, bottom: 14, fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#cfe0ff', background: 'rgba(8,12,20,0.6)', padding: '6px 12px', borderRadius: 8 }}>
          grid={grid} {opt ? '(optimized)' : '(raw)'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: bg }}>
      {url ? (
        <Canvas
          shadows
          gl={{ alpha: false, antialias: true }}
          dpr={[1, 2]}
          camera={{ position: [0, 0.4, 4], fov: 38 }}
          onError={() => setErr('canvas error')}
        >
          <color attach="background" args={[light ? '#11141d' : '#05070d']} />
          <StudioLights />
          <Suspense fallback={null}>
            <Model url={url} />
          </Suspense>
          <ContactShadows position={[0, -1.15, 0]} opacity={0.55} scale={6} blur={2.4} far={3} />
          <OrbitControls
            makeDefault
            autoRotate={spin}
            autoRotateSpeed={1.6}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={1.2}
            maxDistance={14}
          />
        </Canvas>
      ) : null}

      {/* DOM label overlay (greppable; survives screenshots) */}
      <div
        data-testid="glb-lab-label"
        style={{
          position: 'fixed',
          left: 16,
          bottom: 14,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          letterSpacing: '0.04em',
          color: '#cfe0ff',
          background: 'rgba(8,12,20,0.6)',
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid rgba(140,170,210,0.2)',
        }}
      >
        {url ? (file ?? url) : 'no ?file= or ?url='}
        {err ? ` · ${err}` : ''}
      </div>
    </div>
  );
}

export default function GlbLabPage() {
  // useSearchParams must sit under Suspense or `next build` errors.
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#05070d' }} />}>
      <GlbLabInner />
    </Suspense>
  );
}
