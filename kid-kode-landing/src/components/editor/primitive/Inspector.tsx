'use client';

// Inspector — the in-canvas, ZERO-DOM schema editor for the selected primitive
// (spec §1.3 / §7). DOGFOODED from the library: the panel itself is a glass Pane
// primitive with milled channel cutouts, and each control is a worn-alloy fader
// knob riding a channel — the founder-approved chassis + keyframe vocabulary.
//
// Editing any control writes to the node's schema in the lab graph (single source
// of truth, INV-0.2); the renderer re-reads and the geometry REBUILDS INSTANTLY:
//   • fader channels  → width / height / thickness(depth) / corner / bevel /
//                       radius / segments (per kind) + material contrast.
//   • material swatches → glass (clear/smoke/tinted) + worn alloy (5 jewel tones).
//   • ADD CUTOUT (pane) → mills a parametric rounded-rect hole; REMOVE → deletes.
//
// Isolated editor-chrome — window/three access is fine (not runtime/node code).

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import { SPIN_DURATION, SPIN_TURNS, easeInOutCubic } from '@/components/editor/chassis/chassis-config';
import { FaceGlyph } from '@/components/editor/chassis/FaceGlyph';
import { buildCubeGeometry, buildPaneGeometry } from './primitive-geometry';
import { buildPrimitiveMaterial } from './primitive-materials';
import { EngravedText } from './EngravedText';
import { ClickCatcher } from './ClickCatcher';
import { useLabGraphStore } from './use-lab-graph-store';
import {
  MATERIAL_KINDS,
  type Cutout,
  type MaterialKind,
  type PrimitiveSchema,
} from './primitive-schema';

// ── panel geometry (a dogfooded Pane primitive) ─────────────────────────────────
const INSPECTOR_X = 7.4;
const PANEL_Y = 0.2;
const PW = 4.4;
const PH = 9.0;
const PANEL_DEPTH = 0.4;
const FRONT_Z = PANEL_DEPTH / 2;
const KNOB_Z = FRONT_Z + 0.02; // proud of the front face, seated over the channel
const LABEL_Z = FRONT_Z - 0.07; // recessed engraving
const TWO_PI = Math.PI * 2;
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));

// channel travel (panel-local x); the milled slot the knob rides.
const CH_X0 = -1.05;
const CH_X1 = 1.55;
const CH_CENTER = (CH_X0 + CH_X1) / 2;
const CH_W = CH_X1 - CH_X0;

// ── per-kind fader specification ────────────────────────────────────────────────
interface FaderDef {
  key: 'width' | 'height' | 'depth' | 'cornerRadius' | 'bevel' | 'radius' | 'segments' | 'contrast';
  label: string;
  min: number;
  max: number;
  /** contrast routes to material; segments rounds to int. */
  target: 'param' | 'material';
  integer?: boolean;
}

function fadersFor(schema: PrimitiveSchema): FaderDef[] {
  const common: FaderDef[] = [];
  if (schema.kind === 'pane') {
    common.push(
      { key: 'width', label: 'WIDTH', min: 0.6, max: 6, target: 'param' },
      { key: 'height', label: 'HEIGHT', min: 0.6, max: 5, target: 'param' },
      { key: 'depth', label: 'THICKNESS', min: 0.1, max: 1.2, target: 'param' },
      { key: 'cornerRadius', label: 'CORNER', min: 0, max: 1.1, target: 'param' },
      { key: 'bevel', label: 'BEVEL', min: 0, max: 0.2, target: 'param' },
    );
  } else if (schema.kind === 'cube') {
    common.push(
      { key: 'width', label: 'WIDTH', min: 0.3, max: 4, target: 'param' },
      { key: 'height', label: 'HEIGHT', min: 0.3, max: 4, target: 'param' },
      { key: 'depth', label: 'DEPTH', min: 0.3, max: 4, target: 'param' },
      { key: 'cornerRadius', label: 'CORNER', min: 0.01, max: 0.9, target: 'param' },
    );
  } else {
    common.push(
      { key: 'radius', label: 'RADIUS', min: 0.2, max: 2.2, target: 'param' },
      { key: 'segments', label: 'SEGMENTS', min: 8, max: 64, target: 'param', integer: true },
    );
  }
  common.push({ key: 'contrast', label: 'CONTRAST', min: 0.5, max: 1.5, target: 'material' });
  return common;
}

const valueOf = (schema: PrimitiveSchema, f: FaderDef): number =>
  f.target === 'material' ? schema.material.contrast : (schema.params[f.key as keyof typeof schema.params] as number);

const valueToLocalX = (v: number, f: FaderDef) =>
  CH_X0 + ((v - f.min) / (f.max - f.min)) * CH_W;
const localXToValue = (x: number, f: FaderDef) => {
  const tt = THREE.MathUtils.clamp((x - CH_X0) / CH_W, 0, 1);
  const v = f.min + tt * (f.max - f.min);
  return f.integer ? Math.round(v) : v;
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
      const localX = hit.x - INSPECTOR_X;
      commit(f, localXToValue(localX, f));
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

// ── one fader knob (worn cube riding its channel) ───────────────────────────────
function FaderKnob({
  fader,
  schema,
  maps,
  onGrab,
  draggingRef,
}: {
  fader: FaderDef;
  schema: PrimitiveSchema;
  maps: WornMaps;
  onGrab: (f: FaderDef) => void;
  draggingRef: () => boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });
  const size = 0.34;
  const geo = useMemo(
    () => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: size * 0.14, bevel: 0.04, radius: 0, segments: 5, cutouts: [] }),
    [],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial();
    applyWornMaterial(m, maps);
    return m;
  }, [maps]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const g = groupRef.current;
    const mesh = meshRef.current;
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

// ── a material swatch chip ──────────────────────────────────────────────────────
const SWATCH_RING = new THREE.MeshBasicMaterial({ color: '#9fd8ff', toneMapped: false });
function Swatch({
  kind,
  maps,
  active,
  position,
  onPick,
}: {
  kind: MaterialKind;
  maps: Record<string, WornMaps>;
  active: boolean;
  position: [number, number, number];
  onPick: (k: MaterialKind) => void;
}) {
  const size = 0.4;
  const geo = useMemo(() => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: 0.06, bevel: 0.03, radius: 0, segments: 4, cutouts: [] }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(
    () => buildPrimitiveMaterial({ kind, tint: kind === 'glass-tinted' ? '#7fd0ff' : kind === 'glass-smoke' ? '#9fb0c4' : '#dbe8f2', contrast: 1 }, maps),
    [kind, maps],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group position={position}>
      <mesh
        geometry={geo}
        material={material}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(kind); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      />
      {active && (
        <mesh material={SWATCH_RING} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <torusGeometry args={[size * 0.92, 0.012, 8, 32]} />
        </mesh>
      )}
    </group>
  );
}

// ── an action button (worn cube + glyph) ────────────────────────────────────────
function ActionButton({
  glyph,
  maps,
  position,
  onClick,
  tint,
}: {
  glyph: 'plus' | 'group';
  maps: WornMaps;
  position: [number, number, number];
  onClick: () => void;
  tint?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });
  const size = 0.46;
  const geo = useMemo(() => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: size * 0.13, bevel: 0.04, radius: 0, segments: 5, cutouts: [] }), []);
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
        castShadow
        onPointerOver={(e) => { e.stopPropagation(); spin.current.active = true; spin.current.start = elapsed.current; document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
      >
        <FaceGlyph glyph={glyph} z={size / 2 + 0.002} />
      </mesh>
    </group>
  );
}

// ── the panel (glass Pane with milled channel cutouts — dogfood) ─────────────────
function Panel({ faderRows }: { faderRows: number[] }) {
  const cutouts: Cutout[] = faderRows.map((y, i) => ({ id: `ch-${i}`, x: CH_CENTER, y: y - 0.02, w: CH_W + 0.34, h: 0.26, r: 0.12 }));
  const geo = useMemo(
    () => buildPaneGeometry({ width: PW, height: PH, depth: PANEL_DEPTH, cornerRadius: 0.3, bevel: 0.05, radius: 0, segments: 24, cutouts }),
    [JSON.stringify(cutouts)], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} castShadow receiveShadow raycast={() => null}>
      <meshPhysicalMaterial
        transmission={1}
        thickness={0.6}
        ior={1.5}
        roughness={0.06}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.18}
        attenuationColor={'#dbe8f2'}
        attenuationDistance={1.9}
        envMapIntensity={1.05}
        specularIntensity={0.7}
        transparent
      />
    </mesh>
  );
}

// ── recessed worn channel beds (so grooves read as milled, not open slots) ───────
function ChannelBed({ y, maps }: { y: number; maps: WornMaps }) {
  const material = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps); m.color = new THREE.Color('#3a4150'); return m; }, [maps]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh position={[CH_CENTER, y - 0.02, -0.06]} material={material} raycast={() => null}>
      <boxGeometry args={[CH_W + 0.34, 0.26, 0.08]} />
    </mesh>
  );
}

export function Inspector({ maps }: { maps: Record<string, WornMaps> }) {
  const selectedId = useLabGraphStore((s) => s.selectedId);
  const schema = useLabGraphStore((s) => s.schemas.find((x) => x.nodeId === s.selectedId));
  const updateParam = useLabGraphStore((s) => s.updateParam);
  const updateMaterial = useLabGraphStore((s) => s.updateMaterial);
  const setMaterialKind = useLabGraphStore((s) => s.setMaterialKind);
  const addCutout = useLabGraphStore((s) => s.addCutout);
  const remove = useLabGraphStore((s) => s.remove);

  const commit = useCallback(
    (f: FaderDef, v: number) => {
      if (!selectedId) return;
      if (f.target === 'material') updateMaterial(selectedId, { contrast: v });
      else updateParam(selectedId, { [f.key]: v } as never);
    },
    [selectedId, updateParam, updateMaterial],
  );
  const { start, isDragging } = useChannelDrag(commit);

  const faders = useMemo(() => (schema ? fadersFor(schema) : []), [schema]);
  // fader rows top→down within the panel.
  const ROW_TOP = 3.0;
  const ROW_STEP = 0.82;
  const faderRows = faders.map((_, i) => ROW_TOP - i * ROW_STEP);
  const swatchHeaderY = ROW_TOP - faders.length * ROW_STEP - 0.35;
  const swatchRow0 = swatchHeaderY - 0.6;
  const swatchRow1 = swatchRow0 - 0.78;
  const actionsY = swatchRow1 - 0.95;

  // Verification map (editor chrome — window access allowed).
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_PRIM_INSPECTOR_MAP__ = () => {
      const st = useLabGraphStore.getState();
      const sch = st.schemas.find((x) => x.nodeId === st.selectedId);
      if (!sch) return { open: false };
      const fds = fadersFor(sch);
      const sH = ROW_TOP - fds.length * ROW_STEP - 0.35;
      const sR0 = sH - 0.6;
      const sR1 = sR0 - 0.78;
      const aY = sR1 - 0.95;
      const sx = [-1.5, -0.5, 0.5, 1.5];
      return {
        open: true,
        nodeId: sch.nodeId,
        kind: sch.kind,
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
          value: valueOf(sch, f),
        })),
        swatches: MATERIAL_KINDS.map((k, i) => ({
          kind: k,
          worldPos: [INSPECTOR_X + sx[i % 4], PANEL_Y + (i < 4 ? sR0 : sR1), KNOB_Z],
        })),
        actions: {
          addCutout: sch.kind === 'pane' ? [INSPECTOR_X - 1.0, PANEL_Y + aY, KNOB_Z] : null,
          remove: [INSPECTOR_X + (sch.kind === 'pane' ? 1.0 : 0), PANEL_Y + aY, KNOB_Z],
        },
      };
    };
    return () => { delete w.__PRISM_PRIM_INSPECTOR_MAP__; };
  }, []);

  if (!schema) return null;

  const swatchX = [-1.5, -0.5, 0.5, 1.5];
  return (
    <group position={[INSPECTOR_X, PANEL_Y, 0]}>
      <Panel faderRows={faderRows} />
      {/* solid catcher so clicking the glass panel never deselects (controls,
          at higher z, are still hit first) */}
      <ClickCatcher width={PW} height={PH} position={[0, 0, FRONT_Z]} />

      {/* title */}
      <EngravedText position={[0, PH / 2 - 0.6, LABEL_Z]} fontSize={0.26} letterSpacing={0.06}>
        {schema.caption.toUpperCase()}
      </EngravedText>
      <EngravedText position={[0, PH / 2 - 1.0, LABEL_Z]} fontSize={0.14} letterSpacing={0.22}>
        {`${schema.kind.toUpperCase()} · NODE`}
      </EngravedText>

      {/* faders */}
      {faders.map((f, i) => {
        const y = faderRows[i];
        return (
          <group key={f.key} position={[0, y, 0]}>
            <EngravedText position={[-PW / 2 + 0.42, 0.27, LABEL_Z]} fontSize={0.135} letterSpacing={0.08} anchorX="left">
              {f.label}
            </EngravedText>
            <ChannelBed y={0} maps={maps.gunmetal} />
            <FaderKnob fader={f} schema={schema} maps={maps[i % 2 === 0 ? 'sapphire' : 'bronze']} onGrab={start} draggingRef={isDragging} />
          </group>
        );
      })}

      {/* material header + swatches */}
      <EngravedText position={[0, swatchHeaderY, LABEL_Z]} fontSize={0.15} letterSpacing={0.2}>
        MATERIAL
      </EngravedText>
      {MATERIAL_KINDS.map((k, i) => {
        const row = i < 4 ? swatchRow0 : swatchRow1;
        const x = swatchX[i % 4];
        return (
          <Swatch
            key={k}
            kind={k}
            maps={maps}
            active={schema.material.kind === k}
            position={[x, row, KNOB_Z]}
            onPick={(mk) => selectedId && setMaterialKind(selectedId, mk)}
          />
        );
      })}

      {/* actions */}
      {schema.kind === 'pane' && (
        <group position={[-1.0, actionsY, 0]}>
          <ActionButton glyph="plus" maps={maps.emerald} position={[0, 0, KNOB_Z]} onClick={() => selectedId && addCutout(selectedId)} tint="#9fe7c4" />
          <EngravedText position={[0, -0.45, LABEL_Z]} fontSize={0.11} letterSpacing={0.08}>
            ADD CUTOUT
          </EngravedText>
        </group>
      )}
      <group position={[schema.kind === 'pane' ? 1.0 : 0, actionsY, 0]}>
        <ActionButton glyph="group" maps={maps.oxblood} position={[0, 0, KNOB_Z]} onClick={() => selectedId && remove(selectedId)} tint="#e29aa6" />
        <EngravedText position={[0, -0.45, LABEL_Z]} fontSize={0.11} letterSpacing={0.08}>
          REMOVE
        </EngravedText>
      </group>
    </group>
  );
}
