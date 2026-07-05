'use client';

// PRISM EDITOR INTEGRATION — I-3: the 3D CONNECTORS (graph edges as glass tubes).
//
// Every edge of the live app graph whose BOTH endpoints are realized in the
// current canvas is drawn as a premium glass tube routed between the two nodes'
// live world positions (read from window.__PRISM_EDITOR_NODE_GROUPS__), bowing
// forward, with an emissive core. The tube re-routes as nodes move/stack. These
// are EDGE-RENDERS, not nodes — NOT tagged prismEditorNode, so the authorship
// gate ignores them (the P-5 connector lesson). ZERO DOM.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useEditorShellStore, resolveActiveHubId } from './use-editor-shell-store';

function nodeGroups(): Map<string, THREE.Object3D> | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D> };
  return w.__PRISM_EDITOR_NODE_GROUPS__ ?? null;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();

/** One glass-tube connector between two realized nodes; re-routes when the
 *  endpoints move beyond a small epsilon. */
function Connector({ from, to, tint }: { from: string; to: string; tint: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lastKey = useRef('');
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(tint) });
    m.transmission = 0.55;
    m.thickness = 0.4;
    m.ior = 1.4;
    m.roughness = 0.12;
    m.clearcoat = 1;
    m.emissive = new THREE.Color(tint);
    m.emissiveIntensity = 0.55;
    m.transparent = true;
    return m;
  }, [tint]);
  useEffect(() => () => { mat.dispose(); meshRef.current?.geometry?.dispose(); }, [mat]);

  useFrame(() => {
    const m = meshRef.current;
    const map = nodeGroups();
    if (!m || !map) return;
    const ga = map.get(from);
    const gb = map.get(to);
    if (!ga || !gb || !ga.parent || !gb.parent) { m.visible = false; return; }
    ga.getWorldPosition(_a);
    gb.getWorldPosition(_b);
    const key = `${_a.x.toFixed(2)},${_a.y.toFixed(2)},${_a.z.toFixed(2)}|${_b.x.toFixed(2)},${_b.y.toFixed(2)},${_b.z.toFixed(2)}`;
    if (key === lastKey.current) { m.visible = true; return; }
    lastKey.current = key;
    _mid.addVectors(_a, _b).multiplyScalar(0.5);
    _mid.z += Math.max(0.3, _a.distanceTo(_b) * 0.16); // bow forward
    const curve = new THREE.QuadraticBezierCurve3(_a.clone(), _mid.clone(), _b.clone());
    const radius = THREE.MathUtils.clamp(_a.distanceTo(_b) * 0.012, 0.015, 0.06);
    const geo = new THREE.TubeGeometry(curve, 24, radius, 8, false);
    m.geometry.dispose();
    m.geometry = geo;
    m.visible = true;
  });

  return (
    <mesh ref={meshRef} material={mat} renderOrder={15} userData={{ prismConnector: true }}>
      <bufferGeometry />
    </mesh>
  );
}

/** Editor-chrome probe: how many connector tubes are currently rendered. */
function ConnectorProbe() {
  const scene = useThree((s) => s.scene);
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__PRISM_EDITOR_CONNECTOR_COUNT__ = () => {
      let c = 0;
      scene.traverse((o) => { if (o.userData?.prismConnector && (o as THREE.Mesh).visible) c += 1; });
      return c;
    };
  }
  return null;
}

export function EditorConnectors() {
  const view = useEditorShellStore((s) => s.view);
  const edges = useGraphSourceStore((s) => s.edges);
  const nodes = useGraphSourceStore((s) => s.nodes);

  const canvasEdges = useMemo(() => {
    if (view !== 'canvas') return [];
    const hub = resolveActiveHubId();
    const inHub = new Set(nodes.filter((n) => n.parentHubId === hub).map((n) => n.nodeId));
    const seen = new Set<string>();
    const out: { from: string; to: string; tint: string }[] = [];
    for (const e of edges) {
      if (!inHub.has(e.from) || !inHub.has(e.to)) continue;
      const k = e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const tint = e.type === 'triggers' || e.type === 'event-bubble' ? '#ffc46a' : '#7fe0ff';
      out.push({ from: e.from, to: e.to, tint });
    }
    return out;
  }, [edges, nodes, view]);

  return (
    <group>
      <ConnectorProbe />
      {view === 'canvas' && canvasEdges.map((e) => (
        <Connector key={`${e.from}|${e.to}`} from={e.from} to={e.to} tint={e.tint} />
      ))}
    </group>
  );
}
