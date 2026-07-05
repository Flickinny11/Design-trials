'use client';

// PRISM MARKETING — LIVE HERO SHOWPIECE (SHELL W6, S2 hero / DL2/DL4/DL8/DL10)
//
// The landing's flagship 3D moment: "an idea becoming a built world." A signal-
// red prism rises through a chrome gyroscope over a machined pedestal, ringed
// by a small constellation of graph nodes wired in red — the app-as-graph made
// literal — with chrome shards drawn upward. It is a REAL real-time scene, not
// a video: it responds to the pointer (parallax) so a visitor can feel it is
// live. Rendered on the product's renderer — a WebGPU renderer that falls back
// to WebGL2 automatically (the same backend ladder the engine uses) — via the
// R3F async `gl` factory. Material language is the shell's single-sourced
// premium.ts system (DL2). Reduced-motion holds it to a readable pose; the
// island is lazy-mounted behind a static poster so it never blocks LCP (DL8).

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
} from '../shell/showpiece/premium-materials';
import { usePrefersReducedMotion } from '../shell/builder/use-reduced-motion';
import { RED_HOT, SIGNAL_RED } from '../shell/design/prism-premium-tokens';

// ── Renderer backend ────────────────────────────────────────────────────────
// The Prism RUNTIME renders on three/webgpu (WebGL2 fallback). The marketing
// hero deliberately renders on the WebGL2 tier — the product's own fallback
// backend — because the premium IBL look depends on PMREMGenerator, which the
// editor also keeps off the WebGPU path (WebGPURenderer + PMREM is unsupported
// in this three build; GraphScene uses a LightingRig instead). WebGL2 gives us
// the exact same materials with reliable, universally-capturable refraction,
// so the hero is the engine's real material system rendering live in the
// browser — never a video. Flip to 'webgpu' only if/when PMREM lands on the
// WebGPU backend.
const HERO_BACKEND: 'webgpu' | 'webgl' = 'webgl';

async function webgpuRendererFactory(
  props: { canvas?: HTMLCanvasElement } & Record<string, unknown>,
): Promise<THREE.WebGLRenderer> {
  const mod = (await import('three/webgpu')) as unknown as {
    WebGPURenderer: new (params: {
      canvas?: HTMLCanvasElement;
      antialias?: boolean;
      alpha?: boolean;
      powerPreference?: string;
    }) => THREE.WebGLRenderer & {
      init?: () => Promise<void>;
      backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean };
    };
  };
  const renderer = new mod.WebGPURenderer({
    canvas: props?.canvas as HTMLCanvasElement | undefined,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  if (typeof renderer.init === 'function') await renderer.init();
  if (typeof window !== 'undefined') {
    const b = renderer.backend;
    (window as unknown as { __PRISM_MK_HERO_BACKEND__?: string }).__PRISM_MK_HERO_BACKEND__ =
      b?.isWebGPUBackend ? 'webgpu' : b?.isWebGLBackend ? 'webgl2' : 'unknown';
  }
  return renderer as unknown as THREE.WebGLRenderer;
}

// ── The constellation of graph nodes wired in red ───────────────────────────
const NODES = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2;
  const r = 1.9;
  return { a, x: Math.cos(a) * r, z: Math.sin(a) * r, y: (i % 3) * 0.28 - 0.28 };
});

function HeroRig({ reduced, pointer }: { reduced: boolean; pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const m = usePremiumMaterials();
  const root = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Group>(null);
  const ringB = useRef<THREE.Group>(null);
  const prism = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.Group>(null);
  const shards = useRef<THREE.Group>(null);

  const edgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(SIGNAL_RED),
        transparent: true,
        opacity: 0.5,
      }),
    [],
  );
  const nodeMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#cfd6e0',
        metalness: 1,
        roughness: 0.22,
        emissive: new THREE.Color(RED_HOT),
        emissiveIntensity: 0.12,
      }),
    [],
  );
  useEffect(() => () => { edgeMat.dispose(); nodeMat.dispose(); }, [edgeMat, nodeMat]);

  // Red edges from the central prism out to each node (the graph wiring).
  const edgeGeoms = useMemo(
    () =>
      NODES.map((n) => {
        const g = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0.1, 0),
          new THREE.Vector3(n.x, n.y, n.z),
        ]);
        return g;
      }),
    [],
  );
  useEffect(() => () => edgeGeoms.forEach((g) => g.dispose()), [edgeGeoms]);

  const shardData = useMemo(
    () => Array.from({ length: 8 }, (_, i) => ({
      a: (i / 8) * Math.PI * 2,
      r: 1.3 + (i % 3) * 0.24,
      y0: -1.2 - (i % 4) * 0.28,
      s: 0.07 + (i % 3) * 0.02,
    })),
    [],
  );
  const shardMats = useMemo(
    () => shardData.map(() => new THREE.MeshPhysicalMaterial({ color: '#cfd6e0', metalness: 1, roughness: 0.24, transparent: true })),
    [shardData],
  );
  useEffect(() => () => shardMats.forEach((mm) => mm.dispose()), [shardMats]);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    // Pointer parallax — the whole rig leans toward the cursor (proves live).
    if (root.current) {
      const px = pointer.current.x;
      const py = pointer.current.y;
      const tx = reduced ? 0 : py * 0.18;
      const ty = reduced ? 0.35 : px * 0.35;
      root.current.rotation.x += (tx - root.current.rotation.x) * Math.min(1, dt * 3);
      root.current.rotation.y += (ty + (reduced ? 0 : t * 0.06) - root.current.rotation.y) * Math.min(1, dt * 3);
    }
    if (prism.current) {
      prism.current.rotation.y = reduced ? 0.6 : t * 0.5;
      prism.current.position.y = reduced ? 0.1 : Math.sin(t * 0.9) * 0.06 + 0.1;
    }
    if (!reduced) {
      if (ringA.current) ringA.current.rotation.z += dt * 0.35;
      if (ringB.current) ringB.current.rotation.x += dt * 0.28;
      if (orbit.current) orbit.current.rotation.y = t * 0.16;
      if (shards.current) {
        shards.current.children.forEach((c, i) => {
          const d = shardData[i];
          const yy = (t * 0.4 + i * 0.5) % 2.4;
          c.position.y = d.y0 + yy;
          (c as THREE.Mesh).rotation.z = t * 0.8 + i;
          ((c as THREE.Mesh).material as THREE.Material).opacity = Math.max(0, 1 - yy / 2.4);
        });
      }
    }
  });

  return (
    <group ref={root}>
      {/* Pedestal */}
      <mesh material={m.gunmetal} position={[0, -1.2, 0]}>
        <cylinderGeometry args={[1.1, 1.28, 0.26, 64]} />
      </mesh>
      <mesh material={m.chrome} position={[0, -1.05, 0]}>
        <cylinderGeometry args={[0.86, 0.86, 0.05, 64]} />
      </mesh>

      {/* Gyroscope rings */}
      <group ref={ringA}>
        <mesh material={m.brushed} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.32, 0.032, 16, 96]} />
        </mesh>
      </group>
      <group ref={ringB}>
        <mesh material={m.chrome} rotation={[0, 0, Math.PI / 3]}>
          <torusGeometry args={[1.12, 0.026, 16, 96]} />
        </mesh>
      </group>

      {/* Graph constellation — nodes wired to the core in red */}
      <group ref={orbit}>
        {NODES.map((n, i) => (
          <mesh key={i} material={nodeMat} position={[n.x, n.y, n.z]}>
            <icosahedronGeometry args={[0.12, 0]} />
          </mesh>
        ))}
        {edgeGeoms.map((g, i) => (
          // eslint-disable-next-line react/no-unknown-property
          <primitive key={i} object={new THREE.Line(g, edgeMat)} />
        ))}
      </group>

      {/* Rising red prism with a hot core */}
      <group ref={prism} position={[0, 0.1, 0]}>
        <mesh material={m.redJewel}>
          <octahedronGeometry args={[0.66, 0]} />
        </mesh>
        <mesh material={m.redHot} scale={0.34}>
          <octahedronGeometry args={[0.66, 0]} />
        </mesh>
      </group>

      {/* Chrome shards drawn upward */}
      <group ref={shards}>
        {shardData.map((d, i) => (
          <mesh key={i} material={shardMats[i]} position={[Math.cos(d.a) * d.r, d.y0, Math.sin(d.a) * d.r]}>
            <tetrahedronGeometry args={[d.s * 2.2, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function HeroShowpiece3D() {
  const reduced = usePrefersReducedMotion();
  const pointer = useRef({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  const onPointerMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  };

  return (
    <div
      className="mk-hero-canvas"
      onPointerMove={onPointerMove}
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 600ms var(--pp-ease-hero)' }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.5, 5.6], fov: 42, near: 0.1, far: 100 }}
        gl={HERO_BACKEND === 'webgpu' ? (webgpuRendererFactory as never) : ({ antialias: true, alpha: true } as never)}
        onCreated={() => setReady(true)}
        style={{ position: 'absolute', inset: 0 }}
      >
        <StudioEnvironment />
        <StudioLights />
        <HeroRig reduced={reduced} pointer={pointer} />
      </Canvas>
    </div>
  );
}
