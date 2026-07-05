'use client';

// PRISM EDITOR INTEGRATION — I-4: the PREVIEW composition (the running app).
//
// The PREVIEW state of the tri-state renders the BUILT app — the graph AS the
// running application. It reuses the EXACT same node realization the canvas uses
// (ArtifactNode → the codeRef/default factory pipeline, content-hash cached), so
// switching canvas ⇄ preview is a cache HIT, not a rebuild and not a second
// renderer (RT INV-R4 / FP-R4/R5: preview-app is the same built scene in place).
// What changes is only the LAYOUT: instead of the free-edit auto-fit canvas, the
// nodes are composed as an app page inside a framed viewport —
//   • HEADER global-slot nodes pinned to the top band (appear on every page),
//   • FOOTER global-slot nodes pinned to the bottom band,
//   • the active hub's remaining nodes flow as the page CONTENT in the middle,
//   • interactive where applicable (hover lifts; a click routes to the node's
//     own runtime handler).
// The app frame + rails are editor CHROME (glass + worn metal, matching the
// approved look); the realized nodes are graph-backed (Law 0 holds in preview
// too — each is tagged prismEditorNode). ZERO DOM.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import ArtifactNode from '@/components/editor/graph/ArtifactNode';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { PrismNode } from '@/lib/prism-graph/types';
import { buildPaneGeometry, buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { applyWornMaterial, useWornMaps } from '@/components/editor/chassis/materials';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { makeDockGlass } from './editor-shell-glass';
import { contentSig } from './EditorGraphViewport';
import { resolveActiveHubId } from './use-editor-shell-store';

// ── app-frame geometry (world units, inside the central viewport region) ─────
const AW = 12;          // app screen width
const AH = 7.4;         // app screen height
const CY = 0.2;         // app screen vertical center
const TOP = CY + AH / 2;
const BOTTOM = CY - AH / 2;
const BAND = 1.0;       // header / footer band height
const HEADER_Y = TOP - BAND / 2 - 0.15;
const FOOTER_Y = BOTTOM + BAND / 2 + 0.15;
const CONTENT_W = AW - 1.0;
const CONTENT_TOP = HEADER_Y - BAND / 2 - 0.25;
const CONTENT_BOTTOM = FOOTER_Y + BAND / 2 + 0.25;
const CONTENT_H = CONTENT_TOP - CONTENT_BOTTOM;
const CONTENT_CY = (CONTENT_TOP + CONTENT_BOTTOM) / 2;

// ── node-group registry (Law 0 — preview renders resolve to backing nodes) ───
// Register via a stable useEffect (the proven canvas idiom). Doing this inside an
// inline ref callback is unreliable — the callback identity churns each render and
// the map ends up empty — so the headless probes (__PRISM_EDITOR_PREVIEW_NODE_POS__)
// see nothing. useEffect keyed on nodeId sets once on mount, deletes on unmount.
function usePreviewGroupRegistry(nodeId: string, ref: React.RefObject<THREE.Group | null>) {
  useEffect(() => {
    const g = ref.current;
    if (!g || typeof window === 'undefined') return;
    const w = window as unknown as { __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D> };
    const map = (w.__PRISM_EDITOR_NODE_GROUPS__ ??= new Map());
    map.set(nodeId, g);
    return () => { map.delete(nodeId); };
  }, [nodeId, ref]);
}

/** Find a realized node's own runtime click handler (the running-app behavior),
 *  walking its descendants for `userData.handlers.onClick`. */
function findNodeHandler(root: THREE.Object3D | null): (() => void) | null {
  if (!root) return null;
  let fn: (() => void) | null = null;
  root.traverse((o) => {
    if (fn) return;
    const h = (o.userData as { handlers?: { onClick?: () => void } }).handlers;
    if (h && typeof h.onClick === 'function') fn = h.onClick;
  });
  return fn;
}

/** Measure-and-fit: eases a uniform scale + centering so the child content fits a
 *  target (w × h) box. Shared by the per-slot cells and the whole content block.
 *  Re-fits smoothly as MSDF / codeRef artifacts warm async. */
function MeasureFit({
  targetW,
  targetH,
  children,
}: {
  targetW: number;
  targetH: number;
  children: React.ReactNode;
}) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const box = useMemo(() => new THREE.Box3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const size = useMemo(() => new THREE.Vector3(), []);
  const frame = useRef(0);
  useFrame(() => {
    if (!outer.current || !inner.current) return;
    frame.current += 1;
    if (frame.current % 8 !== 0) return;
    outer.current.updateWorldMatrix(true, false);
    inner.current.updateWorldMatrix(true, true);
    box.setFromObject(inner.current, true);
    if (box.isEmpty()) return;
    box.getSize(size);
    box.getCenter(center); // world-space bbox center
    const maxDim = Math.max(size.x / targetW, size.y / targetH);
    if (maxDim <= 0 || !Number.isFinite(maxDim)) return;
    const target = 1 / maxDim;
    const next = THREE.MathUtils.lerp(outer.current.scale.x, target, 0.2);
    outer.current.scale.setScalar(next);
    // Center the content at the outer-group origin REGARDLESS of where the outer
    // group sits in the world (it is nested inside positioned slot/content cells):
    // express the content's world center in outer-local space and nudge `inner`
    // by minus that, so over a few frames the content settles centered.
    const co = outer.current.worldToLocal(center.clone());
    inner.current.position.lerp(inner.current.position.clone().sub(co), 0.2);
  });
  return (
    <group ref={outer}>
      <group ref={inner}>{children}</group>
    </group>
  );
}

/** One realized node in the running app. Same realization path as the canvas
 *  (ArtifactNode), tagged + registered (Law 0). Interactive: hovering lifts it,
 *  clicking routes to the node's own runtime handler when present (the running
 *  app's behavior, NOT editor selection). */
function PreviewNode({
  node,
  cellW,
  cellH,
  position,
}: {
  node: PrismNode;
  cellW: number;
  cellH: number;
  position: [number, number, number];
}) {
  const ref = useRef<THREE.Group | null>(null);
  const lift = useRef(0);
  const target = useRef(0);
  usePreviewGroupRegistry(node.nodeId, ref);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    lift.current = THREE.MathUtils.lerp(lift.current, target.current, 0.25);
    g.position.z = position[2] + lift.current;
    g.position.y = position[1] + lift.current * 0.4;
  });
  return (
    <group
      ref={(g) => {
        ref.current = g;
        if (g) {
          g.userData.prismEditorNode = true;
          g.userData.prismNodeId = node.nodeId;
          g.userData.prismHubId = node.parentHubId;
          g.userData.prismDormant = false;
          g.userData.prismPreviewNode = node.nodeId;
        }
      }}
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); target.current = 0.32; document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { e.stopPropagation(); target.current = 0; document.body.style.cursor = ''; }}
      onClick={(e) => {
        e.stopPropagation();
        const fn = findNodeHandler(ref.current);
        if (fn) fn(); // the running app's own interaction
      }}
    >
      <MeasureFit targetW={cellW} targetH={cellH}>
        <ArtifactNode node={node} layout="scene" />
      </MeasureFit>
    </group>
  );
}

/** A worn-metal rail bar (the global-slot band chrome). */
function Rail({ y, width }: { y: number; width: number }) {
  const maps = useWornMaps();
  const gun = maps['gunmetal'];
  const geo = useMemo(
    () => buildCubeGeometry({ width, height: 0.06, depth: 0.12, cornerRadius: 0.03, bevel: 0.02, radius: 0.5, segments: 6, cutouts: [] }),
    [width],
  );
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial();
    if (gun) applyWornMaterial(m, gun);
    m.roughness = 1;
    m.color = new THREE.Color('#6a7686');
    return m;
  }, [gun]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <mesh geometry={geo} material={mat} position={[0, y, 0.18]} />;
}

/** The app screen frame: a faint glass backplate (the running-app surface) + the
 *  header/footer rails + a small engraved app-frame label. CHROME. */
function AppFrame({ headerEmpty, footerEmpty }: { headerEmpty: boolean; footerEmpty: boolean }) {
  const screenGeo = useMemo(
    () => buildPaneGeometry({ width: AW, height: AH, depth: 0.16, cornerRadius: 0.34, bevel: 0.04, radius: 0.5, segments: 20, cutouts: [] }),
    [],
  );
  const screenMat = useMemo(() => {
    const m = makeDockGlass('smoke');
    m.opacity = 0.5;
    m.attenuationDistance = 2.4;
    return m;
  }, []);
  useEffect(() => () => { screenGeo.dispose(); screenMat.dispose(); }, [screenGeo, screenMat]);
  return (
    <group>
      <mesh geometry={screenGeo} material={screenMat} position={[0, CY, -0.5]} />
      <Rail y={HEADER_Y - BAND / 2} width={AW - 0.6} />
      <Rail y={FOOTER_Y + BAND / 2} width={AW - 0.6} />
      <CompositeText position={[0, TOP + 0.16, 0.3]} fontSize={0.16} variant="engraved">
        PREVIEW · RUNNING APP
      </CompositeText>
      {headerEmpty && (
        <CompositeText position={[0, HEADER_Y, 0.3]} fontSize={0.18} variant="engraved">
          HEADER SLOT
        </CompositeText>
      )}
      {footerEmpty && (
        <CompositeText position={[0, FOOTER_Y, 0.3]} fontSize={0.18} variant="engraved">
          FOOTER SLOT
        </CompositeText>
      )}
    </group>
  );
}

/** Lay slot nodes (header or footer) in a centered horizontal row within a band. */
function SlotRow({ nodes, y }: { nodes: PrismNode[]; y: number }) {
  if (nodes.length === 0) return null;
  const cellW = Math.min(3.2, (AW - 1.2) / nodes.length);
  const cellH = BAND - 0.2;
  const span = nodes.length * cellW + (nodes.length - 1) * 0.3;
  const x0 = -span / 2 + cellW / 2;
  return (
    <group>
      {nodes.map((n, i) => (
        <PreviewNode key={n.nodeId + ':' + contentSig(n)} node={n} cellW={cellW} cellH={cellH} position={[x0 + i * (cellW + 0.3), y, 0]} />
      ))}
    </group>
  );
}

/** The page content: the active hub's non-slot nodes, composed in their authored
 *  scene relationship and fit into the content region. */
function ContentBlock({ nodes }: { nodes: PrismNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <group position={[0, CONTENT_CY, 0]}>
      <MeasureFit targetW={CONTENT_W} targetH={CONTENT_H}>
        {nodes.map((n) => {
          const sp = n.scenePosition;
          return (
            <ContentNode
              key={n.nodeId + ':' + contentSig(n)}
              node={n}
              position={[sp?.x ?? 0, sp?.y ?? 0, sp?.z ?? 0]}
            />
          );
        })}
      </MeasureFit>
    </group>
  );
}

/** One content node at its authored scenePosition (inside the content MeasureFit,
 *  which scales the whole composition into the region). Tagged + interactive. */
function ContentNode({ node, position }: { node: PrismNode; position: [number, number, number] }) {
  const ref = useRef<THREE.Group | null>(null);
  const lift = useRef(0);
  const target = useRef(0);
  const sp = node.scenePosition;
  usePreviewGroupRegistry(node.nodeId, ref);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    lift.current = THREE.MathUtils.lerp(lift.current, target.current, 0.25);
    g.position.z = position[2] + lift.current;
  });
  return (
    <group
      ref={(g) => {
        ref.current = g;
        if (g) {
          g.userData.prismEditorNode = true;
          g.userData.prismNodeId = node.nodeId;
          g.userData.prismHubId = node.parentHubId;
          g.userData.prismDormant = false;
          g.userData.prismPreviewNode = node.nodeId;
        }
      }}
      position={position}
      rotation={[sp?.rotationX ?? 0, sp?.rotationY ?? 0, sp?.rotationZ ?? 0]}
      scale={[sp?.scaleX ?? 1, sp?.scaleY ?? 1, sp?.scaleZ ?? 1]}
      onPointerOver={(e) => { e.stopPropagation(); target.current = 0.3; document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { e.stopPropagation(); target.current = 0; document.body.style.cursor = ''; }}
      onClick={(e) => {
        e.stopPropagation();
        const fn = findNodeHandler(ref.current);
        if (fn) fn();
      }}
    >
      <ArtifactNode node={node} layout="scene" />
    </group>
  );
}

export function PreviewComposition() {
  const nodes = useGraphSourceStore((s) => s.nodes);
  const ready = useGraphSourceStore((s) => s.ready);
  const activeHubId = resolveActiveHubId();

  // GLOBAL slots are sourced from the WHOLE graph (a header authored once shows on
  // every page); content is the ACTIVE hub's non-slot nodes (the current page).
  const { header, footer, content } = useMemo(() => {
    const header = nodes.filter((n) => n.globalSlot === 'header');
    const footer = nodes.filter((n) => n.globalSlot === 'footer');
    const content = nodes.filter((n) => n.parentHubId === activeHubId && !n.globalSlot);
    return { header, footer, content };
  }, [nodes, activeHubId]);

  // ── preview probes (editor chrome — headless running-app assertions) ────────
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_EDITOR_PREVIEW__ = () => ({
      running: true,
      activeHubId,
      headerNodeIds: header.map((n) => n.nodeId),
      footerNodeIds: footer.map((n) => n.nodeId),
      contentNodeIds: content.map((n) => n.nodeId),
      headerCount: header.length,
      footerCount: footer.length,
      contentCount: content.length,
      headerBandY: HEADER_Y,
      footerBandY: FOOTER_Y,
      frame: { width: AW, height: AH, top: TOP, bottom: BOTTOM, centerY: CY },
    });
    // route a click to a preview node's runtime handler; reports whether one fired.
    w.__PRISM_EDITOR_PREVIEW_CLICK__ = (nodeId: string) => {
      const map = (w.__PRISM_EDITOR_NODE_GROUPS__ as Map<string, THREE.Object3D> | undefined);
      const g = map?.get(nodeId) ?? null;
      const fn = findNodeHandler(g);
      if (fn) { fn(); return { hadHandler: true, invoked: true }; }
      return { hadHandler: false, invoked: false };
    };
    // world position of a realized preview node's group (header above footer, etc.)
    w.__PRISM_EDITOR_PREVIEW_NODE_POS__ = (nodeId: string) => {
      const map = (w.__PRISM_EDITOR_NODE_GROUPS__ as Map<string, THREE.Object3D> | undefined);
      const g = map?.get(nodeId);
      if (!g || !g.parent) return null;
      const v = new THREE.Vector3();
      g.getWorldPosition(v);
      return [v.x, v.y, v.z];
    };
  }

  if (!ready) return null;

  return (
    <group>
      <AppFrame headerEmpty={header.length === 0} footerEmpty={footer.length === 0} />
      <SlotRow nodes={header} y={HEADER_Y} />
      <SlotRow nodes={footer} y={FOOTER_Y} />
      <ContentBlock nodes={content} />
    </group>
  );
}
