'use client';

// PRISM EDITOR INTEGRATION — I-3 shared in-canvas control vocabulary.
//
// The founder-approved chassis / keyframe controls, factored into ONE reusable
// set so the docked Inspector (I-3 w-inspector) and the docked Keyframe panel
// (I-3 w-keyframe) MATCH /toolbar-chassis + /keyframe-editor by construction:
//   • FaderRow  — a worn-alloy CUBE knob riding a milled worn-metal rail, with an
//                 engraved MSDF label + value. Dragging the knob writes its value
//                 live (z-plane raycast, OrbitControls frozen during the drag —
//                 the keyframe/library idiom).
//   • ColorSwatch — a glossy color chip (onPick) with an active ring.
//
// ZERO DOM/CSS — everything is R3F/three + MSDF text. Window access is the same
// editor-chrome verification exemption the other editor-shell pieces use.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame, type ThreeEvent } from '@react-three/fiber';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import { buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeText } from '@/components/editor/composite/CompositeText';

// shared scratch (module-level — drag handlers run off window events)
const _ray = new THREE.Raycaster();
const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _world = new THREE.Vector3();

const KNOB = 0.3;
const RAIL_H = 0.12;
const RAIL_DEPTH = 0.08;
const KNOB_Z = 0.22;

/** Registry of live fader geometry (knob + rail world coords + value) for the
 *  headless verification pass — editor chrome only. */
export interface FaderProbe {
  id: string;
  value: number;
  min: number;
  max: number;
  knob: [number, number, number];
  left: [number, number, number];
  right: [number, number, number];
}
function faderRegistry(): Map<string, FaderProbe> {
  const w = window as unknown as { __PRISM_EDITOR_FADERS__?: Map<string, FaderProbe> };
  return (w.__PRISM_EDITOR_FADERS__ ??= new Map());
}

const KNOB_GEO = buildCubeGeometry({
  width: KNOB, height: KNOB, depth: KNOB, cornerRadius: KNOB * 0.16, bevel: 0.03, radius: 0, segments: 5, cutouts: [],
});
const RAIL_GEO = buildCubeGeometry({
  width: 1, height: RAIL_H, depth: RAIL_DEPTH, cornerRadius: RAIL_H * 0.4, bevel: 0.02, radius: 0, segments: 4, cutouts: [],
});

export interface FaderRowProps {
  y: number;
  x?: number;
  width?: number; // total rail span (world units)
  value: number;
  min: number;
  max: number;
  label: string;
  integer?: boolean;
  maps: WornMaps | undefined;
  tint?: string;
  /** fired continuously during the drag (live value) */
  onChange: (v: number) => void;
  /** fired once on pointer-up (the committed value) */
  onCommit?: (v: number) => void;
  /** stable id so the headless pass can target this fader's knob */
  probeId?: string;
  format?: (v: number) => string;
}

export function FaderRow({
  y,
  x = 0,
  width = 2.0,
  value,
  min,
  max,
  label,
  integer,
  maps,
  tint,
  onChange,
  onCommit,
  probeId,
  format,
}: FaderRowProps) {
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const groupRef = useRef<THREE.Group>(null);
  const knobRef = useRef<THREE.Group>(null);
  const drag = useRef<{ railX: number; planeZ: number; half: number } | null>(null);
  const lastV = useRef(value);

  const half = width / 2;
  const clampV = (v: number) => (v < min ? min : v > max ? max : v);
  const norm = (clampV(value) - min) / (max - min || 1);
  const knobX = -half + norm * width;

  const railMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial();
    if (maps) applyWornMaterial(m, maps);
    m.color = new THREE.Color('#2a323e');
    m.roughness = 1;
    m.metalness = 0.9;
    m.envMapIntensity = 0.7;
    return m;
  }, [maps]);
  const knobMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial();
    if (maps) applyWornMaterial(m, maps);
    m.roughness = 1;
    m.clearcoat = 0.12;
    m.envMapIntensity = 1.0;
    if (tint) m.color = new THREE.Color(tint);
    return m;
  }, [maps, tint]);
  useEffect(() => () => { railMat.dispose(); knobMat.dispose(); }, [railMat, knobMat]);

  // value at a world hit x
  const valueAt = (worldHitX: number, d: { railX: number; half: number }) => {
    let lx = worldHitX - d.railX;
    if (lx < -d.half) lx = -d.half;
    if (lx > d.half) lx = d.half;
    let v = min + ((lx + d.half) / (2 * d.half)) * (max - min);
    if (integer) v = Math.round(v);
    return v;
  };

  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const rect = gl.domElement.getBoundingClientRect();
    _ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    _ray.setFromCamera(_ndc, camera as THREE.Camera);
    _plane.set(new THREE.Vector3(0, 0, 1), -d.planeZ);
    if (!_ray.ray.intersectPlane(_plane, _hit)) return;
    const v = valueAt(_hit.x, d);
    lastV.current = v;
    onChange(v);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (controls) controls.enabled = true;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (d && onCommit) onCommit(lastV.current);
  };
  const beginDrag = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const g = groupRef.current;
    if (!g) return;
    g.getWorldPosition(_world);
    drag.current = { railX: _world.x, planeZ: _world.z + KNOB_Z, half };
    if (controls) controls.enabled = false;
    // jump to the press position immediately (seize anywhere on the row)
    const v0 = valueAt(e.point.x, drag.current);
    lastV.current = v0;
    onChange(v0);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // register live world coords for the headless verification pass
  const frame = useRef(0);
  useFrame(() => {
    if (!probeId) return;
    frame.current += 1;
    if (frame.current % 6 !== 0) return;
    const g = groupRef.current;
    if (!g) return;
    g.getWorldPosition(_world);
    faderRegistry().set(probeId, {
      id: probeId,
      value,
      min,
      max,
      knob: [_world.x + knobX, _world.y, _world.z + KNOB_Z],
      left: [_world.x - half, _world.y, _world.z + KNOB_Z],
      right: [_world.x + half, _world.y, _world.z + KNOB_Z],
    });
  });
  useEffect(() => () => { if (probeId) faderRegistry().delete(probeId); }, [probeId]);

  const valueText = format ? format(value) : integer ? String(Math.round(value)) : value.toFixed(2);

  return (
    <group ref={groupRef} position={[x, y, 0]}>
      {/* engraved label (left gutter) */}
      <CompositeText position={[-half - 0.05, 0.16, KNOB_Z]} fontSize={0.13} anchorX="left" variant="engraved">
        {label}
      </CompositeText>
      {/* value readout (right) */}
      <CompositeText position={[half + 0.05, 0.16, KNOB_Z]} fontSize={0.12} anchorX="right" variant="bright">
        {valueText}
      </CompositeText>
      {/* milled worn-metal rail */}
      <mesh geometry={RAIL_GEO} material={railMat} scale={[width, 1, 1]} position={[0, 0, 0.02]} />
      {/* generous invisible grab plane (seize anywhere on the row) */}
      <mesh position={[0, 0, KNOB_Z]} onPointerDown={beginDrag}>
        <planeGeometry args={[width + 0.5, 0.5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* worn-alloy cube knob */}
      <group ref={knobRef} position={[knobX, 0, KNOB_Z]}>
        <mesh geometry={KNOB_GEO} material={knobMat} />
      </group>
    </group>
  );
}

// ── color swatch ────────────────────────────────────────────────────────────
const SWATCH_GEO = buildCubeGeometry({
  width: 0.26, height: 0.26, depth: 0.18, cornerRadius: 0.06, bevel: 0.02, radius: 0, segments: 4, cutouts: [],
});
const SWATCH_RING = new THREE.MeshBasicMaterial({ color: '#9fd8ff', toneMapped: false });

function swatchRegistry(): Map<string, [number, number, number]> {
  const w = window as unknown as { __PRISM_EDITOR_SWATCHES__?: Map<string, [number, number, number]> };
  return (w.__PRISM_EDITOR_SWATCHES__ ??= new Map());
}

export function ColorSwatch({
  x,
  y,
  color,
  active,
  onPick,
}: {
  x: number;
  y: number;
  color: string;
  active?: boolean;
  onPick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color) });
    m.roughness = 0.35;
    m.metalness = 0.1;
    m.clearcoat = 0.8;
    m.clearcoatRoughness = 0.2;
    m.envMapIntensity = 1.1;
    return m;
  }, [color]);
  useEffect(() => () => mat.dispose(), [mat]);
  const frame = useRef(0);
  useFrame(() => {
    frame.current += 1;
    if (frame.current % 10 !== 0) return;
    const g = groupRef.current;
    if (!g) return;
    g.getWorldPosition(_world);
    swatchRegistry().set(color, [_world.x, _world.y, _world.z]);
  });
  useEffect(() => () => { swatchRegistry().delete(color); }, [color]);
  return (
    <group ref={groupRef} position={[x, y, KNOB_Z]}>
      <mesh
        geometry={SWATCH_GEO}
        material={mat}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(); }}
        userData={{ prismEditorSwatch: color }}
      />
      {active && (
        <mesh material={SWATCH_RING} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
          <torusGeometry args={[0.2, 0.012, 8, 24]} />
        </mesh>
      )}
    </group>
  );
}

export const SWATCH_COLORS = ['#caa06a', '#cdd6e2', '#7fb0e0', '#7fd6a0', '#d68a8a', '#e8e2d4'];
