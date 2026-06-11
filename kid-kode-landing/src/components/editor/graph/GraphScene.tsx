'use client';

import { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import {
  Environment,
  Html,
  Stars,
  MeshTransmissionMaterial,
  CameraControls,
  AdaptiveDpr,
  PerformanceMonitor,
  TransformControls,
} from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
  SMAA,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { gsap } from 'gsap';

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import HubLighting from './HubLighting';
import { toEditorView, type EditorGraph, type EditorHubView } from '@/lib/prism-graph/view-model';
import { useGraphEditorStore, type ViewMode, type EditorRenderMode } from '@/stores/useGraphEditorStore';
import { useElementImageStore } from '@/stores/useElementImageStore';
import {
  usePreviewStateStore,
  composeNodeWithPreview,
} from '@/stores/usePreviewStateStore';
import {
  useForceGraph,
  computeGalaxyHubDiameters,
  type SimNode,
  type SimLink,
} from '@/lib/useForceGraph';
import { generateNodeTexture } from '@/lib/nodeTexture';
import HubLabels from '@/components/editor/graph/HubLabels';
import ArtifactNode, { hasArtifactData } from '@/components/editor/graph/ArtifactNode';
import { computeGalaxyLabelVisibility } from '@/lib/galaxy-label-lod';
import { computeHubWorldLabelVisibility } from '@/lib/hub-world-label-lod';
import { computeGalaxyHubTethers } from '@/lib/galaxy-tethers';
import {
  findNearestHub,
  getHubWorldPositions,
} from '@/lib/prism-graph/hub-geometry';
import { computeCloneDragTether } from '@/lib/editor/clone-drag-tether';
import {
  computeGalaxyFilterMatches,
  GALAXY_FILTER_DIM_OPACITY,
  type GalaxyFilterMatches,
} from '@/lib/galaxy-filter';
import {
  computeCanvasCameraPose,
  resolveCanvasCameraPose,
} from '@/lib/editor/canvas-camera';
import {
  computeCanvasViewportFrame,
  CANVAS_VIEWPORT_FRAME_DEFAULTS,
} from '@/lib/editor/canvas-viewport-frame';
import {
  computeCanvasCameraRail,
  type CanvasCameraRail,
} from '@/lib/editor/canvas-camera-rail';
import {
  gizmoModeForKey,
  readCanvasTransform,
  readSceneTransform,
  restorePriorCanvasTransform,
  type CanvasTransform,
  type GizmoMode,
} from '@/lib/editor/canvas-transform-gizmo';
import { getSharedNodeContext, getSharedDriverHub } from '@/lib/prism/runtime/shared-context';
// P2 ANIMATION BINDINGS (canvas-spec §8.2/§8.3) — the binding player attaches
// a node's catalog-primitive animationBindings to the mounted artifact and
// plays them through the SAME driver dispatch the factory's STEP7 path uses.
import { makeNodeDrivers } from '@/lib/prism/runtime/shared/driver-dispatch';
import { attachAnimationBindings } from '@/lib/prism/animatable/bindings';
import {
  IMAGE_SPEC_DEFAULT,
  TEXT_SPEC_DEFAULT,
  type ImageSpec,
  type PrismHub,
  type PrismNode,
  type TextSpec,
} from '@/lib/prism-graph/types';
import { getFontRegistry } from '@/lib/prism/text/font-registry';
import type { TextObjectHandle } from '@/lib/prism/text/contract';
// P4 3D-OBJECT — live primitive reshaping + material handle mounted by the
// factory's mesh branch (userData.meshPrimitiveHandle).
import type { MeshPrimitiveHandle } from '@/lib/prism/runtime/shared/mesh-primitive';
import { isStage0Bubble } from '@/components/editor/add-tools/create-element-node';
// EB-08-04 / §6 SC-046 — three baseline keyframe primitives (load fade-in,
// in-view slide, hover lift). The canvas-mode KeyframeDemo block below
// consumes the registry directly so any future addition to the baselines
// appears in the demo without source edits here.
import {
  LOAD_FADE_IN,
  IN_VIEW_SLIDE,
  HOVER_LIFT,
  interpolateKeyframePrimitive,
} from '@/lib/prism-graph/keyframe-primitives';
// Wave-2E Observatory Brass retint — all chrome accent colors (selection rings,
// hover glows, edge tints, lighting fills, backdrop washes) come from the frozen
// design-system tokens. No component-local hex; purple / electric-blue retired.
import { DS, dsAlpha } from '@/components/editor/design-system';

// Per-hub mockup texture cache — keyed by hubId so each hub textures its
// hull from its own `hub.layout.mockupUrl` (Plan §P11 / Amendment 0002 §A.3).
// The shared singleton this replaced violated one-graph-two-views: every hub
// shared the same hardcoded `/prism-assets/scifi-mockup-v1.png` regardless of
// its own backdrop URL. Now: cache miss → resolves to a CanvasTexture for the
// hub's mockupUrl; cache hit → reuses the same in-flight or settled promise.
const HUB_MOCKUP_TEXTURES = new Map<string, Promise<THREE.CanvasTexture>>();
function loadHubMockupTexture(hubId: string, mockupUrl: string): Promise<THREE.CanvasTexture> {
  const cached = HUB_MOCKUP_TEXTURES.get(hubId);
  if (cached) return cached;
  const promise = new Promise<THREE.CanvasTexture>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('window is undefined'));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(1024, Math.max(img.width, img.height));
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = DS.ink;
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = () => reject(new Error(`failed to load hub mockup ${mockupUrl}`));
    img.src = mockupUrl;
  });
  HUB_MOCKUP_TEXTURES.set(hubId, promise);
  return promise;
}

/** Test-only escape hatch — clears the per-hub texture cache between specs. */
export function __resetHubMockupTextureCache(): void {
  HUB_MOCKUP_TEXTURES.clear();
}

// ═══════════════════════════════════════════════════════════════════
// Edge colors by type
// ═══════════════════════════════════════════════════════════════════
const EDGE_COLORS: Record<string, string> = {
  contains: dsAlpha(DS.brass400, 0.45),
  'navigates-to': DS.ice300,
  triggers: dsAlpha(DS.ok, 0.45),
  'data-flow': dsAlpha(DS.ok, 0.45),
  'shares-state': DS.brass300,
  'depends-on': DS.neutral,
};

// ═══════════════════════════════════════════════════════════════════
// EB-04-01 / SC-019 — hub drill-in reveal animation hook.
//
// Reads `hubRevealAt` and `hubRevealDurationMs` from the editor store and
// returns the current 0..1 fade-in progress for the active hub. Renderers
// (HubHull, Edge, GlassNode) multiply their opacities / group scales by the
// returned value while a galaxy→hub-world drill-in is in flight; once the
// duration elapses the hook holds 1 (no effect).
// ═══════════════════════════════════════════════════════════════════
function useHubRevealProgress(): number {
  const hubRevealAt = useGraphEditorStore((s) => s.hubRevealAt);
  const hubRevealDurationMs = useGraphEditorStore((s) => s.hubRevealDurationMs);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (hubRevealAt == null) {
      setProgress(1);
      return;
    }
    let rafId = 0;
    const tick = () => {
      const elapsed = Date.now() - hubRevealAt;
      if (elapsed >= hubRevealDurationMs) {
        setProgress(1);
        return;
      }
      // Smoothstep ease-out so the reveal feels deterministic but soft.
      const t = Math.max(0, Math.min(1, elapsed / hubRevealDurationMs));
      const eased = t * t * (3 - 2 * t);
      setProgress(eased);
      rafId = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [hubRevealAt, hubRevealDurationMs]);

  return progress;
}

// ═══════════════════════════════════════════════════════════════════
// Edge line (updates positions per-frame from sim)
// ═══════════════════════════════════════════════════════════════════
function Edge({ link, revealOpacity = 1 }: { link: SimLink; revealOpacity?: number }) {
  const lineRef = useRef<any>(null);

  useFrame(() => {
    if (!lineRef.current) return;
    const s = link.source as SimNode;
    const t = link.target as SimNode;
    if (!s || typeof s === 'string' || !t || typeof t === 'string') return;
    const geom = lineRef.current.geometry as THREE.BufferGeometry;
    const positions = new Float32Array([s.x, s.y, s.z, t.x, t.y, t.z]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.attributes.position.needsUpdate = true;
    geom.computeBoundingSphere();
  });

  const color = EDGE_COLORS[link.type] || DS.textHi;
  const baseOpacity = link.type === 'contains' ? 0.28 : 0.62;
  // EB-04-01 / SC-019 — intra-hub tethers in the active hub fade in with the
  // drill-in reveal. Callers pass revealOpacity in [0,1]; default 1 = no effect.
  const opacity = baseOpacity * revealOpacity;

  return (

    <line ref={lineRef}>
      <bufferGeometry />
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        toneMapped={false}
      />

    </line>
  );
}

// Moving packet along an edge to suggest flow
function EdgeParticle({ link }: { link: SimLink }) {
  const ref = useRef<THREE.Mesh>(null);
  const progress = useRef(Math.random());

  useFrame((_, delta) => {
    if (!ref.current) return;
    const s = link.source as SimNode;
    const t = link.target as SimNode;
    if (!s || typeof s === 'string' || !t || typeof t === 'string') return;

    progress.current = (progress.current + delta * 0.16) % 1;
    const p = progress.current;
    ref.current.position.set(
      s.x + (t.x - s.x) * p,
      s.y + (t.y - s.y) * p,
      s.z + (t.z - s.z) * p
    );
  });

  const color = EDGE_COLORS[link.type] || DS.textHi;

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.42, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GalaxyHubTethers — inter-hub reason-colored animated lines (EB-03-04).
// Mounts only when viewMode === 'galaxy'. Color comes from EDGE_COLORS
// keyed by edge type (RA-15). Material is translucent; useFrame drives a
// subtle opacity pulse (SC-015).
// ═══════════════════════════════════════════════════════════════════
function GalaxyHubTethers({
  nodes,
  edges,
  hubCenters,
}: {
  nodes: ReadonlyArray<{ id: string; hubIds: string[] }>;
  edges: ReadonlyArray<{ id: string; source: string; target: string; type: string }>;
  hubCenters: Record<string, { x: number; y: number; z: number }>;
}) {
  const tethers = useMemo(
    () => computeGalaxyHubTethers(nodes, edges),
    [nodes, edges]
  );

  const materialsRef = useRef<THREE.LineBasicMaterial[]>([]);
  materialsRef.current = [];

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    for (let i = 0; i < materialsRef.current.length; i++) {
      const mat = materialsRef.current[i];
      if (!mat) continue;
      // Subtle pulse: opacity oscillates around 0.45 with ±0.15, phase per index.
      mat.opacity = 0.45 + 0.15 * Math.sin(t * 1.4 + i * 0.6);
    }
  });

  return (
    <group>
      {tethers.map((tether, i) => {
        const a = hubCenters[tether.hubA];
        const b = hubCenters[tether.hubB];
        if (!a || !b) return null;
        const color = EDGE_COLORS[tether.type] || DS.textHi;
        const positions = new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z]);
        return (

          <line key={tether.id}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[positions, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              ref={(m) => {
                if (m) materialsRef.current[i] = m;
              }}
              color={color}
              transparent
              opacity={0.45}
              toneMapped={false}
            />

          </line>
        );
      })}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GalaxyCloneDragLayer — EBR2-F-04 / §R2-F SC-077.
//
// Mounted by SceneContent when `viewMode === 'galaxy'` AND
// `draggingNodeId != null` (the Inspector Clone path of EBR2-F-03 sets
// both atomically). Living at the SceneContent layer keeps the listener
// reachable regardless of `editorRenderMode` ('scene' or 'topology').
// Owns three responsibilities:
//
//   1. Attach a `pointermove` listener to the WebGL canvas, raycast the
//      cursor into world space (sample at a fixed forward distance from
//      camera so the cursor follows pointer motion through the galaxy
//      rings).
//   2. Push the unprojected world point + the resolved nearest hub id
//      through the editor-store action setters (FP-11: never direct-
//      mutate).
//   3. Render a transient `<line>` from cursor-world to nearest hub
//      center. Color picks the cyan `'navigates-to'` entry from EDGE_COLORS
//      so the visual matches the existing hub-tether palette (SC-077
//      reuse-EDGE_COLORS clause).
//
// Pointer-up commit (parentHubId rewrite + clear) belongs to EBR2-F-05.
// ═══════════════════════════════════════════════════════════════════
function GalaxyCloneDragLayer({
  hubs,
}: {
  hubs: ReadonlyArray<PrismHub>;
}) {
  const { camera, gl } = useThree();
  const setDraggingPointerWorld = useGraphEditorStore(
    (s) => s.setDraggingPointerWorld,
  );
  const setDraggingNearestHub = useGraphEditorStore(
    (s) => s.setDraggingNearestHub,
  );
  const draggingPointerWorld = useGraphEditorStore(
    (s) => s.draggingPointerWorld,
  );
  const draggingNearestHubId = useGraphEditorStore(
    (s) => s.draggingNearestHubId,
  );
  // EBR2-F-05 / §R2-F SC-076 — pointerup commits the clone to the nearest
  // hub via the source-store action, then clears the three drag slots in
  // lockstep. clearDraggingClone leaves selectedNodeId untouched (INV-20).
  const clearDraggingClone = useGraphEditorStore(
    (s) => s.clearDraggingClone,
  );

  // Reusable buffers so pointermove allocates nothing per-frame.
  const raycasterRef = useRef(new THREE.Raycaster());
  const ndcRef = useRef(new THREE.Vector2());
  const pointRef = useRef(new THREE.Vector3());
  const lineRef = useRef<THREE.Line | null>(null);

  // Sample the cursor at a fixed forward distance from the camera so the
  // unprojected point lives near the galaxy ring radii (~150 units) and
  // moves continuously with pointer drift across hub-bisecting planes.
  const SAMPLE_DISTANCE = 150;

  useEffect(() => {
    const el = gl.domElement;
    if (!el) return;

    const handleMove = (e: PointerEvent) => {
      if (hubs.length === 0) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      ndcRef.current.set(x, y);
      raycasterRef.current.setFromCamera(ndcRef.current, camera);
      raycasterRef.current.ray.at(SAMPLE_DISTANCE, pointRef.current);

      const tether = computeCloneDragTether(
        pointRef.current,
        hubs as PrismHub[],
      );
      setDraggingPointerWorld(tether.tetherStart);
      setDraggingNearestHub(tether.nearestHubId);
    };

    // EBR2-F-05 / §R2-F SC-076 — Pointer-up commits the clone. We read the
    // editor store imperatively here (rather than capturing via closure)
    // because the listener runs from a fresh event tick after the
    // pointermove handler last wrote `draggingNearestHubId`; the store-state
    // snapshot inside the listener is the source-of-truth at release time.
    const handleUp = () => {
      const ed = useGraphEditorStore.getState();
      const cloneId = ed.draggingNodeId;
      const hubId = ed.draggingNearestHubId;
      if (cloneId && hubId) {
        useGraphSourceStore.getState().commitClone(cloneId, hubId);
      }
      clearDraggingClone();
    };

    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerup', handleUp);
    return () => {
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerup', handleUp);
    };
  }, [
    gl,
    camera,
    hubs,
    setDraggingPointerWorld,
    setDraggingNearestHub,
    clearDraggingClone,
  ]);

  // Drive the line geometry from store state. The line endpoints are kept
  // in sync via useFrame so the visual updates smoothly even between
  // pointermove ticks (e.g. during camera-controls inertia).
  const hubPositions = useMemo(
    () => getHubWorldPositions(hubs as PrismHub[]),
    [hubs],
  );

  useFrame(() => {
    if (!lineRef.current) return;
    if (!draggingPointerWorld || !draggingNearestHubId) return;
    const end = hubPositions.get(draggingNearestHubId);
    if (!end) return;
    const geom = lineRef.current.geometry as THREE.BufferGeometry;
    const positions = new Float32Array([
      draggingPointerWorld.x,
      draggingPointerWorld.y,
      draggingPointerWorld.z,
      end.x,
      end.y,
      end.z,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.attributes.position.needsUpdate = true;
    geom.computeBoundingSphere();
  });

  // No line until the first pointermove has populated the slots.
  if (!draggingPointerWorld || !draggingNearestHubId) return null;
  const color = EDGE_COLORS['navigates-to'];
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <line ref={lineRef as any}>
      <bufferGeometry />
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.85}
        toneMapped={false}
      />
    </line>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GlassNode — the photoreal glass-sphere element
// Dual-mesh approach (per research):
//   inner opaque textured sphere shows the element image
//   outer thin-shell sphere is refractive glass with dispersion
// ═══════════════════════════════════════════════════════════════════
function GlassNode({
  node,
  hero,
  hubs,
  sourceNode,
  dim,
  revealOpacity = 1,
}: {
  node: SimNode;
  hero: boolean; // use expensive MeshTransmissionMaterial for 1-2 heroes
  hubs: EditorHubView[];
  sourceNode: PrismNode | undefined;
  // EB-03-05 / SC-016: galaxy-mode filter dim. When true, the node is a
  // non-match against the active filter — its shell opacity is scaled by
  // GALAXY_FILTER_DIM_OPACITY and pointer events are suppressed so the
  // node is not hover/clickable. Matching nodes keep full appearance.
  dim?: boolean;
  // EB-04-01 / SC-019 — drill-in reveal opacity for active-hub nodes. The
  // parent (TopologySceneContent) passes the current fade-in progress only to
  // nodes inside the active hub during the galaxy→hub-world transition. We
  // scale the group so the node grows in with the reveal; non-active hub
  // nodes get the default 1.
  revealOpacity?: number;
}) {
  const dimFactor = dim ? GALAXY_FILTER_DIM_OPACITY : 1;
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const hoveredId = useGraphEditorStore((s) => s.hoveredNodeId);
  const livePreviewHoverId = useGraphEditorStore((s) => s.livePreviewHoverId);
  const frozen = useGraphEditorStore((s) => s.frozenNodeIds.has(node.id));
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  const toggleNodeSelection = useGraphEditorStore((s) => s.toggleNodeSelection);
  const hoverNode = useGraphEditorStore((s) => s.hoverNode);
  const openInspector = useGraphEditorStore((s) => s.openInspector);
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  // drei's MeshTransmissionMaterial (hero shells) is a raw-shader material that
  // WebGPU's NodeBuilder rejects; fall back to the node-compatible
  // meshPhysicalMaterial shell under WebGPU (INV-R14 capability tiering).
  const isWebGPU = useIsWebGPU();

  const isSelected = selectedId === node.id;
  const isHovered = hoveredId === node.id || livePreviewHoverId === node.id;

  // RT-SC-04 / INV-R2 (anchor §2, §3a) — in GALAXY mode every node renders in
  // node-state: a dormant glass sphere, NEVER its built artifact. Built
  // artifacts appear only in canvas/preview-app (AssembledSceneContent). So the
  // ArtifactNode delegation below is disabled in galaxy; it remains available in
  // the canvas-topology authoring view (viewMode === 'canvas') where seeing the
  // real factory output aids structural authoring.
  const renderArtifact =
    viewMode !== 'galaxy' && sourceNode ? hasArtifactData(sourceNode) : false;

  const capturedImage = useElementImageStore((s) => s.images[node.id]);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let current: THREE.CanvasTexture | null = null;
    generateNodeTexture(node, capturedImage).then((tex) => {
      if (cancelled) { tex.dispose(); return; }
      current = tex;
      setTexture((prev) => {
        if (prev) prev.dispose();
        return tex;
      });
    });
    return () => {
      cancelled = true;
      if (current) current.dispose();
    };
  }, [node.id, capturedImage]);

  // Hub color
  const hubColor = useMemo(() => {
    const h = hubs.find((hub) => hub.id === node.hubIds[0]);
    return h?.color || DS.brass400;
  }, [hubs, node.hubIds]);

  const statusColor =
    node.status === 'verified' ? DS.ok :
    node.status === 'failed' ? DS.danger :
    node.status === 'code_generated' ? DS.ice400 :
    node.status === 'image_ready' ? DS.warn : DS.neutral;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.set(node.x, node.y, node.z);
    // EB-04-01 / SC-019 — fade-in via group scale. During the reveal window
    // active-hub nodes grow from 0 → 1; non-active nodes keep revealOpacity=1.
    groupRef.current.scale.setScalar(Math.max(0, Math.min(1, revealOpacity)));

    // Slow rotation so both front & back hemispheres get seen.
    if (innerRef.current) {
      innerRef.current.rotation.y += delta * (isSelected ? 0.25 : 0.08);
    }

    if (ringRef.current) {
      const target = isHovered || isSelected ? 1.0 : 0;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity += (target - mat.opacity) * 0.14;
      ringRef.current.rotation.z += delta * 0.5;
    }

    // Failed nodes pulse red
    if (node.status === 'failed' && innerRef.current) {
      const mat = innerRef.current.material as THREE.MeshStandardMaterial;
      const pulse = (Math.sin(state.clock.elapsedTime * 3) + 1) * 0.5;
      mat.emissiveIntensity = 0.2 + pulse * 0.45;
    }
  });

  const radius = 4.5;

  return (
    <group
      ref={groupRef}
      onPointerOver={dim ? undefined : (e) => {
        e.stopPropagation();
        hoverNode(node.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={dim ? undefined : () => {
        hoverNode(null);
        document.body.style.cursor = 'default';
      }}
      onClick={dim ? undefined : (e) => {
        e.stopPropagation();
        // EB-03-06 / SC-017 — galaxy-mode shift-click promotes the click into
        // toggleNodeSelection so the group grows; plain clicks fall through
        // to selectNode which also collapses any prior group back to a single.
        if (viewMode === 'galaxy' && e.nativeEvent.shiftKey) {
          toggleNodeSelection(node.id);
        } else {
          selectNode(node.id);
        }
      }}
      onDoubleClick={dim ? undefined : (e) => {
        e.stopPropagation();
        selectNode(node.id);
        openInspector();
      }}
    >
      {/* INNER: artifact (real factory output) when the PrismNode carries
          sourceAsset / meshUrl / codeRef; otherwise the textured element
          sphere fallback for intent-only Stage-0 nodes. */}
      {renderArtifact && sourceNode ? (
        <ArtifactNode node={sourceNode} />
      ) : (
        <mesh ref={innerRef} castShadow receiveShadow>
          <sphereGeometry args={[radius, 72, 72]} />
          <meshPhysicalMaterial
            map={texture}
            transparent={dim ? true : undefined}
            opacity={dim ? dimFactor : 1}
            metalness={0.35}
            roughness={0.28}
            clearcoat={0.65}
            clearcoatRoughness={0.18}
            emissive={frozen ? new THREE.Color(DS.ice300) : new THREE.Color(hubColor)}
            emissiveIntensity={(frozen ? 0.22 : node.status === 'failed' ? 0.4 : 0.08) * dimFactor}
            emissiveMap={texture}
          />
        </mesh>
      )}

      {/* OUTER GLASS SHELL — photoreal refraction. Heros use expensive transmission
          material on WebGL; under WebGPU they use the node-compatible physical
          shell (MeshTransmissionMaterial is WebGL-only). */}
      {hero && !isWebGPU ? (
        <mesh ref={shellRef} scale={1.085}>
          <sphereGeometry args={[radius, 48, 48]} />
          <MeshTransmissionMaterial
            samples={4}
            thickness={0.6}
            chromaticAberration={0.08}
            anisotropicBlur={0.15}
            distortion={0.12}
            distortionScale={0.4}
            temporalDistortion={0.08}
            ior={1.33}
            roughness={frozen ? 0.3 : 0.08}
            transmission={0.95 * dimFactor}
            color={frozen ? DS.ice200 : '#ffffff' /* sanctioned: physical no-tint white for transmission glass */}
            attenuationDistance={2}
            attenuationColor={hubColor as any}
            resolution={256}
          />
        </mesh>
      ) : (
        <mesh ref={shellRef} scale={1.08}>
          <sphereGeometry args={[radius, 48, 48]} />
          <meshPhysicalMaterial
            transparent
            opacity={0.52 * dimFactor}
            metalness={0}
            roughness={frozen ? 0.3 : 0.04}
            transmission={0.95}
            thickness={0.35}
            ior={1.35}

            dispersion={frozen ? 0 : 1.8}
            attenuationDistance={2}
            attenuationColor={new THREE.Color(hubColor)}
            clearcoat={1}
            clearcoatRoughness={0.05}
            specularIntensity={1}
            color={'#ffffff' /* sanctioned: physical no-tint white for glass shell */}
          />
        </mesh>
      )}

      {/* SELECTION / HOVER RING */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 1.3, radius * 1.38, 80]} />
        <meshBasicMaterial
          color={isSelected ? DS.brass200 : DS.ice300}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* STATUS POINT LIGHT */}
      <pointLight
        color={statusColor}
        intensity={isSelected ? 3 : 0.7}
        distance={22}
        decay={2}
      />

      {/* HUB-COLORED GLOW BADGE for backend / animation presence */}
      {node.hasBackend && (
        <mesh position={[radius * 0.85, radius * 0.85, 0]}>
          <sphereGeometry args={[0.58, 12, 12]} />
          <meshBasicMaterial color={DS.ice400} toneMapped={false} />
        </mesh>
      )}
      {node.hasAnimation && (
        <mesh position={[-radius * 0.85, radius * 0.85, 0]}>
          <sphereGeometry args={[0.58, 12, 12]} />
          <meshBasicMaterial color={DS.brass300} toneMapped={false} />
        </mesh>
      )}

      {/* Frozen crystal overlay */}
      {frozen && (
        <mesh scale={1.22}>
          <icosahedronGeometry args={[radius, 1]} />
          <meshStandardMaterial
            color={DS.ice300}
            metalness={0.9}
            roughness={0.05}
            transparent
            opacity={0.22}
            wireframe
          />
        </mesh>
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Hub hulls — translucent colored volumes
// ═══════════════════════════════════════════════════════════════════
function HubHull({
  hub,
  center,
  radius,
  innerRadius,
  isActive,
  onSelect,
  dim,
  revealOpacity = 1,
}: {
  hub: EditorHubView;
  center: { x: number; y: number; z: number };
  radius: number;
  innerRadius: number;
  isActive: boolean;
  onSelect: (shiftKey: boolean) => void;
  // EB-03-05 / SC-016: when true, the hub is a non-match against the active
  // galaxy filter. Its opacity is scaled by GALAXY_FILTER_DIM_OPACITY and
  // pointer events are suppressed so dimmed hubs aren't clickable. Matches
  // (dim=false) keep their normal appearance and remain interactive.
  dim?: boolean;
  // EB-04-01 / SC-019 — the active hub's background sphere fades in with the
  // drill-in reveal. The HubHulls parent computes revealOpacity from
  // hubRevealAt / hubRevealDurationMs and forwards it only to the active hub.
  // Default 1 = no effect.
  revealOpacity?: number;
}) {
  // The reveal fade only attenuates the active hub. The dim filter still
  // composes on top for non-match dimming in galaxy mode.
  const revealFactor = isActive ? revealOpacity : 1;
  const dimFactor = (dim ? GALAXY_FILTER_DIM_OPACITY : 1) * revealFactor;
  // Per-hub mockup texture, loaded lazily from `hub.mockupUrl`. When the URL
  // is null/empty (Stage 0 pre-mockup), the inner sphere is skipped and the
  // hull renders with the procedural translucent fallback only.
  const [mockupTexture, setMockupTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    setMockupTexture(null);
    if (!hub.mockupUrl) return;
    let cancelled = false;
    loadHubMockupTexture(hub.id, hub.mockupUrl).then((tex) => {
      if (!cancelled) setMockupTexture(tex);
    }).catch(() => {
      // Texture optional — hub renders without if asset missing.
    });
    return () => { cancelled = true; };
  }, [hub.id, hub.mockupUrl]);

  return (
    <group
      position={[center.x, center.y, center.z]}
      onPointerOver={dim ? undefined : (e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={dim ? undefined : () => {
        document.body.style.cursor = 'default';
      }}
      onClick={dim ? undefined : (e) => {
        e.stopPropagation();
        onSelect(e.nativeEvent.shiftKey);
      }}
    >
      {/* Inner mockup sphere — textures the hub's hull with `hub.mockupUrl`
          via MeshPhysicalMaterial (transmission/clearcoat/ior layered
          vocabulary). Skipped entirely when the hub has no mockupUrl. */}
      {mockupTexture && (
        <mesh>
          <sphereGeometry args={[innerRadius, 64, 64]} />
          <meshPhysicalMaterial
            map={mockupTexture}
            emissiveMap={mockupTexture}
            emissive={new THREE.Color(DS.ice300)}
            emissiveIntensity={(isActive ? 0.32 : 0.18) * dimFactor}
            metalness={0.1}
            roughness={0.3}
            clearcoat={0.6}
            clearcoatRoughness={0.1}
            transmission={0.4}
            thickness={0.5}
            ior={1.6}
            transparent
            opacity={0.85 * dimFactor}
          />
        </mesh>
      )}
      {/* Hull chrome — Observatory Brass retint (Wave-3 advocate MUST-FIX):
          the hull volume/wireframe/ring/light are editor scaffolding, so they
          read in the system's ice family rather than raw hub.color
          (#5d8bff-family registered as forbidden dashboard blue). Roles,
          opacities and intensities unchanged — color-only. */}
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={DS.ice500}
          transparent
          opacity={(isActive ? 0.085 : 0.035) * dimFactor}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial
          color={DS.ice400}
          transparent
          opacity={(isActive ? 0.05 : 0.022) * dimFactor}
          wireframe
          toneMapped={false}
        />
      </mesh>
      {/* Subtle equator glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[innerRadius * 1.02, innerRadius * 1.05, 96]} />
        <meshBasicMaterial
          color={DS.ice300}
          transparent
          opacity={(isActive ? 0.32 : 0.18) * dimFactor}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* Hub-center soft light — modestly brighter than pre-Phase-4 to
          give the mockup sphere a noticeable glow. */}
      <pointLight
        color={DS.ice200}
        intensity={(isActive ? 2.4 : 1.0) * dimFactor}
        distance={radius * 3}
        decay={1.6}
      />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WorldSun — the App_Name_World central object in galaxy mode (SC-012).
// Renders only when viewMode === 'galaxy'. Clicking sets selectedNodeId to
// the PrismRootNode.appNameWorldId and opens the inspector (per haltCheck).
// Hub orbit positions around this sun are owned by EB-03-01; this task ships
// the central object + click target only.
// ═══════════════════════════════════════════════════════════════════
function WorldSun() {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const rootNodes = useGraphSourceStore((s) => s.rootNodes);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  const openInspector = useGraphEditorStore((s) => s.openInspector);

  const root = rootNodes[0];

  useFrame((state, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.12;
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      const pulse = (Math.sin(state.clock.elapsedTime * 0.7) + 1) * 0.5;
      mat.emissiveIntensity = 1.6 + pulse * 0.4;
    }
    if (haloRef.current) {
      haloRef.current.rotation.z += delta * 0.18;
    }
  });

  if (!root) return null;
  const isSelected = selectedId === root.appNameWorldId;
  const radius = 14;

  return (
    <group
      ref={groupRef}
      position={[0, 0, 0]}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectNode(root.appNameWorldId);
        openInspector();
      }}
    >
      <mesh ref={coreRef}>
        <sphereGeometry args={[radius, 96, 96]} />
        <meshStandardMaterial
          color={DS.brass200}
          emissive={new THREE.Color(DS.brass300)}
          emissiveIntensity={1.6}
          roughness={0.32}
          metalness={0.0}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 1.18, radius * 1.32, 96]} />
        <meshBasicMaterial
          color={isSelected ? DS.brass100 : DS.brass200}
          transparent
          opacity={isSelected ? 0.85 : 0.55}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <pointLight color={DS.brass200} intensity={3.2} distance={260} decay={1.8} />
    </group>
  );
}

function HubHulls({
  hubs,
  hubCenters,
  simNodes,
  hubDiameters,
  viewMode,
  filterMatches,
  revealOpacity = 1,
}: {
  hubs: EditorHubView[];
  hubCenters: Record<string, any>;
  simNodes: SimNode[];
  hubDiameters: Record<string, number>;
  viewMode: ViewMode;
  // EB-03-05 / SC-016: when active, hubs whose id is NOT in
  // matchedHubIds receive the dim treatment in galaxy mode.
  filterMatches: GalaxyFilterMatches;
  // EB-04-01 / SC-019 — drill-in reveal opacity for the active hub's
  // background sphere. Forwarded to HubHull where isActive=true.
  revealOpacity?: number;
}) {
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const selectedHubId = useGraphEditorStore((s) => s.selectedHubId);
  const selectHub = useGraphEditorStore((s) => s.selectHub);
  const toggleHubSelection = useGraphEditorStore((s) => s.toggleHubSelection);
  // EB-04-01 / SC-018 — galaxy hub click drills into hub-world.
  const drillIntoHub = useGraphEditorStore((s) => s.drillIntoHub);

  return (
    <>
      {hubs.map((hub) => {
        const center = hubCenters[hub.id];
        if (!center) return null;

        const hubNodes = simNodes.filter((n) => n.hubIds.includes(hub.id));
        if (!hubNodes.length) return null;

        // EB-03-02: galaxy mode swaps the topology-only `maxDist + 10`
        // heuristic for a deterministic per-hub diameter computed from
        // (nodeCount, depth) via computeGalaxyHubDiameters (SC-013). The
        // diameter is the full size; radius is half. Non-galaxy modes keep
        // the existing sim-based radius so hub-world / canvas don't
        // visually regress.
        let radius: number;
        if (viewMode === 'galaxy' && hubDiameters[hub.id] != null) {
          radius = hubDiameters[hub.id] / 2;
        } else {
          let maxDist = 20;
          hubNodes.forEach((n) => {
            const d = Math.sqrt(
              (n.x - center.x) ** 2 + (n.y - center.y) ** 2 + (n.z - center.z) ** 2
            );
            if (d > maxDist) maxDist = d;
          });
          radius = maxDist + 10;
        }
        // Inner mockup-textured sphere is capped well below the node cloud's
        // outer reach so element-spheres orbit *outside* the opaque hub
        // surface and stay visible. The outer translucent hull (`radius`)
        // still wraps the full constellation.
        const innerRadius = Math.min(radius * 0.45, 32);
        const isActive = activeHubId === hub.id || selectedHubId === hub.id;

        const dim =
          viewMode === 'galaxy' &&
          filterMatches.active &&
          !filterMatches.matchedHubIds.has(hub.id);

        return (
          <HubHull
            key={hub.id}
            hub={hub}
            center={center}
            radius={radius}
            innerRadius={innerRadius}
            isActive={isActive}
            revealOpacity={revealOpacity}
            onSelect={(shiftKey) => {
              // EB-03-06 / SC-017 — shift-click on a hub in galaxy mode adds
              // the hub to the multi-selection set instead of replacing the
              // current selection. Other modes preserve single-select.
              if (viewMode === 'galaxy' && shiftKey) {
                toggleHubSelection(hub.id);
              } else if (viewMode === 'galaxy') {
                // EB-04-01 / SC-018 — plain galaxy hub click drills into
                // hub-world, fires flyToHub, and stamps hubRevealAt for the
                // SC-019 fade-in animation.
                drillIntoHub(hub.id);
              } else {
                selectHub(hub.id);
              }
            }}
            dim={dim}
          />
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Progressive HTML labels via 3D→2D projection (4 tiers)
// ═══════════════════════════════════════════════════════════════════
function NodeLabels({ simNodes }: { simNodes: SimNode[] }) {
  const { camera, size } = useThree();
  const [, forceRender] = useState(0);
  useFrame(() => forceRender((x) => (x + 1) % 1000000));

  const hoveredId = useGraphEditorStore((s) => s.hoveredNodeId);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const livePreviewHoverId = useGraphEditorStore((s) => s.livePreviewHoverId);
  const frozenIds = useGraphEditorStore((s) => s.frozenNodeIds);
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const zoomLevel = useGraphEditorStore((s) => s.zoomLevel);
  const cameraDistance = useGraphEditorStore((s) => s.cameraDistance);

  // SC-014 — Galaxy mode zoom-based label LOD. At L0/L1 node-cluster labels
  // are hidden; at L2+ they render. `nodeLabelOpacity` is forwarded to the
  // rendered `<Html>` so any future renderer that lifts the L1 early-return
  // can drive a cross-fade without re-deriving opacity here.
  const lod = computeGalaxyLabelVisibility(viewMode, zoomLevel, cameraDistance);
  // SC-021 — Hub-world intra-hub LOD. At L1 hub label only; L3+ node labels
  // appear; L4 reveals sub-node detail (elementType + status dot row).
  // Predicate is a no-op outside hub-world, so it composes safely with the
  // galaxy gate above.
  const hubWorldLod = computeHubWorldLabelVisibility(viewMode, zoomLevel, cameraDistance);
  if (!lod.showNodeLabels) return null;
  if (!hubWorldLod.showNodeLabels) return null;
  const lodOpacity = lod.nodeLabelOpacity * hubWorldLod.nodeLabelOpacity;
  const showSubNodeDetail = hubWorldLod.showSubNodeDetail;
  const subNodeDetailOpacity = hubWorldLod.subNodeDetailOpacity;

  return (
    <>
      {simNodes.map((node) => {
        const vec = new THREE.Vector3(node.x, node.y, node.z);
        const distance = camera.position.distanceTo(vec);
        vec.project(camera);
        if (vec.z > 1) return null;

        const fovRad = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
        const apparent = (4.5 * size.height) / (2 * distance * Math.tan(fovRad / 2));

        const isHovered = hoveredId === node.id || livePreviewHoverId === node.id;
        const isSelected = selectedId === node.id;
        const frozen = frozenIds.has(node.id);

        let tier = 0;
        if (apparent > 18) tier = 1;
        if (apparent > 36) tier = 2;
        if (apparent > 72) tier = 3;
        if (apparent > 140) tier = 4;
        if ((isHovered || isSelected) && tier < 2) tier = 2;

        if (tier === 0 && !isHovered && !isSelected) return null;

        const statusColor =
          node.status === 'verified' ? DS.ok :
          node.status === 'failed' ? DS.danger :
          node.status === 'code_generated' ? DS.ice400 :
          node.status === 'image_ready' ? DS.warn : DS.neutral;

        return (
          <Html
            key={node.id}
            position={[node.x, node.y + 5.8, node.z]}
            center
            zIndexRange={[100, 0]}
            style={{ pointerEvents: 'none', opacity: lodOpacity }}
          >
            <div className="select-none">
              {tier >= 1 && (
                <div
                  className="font-mono font-semibold tracking-wide whitespace-nowrap"
                  style={{
                    color: isSelected ? DS.brass200 : DS.textHi,
                    fontSize: tier === 1 ? 10 : tier === 2 ? 11 : 13,
                    textShadow: '0 0 10px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,1)',
                    lineHeight: 1.2,
                  }}
                >
                  {node.name}
                </div>
              )}
              {tier >= 2 && showSubNodeDetail && (
                <div
                  className="flex items-center gap-1.5 justify-center font-mono mt-0.5"
                  style={{ fontSize: 9, color: DS.textMid, opacity: subNodeDetailOpacity }}
                >
                  <span>{node.elementType}</span>
                  <span
                    className="inline-block rounded-full"
                    style={{
                      width: 6, height: 6,
                      background: statusColor,
                      boxShadow: `0 0 6px ${statusColor}`,
                    }}
                  />
                  {node.hasBackend && <span style={{ color: DS.ice400 }}>BE</span>}
                  {node.hasAnimation && <span style={{ color: DS.brass300 }}>○</span>}
                  {frozen && <span style={{ color: DS.ice300 }}>❄</span>}
                </div>
              )}
              {tier >= 3 && showSubNodeDetail && (
                <div
                  className="font-mono mt-0.5 text-center"
                  style={{ fontSize: 9, color: statusColor, opacity: subNodeDetailOpacity }}
                >
                  score {node.verificationScore.toFixed(2)}
                </div>
              )}
              {tier >= 4 && showSubNodeDetail && (
                <div
                  className="mt-1 max-w-[200px] mx-auto text-[10px] text-center leading-snug"
                  style={{ color: DS.text, textShadow: '0 1px 3px rgba(0,0,0,0.9)', opacity: subNodeDetailOpacity }}
                >
                  {node.caption.slice(0, 90)}…
                </div>
              )}
            </div>
          </Html>
        );
      })}
    </>
  );
}

function EditorDiagnostics({ simNodes }: { simNodes: SimNode[] }) {
  const { camera, gl } = useThree();

  useFrame(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return;
    const rect = gl.domElement.getBoundingClientRect();
    let visibleHomeNodeCount = 0;
    const visibleHomeNodeIds: string[] = [];
    simNodes.forEach((node) => {
      if (!node.hubIds.includes('home')) return;
      const projected = new THREE.Vector3(node.x, node.y, node.z).project(camera);
      const x = rect.left + ((projected.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - projected.y) / 2) * rect.height;
      if (projected.z <= 1 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        visibleHomeNodeCount += 1;
        visibleHomeNodeIds.push(node.id);
      }
    });
    (window as any).__prismEditorDebug = {
      visibleHomeNodeCount,
      visibleHomeNodeIds,
      totalHomeNodeCount: simNodes.filter((node) => node.hubIds.includes('home')).length,
    };
  });

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Camera controller — uses drei's CameraControls (yomotsu/camera-controls)
// Smooth damped flights, fitToSphere, setLookAt with promises
// ═══════════════════════════════════════════════════════════════════
function ControlsBridge({
  simNodes,
  hubCenters,
}: {
  simNodes: SimNode[];
  hubCenters: Record<string, any>;
}) {
  const controlsRef = useRef<CameraControls>(null);
  const setCameraDistance = useGraphEditorStore((s) => s.setCameraDistance);

  const flyToNodeId = useGraphEditorStore((s) => s.flyToNodeId);
  const flyToHubId = useGraphEditorStore((s) => s.flyToHubId);
  const resetSignal = useGraphEditorStore((s) => s.resetCameraSignal);
  const clearFlyTarget = useGraphEditorStore((s) => s.clearFlyTarget);
  // EB-05-01 / §5 SC-022, SC-024 — canvas-mode pose entry. Read once per
  // mount; subscriptions fire the effect below on changes.
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const checkpointCameraPose = useGraphEditorStore((s) => s.checkpointCameraPose);
  // EB-05-05 / §5 SC-027 — previousViewMode tracks the last-seen mode so the
  // canvas-entry effect can snapshot the *outgoing* mode's live pose into
  // cameraPoseByMode before installing the incoming pose. INV-20: camera
  // pose is mode-specific but checkpointed and restorable.
  const previousViewMode = useRef<typeof viewMode | null>(null);

  // Reset camera
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.setLookAt(0, 0, 320, 0, 0, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // Fly to node
  useEffect(() => {
    if (!flyToNodeId) return;
    const node = simNodes.find((n) => n.id === flyToNodeId);
    const c = controlsRef.current;
    if (!node || !c) return;

    // Position camera at a comfortable distance from node, looking at it
    const offset = new THREE.Vector3(node.x, node.y, node.z).normalize().multiplyScalar(18);
    const camX = node.x + offset.x + 8;
    const camY = node.y + offset.y + 4;
    const camZ = node.z + offset.z + 8;
    c.setLookAt(camX, camY, camZ, node.x, node.y, node.z, true).then(() => {
      clearFlyTarget();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToNodeId]);

  // Fly to hub
  useEffect(() => {
    if (!flyToHubId) return;
    const center = hubCenters[flyToHubId];
    const c = controlsRef.current;
    if (!center || !c) return;
    const singleHub = Object.keys(hubCenters).length === 1;
    const camX = singleHub ? center.x : center.x + 50;
    const camY = singleHub ? center.y : center.y + 30;
    const camZ = singleHub ? center.z + 320 : center.z + 90;
    c.setLookAt(camX, camY, camZ, center.x, center.y, center.z, true).then(() => {
      clearFlyTarget();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToHubId]);

  // EB-05-01 / §5 SC-022, SC-024 — Canvas mode entry: position the camera at
  // a deterministic pose centered on the active hub and checkpoint it. SC-024
  // is preserved by computeCanvasCameraPose, which offsets along +Z so the
  // scene retains its `scenePosition.z` depth instead of collapsing to a
  // flat 2D projection. The pose is then handed to checkpointCameraPose so
  // canvas → hub-world → canvas (SC-027) restores exactly.
  //
  // EB-05-05 / §5 SC-027 — on every viewMode change, first snapshot the
  // *outgoing* mode's live pose into cameraPoseByMode[previousViewMode] so
  // a later re-entry restores exactly what the user left. On canvas entry,
  // prefer the stored canvas pose over re-deriving the deterministic one
  // (resolveCanvasCameraPose) — that is what makes "restores ... exactly"
  // hold when the user moved the camera inside canvas before leaving.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;

    // 1. Capture the live pose of the prior mode (SC-027 round-trip leg).
    const prev = previousViewMode.current;
    if (prev && prev !== viewMode) {
      const pos = new THREE.Vector3();
      const tgt = new THREE.Vector3();
      c.getPosition(pos);
      c.getTarget(tgt);
      checkpointCameraPose(prev, {
        position: { x: pos.x, y: pos.y, z: pos.z },
        target: { x: tgt.x, y: tgt.y, z: tgt.z },
      });
    }
    previousViewMode.current = viewMode;

    // 2. On canvas entry, restore the checkpointed canvas pose if present;
    //    otherwise fall back to the SC-022 deterministic pose.
    if (viewMode !== 'canvas') return;
    const stored = useGraphEditorStore.getState().cameraPoseByMode.canvas;
    const center =
      (activeHubId && hubCenters[activeHubId]) ?? { x: 0, y: 0, z: 0 };
    const pose = resolveCanvasCameraPose(stored, {
      x: center.x,
      y: center.y,
      z: center.z,
    });
    c.setLookAt(
      pose.position.x,
      pose.position.y,
      pose.position.z,
      pose.target.x,
      pose.target.y,
      pose.target.z,
      true,
    );
    checkpointCameraPose('canvas', pose);
    // hubCenters is a fresh object each frame; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeHubId]);

  // Track camera distance for zoom-level state
  useFrame(() => {
    const c = controlsRef.current;
    if (!c) return;
    setCameraDistance(c.distance);
  });

  return (
    <CameraControls
      ref={controlsRef}
      minDistance={8}
      maxDistance={600}
      smoothTime={0.28}
      draggingSmoothTime={0.14}
      dollyToCursor
      truckSpeed={2}
      azimuthRotateSpeed={1}
      polarRotateSpeed={1}
      dollySpeed={1}
      infinityDolly={false}
    />
  );
}

function SceneControlsBridge({
  nodes,
  hub,
}: {
  nodes: PrismNode[];
  hub?: PrismHub | null;
}) {
  const controlsRef = useRef<CameraControls>(null);
  const setCameraDistance = useGraphEditorStore((s) => s.setCameraDistance);
  const flyToNodeId = useGraphEditorStore((s) => s.flyToNodeId);
  const resetSignal = useGraphEditorStore((s) => s.resetCameraSignal);
  const clearFlyTarget = useGraphEditorStore((s) => s.clearFlyTarget);
  // EB-05-01 / §5 SC-022, SC-024 — canvas-mode pose entry (scene-mode coords:
  // active hub renders at local origin so center == 0,0,0).
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const checkpointCameraPose = useGraphEditorStore((s) => s.checkpointCameraPose);

  // EBR2-D-02 / §R2-D SC-071 — derive canvas-mode camera rail (6 angular
  // bounds + pan limits) from the active hub envelope + viewport frame.
  // Non-canvas modes hand `null` so the rail stays inert and the
  // CameraControls fall back to the default (preview-app) constraints.
  const rail = useMemo<CanvasCameraRail | null>(() => {
    if (viewMode === 'canvas' && hub) {
      const breakpoint = hub.responsiveBreakpoints?.desktop ?? null;
      const viewportFrame = computeCanvasViewportFrame({ breakpoint });
      return computeCanvasCameraRail(hub, breakpoint, viewportFrame);
    }
    return null;
  }, [viewMode, hub]);
  // EB-05-05 / §5 SC-027 — previousViewMode for canvas↔hub-world round-trip
  // pose snapshotting in this scene-mode bridge (see ControlsBridge for the
  // matching block in topology mode).
  const previousViewMode = useRef<typeof viewMode | null>(null);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.setLookAt(0, 0, 10, 0, 0, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // EB-05-01 / §5 SC-022, SC-024 — Canvas mode entry: deterministic
  // center/face pose on the active hub. AssembledSceneContent filters to a
  // single hub whose nodes live in their local frame, so the active hub
  // center is (0, 0, 0) here. computeCanvasCameraPose offsets along +Z so
  // node `scenePosition.z` depth is preserved (SC-024 — never a flat 2D
  // projection). Pose is checkpointed for SC-027 round-trip restoration.
  //
  // EB-05-05 / §5 SC-027 — snapshot the outgoing mode's pose on every change
  // and restore the stored canvas pose on canvas entry (INV-20).
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;

    const prev = previousViewMode.current;
    if (prev && prev !== viewMode) {
      const pos = new THREE.Vector3();
      const tgt = new THREE.Vector3();
      c.getPosition(pos);
      c.getTarget(tgt);
      checkpointCameraPose(prev, {
        position: { x: pos.x, y: pos.y, z: pos.z },
        target: { x: tgt.x, y: tgt.y, z: tgt.z },
      });
    }
    previousViewMode.current = viewMode;

    if (viewMode !== 'canvas') return;
    const stored = useGraphEditorStore.getState().cameraPoseByMode.canvas;
    const pose = resolveCanvasCameraPose(stored, { x: 0, y: 0, z: 0 });
    c.setLookAt(
      pose.position.x,
      pose.position.y,
      pose.position.z,
      pose.target.x,
      pose.target.y,
      pose.target.z,
      true,
    );
    checkpointCameraPose('canvas', pose);
  }, [viewMode, activeHubId, checkpointCameraPose]);

  useEffect(() => {
    if (!flyToNodeId) return;
    const node = nodes.find((n) => n.nodeId === flyToNodeId);
    const c = controlsRef.current;
    const sp = node?.scenePosition;
    if (!node || !sp || !c) return;
    c.setLookAt(sp.x, sp.y, sp.z + 5.5, sp.x, sp.y, sp.z, true).then(() => {
      clearFlyTarget();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToNodeId, nodes]);

  useFrame(() => {
    const c = controlsRef.current;
    if (!c) return;
    setCameraDistance(c.distance);
  });

  // EBR2-D-02 / §R2-D SC-071 — apply pan-target clamps via camera-controls
  // setBoundary. The rail expresses panLimits as half-extents around the
  // hub origin in scene units; we lift those into a Box3 with a deliberately
  // generous Z window so dolly movement is not double-clamped (minDistance/
  // maxDistance already constrain Z). Non-canvas modes reset the boundary
  // so preview-app can pan freely.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    if (rail) {
      const { panLimits } = rail;
      const box = new THREE.Box3(
        new THREE.Vector3(panLimits.minX, panLimits.minY, -1000),
        new THREE.Vector3(panLimits.maxX, panLimits.maxY, 1000),
      );
      c.setBoundary(box);
    } else {
      c.setBoundary(undefined);
    }
  }, [rail]);

  // EBR2-D-02 / §R2-D SC-071 — dev hooks consumed by verify-editor-runtimes
  // (notes/ralph-interactions/EBR2-D-02.json):
  //   __PRISM_EDITOR_GET_CANVAS_CAMERA__  → live {position, target,
  //                                         polarAngle, azimuthAngle}
  //   __PRISM_EDITOR_GET_CANVAS_RAIL__    → current CanvasCameraRail or null
  // The interaction script asserts the live camera stays inside the rail
  // after a wheel-zoom barrage; both hooks must therefore reflect the same
  // controls instance (no stale snapshots).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      __PRISM_EDITOR_GET_CANVAS_CAMERA__?: () => {
        position: { x: number; y: number; z: number };
        target: { x: number; y: number; z: number };
        polarAngle: number;
        azimuthAngle: number;
      } | null;
      __PRISM_EDITOR_GET_CANVAS_RAIL__?: () => CanvasCameraRail | null;
    };
    const pos = new THREE.Vector3();
    const tgt = new THREE.Vector3();
    w.__PRISM_EDITOR_GET_CANVAS_CAMERA__ = () => {
      const c = controlsRef.current;
      if (!c) return null;
      c.getPosition(pos);
      c.getTarget(tgt);
      return {
        position: { x: pos.x, y: pos.y, z: pos.z },
        target: { x: tgt.x, y: tgt.y, z: tgt.z },
        polarAngle: c.polarAngle,
        azimuthAngle: c.azimuthAngle,
      };
    };
    w.__PRISM_EDITOR_GET_CANVAS_RAIL__ = () => rail;
    return () => {
      delete w.__PRISM_EDITOR_GET_CANVAS_CAMERA__;
      delete w.__PRISM_EDITOR_GET_CANVAS_RAIL__;
    };
  }, [rail]);

  return (
    <CameraControls
      ref={controlsRef}
      minDistance={rail ? rail.minDistance : 3}
      maxDistance={rail ? rail.maxDistance : 80}
      minPolarAngle={rail ? rail.minPolarAngle : 0}
      maxPolarAngle={rail ? rail.maxPolarAngle : Math.PI}
      minAzimuthAngle={rail ? rail.minAzimuthAngle : -Infinity}
      maxAzimuthAngle={rail ? rail.maxAzimuthAngle : Infinity}
      smoothTime={0.24}
      draggingSmoothTime={0.12}
      dollyToCursor
      truckSpeed={1.1}
      azimuthRotateSpeed={0.7}
      polarRotateSpeed={0.7}
      dollySpeed={0.75}
      infinityDolly={false}
    />
  );
}

function SceneBackdrop({ hub }: { hub: PrismHub | undefined }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const mockupUrl = hub?.layout?.mockupUrl ?? null;

  useEffect(() => {
    if (!mockupUrl) {
      setTexture(null);
      return;
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      mockupUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture((prev) => {
          prev?.dispose();
          return tex;
        });
      },
      undefined,
      () => {
        if (!cancelled) setTexture(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [mockupUrl]);

  useEffect(() => () => texture?.dispose(), [texture]);

  const aspect = hub?.layout?.viewportWidth && hub?.layout?.viewportHeight
    ? hub.layout.viewportWidth / hub.layout.viewportHeight
    : 16 / 9;
  const width = 10;
  const height = width / aspect;

  return (
    <mesh position={[0, 0, -2]} name="hub:scene-backdrop">
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture ?? undefined} color={texture ? '#ffffff' /* sanctioned: no-tint texture passthrough */ : DS.ink} transparent opacity={1} toneMapped={false} />
    </mesh>
  );
}

// EB-05-02 / §5 SC-023 — Canvas mode viewport frame + safe-area bounds.
// Outer frame is the default 1440×900 desktop viewport (multiplied by the
// active responsive breakpoint scale if one is set on the hub); inner
// dashed frame is a 24-px safe-area inset. World scale maps 1440 design-px
// to the SceneBackdrop's 10-unit width so the overlay sits flush with the
// hub mockup plane.
const CANVAS_VIEWPORT_FRAME_WORLD_WIDTH = 10;
const CANVAS_VIEWPORT_FRAME_WORLD_UNITS_PER_PX =
  CANVAS_VIEWPORT_FRAME_WORLD_WIDTH / CANVAS_VIEWPORT_FRAME_DEFAULTS.width;

function rectLinePositions(width: number, height: number): Float32Array {
  const hw = width / 2;
  const hh = height / 2;
  return new Float32Array([
    -hw, -hh, 0,  hw, -hh, 0,
     hw, -hh, 0,  hw,  hh, 0,
     hw,  hh, 0, -hw,  hh, 0,
    -hw,  hh, 0, -hw, -hh, 0,
  ]);
}

function CanvasViewportFrame({
  breakpoint,
}: {
  breakpoint?: { scale?: number } | null;
}) {
  const viewMode = useGraphEditorStore((s) => s.viewMode);

  const frame = useMemo(
    () => computeCanvasViewportFrame({ breakpoint }),
    [breakpoint],
  );

  const { outerGeom, safeGeom } = useMemo(() => {
    const px = CANVAS_VIEWPORT_FRAME_WORLD_UNITS_PER_PX;
    const og = new THREE.BufferGeometry();
    og.setAttribute(
      'position',
      new THREE.BufferAttribute(
        rectLinePositions(frame.width * px, frame.height * px),
        3,
      ),
    );
    const sg = new THREE.BufferGeometry();
    sg.setAttribute(
      'position',
      new THREE.BufferAttribute(
        rectLinePositions(frame.safe.width * px, frame.safe.height * px),
        3,
      ),
    );
    return { outerGeom: og, safeGeom: sg };
  }, [frame]);

  const safeMat = useMemo(
    () =>
      new THREE.LineDashedMaterial({
        color: DS.ice400,
        dashSize: 0.18,
        gapSize: 0.12,
        transparent: true,
        opacity: 0.7,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );
  const outerMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: DS.ice300,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );
  const safeRef = useRef<THREE.LineSegments>(null);

  useEffect(() => {
    safeRef.current?.computeLineDistances();
  }, [safeGeom]);

  useEffect(
    () => () => {
      outerGeom.dispose();
      safeGeom.dispose();
    },
    [outerGeom, safeGeom],
  );

  useEffect(
    () => () => {
      outerMat.dispose();
      safeMat.dispose();
    },
    [outerMat, safeMat],
  );

  return viewMode === 'canvas' ? (
    <group name="canvas:viewport-frame" position={[0, 0, -1.2]} renderOrder={10}>
      <lineSegments geometry={outerGeom} material={outerMat} renderOrder={10} />
      <lineSegments ref={safeRef} geometry={safeGeom} material={safeMat} renderOrder={11} />
    </group>
  ) : null;
}

// EB-08-04 / §6 SC-046 — Canvas-mode keyframe demo node.
//
// Mounts only in `canvas` viewMode (FP-12 canonical literal). Drives a small
// quad through all three baseline keyframe primitives (LOAD_FADE_IN, IN_VIEW_SLIDE,
// HOVER_LIFT) so the two-runtime snapshot captures the post-load + post-in-view
// state (haltCheck: "snapshot captures the in-view-slide state").
//
// Each primitive is consumed via `interpolateKeyframePrimitive`; no per-frame
// values are inlined — they all come from the keyframe-primitives module.
// Hover lift runs on pointer events. Opacity / Z come from the same pure
// interpolator the Phase 8 runtime will consume in EB-08-05.
function KeyframeDemo() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  // Refs (not state) — useFrame mutates them every tick without re-rendering
  // the subtree. Matches the existing pattern in this file (hoverTargetRef,
  // camera pose refs).
  const mountedMsRef = useRef(0);
  const hoverProgressRef = useRef(0);
  const hoverTargetRef = useRef(0);

  // load + in-view animation window so the snapshot — captured ~2.5s after the
  // mode switch — sees both fully settled and the hover primitive at its rest
  // pose (progress = 0).
  const LOAD_DURATION_MS = 800;
  const IN_VIEW_DELAY_MS = 600;
  const IN_VIEW_DURATION_MS = 900;

  useFrame((_, delta) => {
    if (viewMode !== 'canvas') return;
    mountedMsRef.current += delta * 1000;
    const mounted = mountedMsRef.current;
    // Critically-damped hover progress toward target.
    hoverProgressRef.current +=
      (hoverTargetRef.current - hoverProgressRef.current) * Math.min(1, delta * 8);

    // Compose the three primitives into a single transform / opacity.
    const tLoad = Math.min(1, mounted / LOAD_DURATION_MS);
    const tInView = Math.min(
      1,
      Math.max(0, (mounted - LOAD_DURATION_MS - IN_VIEW_DELAY_MS) / IN_VIEW_DURATION_MS),
    );
    const loadVals = interpolateKeyframePrimitive(LOAD_FADE_IN, tLoad);
    const slideVals = interpolateKeyframePrimitive(IN_VIEW_SLIDE, tInView);
    const liftVals = interpolateKeyframePrimitive(HOVER_LIFT, hoverProgressRef.current);

    const mesh = meshRef.current;
    const mat = materialRef.current;
    if (mesh) {
      mesh.position.y = (slideVals.translateY ?? 0) * 0.6; // scaled into scene units
      mesh.position.z = (liftVals.translateZ ?? 0);
      const s = liftVals.scale ?? 1;
      mesh.scale.set(s, s, s);
    }
    if (mat) {
      // Multiply: load opacity * in-view opacity for a clean compose.
      mat.opacity = (loadVals.opacity ?? 1) * (slideVals.opacity ?? 1);
    }
  });

  if (viewMode !== 'canvas') return null;

  // Anchor on the right side of the viewport frame so it doesn't collide
  // with the CanvasTransformGizmo proxy at origin.
  return (
    <group name="canvas:keyframe-demo" position={[1.6, 0, -0.6]} renderOrder={9}>
      <mesh
        ref={meshRef}
        onPointerOver={() => { hoverTargetRef.current = 1; }}
        onPointerOut={() => { hoverTargetRef.current = 0; }}
      >
        <planeGeometry args={[0.6, 0.6]} />
        <meshBasicMaterial
          ref={materialRef}
          color={DS.brass400}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}


// EB-05-03 / §6 Phase 5 SC-025 + Phase 8 SC-042 — Per-node transform gizmo.
//
// When viewMode === 'canvas' AND a node is selected, mounts a drei
// <TransformControls /> bound to an invisible proxy group anchored at the
// node's scenePosition. The proxy's local transform IS the node's
// canvasTransform; on every gizmo change we read the proxy's pose and write
// `canvasTransform` (NEVER scenePosition — SC-042 / FP-04) through
// useGraphSourceStore.updateNode. Pressing Escape during a drag restores the
// prior snapshot captured at selection time. Keys g/r/s switch between
// translate, rotate, and scale gizmo modes (Blender-style).
function CanvasTransformGizmo({ nodes }: { nodes: PrismNode[] }) {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const editorMode = useGraphEditorStore((s) => s.editorMode);
  const selectedNodeId = useGraphEditorStore((s) => s.selectedNodeId);
  // STEP8 canvas-spec SC-9 — Transform tools author the node's OWN schema
  // (scenePosition), the legitimate way a node's position/scale is set. (The
  // archived editor-build SC-042 routed this to `canvasTransform`; that is
  // superseded by the canonical canvas spec — SPEC-INDEX S6.)
  const updateNode = useGraphSourceStore((s) => s.updateNode);
  // STEP8 — gizmo axis set is lifted to the store so the toolbar Move/Rotate/
  // Scale buttons and the g/r/s shortcuts drive the same value.
  const mode = useGraphEditorStore((s) => s.canvasGizmoMode);
  const setMode = useGraphEditorStore((s) => s.setCanvasGizmoMode);
  // State-backed ref so the drei gizmo attaches deterministically on the
  // first render (a plain useRef holds null on the initial render and would
  // skip the gizmo mount until some unrelated state change re-rendered).
  const [proxy, setProxy] = useState<THREE.Group | null>(null);
  const priorSceneTransform = useRef<CanvasTransform | null>(null);
  // EBR2-C-03 / §R2-C INV-25 — the anchor group is positioned at the
  // composed sp+ct world, and the proxy sits at identity local so
  // TransformControls computes drag deltas from a stable origin. We capture
  // the drag-start scenePosition on onMouseDown so onObjectChange can write
  // back `new sp = start + proxy delta` without growing cumulative offset.
  const dragStartSP = useRef<CanvasTransform | null>(null);
  const isDraggingRef = useRef(false);

  // SC-025 — the three gizmo modes rendered on selection. Listed inline so
  // they remain greppable in this file for the source-level regression test.
  const ALLOWED_MODES: ReadonlyArray<GizmoMode> = ['translate', 'rotate', 'scale'];
  void ALLOWED_MODES;

  // SC-025 — gizmos render only in canvas mode (FP-12 canonical literal).
  const isCanvasMode = viewMode === 'canvas';
  // EBR2-C-02 / §R2-C SC-068 — gizmo handles render only while the user has
  // explicitly entered edit mode via the Inspector's Edit toggle. Selecting a
  // node alone (editorMode === 'idle') keeps the canvas in pure-view state.
  const isEditMode = editorMode === 'edit';

  const node = useMemo(
    () => nodes.find((n) => n.nodeId === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const nodeId = node?.nodeId ?? null;
  const persistedSP = node?.scenePosition;
  // STEP8 canvas-spec §5 — a locked node is removed from transform authoring.
  const isLocked = node?.locked === true;

  // EBR2-C-03 / §R2-C INV-25 — the parent anchor group already composes
  // scenePosition + canvasTransform into its world position (see return
  // below). The proxy stays at its parent's local origin so TransformControls
  // attaches at the composed sp+ct world. Each store update re-renders the
  // anchor at the new sp and we reset the proxy back to identity so the
  // next drag frame computes deltas from a stable baseline.
  useEffect(() => {
    if (!proxy || !node) return;
    proxy.position.set(0, 0, 0);
    proxy.rotation.set(0, 0, 0);
    proxy.scale.set(1, 1, 1);
  }, [proxy, nodeId, persistedSP, node]);

  // Capture the prior snapshot on selection so Escape can roll back. Reset
  // when the selection clears, the user switches out of canvas mode, or the
  // user leaves edit mode (EBR2-C-02 / SC-068 — the snapshot should not
  // outlive an edit session).
  useEffect(() => {
    if (!isCanvasMode || !isEditMode || !node) {
      priorSceneTransform.current = null;
      return;
    }
    priorSceneTransform.current = readSceneTransform(node);
  }, [nodeId, isCanvasMode, isEditMode, node]);

  // Keyboard mode switch (g/r/s) + Escape cancel-restore (only during a
  // drag, so deliberate edits aren't silently reverted afterwards). Mode
  // keys are skipped when focus is in a text input / textarea / contenteditable
  // so typing into the Inspector doesn't hijack the gizmo. Gated on
  // isEditMode (EBR2-C-02 / SC-068) — idle-mode users shouldn't see g/r/s
  // mode switches or Escape rollback as the gizmo is not mounted.
  useEffect(() => {
    if (!isCanvasMode || !isEditMode || !node) return;
    const captured = node;
    function isEditableTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (t.isContentEditable) return true;
      return false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!isDraggingRef.current) return;
        const prior = priorSceneTransform.current;
        if (prior) {
          const restored = restorePriorCanvasTransform(prior);
          updateNode(captured.nodeId, { scenePosition: restored });
        }
        return;
      }
      if (isEditableTarget(e.target)) return;
      const next = gizmoModeForKey(e.key);
      if (next) setMode(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCanvasMode, isEditMode, nodeId, updateNode, setMode, node]);

  // STEP8 — never mount handles on a locked node (canvas-spec §5 lock/unlock).
  if (!isCanvasMode || !isEditMode || !node || isLocked) return null;

  const sp = readSceneTransform(node);
  const ct = readCanvasTransform(node);

  return (
    <group
      name={`canvas:gizmo-anchor:${node.nodeId}`}
      position={[sp.x + ct.x, sp.y + ct.y, sp.z + ct.z]}
    >
      <group
        ref={(g) => {
          setProxy(g);
        }}
        name={`canvas:gizmo-proxy:${node.nodeId}`}
      />
      {proxy ? (
        <TransformControls
          object={proxy}
          mode={mode}
          onMouseDown={() => {
            isDraggingRef.current = true;
            // EBR2-C-03 — capture scenePosition at drag start so
            // onObjectChange can write back start + delta. Cleared on mouseUp.
            dragStartSP.current = readSceneTransform(node);
          }}
          onMouseUp={() => {
            isDraggingRef.current = false;
            dragStartSP.current = null;
          }}
          onObjectChange={() => {
            // STEP8 canvas-spec SC-9 — proxy local pose is the drag delta from
            // its anchor origin (identity at drag start). The new scenePosition
            // is the captured drag-start sp composed with the proxy delta:
            // translate is additive, rotation is Euler-additive (incremental
            // from identity), scale is multiplicative (proxy.scale = 1 * factor).
            // We write the node's OWN schema field — authoring, the legitimate
            // way a node's position/scale is set (CORRECTED CONCEPT / SC-9).
            const start = dragStartSP.current ?? readSceneTransform(node);
            const next: CanvasTransform = {
              x: start.x + proxy.position.x,
              y: start.y + proxy.position.y,
              z: start.z + proxy.position.z,
              rotationX: start.rotationX + proxy.rotation.x,
              rotationY: start.rotationY + proxy.rotation.y,
              rotationZ: start.rotationZ + proxy.rotation.z,
              scaleX: start.scaleX * proxy.scale.x,
              scaleY: start.scaleY * proxy.scale.y,
              scaleZ: start.scaleZ * proxy.scale.z,
            };
            updateNode(node.nodeId, { scenePosition: next });
          }}
        />
      ) : null}
    </group>
  );
}

// STEP6 faithful-build (scope item 3 / RT-SC-06) — the node→built REALIZATION
// "pop". When a node is built (first realized into the scene, or rebuilt after
// an edit), its artifact pops into being at its schema position. We realize
// this as a scale-pop on an inner group so it is visually distinct from the
// dormant galaxy sphere, WITHOUT ever fully hiding the artifact (min scale
// stays > 0 so a dropped frame can never leave a node invisible).
//
// Build identity = `${nodeId}:${rebuildVersion}` — the SAME key the build
// model uses. The pop plays exactly once per build: re-entering canvas or
// toggling canvas↔preview-app does NOT replay it (that is a mode change, not a
// build — anchor §4 / INV-R6 / FP-R4). A Save-and-Rebuild bumps the version →
// a new key → the pop plays again, exactly as a fresh realization should.
const poppedBuilds = new Set<string>();
const BUILD_POP_START = 0.6;

function AssembledSceneNode({ node, previewMode = false }: { node: PrismNode; previewMode?: boolean }) {
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const hoveredId = useGraphEditorStore((s) => s.hoveredNodeId);
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  const hoverNode = useGraphEditorStore((s) => s.hoverNode);
  const openInspector = useGraphEditorStore((s) => s.openInspector);
  // STEP8 — multi/group selection rings (canvas-spec §14). A node in the
  // multi-selection set gets the group accent ring so a Group reads as a unit.
  const multiSelectedIds = useGraphEditorStore((s) => s.selectedNodeIds);
  const isSelected = selectedId === node.nodeId;
  const isMultiSelected = multiSelectedIds.has(node.nodeId);
  const isHovered = hoveredId === node.nodeId;
  const isLocked = node.locked === true;
  // EBR2-E-02 / §R2-E SC-072 — renderer reads source ⊕ preview overlay so
  // Inspector tab edits show up live before "Save" commits to source. The
  // selector returns the patch for this specific node (or null), so the
  // component re-renders only when this node's preview buffer changes.
  const previewPatch = usePreviewStateStore((s) => s.patches[node.nodeId] ?? null);
  const composedNode = composeNodeWithPreview(node, previewPatch);
  // STEP8 canvas-spec SC-9 — scenePosition is the authored transform the
  // Transform tools write (gizmo + toolbar). Read it with full defaults
  // (legacy nodes carry only x/y/z, or nothing) so rotation/scale compose
  // cleanly below.
  const spRaw = composedNode.scenePosition;
  const sp = {
    x: spRaw?.x ?? 0,
    y: spRaw?.y ?? 0,
    z: spRaw?.z ?? 0,
    rotationX: spRaw?.rotationX ?? 0,
    rotationY: spRaw?.rotationY ?? 0,
    rotationZ: spRaw?.rotationZ ?? 0,
    scaleX: spRaw?.scaleX ?? 1,
    scaleY: spRaw?.scaleY ?? 1,
    scaleZ: spRaw?.scaleZ ?? 1,
  };
  // EBR2-C-03 / §R2-C SC-069/SC-070 + INV-25 — the renderer is the only
  // consumer of scenePosition + canvasTransform for visible node placement.
  // Compose them here so the artifact, selection ring, and the gizmo anchor
  // (CanvasTransformGizmo, rendered as a sibling) all land at the same
  // world pose. The Transform tools write through scenePosition (canvas-spec
  // SC-9); `canvasTransform` remains a composable overlay (identity unless a
  // legacy ct-authored node carries one). Translate adds; rotation adds;
  // scale multiplies — so identity in either field is a no-op.
  const ct = readCanvasTransform(composedNode);
  const w = composedNode.visual?.transform?.width ?? 0.35;
  const h = composedNode.visual?.transform?.height ?? 0.35;
  const ringSize = Math.max(w, h, 0.25) * 0.62;

  // STEP6 scope item 3 — once-per-build realization pop (see poppedBuilds note).
  const rebuildVersion = useGraphEditorStore((s) => s.nodeRebuildVersion[node.nodeId] ?? 0);
  const buildKey = node.nodeId + ':' + rebuildVersion;
  const popRef = useRef<THREE.Group | null>(null);
  const alreadyPopped = poppedBuilds.has(buildKey);
  useEffect(() => {
    const g = popRef.current;
    if (!g) return;
    if (poppedBuilds.has(buildKey)) {
      g.scale.setScalar(1);
      return;
    }
    // Bound the set to ≤ one entry per node: drop this node's stale build
    // keys (prior rebuildVersions) so a long session of Save-and-Rebuilds
    // cannot leak. The ':' delimiter keeps the prefix match exact.
    const prefix = node.nodeId + ':';
    for (const k of poppedBuilds) {
      if (k !== buildKey && k.startsWith(prefix)) poppedBuilds.delete(k);
    }
    poppedBuilds.add(buildKey);
    g.scale.setScalar(BUILD_POP_START);
    const tween = gsap.to(g.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.5,
      ease: 'back.out(1.7)',
      onComplete: () => g.scale.setScalar(1),
    });
    return () => {
      tween.kill();
      // Safety: a built artifact must never be left below full scale.
      g.scale.setScalar(1);
    };
  }, [buildKey]);

  // Shadow-casting: the assembled artifact's meshes must cast + receive soft
  // shadows so the editor canvas matches the runtime / material-lighting-probe
  // look. resolveArtifactObject builds the artifact synchronously, so the Mesh
  // children exist by the time this effect runs; keyed on buildKey so a
  // Save-and-Rebuild (which remounts the artifact) re-applies the flags.
  useEffect(() => {
    const g = popRef.current;
    if (!g) return;
    g.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }, [buildKey]);

  // P1 TEXT (canvas-spec §7, criterion 26) — instant restyle: the source ⊕
  // preview-overlay textSpec lands on the mounted TextObject IN PLACE via
  // userData.textHandle.setSpec (geometry re-lays-out from the cached atlas;
  // same Group identity; NO artifact re-render, NO rebuild). A font/weight
  // change resolves its atlas through the app-wide font registry (criterion
  // 27 cache) before the swap; resolution is cancelled if the spec moves on.
  const mergedTextSpec: TextSpec | null =
    (composedNode.renderMode as string) === 'text'
      ? { ...TEXT_SPEC_DEFAULT, ...(composedNode.textSpec ?? {}) }
      : null;
  const textSpecKey = mergedTextSpec ? JSON.stringify(mergedTextSpec) : '';
  useEffect(() => {
    if (!mergedTextSpec) return;
    const g = popRef.current;
    if (!g) return;
    let handle: TextObjectHandle | null = null;
    g.traverse((obj) => {
      const h = (obj.userData as { textHandle?: TextObjectHandle } | undefined)?.textHandle;
      if (!handle && h) handle = h;
    });
    if (!handle) return; // cold-atlas deferred mount: factory builds with the committed spec
    const found: TextObjectHandle = handle;
    const family = mergedTextSpec.fontFamily ?? 'Inter';
    const weight = mergedTextSpec.fontWeight ?? 400;
    const cur = found.spec;
    const fontChanged =
      (cur.fontFamily ?? 'Inter') !== family || (cur.fontWeight ?? 400) !== weight;
    if (!fontChanged) {
      found.setSpec(mergedTextSpec);
      return;
    }
    const reg = getFontRegistry();
    const cached = reg.peekAtlas(family, weight);
    if (cached) {
      found.setSpec(mergedTextSpec, cached);
      return;
    }
    let cancelled = false;
    void reg
      .resolveAtlas(family, weight)
      .then((atlas) => {
        if (!cancelled) found.setSpec(mergedTextSpec, atlas);
      })
      .catch(() => { /* offline / bake failure — keep the current glyphs */ });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized spec
  }, [textSpecKey, buildKey]);

  // P3 IMAGE (canvas-spec §5 Image tools) — instant restyle: the source ⊕
  // preview-overlay imageSpec lands on the mounted image plane IN PLACE via
  // userData.imageHandle.setSpec (per-node texture-clone fit/crop window +
  // uniform-driven TSL corner mask + material-opacity multiply; same Mesh
  // identity, NO artifact re-render, NO rebuild). Mirrors the textSpec effect
  // above; the apply is synchronous, so no cancellation is needed. Only nodes
  // that actually carry an imageSpec (committed or previewed) take this path —
  // legacy image planes keep their untouched shared cache texture.
  const imageRenderMode = composedNode.renderMode ?? 'sprite';
  const isImageBearing =
    imageRenderMode === 'sprite' ||
    imageRenderMode === 'plane' ||
    imageRenderMode === 'parallax-plane';
  const mergedImageSpec: ImageSpec | null =
    isImageBearing && composedNode.imageSpec
      ? { ...IMAGE_SPEC_DEFAULT, ...composedNode.imageSpec }
      : null;
  const imageSpecKey = mergedImageSpec ? JSON.stringify(mergedImageSpec) : '';
  useEffect(() => {
    if (!mergedImageSpec) return;
    const g = popRef.current;
    if (!g) return;
    let handle: { setSpec(next: ImageSpec): void } | null = null;
    g.traverse((obj) => {
      const h = (obj.userData as { imageHandle?: { setSpec(next: ImageSpec): void } } | undefined)
        ?.imageHandle;
      if (!handle && h) handle = h;
    });
    if (!handle) return; // non-factory artifact (codeRef/mesh) — nothing to restyle
    (handle as { setSpec(next: ImageSpec): void }).setSpec(mergedImageSpec);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized spec
  }, [imageSpecKey, buildKey]);

  // P4 3D-OBJECT (canvas-spec §5 3D object tools) — instant reshaping +
  // material: the source ⊕ preview-overlay meshPrimitive / materialSpec land
  // on the mounted primitive Mesh IN PLACE via userData.meshPrimitiveHandle
  // (setPrimitive swaps ONLY the geometry — same Mesh + material identity;
  // setMaterialSpec writes the SAME physical material instance, uniform-only
  // except documented recompile edges). Mirrors the imageSpec effect above —
  // the apply is synchronous, no cancellation needed. The Inspector Material
  // tab already writes materialSpec through usePreviewStateStore, so its
  // fader/knob edits land here live before "Save" commits to source. The
  // handle no-ops repeat setPrimitive writes of an unchanged shape, so this
  // effect never churns geometry on material-only edits.
  const meshPrimState =
    (composedNode.renderMode ?? 'sprite') === 'mesh' && composedNode.meshPrimitive
      ? {
          meshPrimitive: composedNode.meshPrimitive,
          materialSpec: composedNode.materialSpec ?? null,
        }
      : null;
  const meshPrimKey = meshPrimState ? JSON.stringify(meshPrimState) : '';
  useEffect(() => {
    if (!meshPrimState) return;
    const g = popRef.current;
    if (!g) return;
    let handle: MeshPrimitiveHandle | null = null;
    g.traverse((obj) => {
      const h = (obj.userData as { meshPrimitiveHandle?: MeshPrimitiveHandle } | undefined)
        ?.meshPrimitiveHandle;
      if (!handle && h) handle = h;
    });
    if (!handle) return; // non-factory artifact (codeRef/GLB) — nothing to reshape
    const found: MeshPrimitiveHandle = handle;
    found.setPrimitive(meshPrimState.meshPrimitive);
    found.setMaterialSpec(meshPrimState.materialSpec);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized spec
  }, [meshPrimKey, buildKey]);

  // P2 ANIMATION BINDINGS (canvas-spec §8.2/§8.3) — preview-app PLAYS the
  // node's catalog-primitive bindings through the existing Driver model;
  // canvas mode stays an editing surface (spec §16), so bindings attach ONLY
  // when previewMode === true. Keyed on the serialized bindings (source ⊕
  // preview overlay), the build identity, and the mode: any change detaches
  // (timelines killed, Animatables disposed, driver wiring unsubscribed, the
  // subject subtree restored to its authored pose) and re-attaches fresh.
  // Changing `driver` never mutates keyframes (INV-6) — the player builds the
  // identical timeline for every driver and only the playback wiring differs.
  const bindingsKey =
    previewMode && (composedNode.animationBindings?.length ?? 0) > 0
      ? JSON.stringify(composedNode.animationBindings)
      : '';
  useEffect(() => {
    if (!bindingsKey) return;
    const g = popRef.current;
    if (!g) return;
    const detach = attachAnimationBindings({
      node: composedNode,
      root: g,
      drivers: makeNodeDrivers(getSharedDriverHub()),
    });
    return () => {
      detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized bindings
  }, [bindingsKey, buildKey, previewMode]);

  // P2 §6 — an unbuilt (stage-0 bubble) node is an EDITING affordance, not a
  // UI element: it renders in canvas mode only. In preview-app (the played
  // app) unbuilt nodes do not exist ("not rendered in Canvas/Preview until
  // Built" — the bubble is the canvas-side stage representation). Placed
  // after all hooks so the hook order is stable across mode toggles.
  if (previewMode && isStage0Bubble(node)) return null;

  return (
    <group
      ref={(g) => {
        // EBR2-C-04 / §R2-C SC-069 — register the composed-pose wrapper group
        // in a window-side map so verify-editor-runtimes can read its world
        // position before/after a synthetic canvasTransform write and prove
        // the renderer is the only consumer of sp+ct (INV-25): a ct write
        // through useGraphSourceStore.updateNode shifts the rendered
        // artifact by exactly the ct delta, end-to-end. Editor-shell scope
        // (FP-05 scopes window.* forbid to runtime + prism-player); the
        // map is purely diagnostic and runtime-inert.
        if (typeof window === 'undefined') return;
        const w = window as unknown as {
          __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D>;
        };
        const map = (w.__PRISM_EDITOR_NODE_GROUPS__ ??= new Map());
        if (g) map.set(node.nodeId, g);
        else map.delete(node.nodeId);
      }}
      position={[sp.x + ct.x, sp.y + ct.y, sp.z + ct.z]}
      rotation={[
        sp.rotationX + ct.rotationX,
        sp.rotationY + ct.rotationY,
        sp.rotationZ + ct.rotationZ,
      ]}
      scale={[sp.scaleX * ct.scaleX, sp.scaleY * ct.scaleY, sp.scaleZ * ct.scaleZ]}
      onClick={(e) => {
        e.stopPropagation();
        // STEP7 — EventDriver input: a click on the built artifact fires a
        // node-addressed 'click' event so any click-triggered animation the
        // node declares plays. This drives ANIMATION only; the existing
        // selection / inspector behavior is unchanged (that is the node
        // editor's job, not the driver's).
        getSharedDriverHub().events.fire('click', { nodeId: node.nodeId });
        selectNode(node.nodeId);
        openInspector();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        // STEP7 — StateDriver input: hover-in sets the node's `hover` state so
        // a hover-triggered animation plays forward (un-hover reverses it).
        getSharedDriverHub().state.set(`hover:${node.nodeId}`, true);
        hoverNode(node.nodeId);
      }}
      onPointerOut={() => {
        getSharedDriverHub().state.set(`hover:${node.nodeId}`, false);
        hoverNode(null);
      }}
    >
      <group ref={popRef} scale={alreadyPopped ? 1 : BUILD_POP_START}>
        <ArtifactNode node={node} layout="scene" />
      </group>
      {!previewMode && (isSelected || isMultiSelected || isHovered) && (
        <mesh position={[0, 0, 0.08]}>
          <ringGeometry args={[ringSize, ringSize + 0.035, 64]} />
          <meshBasicMaterial
            color={
              isSelected ? DS.brass200 : isMultiSelected ? DS.brass400 : DS.ok
            }
            transparent
            opacity={0.85}
            toneMapped={false}
          />
        </mesh>
      )}
      {/* STEP8 — a thin amber ring marks a locked node (canvas-spec §5). */}
      {!previewMode && isLocked && (
        <mesh position={[0, 0, 0.07]}>
          <ringGeometry args={[ringSize + 0.04, ringSize + 0.06, 64]} />
          <meshBasicMaterial color={DS.warn} transparent opacity={0.7} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function AssembledSceneDiagnostics({ nodes }: { nodes: PrismNode[] }) {
  useFrame(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return;
    (window as any).__prismEditorDebug = {
      mode: 'scene',
      visibleHomeNodeCount: nodes.filter((node) => node.parentHubId === 'home').length,
      visibleHomeNodeIds: nodes.filter((node) => node.parentHubId === 'home').map((node) => node.nodeId),
      totalHomeNodeCount: nodes.filter((node) => node.parentHubId === 'home').length,
    };
  });
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Scene content
// ═══════════════════════════════════════════════════════════════════
function TopologySceneContent({
  onPerf,
}: {
  onPerf: (factor: number) => void;
}) {
  const pinnedPositions = useGraphEditorStore((s) => s.pinnedPositions);
  const resetSignal = useGraphEditorStore((s) => s.resetCameraSignal);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const qualityMode = useGraphEditorStore((s) => s.qualityMode);
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  // EB-03-05 / SC-016: galaxy filter query drives non-match dimming.
  const filterQuery = useGraphEditorStore((s) => s.filterQuery);
  // EB-04-01 / SC-018+019 — drill-in reveal animation. The hook reads
  // hubRevealAt and hubRevealDurationMs from the store; activeHubId scopes the
  // reveal to the just-drilled-into hub.
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const hubRevealAt = useGraphEditorStore((s) => s.hubRevealAt);
  const revealProgress = useHubRevealProgress();
  // The reveal only animates when entering canvas (the intra-hub authoring
  // mode after RA-06b) from a drill-in; in galaxy / preview-app modes we
  // hold full opacity so other modes never visually depend on the reveal
  // timer.
  const revealOpacityForActiveHub =
    viewMode === 'canvas' && hubRevealAt != null
      ? revealProgress
      : 1;

  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const editorGraph = useMemo<EditorGraph>(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );

  const { simNodes, simLinks, hubCenters, hubDiameters } = useForceGraph(
    editorGraph.nodes,
    editorGraph.edges,
    editorGraph.hubs,
    pinnedPositions,
    resetSignal,
    viewMode
  );

  // Galaxy-only filter match set (EB-03-05 / SC-016). Dim treatment applies
  // only when viewMode === 'galaxy'; hub-world / canvas / preview-* never
  // inherit the effect, so we short-circuit to the inactive sentinel in
  // every other mode.
  const filterMatches = useMemo<GalaxyFilterMatches>(() => {
    return viewMode === 'galaxy'
      ? computeGalaxyFilterMatches(filterQuery, editorGraph.hubs, editorGraph.nodes)
      : { active: false, matchedHubIds: new Set<string>(), matchedNodeIds: new Set<string>() };
  }, [viewMode, filterQuery, editorGraph.hubs, editorGraph.nodes]);

  // Heroes: the selected node + at most 1 other get the expensive transmission material
  const heroIds = useMemo(() => {
    const set = new Set<string>();
    if (selectedId) set.add(selectedId);
    return set;
  }, [selectedId]);

  // INV-R14 — postprocessing (legacy @react-three/postprocessing EffectComposer)
  // is WebGL-only and cannot run under WebGPU. Capability-tier it: on the WebGL2
  // fallback it runs; on WebGPU it is skipped (TSL PostProcessing is the
  // canvas-spec/Step-5 follow-up).
  const isWebGPU = useIsWebGPU();
  const usePost = qualityMode !== 'low' && !isWebGPU;

  return (
    <>
      {/* drei <Stars> uses a raw GLSL THREE.ShaderMaterial which WebGPU's
          NodeBuilder rejects ("Material ShaderMaterial is not compatible").
          Capability-tier it: render on the WebGL2 fallback only. The nebula
          backdrop + WorldSun still carry galaxy depth under WebGPU. (A
          node-material starfield is a later polish item.) */}
      {!isWebGPU && (
        <Stars radius={800} depth={500} count={5000} factor={4} saturation={0.5} fade speed={0.3} />
      )}

      {/* Lighting — photoreal with environment IBL + fills */}
      <ambientLight intensity={0.06} />
      <directionalLight position={[120, 120, 100]} intensity={0.5} color={DS.ice200} castShadow={false} />
      <directionalLight position={[-100, -60, -100]} intensity={0.25} color={DS.brass100} />
      <Environment preset="night" environmentIntensity={0.55} />

      {/* App_Name_World central sun — only mounts in galaxy mode (SC-012).
          EB-03-01 will orbit the existing hub hulls around this sun; for now
          the hulls keep their current positions and the sun is added on top
          as a click target. */}
      {viewMode === 'galaxy' && <WorldSun />}
      {viewMode === 'galaxy' && (
        <GalaxyHubTethers
          nodes={editorGraph.nodes}
          edges={editorGraph.edges}
          hubCenters={hubCenters}
        />
      )}
      {/* GalaxyCloneDragLayer (EBR2-F-04 / §R2-F SC-077) is mounted by
          SceneContent so the pointermove listener attaches in galaxy mode
          regardless of editorRenderMode. */}

      <HubHulls
        hubs={editorGraph.hubs}
        hubCenters={hubCenters}
        simNodes={simNodes}
        hubDiameters={hubDiameters}
        viewMode={viewMode}
        filterMatches={filterMatches}
        revealOpacity={revealOpacityForActiveHub}
      />

      {simLinks.map((link) => {
        // EB-04-01 / SC-019 — intra-hub tethers in the active hub fade in
        // with the drill-in reveal. We approximate "intra-hub" by checking
        // both endpoint hub membership; inter-hub edges keep opacity 1.
        const s = link.source as SimNode;
        const t = link.target as SimNode;
        const isIntraActive =
          activeHubId != null &&
          typeof s !== 'string' &&
          typeof t !== 'string' &&
          !!s?.hubIds?.includes(activeHubId) &&
          !!t?.hubIds?.includes(activeHubId);
        const edgeReveal = isIntraActive ? revealOpacityForActiveHub : 1;
        return <Edge key={link.id} link={link} revealOpacity={edgeReveal} />;
      })}
      {simLinks.slice(0, 20).map((link) => (
        <EdgeParticle key={'p-' + link.id} link={link} />
      ))}

      {simNodes.map((node) => {
        const sourceNode = sourceNodes.find((sn) => sn.nodeId === node.id);
        // EB-03-05 / SC-016: dim non-matching nodes in galaxy mode. The
        // `filterMatches` memo is already gated on viewMode === 'galaxy'
        // (returns inactive for other modes), so `dim` only ever flips
        // true while the user is in galaxy.
        const dim =
          filterMatches.active && !filterMatches.matchedNodeIds.has(node.id);
        // EB-04-01 / SC-019 — active-hub nodes fade in with the drill-in
        // reveal; all other nodes keep full opacity.
        const nodeRevealOpacity =
          activeHubId != null && node.hubIds.includes(activeHubId)
            ? revealOpacityForActiveHub
            : 1;
        return (
          <GlassNode
            key={node.id}
            node={node}
            hero={heroIds.has(node.id)}
            hubs={editorGraph.hubs}
            sourceNode={sourceNode}
            dim={dim}
            revealOpacity={nodeRevealOpacity}
          />
        );
      })}

      <NodeLabels simNodes={simNodes} />
      <HubLabels hubs={editorGraph.hubs} hubCenters={hubCenters} />
      <EditorDiagnostics simNodes={simNodes} />
      <ControlsBridge simNodes={simNodes} hubCenters={hubCenters} />

      {usePost && (
        <EffectComposer multisampling={0} stencilBuffer={false}>
          <Bloom intensity={0.85} luminanceThreshold={0.4} luminanceSmoothing={0.9} mipmapBlur />
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={[0.0008, 0.0008] as any}
            radialModulation={false}
            modulationOffset={0}
          />
          <Vignette eskil={false} offset={0.15} darkness={0.72} />
          <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.035} />
          <SMAA />
        </EffectComposer>
      )}

      <AdaptiveDpr pixelated={false} />
      <PerformanceMonitor
        onIncline={() => onPerf(2)}
        onDecline={() => onPerf(1)}
        bounds={(refreshrate) => (refreshrate > 90 ? [60, 90] : [45, 60])}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SceneDriverHost — STEP7. The runtime side of the Canvas-spec Driver model
// (§8.2 / §16) for the built scene. Mounts inside AssembledSceneContent
// (canvas + preview-app) so live drivers respond to REAL input there.
//
//   1. Per-frame tick → drives every primitive's `onTick` (e.g. magnetic-
//      cursor's pointer lerp) via the shared DriverHub frame ticker.
//   2. PointerDriver input — pointermove on the WebGL canvas → pointer NDC.
//   3. ScrollDriver input — wheel on the WebGL canvas → scroll progress 0..1.
//   4. Debug handle `window.__prismDrivers` — deterministic verification +
//      a surface to fire State/Event drivers (programmatic "custom" triggers).
//
// THE RULE: this host only supplies INPUT and ticks the clock. It never
// positions a node or authors motion — primitives realize the node's own
// declared animation; drivers play it. Editor-shell scope (not runtime/), so
// canvas listeners + a `window` debug handle are permitted here.
// ═══════════════════════════════════════════════════════════════════
const SCROLL_WHEEL_RANGE = 1400; // px of wheel travel = a full 0→1 scroll sweep.

function SceneDriverHost() {
  const { gl } = useThree();
  const scrollProgressRef = useRef(0);

  // 1. Per-frame tick — drive onTick for every primitive that needs it. R3F's
  // delta is in seconds; the frame driver normalizes to ms for onTick.
  useFrame((_, delta) => {
    getSharedDriverHub().frame.tick(delta * 1000);
  });

  // 2 + 3. Real pointer + scroll input from the WebGL canvas.
  useEffect(() => {
    const el = gl.domElement;
    if (!el) return;
    const hub = getSharedDriverHub();

    const handlePointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      hub.pointer.set({ x, y }, true);
    };
    const handlePointerLeave = () => {
      hub.pointer.set(hub.pointer.ndc, false);
    };
    const handleWheel = (e: WheelEvent) => {
      const next = scrollProgressRef.current + e.deltaY / SCROLL_WHEEL_RANGE;
      const clamped = next < 0 ? 0 : next > 1 ? 1 : next;
      scrollProgressRef.current = clamped;
      hub.scroll.set(clamped);
    };

    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerleave', handlePointerLeave);
    // Passive: we only READ deltaY to advance scroll-driven animation; we never
    // preventDefault, so the camera's own wheel handling stays intact.
    el.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerleave', handlePointerLeave);
      el.removeEventListener('wheel', handleWheel);
    };
  }, [gl]);

  // 4. Debug / verification handle. Lets the verifier drive scroll/pointer
  // deterministically and fire State/Event drivers as "custom" triggers.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hub = getSharedDriverHub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__prismDrivers = {
      hub,
      setScroll: (p: number) => hub.scroll.set(p),
      setPointer: (x: number, y: number) => hub.pointer.set({ x, y }, true),
      // StateDriver: e.g. setState('home-feature-card','hover',true) sets the
      // `hover:home-feature-card` state the dispatch listens on.
      setState: (nodeId: string, name: string, value: boolean | number | string) =>
        hub.state.set(`${name}:${nodeId}`, value),
      // EventDriver: fire('click','home-parallax-stack') replays a click-
      // triggered animation on that node.
      fireEvent: (eventName: string, nodeId: string) =>
        hub.events.fire(eventName, { nodeId }),
      frameSize: () => hub.frame.size(),
      nodeResultCount: (nodeId: string) => hub.getNodeResults(nodeId).length,
      // Verification probe: gsap timeline playback state per attached primitive.
      // Lets the verifier prove an inview/load/event-triggered animation
      // actually PLAYED (progress advanced past 0) vs. sat paused.
      timelineState: (nodeId: string) =>
        hub.getNodeResults(nodeId).map((r) => {
          const tl = r.timeline as unknown as {
            duration?: () => number;
            progress?: () => number;
            totalTime?: () => number;
            paused?: () => boolean;
          };
          return {
            duration: typeof tl.duration === 'function' ? tl.duration() : 0,
            progress: typeof tl.progress === 'function' ? tl.progress() : null,
            totalTime: typeof tl.totalTime === 'function' ? tl.totalTime() : null,
            paused: typeof tl.paused === 'function' ? tl.paused() : null,
          };
        }),
      // Verification probe: the LOCAL position/scale of a node's built artifact
      // object — the thing the scroll/pointer drivers actually move. Reads the
      // factory Object3D (userData.nodeId === nodeId) nested under the
      // AssembledSceneNode wrapper registered in __PRISM_EDITOR_NODE_GROUPS__.
      // Returns null when the node is not currently built.
      localPos: (nodeId: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = (window as any).__PRISM_EDITOR_NODE_GROUPS__ as
          | Map<string, THREE.Object3D>
          | undefined;
        const wrapper = map?.get(nodeId);
        if (!wrapper) return null;
        let target: THREE.Object3D | null = null;
        wrapper.traverse((o) => {
          if (
            o !== wrapper &&
            (o.userData as { nodeId?: string }).nodeId === nodeId &&
            !target
          ) {
            target = o;
          }
        });
        const obj = (target ?? wrapper) as THREE.Object3D;
        return {
          position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
          scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
        };
      },
    };
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__prismDrivers;
    };
  }, []);

  return null;
}

// STEP8 canvas-spec §5 Selection / §14 — marquee hit-test bridge. The DOM
// marquee overlay (CanvasToolbar) draws the rubber-band in canvas-client px;
// it cannot raycast the WebGPU scene, so this in-scene component (which has the
// camera + canvas size) exposes a pure hit-test: given a client-px rect, return
// the ids of every built node whose projected centre falls inside it. Selection
// state is then set by the overlay through store actions (FP-11 safe).
// Editor-shell scope (FP-05 window.* restriction is runtime/prism-player only).
function MarqueeSelectBridge() {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D>;
      __PRISM_EDITOR_MARQUEE_HIT__?: (rect: { x: number; y: number; w: number; h: number }) => string[];
    };
    const v = new THREE.Vector3();
    w.__PRISM_EDITOR_MARQUEE_HIT__ = (rect) => {
      const groups = w.__PRISM_EDITOR_NODE_GROUPS__;
      if (!groups) return [];
      const el = gl.domElement;
      const cw = el.clientWidth || 1;
      const ch = el.clientHeight || 1;
      const x0 = Math.min(rect.x, rect.x + rect.w);
      const x1 = Math.max(rect.x, rect.x + rect.w);
      const y0 = Math.min(rect.y, rect.y + rect.h);
      const y1 = Math.max(rect.y, rect.y + rect.h);
      const hits: string[] = [];
      groups.forEach((group, nodeId) => {
        group.updateWorldMatrix(true, false);
        group.getWorldPosition(v);
        v.project(camera);
        if (v.z > 1) return; // behind the camera / beyond the far plane
        const sx = (v.x * 0.5 + 0.5) * cw;
        const sy = (-v.y * 0.5 + 0.5) * ch;
        if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) hits.push(nodeId);
      });
      return hits;
    };
    return () => {
      delete w.__PRISM_EDITOR_MARQUEE_HIT__;
    };
  }, [camera, gl]);
  return null;
}

// A large, dim shadow-receiver plane sitting just behind the assembled content
// so a soft cast shadow is actually visible in the editor canvas (matching the
// runtime / material-lighting-probe). It uses a dark MeshStandardMaterial so it
// stays low-key and does not change the assembled look — it sits in front of
// SceneBackdrop (z=-2) but behind the artifacts (≈z=0), faces the camera, and
// only receives shadows. Mounted ONLY in the assembled (canvas/preview-app)
// content path.
function AssembledShadowCatcher() {
  return (
    <mesh position={[0, 0, -1.4]} receiveShadow name="assembled:shadow-catcher">
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial
        color={DS.ink}
        roughness={1}
        metalness={0}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}

function AssembledSceneContent({
  onPerf,
  previewMode = false,
}: {
  onPerf: (factor: number) => void;
  // RT-SC-10 / INV-R4 — preview-app renders the SAME built artifacts as canvas
  // but with authoring chrome (viewport frame, transform gizmo, keyframe demo,
  // selection rings) hidden and live drivers running. The artifact objects are
  // identical across the toggle (no remount, no rebuild).
  previewMode?: boolean;
}) {
  const [fontReady, setFontReady] = useState(false);
  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const qualityMode = useGraphEditorStore((s) => s.qualityMode);
  // EBR2-E-04 / §R2-E SC-074 — read the per-node rebuild-version map. The
  // AssembledSceneNode children are keyed by `nodeId + ':' + version` so a
  // Save-and-Rebuild bump remounts *exactly one* wrapper group, producing
  // the wrapper-ref change the interaction script asserts (target ref
  // changes; siblings stay stable per RA-16).
  const nodeRebuildVersion = useGraphEditorStore((s) => s.nodeRebuildVersion);
  const hub = sourceHubs.find((h) => h.hubId === activeHubId) ?? sourceHubs[0];
  const nodes = sourceNodes.filter((node) => !hub || node.parentHubId === hub.hubId);
  // INV-R14 — postprocessing (legacy @react-three/postprocessing EffectComposer)
  // is WebGL-only and cannot run under WebGPU. Capability-tier it: on the WebGL2
  // fallback it runs; on WebGPU it is skipped (TSL PostProcessing is the
  // canvas-spec/Step-5 follow-up).
  const isWebGPU = useIsWebGPU();
  const usePost = qualityMode !== 'low' && !isWebGPU;

  useEffect(() => {
    let cancelled = false;
    const ctx = getSharedNodeContext({ runPrimitives: false });
    ctx.fontAtlas
      .load('/prism-assets/font-inter.msdf.png', '/prism-assets/font-inter.msdf.json')
      .catch((err) => {
        console.warn('[GraphScene] MSDF font atlas warmup failed:', (err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setFontReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // EBR2-C-04 / §R2-C SC-069 — install the world-pos lookup on mount (once),
  // not inside useFrame, so verify-editor-runtimes can find it as soon as
  // AssembledSceneContent has mounted under canvas viewMode (the useFrame
  // path inside AssembledSceneDiagnostics can lag by several frames during
  // WebGPU init on a cold fetch). Reads the per-node map populated by the
  // AssembledSceneNode ref callback. Editor-shell scope; mirrors the
  // __PRISM_EDITOR_SET_VIEW_MODE__ hook installed unconditionally in
  // src/app/page.tsx for the same verifier.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D>;
      __PRISM_EDITOR_GET_NODE_WORLD_POS__?: (nodeId: string) => { x: number; y: number; z: number } | null;
    };
    const vec = new THREE.Vector3();
    w.__PRISM_EDITOR_GET_NODE_WORLD_POS__ = (nodeId: string) => {
      const group = w.__PRISM_EDITOR_NODE_GROUPS__?.get(nodeId);
      if (!group) return null;
      group.updateWorldMatrix(true, false);
      group.getWorldPosition(vec);
      return { x: vec.x, y: vec.y, z: vec.z };
    };
    return () => {
      delete w.__PRISM_EDITOR_GET_NODE_WORLD_POS__;
    };
  }, []);

  return (
    <>
      {/* §10 — lights + IBL driven by the active hub's lightingSpec. A hub with
          no spec renders the exact legacy 3-light look (HubLighting default), so
          the Canvas Lighting toolbar group visibly changes the scene (criterion
          17) while legacy graphs stay pixel-stable. */}
      <HubLighting hub={hub} />
      <SceneBackdrop hub={hub} />
      <AssembledShadowCatcher />
      {/* RT-SC-10 / INV-R4 — authoring chrome only in canvas; preview-app is
          the running app (no frame, no gizmo, no demo). */}
      {!previewMode && (
        <>
          <CanvasViewportFrame breakpoint={hub?.responsiveBreakpoints?.desktop ?? null} />
          <CanvasTransformGizmo nodes={nodes} />
          <MarqueeSelectBridge />
          <KeyframeDemo />
        </>
      )}

      {fontReady ? (
        nodes.map((node) => (
          <AssembledSceneNode
            key={node.nodeId + ':' + (nodeRebuildVersion[node.nodeId] ?? 0)}
            node={node}
            previewMode={previewMode}
          />
        ))
      ) : (
        <Html center>
          <div className="px-3 py-2 rounded-md border border-white/10 bg-black/60 text-[10px] font-mono text-white/65">
            Warming renderer fonts
          </div>
        </Html>
      )}

      <AssembledSceneDiagnostics nodes={nodes} />
      {/* STEP7 — live driver inputs (pointer/scroll) + per-frame onTick for the
          built scene. Runs in canvas + preview-app; in preview-app the drivers
          respond to the user's real input (§16). */}
      <SceneDriverHost />
      <SceneControlsBridge nodes={nodes} hub={hub ?? null} />

      {usePost && (
        <EffectComposer multisampling={0} stencilBuffer={false}>
          <Bloom intensity={0.35} luminanceThreshold={0.55} luminanceSmoothing={0.9} mipmapBlur />
          <SMAA />
        </EffectComposer>
      )}

      <AdaptiveDpr pixelated={false} />
      <PerformanceMonitor
        onIncline={() => onPerf(2)}
        onDecline={() => onPerf(1)}
        bounds={(refreshrate) => (refreshrate > 90 ? [60, 90] : [45, 60])}
      />
    </>
  );
}

/** RT-SC-03/04/10 + INV-R3 — content is a function of `viewMode` (the three
 *  modes are states of this one scene), with `editorRenderMode` retained as a
 *  canvas-only sub-toggle (scene = assembled artifacts, topology = force-graph):
 *    - galaxy        → TopologySceneContent  (dormant spheres; RT-SC-04)
 *    - canvas        → editorRenderMode 'scene' = AssembledSceneContent (built
 *                      + handles), 'topology' = TopologySceneContent
 *    - preview-app   → AssembledSceneContent (built, handles hidden, drivers
 *                      running) — the SAME cached artifacts as canvas (RT-SC-10)
 *  Built-state is served from ArtifactNode's content cache, so toggling
 *  canvas↔preview-app issues no rebuild (RT-SC-08). */
export function showsAssembledFor(
  viewMode: ViewMode,
  editorRenderMode: EditorRenderMode,
): boolean {
  if (viewMode === 'preview-app') return true;
  if (viewMode === 'canvas') return editorRenderMode === 'scene';
  return false; // galaxy → spheres
}

function SceneContent({
  onPerf,
}: {
  onPerf: (factor: number) => void;
}) {
  const editorRenderMode = useGraphEditorStore((s) => s.editorRenderMode);
  // EBR2-F-04 / §R2-F SC-077 — the Clone-drag listener must mount whenever
  // viewMode === 'galaxy' and a clone is attached to the cursor, regardless
  // of whether the user is on the scene or topology render path. We host the
  // overlay at the SceneContent layer (sibling to the two sub-trees) so it
  // is reachable in both editorRenderMode branches.
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const draggingNodeId = useGraphEditorStore((s) => s.draggingNodeId);
  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const cloneDragActive = viewMode === 'galaxy' && draggingNodeId != null;
  const showsAssembled = showsAssembledFor(viewMode, editorRenderMode);
  // preview-app hides authoring handles/gizmos/frames so the built scene reads
  // as the running app (INV-R4). canvas keeps them.
  const previewMode = viewMode === 'preview-app';
  return (
    <>
      {showsAssembled
        ? <AssembledSceneContent onPerf={onPerf} previewMode={previewMode} />
        : <TopologySceneContent onPerf={onPerf} />}
      {cloneDragActive && <GalaxyCloneDragLayer hubs={sourceHubs} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Canvas wrapper
// ═══════════════════════════════════════════════════════════════════

/** RT-SC-01 / INV-R1 — the one unified scene renders via `WebGPURenderer`
 *  (three/webgpu), which since three r171 AUTOMATICALLY falls back to WebGL2
 *  when `navigator.gpu` is absent (no separate code path). R3F v9 supports an
 *  async `gl` factory that returns a Promise; it awaits `init()` before the
 *  first frame, avoiding the "render() before backend initialized" warning.
 *  The single bundled `three`/`three/webgpu` (RT-SC-02) backs this — no CDN. */
async function createUnifiedRenderer(props: { canvas?: HTMLCanvasElement } & Record<string, unknown>) {
  const renderer = new WebGPURenderer({
    canvas: props?.canvas as HTMLCanvasElement | undefined,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  (renderer as unknown as { toneMapping: THREE.ToneMapping }).toneMapping =
    THREE.ACESFilmicToneMapping;
  await renderer.init();
  // Enable soft shadow mapping so the editor's assembled-scene meshes cast +
  // receive shadows, matching the runtime / material-lighting-probe look. The
  // WebGPURenderer exposes the same shadowMap interface as WebGLRenderer.
  (renderer as unknown as {
    shadowMap: { enabled: boolean; type: THREE.ShadowMapType };
  }).shadowMap.enabled = true;
  (renderer as unknown as {
    shadowMap: { enabled: boolean; type: THREE.ShadowMapType };
  }).shadowMap.type = THREE.PCFSoftShadowMap;
  // Editor-shell backend probe (RT-SC-01 verification). GraphScene is not a
  // runtime/prism-player module, so window.* is permitted (FP-R11 scope).
  if (typeof window !== 'undefined') {
    const backend = (renderer as unknown as {
      backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean };
    }).backend;
    (window as unknown as { __PRISM_RENDERER_BACKEND__?: string }).__PRISM_RENDERER_BACKEND__ =
      backend?.isWebGPUBackend ? 'webgpu' : backend?.isWebGLBackend ? 'webgl2' : 'unknown';
  }
  return renderer as unknown as THREE.WebGLRenderer;
}

/** True when the live R3F renderer is a WebGPU backend. The legacy
 *  @react-three/postprocessing EffectComposer targets WebGLRenderer only and
 *  cannot run under WebGPU, so postprocessing is capability-tiered (INV-R14):
 *  it runs on the WebGL2 fallback and is skipped on WebGPU. (TSL-based
 *  PostProcessing is the canvas-spec/Step-5 follow-up.) */
function useIsWebGPU(): boolean {
  const gl = useThree((s) => s.gl) as unknown as {
    isWebGPURenderer?: boolean;
    backend?: { isWebGPUBackend?: boolean };
  };
  return !!(gl?.isWebGPURenderer || gl?.backend?.isWebGPUBackend);
}

export default function GraphScene() {
  const [dpr, setDpr] = useState<[number, number]>([1, 2]);
  const editorRenderMode = useGraphEditorStore((s) => s.editorRenderMode);
  // EBR2-F-04 / §R2-F SC-077 — DOM-side marker the interaction script
  // queries via `[data-component="galaxy-drag-tether"]` to confirm the
  // Clone-drag overlay is mounted. The visible tether is the 3D line
  // emitted by GalaxyCloneDragLayer inside the Canvas; this hidden div
  // exists purely as a presence sentinel for test discoverability.
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const draggingNodeId = useGraphEditorStore((s) => s.draggingNodeId);
  const cloneDragActive = viewMode === 'galaxy' && draggingNodeId != null;
  // RT-SC-10 — key the Canvas by CONTENT TYPE, not viewMode, so that
  // canvas↔preview-app (both 'assembled') do NOT remount: the same React tree
  // and the same cached THREE.Object3D artifacts are reused across the toggle
  // (object identity preserved; no rebuild). galaxy / canvas-topology share the
  // 'topology' content key + the far camera.
  const showsAssembled = showsAssembledFor(viewMode, editorRenderMode);
  const contentKey = showsAssembled ? 'assembled' : 'topology';
  const camera = showsAssembled
    ? { position: [0, 0, 10] as [number, number, number], fov: 45, near: 0.1, far: 2000 }
    : { position: [0, 0, 320] as [number, number, number], fov: 50, near: 0.1, far: 2000 };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {cloneDragActive && (
        <div
          data-component="galaxy-drag-tether"
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Ambient nebula backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            `radial-gradient(ellipse 70% 60% at 20% 20%, ${dsAlpha(DS.brass500, 0.12)} 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 80% 80%, ${dsAlpha(DS.ice500, 0.1)} 0%, transparent 55%), ${DS.void}`,
        }}
      />
      <Canvas
        key={contentKey}
        dpr={dpr}
        gl={createUnifiedRenderer}
        camera={camera}
        shadows="soft"
      >
        <fog attach="fog" args={[DS.void, 300, 900]} />
        <Suspense fallback={null}>
          <SceneContent onPerf={(factor) => setDpr([1, factor])} />
        </Suspense>
      </Canvas>
    </div>
  );
}
