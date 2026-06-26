'use client';

// PRISM FLUID SYSTEM — P-3 — FluidSurface (the realized liquid-glass NODE).
//
// A transmission-glass plane whose normal + relief are driven LIVE by a GPU fluid
// field (FluidFieldSim) stepped each frame. Editing the node's params (viscosity /
// flowSpeed / thickness / turbulence / ior …) re-reads into the sim + material in
// real time. The pointer injects velocity (reactsToInteraction). Carries the
// Node-Law userData so the authorship gate sees a genuine backing node.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { FluidFieldSim, type FluidSimParams } from './fluid-sim';
import { buildFluidSurfaceMaterial } from './fluid-material';
import { useFluidStore } from './use-fluid-store';
import type { FluidSchema, FlowPattern } from './fluid-schema';

const PATTERN_ONEHOT: Record<FlowPattern, [number, number, number, number]> = {
  directional: [1, 0, 0, 0],
  swirl: [0, 1, 0, 0],
  turbulent: [0, 0, 1, 0],
  radial: [0, 0, 0, 1],
};

function paramsFor(schema: FluidSchema, liquidPhase: number): FluidSimParams {
  const p = schema.params;
  return {
    viscosity: p.viscosity,
    surfaceTension: p.surfaceTension,
    flowSpeed: p.flowSpeed,
    flowDirection: p.flowDirection,
    patternWeights: PATTERN_ONEHOT[p.pattern],
    turbulence: p.turbulence,
    damping: p.damping,
    liquidPhase,
    reactsToInteraction: p.reactsToInteraction ? 1 : 0,
  };
}

export function FluidSurface({
  schema,
  selected,
  onSelect,
}: {
  schema: FluidSchema;
  selected: boolean;
  onSelect: (nodeId: string | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  const liquidGlassPhase = useFluidStore((s) => s.liquidGlassPhase);
  const lastUv = useRef<{ x: number; y: number; t: number } | null>(null);

  // the GPU sim + the liquid-glass surface material (one per node, disposed on swap).
  const { sim, surf } = useMemo(() => {
    const s = new FluidFieldSim(176);
    const m = buildFluidSurfaceMaterial(s.fieldTexNode, s.size);
    return { sim: s, surf: m };
  }, []);
  useEffect(() => () => { sim.dispose(); surf.material.dispose(); }, [sim, surf]);

  // push glass params whenever the schema's material-facing params change.
  useEffect(() => {
    surf.applyGlass({
      ior: schema.params.ior,
      thickness: schema.params.thickness,
      tint: schema.params.tint,
      opacity: schema.params.opacity,
    });
  }, [surf, schema.params.ior, schema.params.thickness, schema.params.tint, schema.params.opacity]);

  useFrame((state, dt) => {
    sim.setParams(paramsFor(schema, liquidGlassPhase));
    surf.uniforms.liquidPhase.value = liquidGlassPhase;
    sim.step(gl as unknown as THREE.WebGLRenderer, dt, state.clock.elapsedTime);
  });

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!schema.params.reactsToInteraction || !e.uv) return;
    const now = performance.now();
    const prev = lastUv.current;
    let vx = 0, vy = 0;
    if (prev) {
      const ddt = Math.max((now - prev.t) / 1000, 1 / 120);
      vx = (e.uv.x - prev.x) / ddt;
      vy = (e.uv.y - prev.y) / ddt;
    }
    lastUv.current = { x: e.uv.x, y: e.uv.y, t: now };
    sim.splat(e.uv.x, e.uv.y, THREE.MathUtils.clamp(vx, -2, 2), THREE.MathUtils.clamp(vy, -2, 2), 1);
  };

  const t = schema.transform;
  return (
    <group
      position={[t.x, t.y, t.z]}
      rotation={[t.rotX, t.rotY, t.rotZ]}
      scale={t.scale}
    >
      <mesh
        material={surf.material}
        userData={{ prismFluid: true, prismNodeId: schema.nodeId, prismKind: schema.kind, prismDormant: false }}
        onPointerDown={(e) => { e.stopPropagation(); onSelect(schema.nodeId); }}
        onPointerMove={onPointerMove}
        onPointerOut={() => { lastUv.current = null; }}
      >
        <planeGeometry args={[schema.width, schema.height, 144, 144]} />
      </mesh>

      {selected && <SelectionFrame width={schema.width} height={schema.height} />}
    </group>
  );
}

const FRAME_MAT = new THREE.LineBasicMaterial({ color: '#9fd8ff', toneMapped: false, transparent: true, opacity: 0.85 });
function SelectionFrame({ width, height }: { width: number; height: number }) {
  const obj = useMemo(() => {
    const w = width / 2 + 0.12;
    const h = height / 2 + 0.12;
    const pts = [
      new THREE.Vector3(-w, -h, 0.02), new THREE.Vector3(w, -h, 0.02),
      new THREE.Vector3(w, h, 0.02), new THREE.Vector3(-w, h, 0.02),
      new THREE.Vector3(-w, -h, 0.02),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(geo, FRAME_MAT);
  }, [width, height]);
  useEffect(() => () => obj.geometry.dispose(), [obj]);
  return <primitive object={obj} />;
}
