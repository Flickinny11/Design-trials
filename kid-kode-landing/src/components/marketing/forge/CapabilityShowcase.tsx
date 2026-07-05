'use client';

// PRISM MARKETING — CAPABILITY SHOWCASE (SHELL W9, req #2)
//
// Proves the product's core thesis by BEING it: one continuous live scene with
// three states — GALAXY (the app as a knowledge graph), CANVAS (surgical node
// editing with a gizmo), PREVIEW-APP (the built app running in place). A
// segmented control switches state; the scene morphs, it never remounts (the
// runtime's one-scene / two-state law, made visible on the marketing surface).
// WebGPU-first via the shared MarketingCanvas, WebGL2 fallback, reduced-motion
// holds a composed still.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import dynamic from 'next/dynamic';
import Lazy3D from '../Lazy3D';
import { ClearedRender } from './MarketingCanvas';
import { ForgeEnvironment, ForgeLights } from './ForgeEnvironment';
import { usePrefersReducedMotion } from '../../shell/builder/use-reduced-motion';
import { useGeneratedPBR } from './use-generated-pbr';
import { CHROME, GUNMETAL, SIGNAL_RED, RED_HOT, RED_DEEP } from '@/components/shell/design/prism-premium-tokens';

const MarketingCanvas = dynamic(() => import('./MarketingCanvas'), { ssr: false });

type Mode = 'galaxy' | 'canvas' | 'preview';
const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: 'galaxy', label: 'Galaxy', blurb: 'Your whole app as a navigable knowledge graph — every screen a world.' },
  { id: 'canvas', label: 'Canvas', blurb: 'Select a node, grab a handle, and edit the rendered artifact in place.' },
  { id: 'preview', label: 'Preview', blurb: 'The built app runs right here — same scene, no separate compile.' },
];

// A group that fades/scales in when active and is hidden (declaratively) when not.
function State({
  active,
  reduced,
  sway = false,
  children,
}: {
  active: boolean;
  reduced: boolean;
  sway?: boolean;
  children: React.ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const s = useRef(active ? 1 : 0.001);
  useFrame(({ clock }, dt) => {
    const ease = 1 - Math.exp(-dt * 7);
    s.current += ((active ? 1 : 0) - s.current) * ease;
    if (g.current) {
      const sc = 0.7 + s.current * 0.3;
      g.current.scale.setScalar(sc);
    }
    if (spin.current) {
      const t = clock.getElapsedTime();
      // Galaxy rotates fully (reads as a graph); single artifacts sway so they
      // stay front-facing and legible.
      spin.current.rotation.y = reduced ? 0 : sway ? Math.sin(t * 0.35) * 0.32 : t * 0.2;
    }
  });
  // Declarative visibility (React-owned) so a hidden state is never rendered.
  return (
    <group ref={g} visible={active}>
      <group ref={spin}>{children}</group>
    </group>
  );
}

// ── GALAXY: a hub + orbiting nodes, connected (a clear graph topology) ───────
function Galaxy() {
  const nodes = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = 2.1 + (i % 2) * 0.5;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 1.3) * 0.7, Math.sin(a) * r * 0.55));
    }
    return pts;
  }, []);
  const hubMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: RED_HOT, emissive: new THREE.Color(RED_HOT), emissiveIntensity: 2.6, metalness: 0.1, roughness: 0.4, toneMapped: false }),
    [],
  );
  const nodeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: CHROME, emissive: new THREE.Color(SIGNAL_RED), emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.28 }),
    [],
  );
  const edgeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: SIGNAL_RED, emissive: new THREE.Color(SIGNAL_RED), emissiveIntensity: 0.9, transparent: true, opacity: 0.55, toneMapped: false }),
    [],
  );
  // Edges as thin cylinders from the hub to each node (WebGPU renders line
  // primitives unreliably — solid geometry is the safe path).
  const edges = useMemo(
    () =>
      nodes.map((p) => {
        const len = p.length();
        const mid = p.clone().multiplyScalar(0.5);
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
        return { mid: mid.toArray() as [number, number, number], quat: quat.toArray() as [number, number, number, number], len };
      }),
    [nodes],
  );
  return (
    <>
      {edges.map((e, i) => (
        <mesh key={`e${i}`} material={edgeMat} position={e.mid} quaternion={e.quat}>
          <cylinderGeometry args={[0.012, 0.012, e.len, 6]} />
        </mesh>
      ))}
      <mesh material={hubMat} scale={0.42}>
        <icosahedronGeometry args={[1, 2]} />
      </mesh>
      {nodes.map((p, i) => (
        <mesh key={i} position={p} material={nodeMat} scale={0.26 + (i % 3) * 0.05}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
    </>
  );
}

// ── CANVAS: a flat rendered artifact + selection ring + gizmo ───────────────
function CanvasArtifact() {
  const marble = useGeneratedPBR('nero-marquina', { repeat: [1, 1], metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.16, envMapIntensity: 0.9 });
  const ring = useMemo(() => new THREE.MeshStandardMaterial({ color: SIGNAL_RED, emissive: new THREE.Color(SIGNAL_RED), emissiveIntensity: 1.3, toneMapped: false }), []);
  const ax = useMemo(
    () => ({
      x: new THREE.MeshStandardMaterial({ color: '#ff5a55', emissive: new THREE.Color('#ff5a55'), emissiveIntensity: 0.8, toneMapped: false }),
      y: new THREE.MeshStandardMaterial({ color: '#8fe388', emissive: new THREE.Color('#8fe388'), emissiveIntensity: 0.8, toneMapped: false }),
      z: new THREE.MeshStandardMaterial({ color: '#7fb2ff', emissive: new THREE.Color('#7fb2ff'), emissiveIntensity: 0.8, toneMapped: false }),
    }),
    [],
  );
  return (
    <group rotation={[0.05, -0.32, 0]}>
      <mesh material={marble}>
        <boxGeometry args={[2.6, 1.6, 0.16]} />
      </mesh>
      <mesh material={ring} position={[0, 0, 0.12]}>
        <torusGeometry args={[1.75, 0.018, 10, 96]} />
      </mesh>
      {/* corner gizmo */}
      <group position={[-1.3, 0.8, 0.25]}>
        <mesh material={ax.x} position={[0.28, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.028, 0.028, 0.56, 12]} />
        </mesh>
        <mesh material={ax.y} position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.56, 12]} />
        </mesh>
        <mesh material={ax.z} position={[0, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.56, 12]} />
        </mesh>
        <mesh material={ring}>
          <boxGeometry args={[0.11, 0.11, 0.11]} />
        </mesh>
      </group>
    </group>
  );
}

// ── PREVIEW: a framed running app ───────────────────────────────────────────
function PreviewApp() {
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: GUNMETAL, metalness: 0.9, roughness: 0.32 }), []);
  const screen = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#0d0d11', metalness: 0.1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }), []);
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color: SIGNAL_RED, emissive: new THREE.Color(RED_DEEP), emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.3 }), []);
  const chrome = useMemo(() => new THREE.MeshPhysicalMaterial({ color: CHROME, metalness: 1, roughness: 0.22 }), []);
  return (
    <group rotation={[0.03, -0.32, 0]}>
      <mesh material={frame}>
        <boxGeometry args={[3.0, 1.9, 0.12]} />
      </mesh>
      <mesh material={screen} position={[0, 0, 0.07]}>
        <boxGeometry args={[2.8, 1.7, 0.02]} />
      </mesh>
      <mesh material={red} position={[-0.55, 0.55, 0.11]}>
        <boxGeometry args={[1.4, 0.26, 0.03]} />
      </mesh>
      <mesh material={chrome} position={[0.72, 0.55, 0.11]}>
        <boxGeometry args={[0.66, 0.16, 0.03]} />
      </mesh>
      {[-0.78, 0.02, 0.82].map((x) => (
        <mesh key={x} material={chrome} position={[x, -0.18, 0.11]}>
          <boxGeometry args={[0.62, 0.62, 0.03]} />
        </mesh>
      ))}
      <mesh material={red} position={[-0.8, -0.74, 0.11]}>
        <boxGeometry args={[0.46, 0.14, 0.03]} />
      </mesh>
    </group>
  );
}

function ShowScene({ mode, reduced }: { mode: Mode; reduced: boolean }) {
  return (
    <>
      <ClearedRender />
      <ForgeEnvironment intensity={0.9} />
      <ForgeLights intensity={0.9} />
      <State active={mode === 'galaxy'} reduced={reduced}>
        <Galaxy />
      </State>
      <State active={mode === 'canvas'} reduced={reduced} sway>
        <CanvasArtifact />
      </State>
      <State active={mode === 'preview'} reduced={reduced} sway>
        <PreviewApp />
      </State>
    </>
  );
}

function ShowcasePoster() {
  return <div className="mk-show-poster" aria-hidden="true" />;
}

export default function CapabilityShowcase() {
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<Mode>('galaxy');
  const active = MODES.find((m) => m.id === mode)!;
  return (
    <div className="mk-show">
      <div className="mk-show-stage">
        <div className="mk-show-canvas" aria-hidden="true">
          <Lazy3D poster={<ShowcasePoster />} heavy rootMargin="500px">
            <MarketingCanvas camera={{ position: [0, 0.4, 6.6], fov: 40, near: 0.1, far: 40 }}>
              <ShowScene mode={mode} reduced={reduced} />
            </MarketingCanvas>
          </Lazy3D>
        </div>
      </div>
      <div className="mk-show-ui">
        <div className="mk-show-seg" role="tablist" aria-label="View modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className="mk-show-tab"
              data-active={mode === m.id ? 'true' : 'false'}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mk-show-blurb" aria-live="polite">
          {active.blurb}
        </p>
      </div>
    </div>
  );
}
