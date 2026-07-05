'use client';

// FluidInspector — the in-canvas, ZERO-DOM schema editor for the selected fluid
// (spec §3.2 / §7). DOGFOODED from the library: the panel is a glass Pane primitive
// with milled channel cutouts, and each control is a worn-alloy fader knob riding a
// channel — the founder-approved chassis + keyframe vocabulary, on WebGPU.
//
// Editing any control writes to the fluid node's params in the lab graph (single
// source of truth, INV-0.2); the GPU sim + material re-read every frame and the
// fluid responds LIVE:
//   • faders → viscosity / tension / flow / thickness / turbulence / refraction /
//             opacity / damping.
//   • pattern chips → directional / swirl / turbulent / radial flow field.
//   • GO LIQUID → runs the liquid-glass expand timeline (spec §3.3).
//   • REACTS / REMOVE.
//
// Labels are MSDF (FluidEngravedText) — WebGPU-safe, never Troika/ShaderMaterial.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { applyWornMaterial, useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';
import { SPIN_DURATION, SPIN_TURNS, easeInOutCubic } from '@/components/editor/chassis/chassis-config';
import { buildCubeGeometry, buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { ClickCatcher } from '@/components/editor/primitive/ClickCatcher';
import { FluidEngravedText } from './FluidEngravedText';
import { useFluidStore } from './use-fluid-store';
import { FLOW_PATTERNS, type FluidSchema, type FlowPattern } from './fluid-schema';

// ── panel geometry (a dogfooded Pane primitive) ─────────────────────────────────
const INSPECTOR_X = 7.6;
const PANEL_Y = 0.0;
const PW = 4.6;
const PH = 10.6;
const PANEL_DEPTH = 0.4;
const FRONT_Z = PANEL_DEPTH / 2;
const KNOB_Z = FRONT_Z + 0.02;
const LABEL_Z = FRONT_Z - 0.06;
const TWO_PI = Math.PI * 2;
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));

const CH_X0 = -1.05;
const CH_X1 = 1.55;
const CH_CENTER = (CH_X0 + CH_X1) / 2;
const CH_W = CH_X1 - CH_X0;

interface FaderDef {
  key: 'viscosity' | 'surfaceTension' | 'flowSpeed' | 'thickness' | 'turbulence' | 'ior' | 'opacity' | 'damping';
  label: string;
  min: number;
  max: number;
}
const FADERS: FaderDef[] = [
  { key: 'viscosity', label: 'TOGETHER', min: 0, max: 1 },
  { key: 'surfaceTension', label: 'TENSION', min: 0, max: 1 },
  { key: 'flowSpeed', label: 'FLOW', min: 0, max: 2 },
  { key: 'thickness', label: 'THICKNESS', min: 0.1, max: 2.5 },
  { key: 'turbulence', label: 'TURBULENCE', min: 0, max: 1 },
  { key: 'ior', label: 'REFRACT', min: 1, max: 2.4 },
  { key: 'opacity', label: 'OPACITY', min: 0, max: 1 },
  { key: 'damping', label: 'DAMPING', min: 0.9, max: 1 },
];

const valueOf = (schema: FluidSchema, f: FaderDef): number => schema.params[f.key];
const valueToLocalX = (v: number, f: FaderDef) => CH_X0 + ((v - f.min) / (f.max - f.min)) * CH_W;
const localXToValue = (x: number, f: FaderDef) => {
  const tt = THREE.MathUtils.clamp((x - CH_X0) / CH_W, 0, 1);
  return f.min + tt * (f.max - f.min);
};

// ── shared channel drag (keyframe idiom: disable controls, raycast onto z-plane) ──
function useChannelDrag(commit: (f: FaderDef, v: number) => void) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const drag = useRef<FaderDef | null>(null);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const onMove = useCallback(
    (ev: PointerEvent) => {
      const f = drag.current;
      if (!f) return;
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      plane.setComponents(0, 0, 1, -KNOB_Z);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      commit(f, localXToValue(hit.x - INSPECTOR_X, f));
    },
    [camera, gl, ndc, ray, plane, hit, commit],
  );
  const onUp = useCallback(() => {
    drag.current = null;
    if (controls) controls.enabled = true;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }, [onMove, controls]);
  const start = useCallback(
    (f: FaderDef) => {
      drag.current = f;
      if (controls) controls.enabled = false;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onMove, onUp, controls],
  );
  const isDragging = useCallback(() => drag.current !== null, []);
  return { start, isDragging };
}

function FaderKnob({ fader, schema, maps, onGrab, draggingRef }: {
  fader: FaderDef; schema: FluidSchema; maps: WornMaps;
  onGrab: (f: FaderDef) => void; draggingRef: () => boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });
  const size = 0.34;
  const geo = useMemo(() => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: size * 0.14, bevel: 0.04, radius: 0, segments: 5, cutouts: [] }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps); return m; }, [maps]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const g = groupRef.current; const mesh = meshRef.current;
    if (!g || !mesh) return;
    elapsed.current = state.clock.elapsedTime;
    g.position.x = valueToLocalX(valueOf(schema, fader), fader);
    const s = spin.current;
    if (s.active && !draggingRef()) {
      const t = (elapsed.current - s.start) / SPIN_DURATION;
      if (t >= 1) { mesh.rotation.x = 0; s.active = false; }
      else mesh.rotation.x = easeInOutCubic(t) * REST_TURNS * TWO_PI;
    }
  });

  return (
    <group ref={groupRef} position={[valueToLocalX(valueOf(schema, fader), fader), 0, KNOB_Z]}>
      <mesh
        ref={meshRef}
        geometry={geo}
        material={material}
        onPointerOver={(e) => { e.stopPropagation(); if (!draggingRef()) { spin.current.active = true; spin.current.start = elapsed.current; } document.body.style.cursor = 'ew-resize'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
        onPointerDown={(e) => { e.stopPropagation(); spin.current.active = false; meshRef.current!.rotation.x = 0; onGrab(fader); }}
      >
        <mesh position={[0, 0, size / 2 + 0.002]}>
          <boxGeometry args={[0.04, size * 0.6, 0.02]} />
          <meshStandardMaterial color="#0a0d12" roughness={0.3} metalness={0.5} />
        </mesh>
      </mesh>
    </group>
  );
}

// ── a small worn-cube chip (pattern / action button) ────────────────────────────
const RING_MAT = new THREE.MeshBasicMaterial({ color: '#9fd8ff', toneMapped: false });
function Chip({ maps, active, position, tint, onClick, size = 0.42 }: {
  maps: WornMaps; active?: boolean; position: [number, number, number]; tint?: string; onClick: () => void; size?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });
  const geo = useMemo(() => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: size * 0.14, bevel: 0.04, radius: 0, segments: 5, cutouts: [] }), [size]);
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps); if (tint) m.color = new THREE.Color(tint); return m; }, [maps, tint]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => {
    const mesh = meshRef.current; if (!mesh) return;
    elapsed.current = state.clock.elapsedTime;
    const s = spin.current;
    if (s.active) { const t = (elapsed.current - s.start) / SPIN_DURATION; if (t >= 1) { mesh.rotation.x = 0; s.active = false; } else mesh.rotation.x = easeInOutCubic(t) * REST_TURNS * TWO_PI; }
  });
  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        geometry={geo}
        material={material}
        onPointerOver={(e) => { e.stopPropagation(); spin.current.active = true; spin.current.start = elapsed.current; document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
      />
      {active && (
        <mesh material={RING_MAT} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[size * 0.92, 0.012, 8, 28]} />
        </mesh>
      )}
    </group>
  );
}

function Panel({ faderRows }: { faderRows: number[] }) {
  const cutouts = faderRows.map((y, i) => ({ id: `ch-${i}`, x: CH_CENTER, y: y - 0.02, w: CH_W + 0.34, h: 0.26, r: 0.12 }));
  const geo = useMemo(
    () => buildPaneGeometry({ width: PW, height: PH, depth: PANEL_DEPTH, cornerRadius: 0.3, bevel: 0.05, radius: 0, segments: 24, cutouts }),
    [JSON.stringify(cutouts)], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} raycast={() => null}>
      <meshPhysicalMaterial
        transmission={1} thickness={0.6} ior={1.5} roughness={0.06} metalness={0}
        clearcoat={1} clearcoatRoughness={0.18} attenuationColor={'#dbe8f2'} attenuationDistance={1.9}
        envMapIntensity={1.05} specularIntensity={0.7} transparent
      />
    </mesh>
  );
}

function ChannelBed({ y, maps }: { y: number; maps: WornMaps }) {
  const material = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps); m.color = new THREE.Color('#3a4150'); return m; }, [maps]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh position={[CH_CENTER, y - 0.02, -0.06]} material={material} raycast={() => null}>
      <boxGeometry args={[CH_W + 0.34, 0.26, 0.08]} />
    </mesh>
  );
}

export function FluidInspector() {
  const maps = useWornMaps();
  const selectedId = useFluidStore((s) => s.selectedId);
  const schema = useFluidStore((s) => s.schemas.find((x) => x.nodeId === s.selectedId));
  const updateParam = useFluidStore((s) => s.updateParam);
  const triggerLiquidGlass = useFluidStore((s) => s.triggerLiquidGlass);
  const remove = useFluidStore((s) => s.remove);

  const commit = useCallback(
    (f: FaderDef, v: number) => { if (selectedId) updateParam(selectedId, { [f.key]: v } as never); },
    [selectedId, updateParam],
  );
  const { start, isDragging } = useChannelDrag(commit);

  // rows top→down
  const ROW_TOP = 4.0;
  const ROW_STEP = 0.62;
  const faderRows = FADERS.map((_, i) => ROW_TOP - i * ROW_STEP);
  const patternHeaderY = ROW_TOP - FADERS.length * ROW_STEP - 0.35;
  const patternRowY = patternHeaderY - 0.62;
  const actionsY = patternRowY - 1.05;

  // verification map (editor chrome — window access allowed).
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_FLUID_INSPECTOR_MAP__ = () => {
      const st = useFluidStore.getState();
      const sch = st.schemas.find((x) => x.nodeId === st.selectedId);
      if (!sch) return { open: false };
      return {
        open: true, nodeId: sch.nodeId, inspectorX: INSPECTOR_X, knobZ: KNOB_Z,
        faders: FADERS.map((f, i) => ({
          key: f.key, worldX0: INSPECTOR_X + CH_X0, worldX1: INSPECTOR_X + CH_X1,
          worldY: PANEL_Y + (ROW_TOP - i * ROW_STEP), min: f.min, max: f.max, value: sch.params[f.key],
        })),
        patterns: FLOW_PATTERNS.map((p, i) => ({ pattern: p, worldPos: [INSPECTOR_X - 1.5 + i, PANEL_Y + patternRowY, KNOB_Z] })),
        goLiquid: [INSPECTOR_X - 1.1, PANEL_Y + actionsY, KNOB_Z],
        remove: [INSPECTOR_X + 1.1, PANEL_Y + actionsY, KNOB_Z],
      };
    };
    return () => { delete w.__PRISM_FLUID_INSPECTOR_MAP__; };
  }, [patternRowY, actionsY]);

  if (!schema) return null;

  const patternX = [-1.5, -0.5, 0.5, 1.5];
  return (
    <group position={[INSPECTOR_X, PANEL_Y, 0]}>
      <Panel faderRows={faderRows} />
      <ClickCatcher width={PW} height={PH} position={[0, 0, FRONT_Z]} />

      <FluidEngravedText position={[0, PH / 2 - 0.55, LABEL_Z]} fontSize={0.24} letterSpacing={0.05}>
        {schema.caption.toUpperCase()}
      </FluidEngravedText>
      <FluidEngravedText position={[0, PH / 2 - 0.95, LABEL_Z]} fontSize={0.13} letterSpacing={0.2}>
        {`${schema.kind === 'surface' ? 'LIQUID GLASS' : 'FLUID VOLUME'} · NODE`}
      </FluidEngravedText>

      {FADERS.map((f, i) => {
        const y = faderRows[i];
        return (
          <group key={f.key} position={[0, y, 0]}>
            <FluidEngravedText position={[-PW / 2 + 0.42, 0.24, LABEL_Z]} fontSize={0.12} letterSpacing={0.06} anchorX="left">
              {f.label}
            </FluidEngravedText>
            <ChannelBed y={0} maps={maps.gunmetal} />
            <FaderKnob fader={f} schema={schema} maps={maps[i % 2 === 0 ? 'sapphire' : 'bronze']} onGrab={start} draggingRef={isDragging} />
          </group>
        );
      })}

      <FluidEngravedText position={[0, patternHeaderY, LABEL_Z]} fontSize={0.13} letterSpacing={0.18}>
        FLOW PATTERN
      </FluidEngravedText>
      {FLOW_PATTERNS.map((pat: FlowPattern, i) => (
        <Chip
          key={pat}
          maps={maps.emerald}
          active={schema.params.pattern === pat}
          position={[patternX[i], patternRowY, KNOB_Z]}
          onClick={() => selectedId && updateParam(selectedId, { pattern: pat })}
          size={0.4}
        />
      ))}

      {/* GO LIQUID (run the expand timeline) */}
      <group position={[-1.1, actionsY, 0]}>
        <Chip maps={maps.sapphire} tint="#a9d6ff" position={[0, 0, KNOB_Z]} onClick={() => triggerLiquidGlass()} size={0.5} />
        <FluidEngravedText position={[0, -0.48, LABEL_Z]} fontSize={0.11} letterSpacing={0.06}>GO LIQUID</FluidEngravedText>
      </group>
      {/* REACTS toggle */}
      <group position={[0, actionsY, 0]}>
        <Chip maps={maps.bronze} active={schema.params.reactsToInteraction} position={[0, 0, KNOB_Z]} onClick={() => selectedId && updateParam(selectedId, { reactsToInteraction: !schema.params.reactsToInteraction })} size={0.5} />
        <FluidEngravedText position={[0, -0.48, LABEL_Z]} fontSize={0.11} letterSpacing={0.06}>REACTS</FluidEngravedText>
      </group>
      {/* REMOVE */}
      <group position={[1.1, actionsY, 0]}>
        <Chip maps={maps.oxblood} tint="#e29aa6" position={[0, 0, KNOB_Z]} onClick={() => selectedId && remove(selectedId)} size={0.5} />
        <FluidEngravedText position={[0, -0.48, LABEL_Z]} fontSize={0.11} letterSpacing={0.06}>REMOVE</FluidEngravedText>
      </group>
    </group>
  );
}
