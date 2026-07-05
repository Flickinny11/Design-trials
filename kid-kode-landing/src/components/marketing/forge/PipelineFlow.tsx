'use client';

// PRISM MARKETING — HOW IT WORKS (SHELL W9, req #3)
//
// The build pipeline as a live, animated 3D sequence: a signal travels a rail
// through five stations — Describe, Plan, Build (parallel), Verify, Ship —
// lighting each as it arrives and looping. The Build station is a cluster of
// lanes (the wavefront/parallel generation made visible). Auto-plays; reduced-
// motion holds a composed still. WebGPU-first via MarketingCanvas + the shared
// ClearedRender (the signal translates, so the framebuffer must clear).

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import dynamic from 'next/dynamic';
import Lazy3D from '../Lazy3D';
import { ClearedRender } from './MarketingCanvas';
import { ForgeEnvironment, ForgeLights } from './ForgeEnvironment';
import { usePrefersReducedMotion } from '../../shell/builder/use-reduced-motion';
import { CHROME, GUNMETAL, SIGNAL_RED, RED_HOT, RED_DEEP } from '@/components/shell/design/prism-premium-tokens';

const MarketingCanvas = dynamic(() => import('./MarketingCanvas'), { ssr: false });

interface Stage {
  readonly key: string;
  readonly label: string;
  readonly blurb: string;
}
const STAGES: readonly Stage[] = [
  { key: 'describe', label: 'Describe', blurb: 'One sentence, plus a few guided choices.' },
  { key: 'plan', label: 'Plan', blurb: 'A Build Brief you approve before anything runs.' },
  { key: 'build', label: 'Build', blurb: 'The Conductor authors your app in parallel waves.' },
  { key: 'verify', label: 'Verify', blurb: 'It behaves, it looks right, it deploys — or it is not done.' },
  { key: 'ship', label: 'Ship', blurb: 'Live at a real URL, or a portable bundle you own.' },
];

const XS = [-5, -2.5, 0, 2.5, 5] as const; // station x-positions
const T_PERIOD = 6.5; // seconds for one signal pass

function Rail() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: GUNMETAL, metalness: 0.85, roughness: 0.4 }), []);
  return (
    <mesh material={mat} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.028, 0.028, 11, 16]} />
    </mesh>
  );
}

function Station({ x, index, progressRef, cluster = false }: { x: number; index: number; progressRef: RefObject<number>; cluster?: boolean }) {
  const grp = useRef<THREE.Group>(null);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: CHROME, emissive: new THREE.Color(RED_DEEP), emissiveIntensity: 0.35, metalness: 0.7, roughness: 0.28, toneMapped: false }),
    [],
  );
  // Where along 0..1 this station sits.
  const at = index / (XS.length - 1);
  useFrame(() => {
    const p = progressRef.current;
    // Proximity of the signal to this station (0..1), a soft pulse.
    const d = Math.abs(p - at);
    const hot = Math.max(0, 1 - d * 7);
    mat.emissiveIntensity = 0.35 + hot * 2.6;
    if (grp.current) grp.current.scale.setScalar(1 + hot * 0.35);
  });
  const offsets = cluster
    ? [
        [0, 0.42, 0],
        [0, 0, 0],
        [0, -0.42, 0],
      ]
    : [[0, 0, 0]];
  return (
    <group ref={grp} position={[x, 0, 0]}>
      {offsets.map((o, i) => (
        <mesh key={i} material={mat} position={o as [number, number, number]} scale={cluster ? 0.24 : 0.34}>
          <icosahedronGeometry args={[1, 2]} />
        </mesh>
      ))}
      {/* base collar */}
      <mesh material={mat} position={[0, -0.7, 0]} scale={0.14}>
        <cylinderGeometry args={[1, 1.3, 0.5, 6]} />
      </mesh>
    </group>
  );
}

function Signal({ progressRef, reduced }: { progressRef: RefObject<number>; reduced: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: RED_HOT, emissive: new THREE.Color(RED_HOT), emissiveIntensity: 3.4, metalness: 0.1, roughness: 0.4, toneMapped: false }),
    [],
  );
  const x0 = XS[0];
  const x1 = XS[XS.length - 1];
  useFrame(({ clock }) => {
    const p = reduced ? 0.5 : (clock.getElapsedTime() % T_PERIOD) / T_PERIOD;
    progressRef.current = p;
    if (mesh.current) {
      mesh.current.position.x = x0 + (x1 - x0) * p;
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 6) * 0.12;
      mesh.current.scale.setScalar(0.2 * pulse);
    }
  });
  return (
    <mesh ref={mesh} material={mat}>
      <icosahedronGeometry args={[1, 3]} />
    </mesh>
  );
}

function LabelTracker({ labelRefs }: { labelRefs: RefObject<(HTMLElement | null)[]> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const els = labelRefs.current;
    if (!els) return;
    for (let i = 0; i < XS.length; i++) {
      const el = els[i];
      if (!el) continue;
      v.set(XS[i], -1.35, 0).project(camera);
      const sx = (v.x * 0.5 + 0.5) * size.width;
      const sy = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(-50%, 0) translate(${sx}px, ${sy}px)`;
      el.style.opacity = v.z < 1 ? '1' : '0';
    }
  });
  return null;
}

function FlowScene({ progressRef, labelRefs, reduced }: { progressRef: RefObject<number>; labelRefs: RefObject<(HTMLElement | null)[]>; reduced: boolean }) {
  return (
    <>
      <ClearedRender />
      <ForgeEnvironment intensity={0.9} />
      <ForgeLights intensity={0.85} />
      <group position={[0, 0.2, 0]}>
        <Rail />
        {XS.map((x, i) => (
          <Station key={STAGES[i].key} x={x} index={i} progressRef={progressRef} cluster={STAGES[i].key === 'build'} />
        ))}
        <Signal progressRef={progressRef} reduced={reduced} />
      </group>
      <LabelTracker labelRefs={labelRefs} />
    </>
  );
}

function FlowPoster() {
  return <div className="mk-flow-poster" aria-hidden="true" />;
}

export default function PipelineFlow() {
  const reduced = usePrefersReducedMotion();
  const progressRef = useRef(0);
  const labelRefs = useRef<(HTMLElement | null)[]>([]);
  return (
    <div className="mk-flow">
      <div className="mk-flow-canvas" aria-hidden="true">
        <Lazy3D poster={<FlowPoster />} heavy rootMargin="500px">
          <MarketingCanvas camera={{ position: [0, 0.3, 9], fov: 42, near: 0.1, far: 40 }}>
            <FlowScene progressRef={progressRef} labelRefs={labelRefs} reduced={reduced} />
          </MarketingCanvas>
        </Lazy3D>
      </div>
      <ol className="mk-flow-labels">
        {STAGES.map((s, i) => (
          <li
            key={s.key}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className="mk-flow-label"
          >
            <span className="mk-flow-label-n">{String(i + 1).padStart(2, '0')}</span>
            <span className="mk-flow-label-name">{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export { STAGES as PIPELINE_STAGES };
