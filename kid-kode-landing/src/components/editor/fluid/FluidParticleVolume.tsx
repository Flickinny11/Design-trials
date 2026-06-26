'use client';

// FluidParticleVolume — the VOLUMETRIC particle fluid (spec §3.1), WebGPU-ONLY.
//
// Mounted by FluidVolume ONLY when renderer.backend.isWebGPUBackend is true; the
// WebGL2 fallback path renders FluidSurface instead. So this file is free to use
// WebGPU-only compute() — a real GPU particle simulation that EVOLVES STATE
// frame-to-frame with NO CPU round-trip.
//
// ── Algorithm (HONEST) ──────────────────────────────────────────────────────────
// This is NOT a true grid MLS-MPM solver. It is a stable, GPU-resident,
// curl-advected POSITION-BASED particle fluid (an SPH-lite / divergence-shaped
// force field), which is the SAFER choice the prompt explicitly permits: a full
// grid P2G/G2P MLS-MPM pass needs an extra grid storage buffer + atomic scatter,
// which is hard to keep tsc-clean and crash-proof on a path we cannot verify
// headless. Instead each particle integrates, on the GPU, every frame:
//   • a CURL-NOISE turbulence force (analytic curl of a 3-D value-noise potential
//     via mx_noise_vec3 finite differences → divergence-free, so the cloud swirls
//     and folds like a cohesive incompressible volume rather than dispersing),
//   • a directional ADVECTION push (flowSpeed along flowDirection),
//   • a gentle COHESION pull toward the bounds centre (stands in for surface
//     tension / viscosity togetherness so the body holds together),
//   • a POINTER force (reactsToInteraction) toward the cursor ray,
//   • velocity DAMPING (retention) + bounds REFLECTION inside the box,
//   • semi-implicit Euler position integration.
// The result reads as a luminous, swirling, cohesive fluid VOLUME — clearly
// different from the flat liquid-glass SURFACE — and is numerically stable for
// arbitrary frame times (dt is clamped).
//
// MAXIMALLY DEFENSIVE: all GPU/compute setup is wrapped in try/catch. If anything
// is unavailable or throws, we render <FluidSurface/> as the fallback (one
// console.warn, never an error) so the volume node is NEVER broken or empty.
//
// Node Law: the rendered particle group carries the prismFluid userData so the
// authorship gate sees a genuine backing node. Zero DOM, zero raw GLSL — TSL only.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { InstancedMesh, SpriteNodeMaterial } from 'three/webgpu';
import {
  Fn,
  instancedArray,
  instanceIndex,
  uniform,
  uv,
  vec2,
  vec3,
  float,
  hash,
  mx_noise_vec3,
} from 'three/tsl';
import { FluidSurface } from './FluidSurface';
import type { FluidSchema } from './fluid-schema';

// ── tunables ────────────────────────────────────────────────────────────────────
const PARTICLE_COUNT = 36_000; // within the 20k–60k band; comfortable on Metal.
const MAX_DT = 1 / 30; // clamp frame time so a stall can't explode the integrator.

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n =
    h.length === 3
      ? parseInt(h.replace(/(.)/g, '$1$1'), 16)
      : parseInt(h.length >= 6 ? h.slice(0, 6) : 'bfe3ea', 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface FluidGpu {
  mesh: InstancedMesh;
  material: SpriteNodeMaterial;
  computeUpdate: ReturnType<ReturnType<typeof Fn>>;
  uniforms: {
    dt: ReturnType<typeof uniform>;
    elapsed: ReturnType<typeof uniform>;
    halfBox: ReturnType<typeof uniform>;
    flowDir: ReturnType<typeof uniform>;
    flowSpeed: ReturnType<typeof uniform>;
    turbulence: ReturnType<typeof uniform>;
    cohesion: ReturnType<typeof uniform>;
    damping: ReturnType<typeof uniform>;
    pointer: ReturnType<typeof uniform>;
    pointerForce: ReturnType<typeof uniform>;
  };
  dispose: () => void;
}

// Build the whole GPU fluid (storage buffers + compute kernel + sprite material +
// instanced mesh). Throws if the WebGPU/TSL pipeline can't be constructed — the
// caller catches and falls back to the surface.
function buildFluidGpu(schema: FluidSchema): FluidGpu {
  const p = schema.params;
  const halfW = schema.width / 2;
  const halfH = schema.height / 2;
  const halfD = Math.max(p.thickness, 0.2) * 0.9; // depth half-extent of the slab

  // ── storage buffers (GPU-resident state) ──
  const positions = instancedArray(PARTICLE_COUNT, 'vec3');
  const velocities = instancedArray(PARTICLE_COUNT, 'vec3');

  // ── uniforms (live schema → sim, re-read every frame, no rebuild) ──
  const [tr, tg, tb] = hexToRgb(p.tint);
  const u = {
    dt: uniform(1 / 60),
    elapsed: uniform(0),
    halfBox: uniform(new THREE.Vector3(halfW, halfH, halfD)),
    flowDir: uniform(new THREE.Vector3(Math.cos(p.flowDirection), Math.sin(p.flowDirection), 0)),
    flowSpeed: uniform(p.flowSpeed),
    turbulence: uniform(p.turbulence),
    cohesion: uniform(0.2 + 0.9 * p.viscosity),
    damping: uniform(p.damping),
    pointer: uniform(new THREE.Vector3(0, 0, -999)), // z=-999 → "no pointer"
    pointerForce: uniform(p.reactsToInteraction ? 1 : 0),
  };

  // ── compute INIT: seed positions to fill the bounds box, velocities ~0 ──
  const seedHash = (salt: number) =>
    hash(instanceIndex.add(float(salt * PARTICLE_COUNT)));
  const computeInit = Fn(() => {
    const pos = positions.element(instanceIndex);
    const rx = seedHash(1).sub(0.5).mul(2);
    const ry = seedHash(2).sub(0.5).mul(2);
    const rz = seedHash(3).sub(0.5).mul(2);
    pos.assign(vec3(rx.mul(u.halfBox.x), ry.mul(u.halfBox.y), rz.mul(u.halfBox.z)));
    velocities.element(instanceIndex).assign(vec3(0, 0, 0));
  })().compute(PARTICLE_COUNT);

  // ── compute UPDATE: integrate one step on the GPU ──
  // All TSL is inlined (no inner typed Fn helpers — the strict r184 TSL generics
  // reject a StorageArrayElement var passed as a typed Fn arg).
  const computeUpdate = Fn(() => {
    const pos = positions.element(instanceIndex).toVar();
    const vel = velocities.element(instanceIndex).toVar();
    const dt = u.dt;

    // 1) CURL-NOISE turbulence — analytic curl of a vec3 noise potential via finite
    //    differences (divergence-free → cohesive, incompressible-looking swirl).
    const e = float(0.35);
    const px = pos.add(vec3(u.elapsed.mul(0.25), 0, 0));
    const nyP = mx_noise_vec3(px.add(vec3(0, e, 0)));
    const nyN = mx_noise_vec3(px.sub(vec3(0, e, 0)));
    const nzP = mx_noise_vec3(px.add(vec3(0, 0, e)));
    const nzN = mx_noise_vec3(px.sub(vec3(0, 0, e)));
    const nxP = mx_noise_vec3(px.add(vec3(e, 0, 0)));
    const nxN = mx_noise_vec3(px.sub(vec3(e, 0, 0)));
    const inv = float(1).div(e.mul(2));
    const curl = vec3(
      nyP.z.sub(nyN.z).sub(nzP.y.sub(nzN.y)).mul(inv),
      nzP.x.sub(nzN.x).sub(nxP.z.sub(nxN.z)).mul(inv),
      nxP.y.sub(nxN.y).sub(nyP.x.sub(nyN.x)).mul(inv),
    );
    const turb = curl.mul(u.turbulence.mul(2.2).add(0.15)).mul(u.flowSpeed.add(0.25));

    // 2) directional ADVECTION
    const advect = u.flowDir.mul(u.flowSpeed.mul(0.8));
    // 3) COHESION pull toward centre (surface-tension / viscosity stand-in)
    const cohere = pos.mul(u.cohesion.mul(-0.6));
    // 4) POINTER force (toward cursor) when reactsToInteraction & pointer active
    const toP = u.pointer.sub(pos);
    const dist = toP.length().max(0.001);
    const within = u.pointer.z.add(900).step(1); // 1 when pointer.z > -899 (active)
    const pforce = toP
      .div(dist)
      .mul(within)
      .mul(u.pointerForce)
      .mul(float(3.0).div(dist.mul(dist).add(0.5)));

    const accel = turb.add(advect).add(cohere).add(pforce);
    vel.addAssign(accel.mul(dt));
    vel.mulAssign(u.damping); // velocity retention
    pos.addAssign(vel.mul(dt));

    // 5) BOUNDS REFLECTION inside the slab box — per-component, branch-free, inlined.
    // For each axis: if |pos| > half, fold the overshoot back in and invert+damp vel.
    const hb = u.halfBox;
    // overshoot magnitude per axis (>0 when outside)
    const oX = pos.x.abs().sub(hb.x).max(0);
    const oY = pos.y.abs().sub(hb.y).max(0);
    const oZ = pos.z.abs().sub(hb.z).max(0);
    // velocity flip+damp BEFORE we move pos back (uses the outside test)
    vel.assign(
      vec3(
        oX.greaterThan(0).select(vel.x.mul(-0.45), vel.x),
        oY.greaterThan(0).select(vel.y.mul(-0.45), vel.y),
        oZ.greaterThan(0).select(vel.z.mul(-0.45), vel.z),
      ),
    );
    pos.assign(
      vec3(
        pos.x.sub(pos.x.sign().mul(oX).mul(2)),
        pos.y.sub(pos.y.sign().mul(oY).mul(2)),
        pos.z.sub(pos.z.sign().mul(oZ).mul(2)),
      ),
    );

    positions.element(instanceIndex).assign(pos);
    velocities.element(instanceIndex).assign(vel);
  })().compute(PARTICLE_COUNT);

  // ── sprite material: soft luminous round particle, tinted cool-glass ──
  const material = new SpriteNodeMaterial();
  material.positionNode = positions.toAttribute();
  // soft radial falloff so each sprite is a glowing droplet, not a hard square.
  const radial = uv().distance(vec2(0.5)).oneMinus().clamp(0, 1);
  const alpha = radial.mul(radial).mul(p.opacity * 0.9 + 0.1);
  material.colorNode = vec3(tr, tg, tb).mul(0.7).add(radial.mul(vec3(0.5, 0.7, 0.85).mul(0.6)));
  material.opacityNode = alpha;
  // luminous fluid VOLUME: additive-leaning blend, depth-test on / depth-write off.
  material.transparent = true;
  material.depthWrite = false;
  material.blending = THREE.AdditiveBlending;
  material.toneMapped = false;
  // particle size ∝ thickness (sprite scale, vec2)
  const sizePx = THREE.MathUtils.clamp(0.018 + 0.02 * p.thickness, 0.012, 0.06);
  material.scaleNode = vec2(sizePx, sizePx);

  // ── instanced mesh hosting the sprites ──
  const geo = new THREE.PlaneGeometry(1, 1);
  const mesh = new InstancedMesh(geo, material, PARTICLE_COUNT);
  mesh.frustumCulled = false;
  // identity instance matrices (the sprite positionNode drives placement).
  const m = new THREE.Matrix4();
  for (let i = 0; i < PARTICLE_COUNT; i++) mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;

  const dispose = () => {
    try {
      geo.dispose();
      material.dispose();
      mesh.dispose();
      // storage buffers dispose via their attributes
      (positions as unknown as { dispose?: () => void }).dispose?.();
      (velocities as unknown as { dispose?: () => void }).dispose?.();
    } catch {
      /* defensive: never throw on teardown */
    }
  };

  return { mesh, material, computeUpdate, uniforms: u, dispose, computeInit } as FluidGpu & {
    computeInit: ReturnType<ReturnType<typeof Fn>>;
  };
}

export function FluidParticleVolume({
  schema,
  selected,
  onSelect,
}: {
  schema: FluidSchema;
  selected: boolean;
  onSelect: (nodeId: string | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  const failedRef = useRef(false);

  // Build the GPU fluid once. Any failure → null → render the surface fallback.
  const gpu = useMemo<(FluidGpu & { computeInit: ReturnType<ReturnType<typeof Fn>> }) | null>(() => {
    try {
      const renderer = gl as unknown as { backend?: { isWebGPUBackend?: boolean } };
      if (!renderer.backend?.isWebGPUBackend) return null; // belt-and-suspenders
      const built = buildFluidGpu(schema) as FluidGpu & {
        computeInit: ReturnType<ReturnType<typeof Fn>>;
      };
      // seed the buffers once (synchronous-ish; computeAsync fire-and-forget).
      const r = gl as unknown as { computeAsync?: (n: unknown) => Promise<void> };
      r.computeAsync?.(built.computeInit)?.catch(() => {
        /* seed failure is non-fatal; particles still render at origin */
      });
      return built;
    } catch (err) {
      if (!failedRef.current) {
        failedRef.current = true;
        // eslint-disable-next-line no-console
        console.warn('[FluidParticleVolume] GPU compute unavailable, using surface fallback:', err);
      }
      return null;
    }
    // schema identity drives a rebuild; params are pushed live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, schema.nodeId]);

  useEffect(() => {
    if (!gpu) return;
    return () => gpu.dispose();
  }, [gpu]);

  // Push live schema → uniforms whenever the sim-facing params change (no rebuild).
  useEffect(() => {
    if (!gpu) return;
    try {
      const p = schema.params;
      const u = gpu.uniforms;
      (u.flowDir.value as THREE.Vector3).set(Math.cos(p.flowDirection), Math.sin(p.flowDirection), 0);
      u.flowSpeed.value = p.flowSpeed;
      u.turbulence.value = p.turbulence;
      u.cohesion.value = 0.2 + 0.9 * p.viscosity;
      u.damping.value = p.damping;
      u.pointerForce.value = p.reactsToInteraction ? 1 : 0;
    } catch {
      /* defensive */
    }
  }, [
    gpu,
    schema.params.flowDirection,
    schema.params.flowSpeed,
    schema.params.turbulence,
    schema.params.viscosity,
    schema.params.damping,
    schema.params.reactsToInteraction,
    schema.params,
  ]);

  // Per-frame: advance uniforms + dispatch the compute kernel on the GPU.
  useFrame((state, dt) => {
    if (!gpu) return;
    try {
      const u = gpu.uniforms;
      (u.dt.value as number) = Math.min(dt, MAX_DT);
      (u.elapsed.value as number) = state.clock.elapsedTime;
      const r = gl as unknown as { compute?: (n: unknown) => void; computeAsync?: (n: unknown) => Promise<void> };
      if (r.compute) r.compute(gpu.computeUpdate);
      else r.computeAsync?.(gpu.computeUpdate)?.catch(() => {});
    } catch {
      /* a transient compute error must not break the frame loop */
    }
  });

  // Pointer → world-space pointer uniform (reactsToInteraction). The hit point on
  // the invisible interaction plane drives the in-shader pointer force.
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!gpu || !schema.params.reactsToInteraction) return;
    try {
      const lp = e.object.worldToLocal(e.point.clone());
      (gpu.uniforms.pointer.value as THREE.Vector3).set(lp.x, lp.y, lp.z);
    } catch {
      /* ignore */
    }
  };
  const clearPointer = () => {
    if (gpu) (gpu.uniforms.pointer.value as THREE.Vector3).set(0, 0, -999);
  };

  // If the GPU build failed / is unavailable, render the verified surface core.
  if (!gpu) {
    return <FluidSurface schema={schema} selected={selected} onSelect={onSelect} />;
  }

  const t = schema.transform;
  return (
    <group position={[t.x, t.y, t.z]} rotation={[t.rotX, t.rotY, t.rotZ]} scale={t.scale}>
      {/* the GPU-simulated particle cloud — carries Node-Law userData. */}
      <primitive
        object={gpu.mesh}
        userData={{ prismFluid: true, prismNodeId: schema.nodeId, prismKind: schema.kind, prismDormant: false }}
      />

      {/* invisible interaction plane: selection + pointer force injection. */}
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(schema.nodeId);
        }}
        onPointerMove={onPointerMove}
        onPointerOut={clearPointer}
        visible={false}
      >
        <planeGeometry args={[schema.width, schema.height]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {selected && (
        <BoundsWireframe
          width={schema.width}
          height={schema.height}
          depth={Math.max(schema.params.thickness, 0.2) * 1.8}
        />
      )}
    </group>
  );
}

// Subtle bounds wireframe shown when selected — WebGPU-safe LineSegments.
const BOUNDS_MAT = new THREE.LineBasicMaterial({
  color: '#9fd8ff',
  toneMapped: false,
  transparent: true,
  opacity: 0.7,
});
function BoundsWireframe({ width, height, depth }: { width: number; height: number; depth: number }) {
  const obj = useMemo(() => {
    const box = new THREE.BoxGeometry(width * 1.02, height * 1.02, depth);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return new THREE.LineSegments(edges, BOUNDS_MAT);
  }, [width, height, depth]);
  useEffect(() => () => obj.geometry.dispose(), [obj]);
  return <primitive object={obj} />;
}
