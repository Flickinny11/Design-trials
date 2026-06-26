'use client';

// PRISM PRIMITIVE SYSTEM — P-5 — CONNECT: visible 3D connectors (spec §6.2).
//
// A user-drawn graph edge between two member NODES is realized as a PREMIUM in-engine
// connector — a transmission-glass tube that arcs forward through space (never a flat
// 2D HUD line), with a flowing emissive core + worn-alloy end nodes, tinted by kind
// (data = cool cyan · logic = warm amber). The tube routes between the two nodes'
// LIVE world positions, so it follows them as they move / stack.
//
//   • ConnectorLayer — every committed connection as a glass tube.
//   • ConnectPicker  — while CONNECT mode is armed, a bright rubber-band from the
//                      first-picked node to the cursor, plus a pulse on the pick.
//
// Connectors are EDGE renders, not nodes — the authorship gate only checks tagged
// members. Each connection IS a real edge in `store.edges()` (kind data/logic), so the
// graph stays the source of truth (spec §6.2 / engine INV "the graph is the app").

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useCompositeStore } from './use-composite-store';
import type { Vec3 } from './composition';

const KIND_TINT: Record<'data' | 'logic', string> = { data: '#6fd0ff', logic: '#e6b070' };
const KIND_CORE: Record<'data' | 'logic', string> = { data: '#d6f4ff', logic: '#ffe6bf' };

function v3(p: Vec3) {
  return new THREE.Vector3(p.x, p.y, p.z);
}

// a quadratic arc that bows toward the viewer (+z) so the tube reads as a 3D cable.
function arc(a: THREE.Vector3, b: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dist = a.distanceTo(b);
  mid.z += 0.5 + dist * 0.14;
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

function ConnectorTube({ id, from, to, kind }: { id: string; from: Vec3; to: Vec3; kind: 'data' | 'logic' }) {
  const removeConnection = useCompositeStore((s) => s.removeConnection);
  const editorMode = useCompositeStore((s) => s.editorMode);

  const fk = `${from.x.toFixed(3)},${from.y.toFixed(3)},${from.z.toFixed(3)}`;
  const tk = `${to.x.toFixed(3)},${to.y.toFixed(3)},${to.z.toFixed(3)}`;

  const { tube, core, capGeo } = useMemo(() => {
    const curve = arc(v3(from), v3(to));
    const tube = new THREE.TubeGeometry(curve, 32, 0.075, 10, false);
    const core = new THREE.TubeGeometry(curve, 32, 0.032, 8, false);
    const capGeo = new THREE.SphereGeometry(0.12, 16, 16);
    return { tube, core, capGeo };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fk, tk]);
  useEffect(() => () => { tube.dispose(); core.dispose(); capGeo.dispose(); }, [tube, core, capGeo]);

  const tubeMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    transmission: 0.8, thickness: 0.6, ior: 1.45, roughness: 0.07, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.16, attenuationColor: new THREE.Color(KIND_TINT[kind]),
    attenuationDistance: 0.8, emissive: new THREE.Color(KIND_TINT[kind]), emissiveIntensity: 0.45,
    envMapIntensity: 1.1, transparent: true,
  }), [kind]);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(KIND_CORE[kind]), toneMapped: false, transparent: true, opacity: 0.85 }), [kind]);
  const capMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(KIND_CORE[kind]), toneMapped: false }), [kind]);
  useEffect(() => () => { tubeMat.dispose(); coreMat.dispose(); capMat.dispose(); }, [tubeMat, coreMat, capMat]);

  // a gentle energy pulse along the core (reads as data flow).
  useFrame((state) => {
    coreMat.opacity = 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.4));
  });

  return (
    <group renderOrder={5}>
      <mesh
        geometry={tube}
        material={tubeMat}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (editorMode === 'connect') removeConnection(id); }}
        onPointerOver={(e) => { e.stopPropagation(); if (editorMode === 'connect') document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      />
      <mesh geometry={core} material={coreMat} raycast={() => null} />
      <mesh geometry={capGeo} material={capMat} position={[from.x, from.y, from.z]} raycast={() => null} />
      <mesh geometry={capGeo} material={capMat} position={[to.x, to.y, to.z]} raycast={() => null} />
    </group>
  );
}

export function ConnectorLayer() {
  const connections = useCompositeStore((s) => s.connections);
  const rev = useCompositeStore((s) => s.rev);
  // resolve live world endpoints (rev forces a re-resolve as composites move/stack).
  const resolved = useMemo(() => {
    const st = useCompositeStore.getState();
    return connections
      .map((c) => {
        const from = st.nodeWorldPos(c.fromNodeId);
        const to = st.nodeWorldPos(c.toNodeId);
        return from && to ? { id: c.id, from, to, kind: c.kind } : null;
      })
      .filter(Boolean) as { id: string; from: Vec3; to: Vec3; kind: 'data' | 'logic' }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, rev]);
  return (
    <>
      {resolved.map((c) => <ConnectorTube key={c.id} id={c.id} from={c.from} to={c.to} kind={c.kind} />)}
    </>
  );
}

// ── ConnectPicker — the rubber-band + pick pulse while CONNECT is armed ──────────
const BAND_MAT = new THREE.LineBasicMaterial({ color: '#9fe9ff', transparent: true, opacity: 0.9, toneMapped: false });
export function ConnectPicker() {
  const editorMode = useCompositeStore((s) => s.editorMode);
  const pendingConnectFrom = useCompositeStore((s) => s.pendingConnectFrom);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const lineRef = useRef<THREE.Line>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const cursor = useRef(new THREE.Vector3());
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const lineObj = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    return new THREE.Line(g, BAND_MAT);
  }, []);
  useEffect(() => () => lineObj.geometry.dispose(), [lineObj]);

  const onMove = useCallback((ev: PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    plane.setComponents(0, 0, 1, -0.3);
    if (ray.ray.intersectPlane(plane, hit)) cursor.current.copy(hit);
  }, [gl, camera, ndc, ray, plane, hit]);

  useEffect(() => {
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [onMove]);

  useFrame((state) => {
    const from = pendingConnectFrom ? useCompositeStore.getState().nodeWorldPos(pendingConnectFrom) : null;
    const ln = lineRef.current;
    const pulse = pulseRef.current;
    if (ln && from) {
      const pos = ln.geometry.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, from.x, from.y, from.z + 0.05);
      pos.setXYZ(1, cursor.current.x, cursor.current.y, cursor.current.z);
      pos.needsUpdate = true;
    }
    if (pulse && from) {
      pulse.position.set(from.x, from.y, from.z + 0.1);
      const s = 0.18 + 0.06 * Math.sin(state.clock.elapsedTime * 5);
      pulse.scale.setScalar(s);
    }
  });

  if (editorMode !== 'connect' || !pendingConnectFrom) return null;
  return (
    <group renderOrder={9}>
      <primitive object={lineObj} ref={lineRef} />
      <mesh ref={pulseRef}>
        <torusGeometry args={[1, 0.16, 10, 28]} />
        <meshBasicMaterial color="#9fe9ff" toneMapped={false} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
