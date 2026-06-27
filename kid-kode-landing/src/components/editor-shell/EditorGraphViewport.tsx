'use client';

// PRISM EDITOR INTEGRATION — I-1: the live-app-graph viewport.
//
// ONE canvas region that renders the LIVE APP GRAPH (loaded into
// useGraphSourceStore from public/prism-mock/home/live-graph.json) in three
// states of one continuous scene:
//   • canvas  — the active hub's nodes REALIZED via the SAME node-realization
//               path the app uses (ArtifactNode → buildPerNodeFactory →
//               defaultRenderModeFactory / codeRef registry). This is the user's
//               real app, not a demo. Auto-fit into the framed viewport box.
//   • galaxy  — the UNBUILT graph: every node as a dormant liquid-glass seed,
//               clustered per hub into a constellation (RT INV-R2 two-state).
//   • preview — handled by the scene (an honest placeholder this phase; the
//               running app is wired in I-4).
//
// Every realized artifact + dormant seed is TAGGED (userData.prismEditorNode +
// prismNodeId) so the in-engine authorship probe (Law 0 / node-authorship gate
// --editor) can prove every render maps to a backing graph node.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import ArtifactNode from '@/components/editor/graph/ArtifactNode';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { PrismNode, PrismHub } from '@/lib/prism-graph/types';
import { makeDormantSeed } from './editor-shell-glass';
import { PreviewComposition } from './PreviewComposition';
import { effectivePos, connectNodes, type Vec3 } from './editor-manipulation';
import {
  useEditorShellStore,
  resolveActiveHubId,
} from './use-editor-shell-store';

// Target framed-viewport extent the content auto-fits into (world units). The
// dock frame (W2) surrounds this box.
const FIT_W = 13.5;
const FIT_H = 7.6;

function readScenePos(node: PrismNode) {
  const sp = node.scenePosition;
  return {
    pos: [sp?.x ?? 0, sp?.y ?? 0, sp?.z ?? 0] as [number, number, number],
    rot: [sp?.rotationX ?? 0, sp?.rotationY ?? 0, sp?.rotationZ ?? 0] as [number, number, number],
    scale: [sp?.scaleX ?? 1, sp?.scaleY ?? 1, sp?.scaleZ ?? 1] as [number, number, number],
  };
}

/** Register/unregister a node's wrapper group in the editor node-group map so
 *  the authorship probe + gate can resolve every render to a backing nodeId. */
function useNodeGroupRegistry(nodeId: string, ref: React.RefObject<THREE.Group | null>) {
  useEffect(() => {
    const g = ref.current;
    if (!g || typeof window === 'undefined') return;
    const w = window as unknown as { __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D> };
    const map = (w.__PRISM_EDITOR_NODE_GROUPS__ ??= new Map());
    map.set(nodeId, g);
    return () => { map.delete(nodeId); };
  }, [nodeId, ref]);
}

/** Click routing for a realized node: connect-mode arms/creates an edge;
 *  shift toggles the multi-select set; a plain click single-selects. */
function pickNode(nodeId: string, shift: boolean) {
  const shell = useEditorShellStore.getState();
  if (shell.connectMode) {
    if (!shell.pendingConnectFrom) {
      shell.setPendingConnectFrom(nodeId);
      shell.select(nodeId);
    } else if (shell.pendingConnectFrom !== nodeId) {
      connectNodes(shell.pendingConnectFrom, nodeId);
      shell.setPendingConnectFrom(null);
      shell.select(nodeId);
    }
    return;
  }
  if (shift) {
    shell.toggleMultiSelect(nodeId);
    shell.select(nodeId);
  } else {
    shell.clearMultiSelect();
    shell.select(nodeId);
  }
}

/** A content signature for a node's REALIZED artifact: the geometry/material/text
 *  fields that should reconstruct the THREE object when edited. Excludes
 *  scenePosition (transform stays live via the wrapper, no rebuild). Used as part
 *  of the React key so an Inspector schema edit (updateNode) automatically rebuilds
 *  just that one node — the "save-and-rebuild" made automatic (I-3). */
export function contentSig(n: PrismNode): string {
  const mp = n.meshPrimitive;
  const ms = n.materialSpec;
  const p = mp?.params as Record<string, number> | undefined;
  return [
    n.renderMode,
    mp?.kind,
    p ? `${p.width ?? ''},${p.height ?? ''},${p.depth ?? ''},${p.radius ?? ''},${p.segments ?? ''},${p.length ?? ''},${p.tube ?? ''}` : '',
    ms ? `${ms.baseColor ?? ''},${ms.roughness ?? ''},${ms.metalness ?? ''},${ms.transmission ?? ''},${ms.opacity ?? ''}` : '',
    n.textSpec?.content ?? '',
    n.textSpec?.fontSize ?? '',
  ].join('|');
}

/** One REALIZED node — the app's node-realization path, placed at the node's
 *  scenePosition (the renderer is the sole consumer of scenePosition, mirroring
 *  AssembledSceneNode; ArtifactNode resets the factory root to identity).
 *  Clicking it selects the node (I-3). */
function RealizedNode({ node, effPos }: { node: PrismNode; effPos?: Vec3 }) {
  const ref = useRef<THREE.Group | null>(null);
  const { pos, rot, scale } = useMemo(() => readScenePos(node), [node]);
  useNodeGroupRegistry(node.nodeId, ref);
  // effective (stack-composed) translation; rotation/scale stay node-local.
  const position: [number, number, number] = effPos ? [effPos.x, effPos.y, effPos.z] : pos;
  return (
    <group
      ref={(g) => {
        ref.current = g;
        if (g) {
          g.userData.prismEditorNode = true;
          g.userData.prismNodeId = node.nodeId;
          g.userData.prismHubId = node.parentHubId;
          g.userData.prismDormant = false;
          g.userData.prismSelectable = node.nodeId;
        }
      }}
      position={position}
      rotation={rot}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        pickNode(node.nodeId, !!(e.nativeEvent as PointerEvent)?.shiftKey);
      }}
    >
      <ArtifactNode node={node} layout="scene" />
    </group>
  );
}

/** One DORMANT seed — the galaxy/unbuilt look for a node (a liquid-glass sphere).
 *  Backed by the same graph node, so Law 0 holds in galaxy too. */
function DormantSeed({ node, position }: { node: PrismNode; position: [number, number, number] }) {
  const ref = useRef<THREE.Group | null>(null);
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const selected = selectedId === node.nodeId;
  const mat = useMemo(() => makeDormantSeed(selected), [selected]);
  useEffect(() => () => mat.dispose(), [mat]);
  useNodeGroupRegistry(node.nodeId, ref);
  return (
    <group
      ref={(g) => {
        ref.current = g;
        if (g) {
          g.userData.prismEditorNode = true;
          g.userData.prismNodeId = node.nodeId;
          g.userData.prismHubId = node.parentHubId;
          g.userData.prismDormant = true;
        }
      }}
      position={position}
    >
      <mesh geometry={SEED_GEO} material={mat} />
    </group>
  );
}
const SEED_GEO = new THREE.SphereGeometry(0.34, 24, 18);

/** Auto-fit wrapper: measures its children's world bbox and eases a uniform
 *  scale + centering so the realized hub fills the framed viewport regardless of
 *  the hub's authored extent (text/codeRef artifacts warm async, so it re-fits
 *  smoothly until stable). */
function FitGroup({ children, active }: { children: React.ReactNode; active: boolean }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const box = useMemo(() => new THREE.Box3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const size = useMemo(() => new THREE.Vector3(), []);
  const frame = useRef(0);
  useFrame(() => {
    if (!active || !outer.current || !inner.current) return;
    frame.current += 1;
    if (frame.current % 8 !== 0) return; // throttle the measure
    inner.current.updateWorldMatrix(true, true);
    box.setFromObject(inner.current, true);
    if (box.isEmpty()) return;
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x / FIT_W, size.y / FIT_H);
    if (maxDim <= 0 || !Number.isFinite(maxDim)) return;
    const target = 1 / maxDim;
    const cur = outer.current.scale.x;
    const next = THREE.MathUtils.lerp(cur, target, 0.18);
    outer.current.scale.setScalar(next);
    // center the content (inner is offset so the bbox center sits at origin)
    inner.current.position.lerp(center.clone().multiplyScalar(-1), 0.18);
  });
  return (
    <group ref={outer}>
      <group ref={inner}>{children}</group>
    </group>
  );
}

export function EditorGraphViewport() {
  const view = useEditorShellStore((s) => s.view);
  const ready = useGraphSourceStore((s) => s.ready);
  const nodes = useGraphSourceStore((s) => s.nodes);
  const hubs = useGraphSourceStore((s) => s.hubs);
  const storeActiveHub = useEditorShellStore((s) => s.activeHubId);

  // default the active hub to the first hub once the graph is loaded.
  useEffect(() => {
    if (!storeActiveHub && hubs.length > 0) {
      useEditorShellStore.getState().setActiveHub(hubs[0].hubId);
    }
  }, [storeActiveHub, hubs]);

  const activeHubId = storeActiveHub ?? resolveActiveHubId();

  if (!ready || nodes.length === 0) return null;

  if (view === 'galaxy') {
    return <GalaxyConstellation nodes={nodes} hubs={hubs} />;
  }

  if (view === 'canvas') {
    const hubNodes = nodes.filter((n) => n.parentHubId === activeHubId);
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    return (
      <FitGroup active>
        {hubNodes.map((n) => (
          // key on a content signature so an Inspector schema edit rebuilds just
          // this node (live), while scenePosition edits keep moving it without remount.
          <RealizedNode key={n.nodeId + ':' + contentSig(n)} node={n} effPos={effectivePos(n, byId)} />
        ))}
      </FitGroup>
    );
  }

  // preview-app — the running app composed from the SAME realized nodes (cache
  // hit, not a rebuild), with header/footer global slots (I-4).
  return <PreviewComposition />;
}

// ── selection overlay (editor chrome — a world-space glowing box that tracks the
//    selected node's realized group, decoupled from the FitGroup scaling) ───────
const SEL_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

function nodeGroups(): Map<string, THREE.Object3D> | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D> };
  return w.__PRISM_EDITOR_NODE_GROUPS__ ?? null;
}

/** A bright wireframe box that snaps to the selected node's world bbox each frame.
 *  Scene-level so it is immune to the FitGroup scale; NOT tagged prismEditorNode
 *  (chrome). Also publishes the selection probes for the headless pass. */
export function SelectionOverlay() {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const view = useEditorShellStore((s) => s.view);
  const lineRef = useRef<THREE.LineSegments>(null);
  const box = useMemo(() => new THREE.Box3(), []);
  const size = useMemo(() => new THREE.Vector3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#9fd8ff', toneMapped: false, transparent: true, opacity: 0.95 }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);

  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_EDITOR_SELECT__ = (id: string | null) => useEditorShellStore.getState().select(id);
    w.__PRISM_EDITOR_SELECTABLE_POS__ = () => {
      const map = nodeGroups();
      if (!map) return [];
      const out: { nodeId: string; world: [number, number, number] }[] = [];
      const b = new THREE.Box3();
      const c = new THREE.Vector3();
      map.forEach((g, id) => {
        if (!g.userData?.prismDormant && g.parent) {
          b.setFromObject(g, true);
          if (!b.isEmpty()) {
            b.getCenter(c);
            out.push({ nodeId: id, world: [c.x, c.y, c.z] });
          }
        }
      });
      return out;
    };
  }

  useFrame(() => {
    const l = lineRef.current;
    if (!l) return;
    const map = nodeGroups();
    const g = selectedId && view === 'canvas' ? map?.get(selectedId) : null;
    if (!g || !g.parent) {
      l.visible = false;
      return;
    }
    box.setFromObject(g, true);
    if (box.isEmpty()) {
      l.visible = false;
      return;
    }
    box.getSize(size);
    box.getCenter(center);
    l.visible = true;
    l.position.copy(center);
    l.scale.set(Math.max(size.x, 0.2) * 1.08, Math.max(size.y, 0.2) * 1.08, Math.max(size.z, 0.2) * 1.08);
  });

  return <lineSegments ref={lineRef} geometry={SEL_EDGES} material={mat} visible={false} renderOrder={20} />;
}

/** Galaxy = the unbuilt graph: every node a dormant seed, clustered per hub into
 *  a constellation ring so the whole app reads as a galaxy of hubs. */
function GalaxyConstellation({ nodes, hubs }: { nodes: PrismNode[]; hubs: PrismHub[] }) {
  const hubIndex = useMemo(() => {
    const m = new Map<string, number>();
    hubs.forEach((h, i) => m.set(h.hubId, i));
    return m;
  }, [hubs]);
  const placed = useMemo(() => {
    const N = Math.max(1, hubs.length);
    const ringR = 5.2;
    const perHubCount = new Map<string, number>();
    return nodes.map((n) => {
      const hi = hubIndex.get(n.parentHubId) ?? 0;
      const ang = (hi / N) * Math.PI * 2;
      const hx = Math.cos(ang) * ringR;
      const hy = Math.sin(ang) * ringR * 0.55;
      // spread the hub's nodes in a tight local cloud around its planet center
      const k = perHubCount.get(n.parentHubId) ?? 0;
      perHubCount.set(n.parentHubId, k + 1);
      const spiralA = k * 2.399; // golden-angle scatter
      const spiralR = 0.22 * Math.sqrt(k);
      const lx = Math.cos(spiralA) * spiralR;
      const ly = Math.sin(spiralA) * spiralR;
      const lz = ((k % 7) - 3) * 0.16;
      return { node: n, pos: [hx + lx, hy + ly, lz] as [number, number, number] };
    });
  }, [nodes, hubs, hubIndex]);
  return (
    <group>
      {placed.map(({ node, pos }) => (
        <DormantSeed key={node.nodeId} node={node} position={pos} />
      ))}
    </group>
  );
}
