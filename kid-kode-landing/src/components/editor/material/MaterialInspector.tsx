'use client';

// MaterialInspector — the in-canvas, ZERO-DOM PBR param editor for the selected
// library material (spec §2.2 — editable roughness/metalness/clearcoat/transmission/
// IOR/iridescence/sheen/anisotropy/wear). DOGFOODED from the library: the panel is a
// glass Pane with milled channel cutouts; each control is a worn-alloy fader knob
// riding a channel (the chassis + keyframe vocabulary). Only the params that matter
// for the material's family are shown (paramFadersFor) — a gem shows IOR/FIRE, a
// fabric shows SHEEN — never a wall of dead knobs.
//
// Dragging a fader writes a per-instance override (usePreviewStore-style) that the
// renderer reads live → the material on all three displays updates in real time.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { applyWornMaterial } from '@/components/editor/chassis/materials';
import { SPIN_DURATION, SPIN_TURNS, easeInOutCubic } from '@/components/editor/chassis/chassis-config';
import { buildCubeGeometry, buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { EngravedText } from '@/components/editor/primitive/EngravedText';
import { ClickCatcher } from '@/components/editor/primitive/ClickCatcher';
import { FaceGlyph } from '@/components/editor/chassis/FaceGlyph';
import { getMaterial } from './material-registry';
import { resolveParams, paramFadersFor } from './material-build';
import { useMaterialStore } from './use-material-store';
import type { MaterialParams, ParamFaderDef } from './material-types';

const INSPECTOR_X = 9.0;
const PANEL_Y = 0.4;
const PW = 4.2;
const PH = 8.2;
const PANEL_DEPTH = 0.4;
const FRONT_Z = PANEL_DEPTH / 2;
const KNOB_Z = FRONT_Z + 0.02;
const LABEL_Z = FRONT_Z - 0.07;
const TWO_PI = Math.PI * 2;
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));

const CH_X0 = -1.0;
const CH_X1 = 1.5;
const CH_CENTER = (CH_X0 + CH_X1) / 2;
const CH_W = CH_X1 - CH_X0;

const ROW_TOP = 2.6;
const ROW_STEP = 0.84;

function defaultFor(key: keyof MaterialParams): number {
  if (key === 'envMapIntensity') return 1;
  if (key === 'ior') return 1.5;
  if (key === 'iridescenceIOR') return 1.3;
  return 0;
}
function valueOf(params: MaterialParams, f: ParamFaderDef): number {
  const raw = params[f.key];
  return typeof raw === 'number' ? raw : defaultFor(f.key);
}
const valueToLocalX = (v: number, f: ParamFaderDef) => CH_X0 + ((v - f.min) / (f.max - f.min)) * CH_W;
const localXToValue = (x: number, f: ParamFaderDef) => {
  const tt = THREE.MathUtils.clamp((x - CH_X0) / CH_W, 0, 1);
  const v = f.min + tt * (f.max - f.min);
  return f.integer ? Math.round(v) : Math.round(v * 1000) / 1000;
};

// ── shared channel drag (keyframe idiom: disable controls, raycast onto z-plane) ──
function useChannelDrag(commit: (f: ParamFaderDef, v: number) => void) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const drag = useRef<ParamFaderDef | null>(null);
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
    (f: ParamFaderDef) => {
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

function FaderKnob({
  fader, value, maps, onGrab, draggingRef,
}: {
  fader: ParamFaderDef; value: number; maps: WornMaps; onGrab: (f: ParamFaderDef) => void; draggingRef: () => boolean;
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
    g.position.x = valueToLocalX(value, fader);
    const s = spin.current;
    if (s.active && !draggingRef()) {
      const t = (elapsed.current - s.start) / SPIN_DURATION;
      if (t >= 1) { mesh.rotation.x = 0; s.active = false; }
      else mesh.rotation.x = easeInOutCubic(t) * REST_TURNS * TWO_PI;
    }
  });

  return (
    <group ref={groupRef} position={[valueToLocalX(value, fader), 0, KNOB_Z]}>
      <mesh
        ref={meshRef}
        geometry={geo}
        material={material}
        castShadow
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

function ResetButton({ maps, position, onClick }: { maps: WornMaps; position: [number, number, number]; onClick: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });
  const size = 0.46;
  const geo = useMemo(() => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: size * 0.13, bevel: 0.04, radius: 0, segments: 5, cutouts: [] }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps); m.color = new THREE.Color('#9fb6d6'); return m; }, [maps]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => {
    const mesh = meshRef.current; if (!mesh) return;
    elapsed.current = state.clock.elapsedTime;
    const s = spin.current;
    if (s.active) { const t = (elapsed.current - s.start) / SPIN_DURATION; if (t >= 1) { mesh.rotation.x = 0; s.active = false; } else mesh.rotation.x = easeInOutCubic(t) * REST_TURNS * TWO_PI; }
  });
  return (
    <group position={position}>
      <mesh ref={meshRef} geometry={geo} material={material} castShadow
        onPointerOver={(e) => { e.stopPropagation(); spin.current.active = true; spin.current.start = elapsed.current; document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}>
        <FaceGlyph glyph="sparkle" z={size / 2 + 0.002} />
      </mesh>
    </group>
  );
}

function Panel({ faderRows }: { faderRows: number[] }) {
  const cutouts = faderRows.map((y, i) => ({ id: `ch-${i}`, x: CH_CENTER, y: y - 0.02, w: CH_W + 0.34, h: 0.26, r: 0.12 }));
  const geo = useMemo(() => buildPaneGeometry({ width: PW, height: PH, depth: PANEL_DEPTH, cornerRadius: 0.3, bevel: 0.05, radius: 0, segments: 24, cutouts }), [JSON.stringify(cutouts)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} castShadow receiveShadow raycast={() => null}>
      <meshPhysicalMaterial transmission={1} thickness={0.6} ior={1.5} roughness={0.06} metalness={0} clearcoat={1} clearcoatRoughness={0.18} attenuationColor={'#dbe8f2'} attenuationDistance={1.9} envMapIntensity={1.05} specularIntensity={0.7} transparent />
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

export function MaterialInspector({ mapSets }: { mapSets: Record<string, WornMaps> }) {
  const selectedMaterialId = useMaterialStore((s) => s.selectedMaterialId);
  const overrides = useMaterialStore((s) => s.overrides);
  const updateOverride = useMaterialStore((s) => s.updateOverride);
  const resetOverrides = useMaterialStore((s) => s.resetOverrides);

  const def = getMaterial(selectedMaterialId);
  const params = useMemo(() => (def ? resolveParams(def, overrides as Partial<MaterialParams>) : null), [def, overrides]);
  const faders = useMemo(() => (def ? paramFadersFor(def.family) : []), [def]);
  const faderRows = faders.map((_, i) => ROW_TOP - i * ROW_STEP);
  const actionsY = ROW_TOP - faders.length * ROW_STEP - 0.55;

  const commit = useCallback((f: ParamFaderDef, v: number) => { updateOverride({ [f.key]: v }); }, [updateOverride]);
  const { start, isDragging } = useChannelDrag(commit);

  // Verification map (editor chrome — window access allowed).
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_MAT_INSPECTOR_MAP__ = () => {
      const st = useMaterialStore.getState();
      const d = getMaterial(st.selectedMaterialId);
      if (!d) return { open: false };
      const p = resolveParams(d, st.overrides as Partial<MaterialParams>);
      const fds = paramFadersFor(d.family);
      return {
        open: true,
        materialId: d.id,
        family: d.family,
        inspectorX: INSPECTOR_X,
        panelY: PANEL_Y,
        knobZ: KNOB_Z,
        faders: fds.map((f, i) => ({
          key: f.key,
          worldX0: INSPECTOR_X + CH_X0,
          worldX1: INSPECTOR_X + CH_X1,
          worldY: PANEL_Y + (ROW_TOP - i * ROW_STEP),
          min: f.min,
          max: f.max,
          value: typeof p[f.key] === 'number' ? (p[f.key] as number) : defaultFor(f.key),
        })),
        reset: [INSPECTOR_X, PANEL_Y + (ROW_TOP - fds.length * ROW_STEP - 0.55), KNOB_Z],
      };
    };
    return () => { delete w.__PRISM_MAT_INSPECTOR_MAP__; };
  }, []);

  if (!def || !params) return null;

  return (
    <group position={[INSPECTOR_X, PANEL_Y, 0]}>
      <Panel faderRows={faderRows} />
      <ClickCatcher width={PW} height={PH} position={[0, 0, FRONT_Z]} />

      <EngravedText position={[0, PH / 2 - 0.6, LABEL_Z]} fontSize={0.24} letterSpacing={0.05}>
        {def.label.toUpperCase()}
      </EngravedText>
      <EngravedText position={[0, PH / 2 - 1.0, LABEL_Z]} fontSize={0.13} letterSpacing={0.22}>
        {`${def.family.toUpperCase()} · TUNE`}
      </EngravedText>

      {faders.map((f, i) => {
        const y = faderRows[i];
        return (
          <group key={f.key} position={[0, y, 0]}>
            <EngravedText position={[-PW / 2 + 0.42, 0.27, LABEL_Z]} fontSize={0.125} letterSpacing={0.06} anchorX="left">
              {f.label}
            </EngravedText>
            <ChannelBed y={0} maps={mapSets['worn:gunmetal']} />
            <FaderKnob fader={f} value={valueOf(params, f)} maps={mapSets[i % 2 === 0 ? 'worn:sapphire' : 'worn:bronze']} onGrab={start} draggingRef={isDragging} />
          </group>
        );
      })}

      <group position={[0, actionsY, 0]}>
        <ResetButton maps={mapSets['worn:emerald']} position={[0, 0, KNOB_Z]} onClick={resetOverrides} />
        <EngravedText position={[0, -0.45, LABEL_Z]} fontSize={0.11} letterSpacing={0.08}>
          RESET
        </EngravedText>
      </group>
    </group>
  );
}
