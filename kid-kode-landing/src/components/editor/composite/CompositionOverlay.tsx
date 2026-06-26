'use client';

// PRISM PRIMITIVE SYSTEM — P-5 — the COMPOSITION OVERLAY (spec §6).
//
// In-engine, ZERO-DOM composition affordances over the live subgraph:
//   • GridFloor   — a faint milled reference grid the move-drag snaps to (§6.3).
//   • SnapGuides  — the bright alignment lines emitted while dragging (§6.3).
//   • StackTies   — a slim glass strut from a stacked child to its parent (§6.1),
//                   so "this is stacked on that" reads in 3D, never as a flat HUD.
//   • MoveGizmo   — a worn-alloy drag handle (chassis vocabulary) that translates the
//                   selected composite on its plane with live grid/edge/center snap.
//
// Everything reads the live store; nothing here is a node (these are editor gizmos,
// not graph artifacts — the authorship gate only checks tagged members).

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import { buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeText } from './CompositeText';
import { useCompositeStore } from './use-composite-store';
import { effectiveRoot } from './composition';

const GRID_Z = -0.55;
const GRID_HALF = 9;
const GRID_STEP_LINES = 0.5;

// ── GridFloor — a faint cyan reference grid (snapping reference) ─────────────────
const GRID_MAT = new THREE.LineBasicMaterial({ color: '#3f6488', transparent: true, opacity: 0.32, toneMapped: false });
const GRID_MAT_MAJOR = new THREE.LineBasicMaterial({ color: '#6fa6d8', transparent: true, opacity: 0.42, toneMapped: false });
export function GridFloor() {
  const showGrid = useCompositeStore((s) => s.showGrid);
  const { minor, major } = useMemo(() => {
    const minorPts: number[] = [];
    const majorPts: number[] = [];
    for (let i = -GRID_HALF; i <= GRID_HALF + 1e-6; i += GRID_STEP_LINES) {
      const isMajor = Math.abs(Math.round(i) - i) < 1e-6 && Math.round(i) % 2 === 0;
      const arr = isMajor ? majorPts : minorPts;
      arr.push(-GRID_HALF, i, GRID_Z, GRID_HALF, i, GRID_Z); // horizontal
      arr.push(i, -GRID_HALF, GRID_Z, i, GRID_HALF, GRID_Z); // vertical
    }
    const mk = (pts: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return g;
    };
    return { minor: mk(minorPts), major: mk(majorPts) };
  }, []);
  useEffect(() => () => { minor.dispose(); major.dispose(); }, [minor, major]);
  if (!showGrid) return null;
  return (
    <group renderOrder={1}>
      <lineSegments geometry={minor} material={GRID_MAT} />
      <lineSegments geometry={major} material={GRID_MAT_MAJOR} />
    </group>
  );
}

// ── SnapGuides — bright alignment lines during a move (§6.3) ─────────────────────
const GUIDE_MAT = new THREE.LineBasicMaterial({ color: '#9fe9ff', transparent: true, opacity: 0.95, toneMapped: false });
function Guide({ axis, value, from, to, kind }: { axis: 'x' | 'y'; value: number; from: number; to: number; kind: string }) {
  const obj = useMemo(() => {
    const z = 0.5;
    const pts = axis === 'x'
      ? [new THREE.Vector3(value, from, z), new THREE.Vector3(value, to, z)]
      : [new THREE.Vector3(from, value, z), new THREE.Vector3(to, value, z)];
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), GUIDE_MAT);
  }, [axis, value, from, to]);
  useEffect(() => () => obj.geometry.dispose(), [obj]);
  // a little tick where it sits, brighter on edge snaps.
  return (
    <group renderOrder={9}>
      <primitive object={obj} />
      <mesh position={axis === 'x' ? [value, (from + to) / 2, 0.5] : [(from + to) / 2, value, 0.5]}>
        <sphereGeometry args={[kind === 'edge' ? 0.07 : 0.05, 10, 10]} />
        <meshBasicMaterial color="#d6f4ff" toneMapped={false} />
      </mesh>
    </group>
  );
}
export function SnapGuides() {
  const guides = useCompositeStore((s) => s.guides);
  if (guides.length === 0) return null;
  return (
    <>
      {guides.map((g, i) => (
        <Guide key={`${g.axis}-${i}`} axis={g.axis} value={g.value} from={g.from} to={g.to} kind={g.kind} />
      ))}
    </>
  );
}

// ── StackTies — a slim glass strut from a stacked child to its parent (§6.1) ─────
const TIE_MAT = new THREE.MeshPhysicalMaterial({
  transmission: 0.9, thickness: 0.3, ior: 1.45, roughness: 0.08, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0.2, attenuationColor: new THREE.Color('#a9d6ff'),
  attenuationDistance: 1.2, emissive: new THREE.Color('#2a5670'), emissiveIntensity: 0.5,
  envMapIntensity: 1.05, transparent: true,
});
function StackTie({ a, b }: { a: THREE.Vector3; b: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.CylinderGeometry(0.035, 0.035, 1, 10, 1), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const len = Math.max(0.0001, dir.length());
    m.position.copy(mid);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  });
  return <mesh ref={ref} geometry={geo} material={TIE_MAT} renderOrder={4} />;
}
export function StackTies() {
  const composites = useCompositeStore((s) => s.composites);
  const rev = useCompositeStore((s) => s.rev);
  const ties = useMemo(() => {
    const byId = new Map(composites.map((c) => [c.compositeId, c]));
    const out: { id: string; a: THREE.Vector3; b: THREE.Vector3 }[] = [];
    for (const c of composites) {
      if (!c.parentCompositeId) continue;
      const parent = byId.get(c.parentCompositeId);
      if (!parent) continue;
      const cw = effectiveRoot(c, byId);
      const pw = effectiveRoot(parent, byId);
      out.push({ id: c.compositeId, a: new THREE.Vector3(cw.x, cw.y, cw.z), b: new THREE.Vector3(pw.x, pw.y, pw.z) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composites, rev]);
  return (
    <>
      {ties.map((t) => <StackTie key={t.id} a={t.a} b={t.b} />)}
    </>
  );
}

// ── MoveGizmo — the worn-alloy drag handle for the selected composite (§6.3) ─────
export function MoveGizmo({ maps }: { maps: Record<string, WornMaps> }) {
  const editorMode = useCompositeStore((s) => s.editorMode);
  const selectedId = useCompositeStore((s) => s.selectedId);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;

  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const drag = useRef<{ dx: number; dy: number; z: number } | null>(null);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const geo = useMemo(() => buildCubeGeometry({ width: 0.5, height: 0.5, depth: 0.5, cornerRadius: 0.08, bevel: 0.04, radius: 0, segments: 5, cutouts: [] }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps.sapphire); m.color = new THREE.Color('#bcd9ff'); return m; }, [maps]);
  useEffect(() => () => material.dispose(), [material]);

  // follow the selected composite's world root (just in front, easy to grab).
  useFrame((state) => {
    const g = groupRef.current;
    if (!g || !selectedId) return;
    const wr = useCompositeStore.getState().worldRootOf(selectedId);
    if (wr) g.position.set(wr.x, wr.y, wr.z + 0.9);
    const mesh = meshRef.current;
    if (mesh && !drag.current) mesh.rotation.z = Math.sin(state.clock.elapsedTime * 1.4) * 0.12;
  });

  const onMove = useCallback((ev: PointerEvent) => {
    const d = drag.current;
    if (!d || !selectedId) return;
    const rect = gl.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    plane.setComponents(0, 0, 1, -d.z);
    if (!ray.ray.intersectPlane(plane, hit)) return;
    useCompositeStore.getState().moveComposite(selectedId, hit.x + d.dx, hit.y + d.dy);
  }, [selectedId, camera, gl, ndc, ray, plane, hit]);

  const onUp = useCallback(() => {
    drag.current = null;
    if (controls) controls.enabled = true;
    useCompositeStore.getState().endMove();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }, [onMove, controls]);

  const onDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!selectedId) return;
    const wr = useCompositeStore.getState().worldRootOf(selectedId);
    if (!wr) return;
    const ev = e.nativeEvent;
    const rect = gl.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    plane.setComponents(0, 0, 1, -wr.z);
    drag.current = { dx: 0, dy: 0, z: wr.z };
    if (ray.ray.intersectPlane(plane, hit)) { drag.current.dx = wr.x - hit.x; drag.current.dy = wr.y - hit.y; }
    if (controls) controls.enabled = false;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [selectedId, camera, gl, ndc, ray, plane, hit, onMove, onUp, controls]);

  useEffect(() => () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); }, [onMove, onUp]);

  if (editorMode !== 'move' || !selectedId) return null;
  return (
    <group ref={groupRef}>
      <mesh
        ref={meshRef}
        geometry={geo}
        material={material}
        onPointerDown={onDown}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      >
        {/* four nibs = a move/translate affordance (custom 3D, no stock icon) */}
        {[[0, 0.34], [0, -0.34], [0.34, 0], [-0.34, 0]].map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.28]} rotation={[0, 0, Math.atan2(y, x)]}>
            <coneGeometry args={[0.06, 0.12, 4]} />
            <meshBasicMaterial color="#0a0d12" toneMapped={false} />
          </mesh>
        ))}
      </mesh>
      <CompositeText position={[0, -0.55, 0]} fontSize={0.12} letterSpacing={0.06} variant="bright">
        MOVE
      </CompositeText>
    </group>
  );
}
