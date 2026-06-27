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

/** One REALIZED node — the app's node-realization path, placed at the node's
 *  scenePosition (the renderer is the sole consumer of scenePosition, mirroring
 *  AssembledSceneNode; ArtifactNode resets the factory root to identity). */
function RealizedNode({ node }: { node: PrismNode }) {
  const ref = useRef<THREE.Group | null>(null);
  const { pos, rot, scale } = useMemo(() => readScenePos(node), [node]);
  useNodeGroupRegistry(node.nodeId, ref);
  return (
    <group
      ref={(g) => {
        ref.current = g;
        if (g) {
          g.userData.prismEditorNode = true;
          g.userData.prismNodeId = node.nodeId;
          g.userData.prismHubId = node.parentHubId;
          g.userData.prismDormant = false;
        }
      }}
      position={pos}
      rotation={rot}
      scale={scale}
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
    return (
      <FitGroup active>
        {hubNodes.map((n) => (
          <RealizedNode key={n.nodeId} node={n} />
        ))}
      </FitGroup>
    );
  }

  // preview-app placeholder content is rendered by the scene (PreviewPlaceholder).
  return null;
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
