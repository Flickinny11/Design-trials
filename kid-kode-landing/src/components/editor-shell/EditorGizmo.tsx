'use client';

// PRISM EDITOR INTEGRATION — I-3: the canvas TRANSFORM GIZMO (move/rotate/scale).
//
// A worn-alloy gizmo that floats on the SELECTED node (reads its realized group
// from window.__PRISM_EDITOR_NODE_GROUPS__) and edits its transform on the live
// app graph via setScenePosition:
//   • MOVE  — drag the center handle in the node's X/Y plane (world→scenePosition
//             via the FitGroup parent; snaps to grid / neighbour centers, drawing
//             an alignment guide). Stacked children write a parent-relative offset.
//   • ROTATE— drag the ring; the screen-space angle delta writes rotationZ.
//   • SCALE — drag the corner handle; the distance ratio writes a uniform scale.
// A 3-chip mode selector floats above. OrbitControls freeze during a drag. Editor
// CHROME (NOT tagged prismEditorNode) so the authorship gate ignores it. ZERO DOM.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame, type ThreeEvent } from '@react-three/fiber';
import { applyWornMaterial, useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';
import { buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeChip } from '@/components/editor/composite/CompositeChip';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { effectivePos, computeSnap, stackNodes, saveSelectionAsTemplate, type Vec2 } from './editor-manipulation';
import { useEditorShellStore, resolveActiveHubId, guardDeselect, type GizmoMode } from './use-editor-shell-store';

const _ray = new THREE.Raycaster();
const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _wc = new THREE.Vector3();
const _tmp = new THREE.Vector3();

function nodeGroups(): Map<string, THREE.Object3D> | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D> };
  return w.__PRISM_EDITOR_NODE_GROUPS__ ?? null;
}

const HANDLE_GEO = buildCubeGeometry({ width: 0.5, height: 0.5, depth: 0.5, cornerRadius: 0.1, bevel: 0.03, radius: 0, segments: 5, cutouts: [] });
const BAR_GEO = buildCubeGeometry({ width: 1, height: 0.09, depth: 0.09, cornerRadius: 0.03, bevel: 0.02, radius: 0, segments: 4, cutouts: [] });
const GUIDE_MAT = new THREE.LineBasicMaterial({ color: '#ffd9a8', toneMapped: false, transparent: true, opacity: 0.8 });
const GUIDE_GEO = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -6, 0), new THREE.Vector3(0, 6, 0)]);

function wornMat(maps: WornMaps | undefined, tint?: string, emissive?: string): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial();
  if (maps) applyWornMaterial(m, maps);
  m.roughness = 1;
  m.clearcoat = 0.14;
  m.envMapIntensity = 1.05;
  if (tint) m.color = new THREE.Color(tint);
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 0.4; }
  return m;
}

export function EditorGizmo() {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const view = useEditorShellStore((s) => s.view);
  const mode = useEditorShellStore((s) => s.gizmoMode);
  const snapEnabled = useEditorShellStore((s) => s.snapEnabled);
  const multiSelect = useEditorShellStore((s) => s.multiSelect);
  const connectMode = useEditorShellStore((s) => s.connectMode);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const maps = useWornMaps();

  const groupRef = useRef<THREE.Group>(null);
  const guideX = useRef<THREE.LineSegments>(null);
  const guideY = useRef<THREE.LineSegments>(null);
  const drag = useRef<
    | { kind: 'move'; parent: THREE.Object3D; planeZ: number; offset: Vec2; parentEff: Vec2 }
    | { kind: 'rotate'; centerCss: [number, number]; lastAngle: number; startRotZ: number }
    | { kind: 'scale'; centerWorld: THREE.Vector3; startDist: number; startScale: number }
    | null
  >(null);

  const moveMat = useMemo(() => wornMat(maps['gunmetal'], '#cdd6e2', '#2a3a52'), [maps]);
  const ringMat = useMemo(() => wornMat(maps['emerald'], undefined, '#1c3a2a'), [maps]);
  const scaleMat = useMemo(() => wornMat(maps['bronze'], '#caa06a', '#3a2a12'), [maps]);
  const xBar = useMemo(() => wornMat(maps['bronze'], '#caa06a'), [maps]);
  const yBar = useMemo(() => wornMat(maps['emerald'], '#7fd6a0'), [maps]);
  const ringGeo = useMemo(() => new THREE.TorusGeometry(1.0, 0.06, 10, 40), []);
  useEffect(() => () => { [moveMat, ringMat, scaleMat, xBar, yBar].forEach((m) => m.dispose()); ringGeo.dispose(); }, [moveMat, ringMat, scaleMat, xBar, yBar, ringGeo]);

  const freshNode = (id: string) => useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id);

  const ndcFrom = (e: PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    _ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    return rect;
  };

  // ── MOVE ──────────────────────────────────────────────────────────────────
  const onMoveDrag = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.kind !== 'move' || !selectedId) return;
    ndcFrom(e);
    _ray.setFromCamera(_ndc, camera as THREE.Camera);
    _plane.set(new THREE.Vector3(0, 0, 1), -d.planeZ);
    if (!_ray.ray.intersectPlane(_plane, _hit)) return;
    d.parent.worldToLocal(_hit); // → scenePosition / effPos space
    let nx = _hit.x + d.offset.x;
    let ny = _hit.y + d.offset.y;
    const g = useGraphSourceStore.getState();
    const byId = new Map(g.nodes.map((n) => [n.nodeId, n]));
    const neighbours: Vec2[] = g.nodes
      .filter((n) => n.parentHubId === freshNode(selectedId)?.parentHubId && n.nodeId !== selectedId)
      .map((n) => effectivePos(n, byId));
    const snapped = computeSnap(nx, ny, neighbours, snapEnabled);
    nx = snapped.x; ny = snapped.y;
    // draw alignment guides
    if (guideX.current) { guideX.current.visible = false; }
    if (guideY.current) { guideY.current.visible = false; }
    for (const guide of snapped.guides) {
      if (guide.axis === 'x' && guideX.current) { guideX.current.visible = true; guideX.current.position.x = 0; }
      if (guide.axis === 'y' && guideY.current) { guideY.current.visible = true; guideY.current.position.y = 0; }
    }
    g.setScenePosition(selectedId, { x: nx - d.parentEff.x, y: ny - d.parentEff.y });
  };

  const beginMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!selectedId) return;
    const map = nodeGroups();
    const ng = map?.get(selectedId);
    if (!ng || !ng.parent) return;
    const node = freshNode(selectedId);
    if (!node) return;
    const byId = new Map(useGraphSourceStore.getState().nodes.map((n) => [n.nodeId, n]));
    const eff = effectivePos(node, byId);
    const parentEff = node.parentNodeId && byId.get(node.parentNodeId)
      ? effectivePos(byId.get(node.parentNodeId)!, byId)
      : { x: 0, y: 0, z: 0 };
    ng.getWorldPosition(_wc);
    // local hit at press → grab offset so the node doesn't jump to cursor center
    _hit.copy(e.point);
    ng.parent.worldToLocal(_hit);
    drag.current = { kind: 'move', parent: ng.parent, planeZ: _wc.z, offset: { x: eff.x - _hit.x, y: eff.y - _hit.y }, parentEff };
    if (controls) controls.enabled = false;
    window.addEventListener('pointermove', onMoveDrag);
    window.addEventListener('pointerup', endDrag);
  };

  // ── ROTATE ──────────────────────────────────────────────────────────────────
  const onRotateDrag = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.kind !== 'rotate' || !selectedId) return;
    const rect = gl.domElement.getBoundingClientRect();
    const ang = Math.atan2(e.clientY - rect.top - d.centerCss[1], e.clientX - rect.left - d.centerCss[0]);
    const delta = ang - d.lastAngle;
    const node = freshNode(selectedId);
    const cur = node?.scenePosition?.rotationZ ?? 0;
    useGraphSourceStore.getState().setScenePosition(selectedId, { rotationZ: cur - delta });
    d.lastAngle = ang;
  };
  const beginRotate = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!selectedId) return;
    const map = nodeGroups();
    const ng = map?.get(selectedId);
    if (!ng) return;
    ng.getWorldPosition(_wc);
    const v = _wc.clone().project(camera as THREE.Camera);
    const rect = gl.domElement.getBoundingClientRect();
    const cx = (v.x * 0.5 + 0.5) * rect.width;
    const cy = (1 - (v.y * 0.5 + 0.5)) * rect.height;
    const ang = Math.atan2((e.nativeEvent as PointerEvent).clientY - rect.top - cy, (e.nativeEvent as PointerEvent).clientX - rect.left - cx);
    drag.current = { kind: 'rotate', centerCss: [cx, cy], lastAngle: ang, startRotZ: freshNode(selectedId)?.scenePosition?.rotationZ ?? 0 };
    if (controls) controls.enabled = false;
    window.addEventListener('pointermove', onRotateDrag);
    window.addEventListener('pointerup', endDrag);
  };

  // ── SCALE ────────────────────────────────────────────────────────────────────
  const onScaleDrag = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.kind !== 'scale' || !selectedId) return;
    ndcFrom(e);
    _ray.setFromCamera(_ndc, camera as THREE.Camera);
    _plane.set(new THREE.Vector3(0, 0, 1), -d.centerWorld.z);
    if (!_ray.ray.intersectPlane(_plane, _hit)) return;
    const dist = _hit.distanceTo(d.centerWorld);
    const ratio = d.startDist > 0.01 ? dist / d.startDist : 1;
    const next = Math.max(0.15, Math.min(6, d.startScale * ratio));
    useGraphSourceStore.getState().setScenePosition(selectedId, { scaleX: next, scaleY: next, scaleZ: next });
  };
  const beginScale = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!selectedId) return;
    const map = nodeGroups();
    const ng = map?.get(selectedId);
    if (!ng) return;
    ng.getWorldPosition(_wc);
    const startDist = e.point.distanceTo(_wc);
    drag.current = { kind: 'scale', centerWorld: _wc.clone(), startDist, startScale: freshNode(selectedId)?.scenePosition?.scaleX ?? 1 };
    if (controls) controls.enabled = false;
    window.addEventListener('pointermove', onScaleDrag);
    window.addEventListener('pointerup', endDrag);
  };

  const endDrag = () => {
    drag.current = null;
    guardDeselect(); // a drag-release over open canvas must not deselect the node
    if (controls) controls.enabled = true;
    if (guideX.current) guideX.current.visible = false;
    if (guideY.current) guideY.current.visible = false;
    window.removeEventListener('pointermove', onMoveDrag);
    window.removeEventListener('pointermove', onRotateDrag);
    window.removeEventListener('pointermove', onScaleDrag);
    window.removeEventListener('pointerup', endDrag);
  };

  // follow the selected node's world center each frame
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const map = nodeGroups();
    const ng = selectedId && view === 'canvas' ? map?.get(selectedId) : null;
    if (!ng || !ng.parent) { g.visible = false; return; }
    ng.getWorldPosition(_wc);
    g.visible = true;
    g.position.copy(_wc);
  });

  // ── manipulation actions (chips + headless probe) ──────────────────────────
  const doStack = () => {
    const ms = useEditorShellStore.getState().multiSelect;
    if (ms.length >= 2) { for (let i = 1; i < ms.length; i++) stackNodes(ms[i], ms[0]); useEditorShellStore.getState().clearMultiSelect(); }
  };
  const doGroup = () => {
    const ms = useEditorShellStore.getState().multiSelect;
    if (ms.length >= 2) useGraphSourceStore.getState().groupNodes(ms);
  };
  const doSave = () => {
    const shell = useEditorShellStore.getState();
    const ids = shell.multiSelect.length ? shell.multiSelect : shell.selectedId ? [shell.selectedId] : [];
    const newIds = saveSelectionAsTemplate(ids);
    shell.clearMultiSelect();
    if (newIds[0]) shell.select(newIds[0]);
    return newIds;
  };

  // headless probe
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_EDITOR_SET_GIZMO_MODE__ = (m: GizmoMode) => useEditorShellStore.getState().setGizmoMode(m);
    w.__PRISM_EDITOR_GIZMO__ = () => {
      const g = groupRef.current;
      if (!g || !g.visible) return { mode, center: null, handle: null, unit: 1 };
      g.getWorldPosition(_wc);
      const center: [number, number, number] = [_wc.x, _wc.y, _wc.z];
      const handle = _tmp.set(mode === 'scale' ? 1.0 : 0, mode === 'scale' ? 1.0 : 0, 0.4);
      g.localToWorld(handle);
      const u = new THREE.Vector3(1, 0, 0);
      g.localToWorld(u);
      const unit = Math.hypot(u.x - center[0], u.y - center[1], u.z - center[2]);
      return { mode, center, handle: [handle.x, handle.y, handle.z], unit };
    };
    w.__PRISM_EDITOR_MANIP__ = {
      stack: (childId: string, parentId: string) => stackNodes(childId, parentId),
      group: (ids: string[]) => useGraphSourceStore.getState().groupNodes(ids),
      save: (ids: string[]) => saveSelectionAsTemplate(ids),
      connect: (from: string, to: string) => {
        const g = useGraphSourceStore.getState();
        if (g.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from))) return false;
        g.addEdge({ from, to, type: 'data-flow' });
        return true;
      },
      setScenePos: (id: string, patch: Record<string, number>) => useGraphSourceStore.getState().setScenePosition(id, patch),
      snapTest: (x: number, y: number) => {
        const g = useGraphSourceStore.getState();
        const hub = resolveActiveHubId();
        const byId = new Map(g.nodes.map((n) => [n.nodeId, n]));
        const neighbours = g.nodes.filter((n) => n.parentHubId === hub).map((n) => effectivePos(n, byId));
        return computeSnap(x, y, neighbours, true);
      },
      nodeMeta: (id: string) => {
        const n = useGraphSourceStore.getState().nodes.find((x) => x.nodeId === id);
        return n ? { groupId: n.groupId ?? null, parentNodeId: n.parentNodeId ?? null, scenePosition: n.scenePosition ?? null } : null;
      },
    };
  }

  if (!selectedId || view !== 'canvas') return null;

  return (
    <group ref={groupRef}>
      {/* alignment guides (move) */}
      <lineSegments ref={guideX} geometry={GUIDE_GEO} material={GUIDE_MAT} visible={false} />
      <lineSegments ref={guideY} geometry={GUIDE_GEO} material={GUIDE_MAT} rotation={[0, 0, Math.PI / 2]} visible={false} />

      {/* mode selector chips, floating above the node */}
      {(['move', 'rotate', 'scale'] as GizmoMode[]).map((m, i) => (
        <CompositeChip
          key={m}
          maps={maps['gunmetal']}
          position={[(i - 1) * 0.62, 1.7, 0.4]}
          size={0.34}
          active={mode === m}
          label={m.toUpperCase()}
          onClick={() => useEditorShellStore.getState().setGizmoMode(m)}
        />
      ))}

      {/* manipulation action chips (stack / connect / group / save / snap) */}
      {[
        { id: 'stack', label: 'STACK', tint: '#9fb6d6', onClick: doStack, active: multiSelect.length >= 2 },
        { id: 'connect', label: 'CONNECT', tint: '#7fe0ff', onClick: () => useEditorShellStore.getState().setConnectMode(!useEditorShellStore.getState().connectMode), active: connectMode },
        { id: 'group', label: 'GROUP', tint: '#caa06a', onClick: doGroup, active: multiSelect.length >= 2 },
        { id: 'save', label: 'SAVE', tint: '#7fd6a0', onClick: doSave, active: false },
        { id: 'snap', label: 'SNAP', tint: '#cdd6e2', onClick: () => useEditorShellStore.getState().toggleSnap(), active: snapEnabled },
      ].map((c, i) => (
        <CompositeChip
          key={c.id}
          maps={maps['gunmetal']}
          position={[(i - 2) * 0.62, 2.32, 0.4]}
          size={0.3}
          tint={c.tint}
          active={c.active}
          label={c.label}
          onClick={c.onClick}
        />
      ))}

      {mode === 'move' && (
        <group>
          <mesh geometry={BAR_GEO} material={xBar} scale={[1.1, 1, 1]} position={[0.55, 0, 0.4]} />
          <mesh geometry={BAR_GEO} material={yBar} scale={[1.1, 1, 1]} rotation={[0, 0, Math.PI / 2]} position={[0, 0.55, 0.4]} />
          <group position={[0, 0, 0.4]}>
            <mesh geometry={HANDLE_GEO} material={moveMat} />
            <mesh onPointerDown={beginMove}>
              <boxGeometry args={[1.0, 1.0, 0.8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        </group>
      )}
      {mode === 'rotate' && (
        <group position={[0, 0, 0.4]}>
          <mesh geometry={ringGeo} material={ringMat} />
          {/* generous invisible grab torus so the ring is easy to seize */}
          <mesh onPointerDown={beginRotate}>
            <torusGeometry args={[1.0, 0.24, 8, 36]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      )}
      {mode === 'scale' && (
        <group>
          <mesh geometry={BAR_GEO} material={scaleMat} scale={[1.4, 1, 1]} rotation={[0, 0, Math.PI / 4]} position={[0.5, 0.5, 0.4]} />
          <group position={[1.0, 1.0, 0.4]}>
            <mesh geometry={HANDLE_GEO} material={scaleMat} />
            <mesh onPointerDown={beginScale}>
              <boxGeometry args={[1.0, 1.0, 0.8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}
