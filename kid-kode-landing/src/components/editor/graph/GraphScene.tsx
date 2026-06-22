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
import { GalaxyStarfield, GalaxyNebula, GalaxyOrbitRings, SunCorona, type GalaxyQuality } from '@/components/editor/graph/GalaxyAtmosphere';
import { gsap } from 'gsap';

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { ChromeSlabLayer } from '@/components/editor/chrome-layer';
import { HubSceneTransition } from '@/components/editor/transition/HubSceneTransition';
import {
  useHubTransitionStore,
  requestHubNavigation,
} from '@/stores/useHubTransitionStore';
import HubLighting from './HubLighting';
import { toEditorView, type EditorGraph, type EditorHubView } from '@/lib/prism-graph/view-model';
import {
  useGraphEditorStore,
  type ViewMode,
  type EditorRenderMode,
  GIZMO_TRANSLATE_SNAP,
  GIZMO_ROTATE_SNAP,
  GIZMO_SCALE_SNAP,
} from '@/stores/useGraphEditorStore';
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
import HubPlanet, { NodeContentIcons } from '@/components/editor/graph/HubPlanet';
import { NodeContentBadge } from '@/components/editor/graph/content-glyphs';
import ArtifactNode, { hasArtifactData } from '@/components/editor/graph/ArtifactNode';
import { computeSceneAuthorship } from '@/lib/prism/runtime/node-authorship';
import { computeGalaxyLabelVisibility, computePerLabelLod } from '@/lib/galaxy-label-lod';
import { computeHubWorldLabelVisibility } from '@/lib/hub-world-label-lod';
import { computeGalaxyHubTethers } from '@/lib/galaxy-tethers';
import {
  findNearestHub,
  getHubWorldPositions,
} from '@/lib/prism-graph/hub-geometry';
import { computeCloneDragTether } from '@/lib/editor/clone-drag-tether';
import ElementPlacementLayer from '@/components/editor/elements/ElementPlacementLayer';
import { HubBackgroundStack, hubSuppressesSkybox } from '@/components/editor/graph/backgrounds/HubBackgroundStack';
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
  buildCameraKeyframe,
  hasJourney,
  journeyDurationSeconds,
  sampleJourney,
} from '@/lib/editor/camera-journey';
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
import {
  getSharedNodeContext,
  getSharedDriverHub,
  setSharedNodeContextTier,
} from '@/lib/prism/runtime/shared-context';
import { detectCapabilityTier } from '@/lib/prism/runtime/shared/capability-tier';
import { getTransmissionCount } from '@/lib/prism/runtime/shared/transmission-budget';
// P2 ANIMATION BINDINGS (canvas-spec §8.2/§8.3) — the binding player attaches
// a node's catalog-primitive animationBindings to the mounted artifact and
// plays them through the SAME driver dispatch the factory's STEP7 path uses.
import { makeNodeDrivers } from '@/lib/prism/runtime/shared/driver-dispatch';
// F5 ATELIER (ORRERY-NO7-PROTOTYPE-SPEC §3) — in-3D watch configurator wiring.
import { useConfiguratorStore } from '@/stores/useConfiguratorStore';
import type { AtelierLayerId } from '@/lib/prism/atelier/config';
import { runAtelierAction } from '@/lib/prism/atelier/actions';
import { AtelierApplier } from '@/components/atelier/AtelierApplier';
import { AtelierDragController } from '@/components/atelier/AtelierDragController';
import { AtelierWatchRig } from '@/components/atelier/AtelierWatchRig';
import { OrreryComplicationRig } from '@/components/atelier/OrreryComplicationRig';
import { attachAnimationBindings } from '@/lib/prism/animatable/bindings';
import {
  IMAGE_SPEC_DEFAULT,
  TEXT_SPEC_DEFAULT,
  deriveContentType,
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
// Wave-2E Chrome-Arc retint — all chrome accent colors (selection rings,
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
  contains: dsAlpha(DS.metal400, 0.45),
  'navigates-to': DS.ice300,
  triggers: dsAlpha(DS.ok, 0.45),
  'data-flow': dsAlpha(DS.ok, 0.45),
  'shares-state': DS.metal300,
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
// POLISH PC — bipartite-DAG connection lines: gently CURVED brass-tinted
// polylines instead of harsh straight bright-white 1px lines. A small
// perpendicular bow + N-sample bezier reads as a soft arc; the color is blended
// toward brass so no edge type (the old `navigates-to` ice / `DS.textHi`
// fallback) renders as a harsh white seam; opacity is dropped for a softer,
// recessive look that lets the nodes stay the heroes.
const EDGE_SAMPLES = 14; // polyline segments along each curved edge
const _edgeUp = new THREE.Vector3(0, 1, 0);
const _edgeAltUp = new THREE.Vector3(1, 0, 0);

function Edge({ link, revealOpacity = 1 }: { link: SimLink; revealOpacity?: number }) {
  const lineRef = useRef<any>(null);
  // Reusable scratch so the per-frame curve resample allocates nothing.
  const scratch = useRef({
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    mid: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    perp: new THREE.Vector3(),
    curve: new THREE.QuadraticBezierCurve3(),
    pt: new THREE.Vector3(),
    pos: new Float32Array((EDGE_SAMPLES + 1) * 3),
  });

  useFrame(() => {
    if (!lineRef.current) return;
    const s = link.source as SimNode;
    const t = link.target as SimNode;
    if (!s || typeof s === 'string' || !t || typeof t === 'string') return;
    const sc = scratch.current;
    sc.a.set(s.x, s.y, s.z);
    sc.b.set(t.x, t.y, t.z);
    sc.mid.copy(sc.a).add(sc.b).multiplyScalar(0.5);
    sc.dir.copy(sc.b).sub(sc.a);
    const dist = sc.dir.length();
    // Perpendicular bow — pick an up vector not parallel to the edge so the arc
    // is stable even for near-vertical links.
    const up = Math.abs(sc.dir.y) > dist * 0.92 ? _edgeAltUp : _edgeUp;
    sc.perp.copy(sc.dir).cross(up);
    if (sc.perp.lengthSq() > 1e-6) sc.perp.normalize();
    sc.mid.addScaledVector(sc.perp, dist * 0.08); // subtle outward bow
    sc.curve.v0.copy(sc.a);
    sc.curve.v1.copy(sc.mid);
    sc.curve.v2.copy(sc.b);
    const pos = sc.pos;
    for (let i = 0; i <= EDGE_SAMPLES; i++) {
      const p = sc.curve.getPoint(i / EDGE_SAMPLES, sc.pt); // reuse target → no per-sample alloc
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    }
    const geom = lineRef.current.geometry as THREE.BufferGeometry;
    const attr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!attr || attr.count !== EDGE_SAMPLES + 1) {
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    } else {
      (attr.array as Float32Array).set(pos);
      attr.needsUpdate = true;
    }
    geom.computeBoundingSphere();
  });

  // Brass-tint: blend the reason color toward brass so the harsh ice/bone-white
  // look is gone while the type still reads. `contains` keeps more of its dim
  // brass; peer edges blend harder off their bright hues.
  const color = useMemo(() => {
    const base = new THREE.Color(EDGE_COLORS[link.type] || DS.metal400);
    return base.lerp(new THREE.Color(DS.metal300), link.type === 'contains' ? 0.18 : 0.5);
  }, [link.type]);
  // Softer, recessive opacity (was 0.28 / 0.62 → harsh). Nodes stay the heroes.
  const baseOpacity = link.type === 'contains' ? 0.2 : 0.32;
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

  // UI-WOW-2 P2 — glowing additive TUBES (were 1px grey lines). hubCenters is a
  // fresh object each frame but the galaxy centers are deterministic, so a value
  // signature keeps the tube geometries from rebuilding every frame.
  const posSig = tethers
    .map((t) => {
      const a = hubCenters[t.hubA];
      const b = hubCenters[t.hubB];
      return a && b ? `${a.x | 0},${a.y | 0},${a.z | 0}|${b.x | 0},${b.y | 0},${b.z | 0}` : 'x';
    })
    .join(';');

  const tubes = useMemo(() => {
    const out: { id: string; geo: THREE.TubeGeometry; halo: THREE.TubeGeometry; color: THREE.Color }[] = [];
    for (const tether of tethers) {
      const a = hubCenters[tether.hubA];
      const b = hubCenters[tether.hubB];
      if (!a || !b) continue;
      const va = new THREE.Vector3(a.x, a.y, a.z);
      const vb = new THREE.Vector3(b.x, b.y, b.z);
      const mid = va.clone().add(vb).multiplyScalar(0.5);
      const dist = va.distanceTo(vb);
      // bow the arc outward from the central sun → reads as an orbit-connection
      mid.add(mid.clone().normalize().multiplyScalar(dist * 0.14 + 8));
      const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
      // POLISH PC — brass-tint + thin the inter-hub tethers so no reason colour
      // (esp. the bright `navigates-to` ice / `DS.textHi` fallback) reads as a
      // harsh bright-white seam across the galaxy. Blend each reason hue toward
      // brass and slim the core/halo tubes.
      const tetherColor = new THREE.Color(EDGE_COLORS[tether.type] || DS.metal400)
        .lerp(new THREE.Color(DS.metal300), 0.45);
      out.push({
        id: tether.id,
        geo: new THREE.TubeGeometry(curve, 28, 0.3, 6, false),
        halo: new THREE.TubeGeometry(curve, 28, 1.2, 6, false),
        color: tetherColor,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tethers, posSig]);

  // dispose superseded geometries when the layout changes / on unmount
  useEffect(() => () => { tubes.forEach((p) => { p.geo.dispose(); p.halo.dispose(); }); }, [tubes]);

  const coreMats = useRef<THREE.MeshBasicMaterial[]>([]);
  coreMats.current = [];
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    for (let i = 0; i < coreMats.current.length; i++) {
      const mat = coreMats.current[i];
      // energy pulse travelling along the hub trail (phase per index). POLISH PC
      // — softer band (was 0.4±0.24, harsh) so the tether glows recessively.
      if (mat) mat.opacity = 0.24 + 0.12 * Math.sin(t * 1.4 + i * 0.6);
    }
  });

  return (
    <group>
      {tubes.map((tube, i) => (
        <group key={tube.id}>
          <mesh geometry={tube.geo}>
            <meshBasicMaterial
              ref={(m) => { if (m) coreMats.current[i] = m as THREE.MeshBasicMaterial; }}
              color={tube.color}
              transparent
              opacity={0.3}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh geometry={tube.halo}>
            <meshBasicMaterial
              color={tube.color}
              transparent
              opacity={0.05}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
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
    return h?.color || DS.metal400;
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

  // POLISH PA — galaxy hero-world hierarchy: dormant node spheres are
  // SUBORDINATE to the hub PLANETS (HubPlanet). In galaxy overview a node
  // sphere shrinks to ~2.6u so the planet (innerRadius floored well above this,
  // see HubHulls) reads ≥2.5× larger and the scene parses as 5 worlds with
  // orbiting moons. Non-galaxy modes keep the established 4.5u node-state size.
  const radius = viewMode === 'galaxy' ? 2.6 : 4.5;

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
        <mesh
          ref={innerRef}
          castShadow
          receiveShadow
          // POLISH PA — tag the dormant node SPHERE so the dev-only
          // __PRISM_GALAXY_PROBE__ can measure its projected radius vs the hub
          // planets (hero-world size-hierarchy gate). Diagnostic only; inert at
          // runtime (NODE_ENV-gated reader).
          userData={{ galaxyNodeSphere: true }}
        >
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
          color={isSelected ? DS.metal200 : DS.ice300}
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
          <meshBasicMaterial color={DS.metal300} toneMapped={false} />
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

      {/* NODE-EDITOR-V2 D3 — per-integration content icons (galaxy node-state,
          §3.3): one brand-tinted badge per connected integration + function
          platform, showing what the node HOLDS. */}
      {viewMode === 'galaxy' && (
        <NodeContentIcons sourceNode={sourceNode} radius={radius} dimFactor={dimFactor} />
      )}

      {/* POLISH PC — content-type glance glyph: every dormant node carries a
          small premium custom 3D badge (image / text / 3d-object / integration)
          BELOW the sphere so the node's content type reads at a glance, clear
          of the name label (above) and the integration icons (above). */}
      {viewMode === 'galaxy' && (
        <group userData={{ contentBadge: true }}>
          <NodeContentBadge
            contentType={sourceNode ? deriveContentType(sourceNode) : 'image'}
            position={[0, -radius - 2.2, 0]}
            scale={1.5}
            dimFactor={dimFactor}
          />
        </group>
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
  galaxy = false,
}: {
  hub: EditorHubView;
  center: { x: number; y: number; z: number };
  radius: number;
  innerRadius: number;
  isActive: boolean;
  onSelect: (shiftKey: boolean) => void;
  // NODE-EDITOR-V2 D1 — in galaxy mode the hub renders as a photoreal PLANET
  // (HubPlanet) instead of the editor-scaffolding hull + page-mockup sphere.
  galaxy?: boolean;
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
      {galaxy ? (
        // NODE-EDITOR-V2 D1 — photoreal hub PLANET (brass/bone/ice, lit by the
        // scene's night IBL + directionals, glowing via Bloom). Replaces the
        // editor-scaffolding hull + page-mockup sphere in galaxy (FP-NE-3: no
        // built artifact in galaxy; the planet is the dormant hub body).
        <>
          <HubPlanet radius={innerRadius} hubId={hub.id} isActive={isActive} dimFactor={dimFactor} />
          {/* Faint constellation envelope — the node cloud boundary. */}
          <mesh>
            <sphereGeometry args={[radius, 24, 24]} />
            <meshBasicMaterial
              color={DS.ice500}
              transparent
              opacity={(isActive ? 0.05 : 0.02) * dimFactor}
              side={THREE.BackSide}
              toneMapped={false}
            />
          </mesh>
        </>
      ) : (
        <>
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
          {/* Hull chrome — Chrome-Arc retint (Wave-3 advocate MUST-FIX):
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
        </>
      )}
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
          color={DS.metal200}
          emissive={new THREE.Color(DS.metal300)}
          emissiveIntensity={1.6}
          roughness={0.32}
          metalness={0.0}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 1.18, radius * 1.32, 96]} />
        <meshBasicMaterial
          color={isSelected ? DS.metal100 : DS.metal200}
          transparent
          opacity={isSelected ? 0.85 : 0.55}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <pointLight color={DS.metal200} intensity={3.2} distance={260} decay={1.8} />
      {/* UI-WOW-2 P2 — layered additive corona so the sun reads as a star. */}
      <SunCorona radius={radius} />
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
        // POLISH PA — in galaxy the hub PLANET must read as the HERO world:
        // floor its radius well above the subordinate node spheres (2.6u in
        // galaxy) so the projected-radius ratio clears ≥2.5× even for the
        // smallest hub, while staying < the node-cloud hull radius so the
        // element-spheres still orbit OUTSIDE the opaque planet surface.
        const innerRadius =
          viewMode === 'galaxy'
            ? Math.min(Math.max(radius * 0.5, 9), 40)
            : Math.min(radius * 0.45, 32);
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
            galaxy={viewMode === 'galaxy'}
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

  // POLISH PC — per-label declutter at element-detail zoom (galaxy). A pre-pass
  // ranks the on-screen labels by camera distance so computePerLabelLod keeps the
  // nearest few crisp and recedes the rest, instead of painting every node name
  // at full opacity into an unreadable mass. Focused (hover/selected) labels are
  // exempt. No-op outside galaxy (hub-world keeps its own intra-hub LOD).
  const GALAXY_LABEL_CULL = 380;
  const perLabel = new Map<string, { rank: number; visibleCount: number; distance: number }>();
  if (viewMode === 'galaxy') {
    const vis: { id: string; distance: number; focused: boolean }[] = [];
    const probe = new THREE.Vector3();
    for (const n of simNodes) {
      probe.set(n.x, n.y, n.z);
      const d = camera.position.distanceTo(probe);
      probe.project(camera);
      if (probe.z > 1 || probe.x < -1.05 || probe.x > 1.05 || probe.y < -1.05 || probe.y > 1.05) continue;
      const focused = hoveredId === n.id || livePreviewHoverId === n.id || selectedId === n.id;
      vis.push({ id: n.id, distance: d, focused });
    }
    const visibleCount = vis.length;
    vis
      .filter((x) => !x.focused)
      .sort((a, b) => a.distance - b.distance)
      .forEach((x, i) => perLabel.set(x.id, { rank: i, visibleCount, distance: x.distance }));
    vis
      .filter((x) => x.focused)
      .forEach((x) => perLabel.set(x.id, { rank: 0, visibleCount, distance: x.distance }));
  }

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

        // POLISH PC — per-label declutter multiplier (galaxy element-detail zoom).
        const pll = viewMode === 'galaxy' ? perLabel.get(node.id) : undefined;
        const perLabelLod = pll
          ? computePerLabelLod({
              distance: pll.distance,
              maxDistance: GALAXY_LABEL_CULL,
              isFocused: isHovered || isSelected,
              densityRank: pll.rank,
              visibleCount: pll.visibleCount,
            })
          : { opacity: 1, scale: 1 };

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
            zIndexRange={[25, 0]}
            style={{ pointerEvents: 'none', opacity: lodOpacity * perLabelLod.opacity }}
          >
            <div
              className="select-none"
              style={{ transform: `scale(${perLabelLod.scale})`, transformOrigin: 'center top' }}
            >
              {tier >= 1 && (
                <div
                  className="font-mono font-semibold tracking-wide whitespace-nowrap"
                  style={{
                    color: isSelected ? DS.metal200 : DS.textHi,
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
                  {node.hasAnimation && <span style={{ color: DS.metal300 }}>○</span>}
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
  const { camera, gl, scene, size } = useThree();

  // POLISH PA — dev-only galaxy probe. Measures each hub PLANET's projected
  // screen radius (px) and each dormant NODE sphere's projected radius so the
  // verifier can prove the hero-world size hierarchy (ratio ≥ 2.5×). Reads the
  // userData tags set on the HubPlanet surface (userData.hubPlanet) and the
  // GlassNode inner sphere (userData.galaxyNodeSphere). Editor-shell dev scope
  // (NODE_ENV gate + window), inert in production (FP-05 safe).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return;
    const w = window as unknown as { __PRISM_GALAXY_PROBE__?: () => unknown };
    const tmpRight = new THREE.Vector3();
    const tmpUp = new THREE.Vector3();
    const tmpFwd = new THREE.Vector3();
    const tmpScale = new THREE.Vector3();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const projRadiusPx = (center: THREE.Vector3, worldRadius: number) => {
      camera.updateMatrixWorld();
      camera.matrixWorld.extractBasis(tmpRight, tmpUp, tmpFwd); // tmpRight = camera +X
      const c = center.clone().project(camera);
      const edge = center.clone().addScaledVector(tmpRight, worldRadius).project(camera);
      const dx = (edge.x - c.x) * 0.5 * size.width;
      const dy = (edge.y - c.y) * 0.5 * size.height;
      return {
        px: Math.hypot(dx, dy),
        cx: c.x * 0.5 + 0.5,
        cy: 1 - (c.y * 0.5 + 0.5),
        inFront: c.z < 1,
      };
    };
    const meshWorldSphere = (mesh: THREE.Mesh) => {
      mesh.updateWorldMatrix(true, false);
      const geom = mesh.geometry;
      if (!geom.boundingSphere) geom.computeBoundingSphere();
      const bs = geom.boundingSphere;
      if (!bs) return null;
      const center = bs.center.clone().applyMatrix4(mesh.matrixWorld);
      mesh.matrixWorld.decompose(tmpPos, tmpQuat, tmpScale);
      const worldRadius = bs.radius * Math.max(tmpScale.x, tmpScale.y, tmpScale.z);
      return { center, worldRadius };
    };
    const groupWorldSphere = (group: THREE.Object3D) => {
      const box = new THREE.Box3();
      let any = false;
      group.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh && m.geometry) { m.updateWorldMatrix(true, false); box.expandByObject(m); any = true; }
      });
      if (!any || box.isEmpty()) return null;
      const center = box.getCenter(new THREE.Vector3());
      const worldRadius = box.getSize(new THREE.Vector3()).length() / 2;
      return { center, worldRadius };
    };
    w.__PRISM_GALAXY_PROBE__ = () => {
      const hubs: { screenRadiusPx: number; cx: number; cy: number }[] = [];
      const nodes: { screenRadiusPx: number; cx: number; cy: number }[] = [];
      const badges: { screenRadiusPx: number; cx: number; cy: number }[] = [];
      scene.traverse((obj) => {
        if (obj.userData?.contentBadge === true) {
          const s = groupWorldSphere(obj);
          if (s) { const p = projRadiusPx(s.center, s.worldRadius); if (p.inFront) badges.push({ screenRadiusPx: p.px, cx: p.cx, cy: p.cy }); }
          return;
        }
        if (obj.userData?.hubPlanet === true) {
          // surface = first child Mesh with a SphereGeometry (added before the
          // halo sprite + rim shell in HubPlanet).
          let surface: THREE.Mesh | null = null;
          obj.traverse((child) => {
            if (surface) return;
            const m = child as THREE.Mesh;
            if (m.isMesh && (m.geometry as THREE.BufferGeometry)?.type === 'SphereGeometry') surface = m;
          });
          if (surface) {
            const s = meshWorldSphere(surface);
            if (s) { const p = projRadiusPx(s.center, s.worldRadius); if (p.inFront) hubs.push({ screenRadiusPx: p.px, cx: p.cx, cy: p.cy }); }
          }
        } else if ((obj as THREE.Mesh).isMesh && obj.userData?.galaxyNodeSphere === true) {
          const s = meshWorldSphere(obj as THREE.Mesh);
          if (s) { const p = projRadiusPx(s.center, s.worldRadius); if (p.inFront) nodes.push({ screenRadiusPx: p.px, cx: p.cx, cy: p.cy }); }
        }
      });
      return { hubs, nodes, badges, viewport: { w: size.width, h: size.height } };
    };
    return () => { delete w.__PRISM_GALAXY_PROBE__; };
  }, [camera, scene, size]);

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

// APP-REALITY P2 — animate camera fov (enables dolly-zoom over a journey).
function applyCameraFov(c: CameraControls, fov: number) {
  const cam = c.camera as THREE.PerspectiveCamera;
  if (cam && cam.isPerspectiveCamera && Math.abs(cam.fov - fov) > 0.01) {
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }
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
  // APP-REALITY P1 — straight-on reset signal + live angle read-out feed.
  const resetViewSignal = useGraphEditorStore((s) => s.resetViewSignal);
  const setCanvasView = useGraphEditorStore((s) => s.setCanvasView);
  // Throttle the per-frame angle push to real motion.
  const lastViewRef = useRef<{ az: number; pol: number; dist: number } | null>(null);
  // APP-REALITY P2 — camera-journey authoring + deterministic preview playback.
  const captureKeyframeSignal = useGraphEditorStore((s) => s.captureKeyframeSignal);
  const journeyReplaySignal = useGraphEditorStore((s) => s.journeyReplaySignal);
  const journeyActiveRef = useRef(false);
  const journeyStartRef = useRef<number | null>(null);
  // APP-REALITY P3 — Edit-in-Preview locks the canvas camera to the shipped view.
  const editInPreview = useGraphEditorStore((s) => s.editInPreview);
  // APP-REALITY P5 — device mode reframes the locked preview camera per device.
  const deviceMode = useGraphEditorStore((s) => s.deviceMode);
  // PHASE3 (P3-1) — the in-canvas hub-transition token: bumps when a hub change
  // begins, kicking a camera dolly-through (pull back behind the closing
  // curtain; the landing effect on commit eases forward into the new hub).
  const hubTransitionToken = useHubTransitionStore((s) => s.token);
  // PHASE3 (P3-5) — cinematic idle camera drift bookkeeping: the clock time the
  // active hub last settled, so the drift eases in (and so it never fights the
  // landing/transition that owns the camera right after a hub change).
  const driftHubRef = useRef<string | null>(null);
  const hubSettleClockRef = useRef(0);

  // EBR2-D-02 / §R2-D SC-071 — canvas rail is RETAINED only to feed the dev
  // hook (`__PRISM_EDITOR_GET_CANVAS_RAIL__`). APP-REALITY P1 DELIBERATELY
  // SUPERSEDES SC-071 for canvas: the camera is now fully free (no angular /
  // pan clamps fed to CameraControls below). Kept computing so existing probes
  // still resolve a value; it no longer constrains motion.
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

  // APP-REALITY P1 — RESET VIEW TO ZERO (canvas straight-on). Snaps the free
  // canvas camera back to the deterministic front-facing pose on the active
  // hub (which renders at the local origin in scene mode). Keeps activeHubId.
  // The CanvasCameraHud watches the same signal for the haptic + visual pulse.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || viewMode !== 'canvas') return;
    const pose = computeCanvasCameraPose({ x: 0, y: 0, z: 0 });
    c.setLookAt(
      pose.position.x, pose.position.y, pose.position.z,
      pose.target.x, pose.target.y, pose.target.z,
      true,
    );
    checkpointCameraPose('canvas', pose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetViewSignal]);

  // APP-REALITY P1 — PREVIEW-APP is camera-LOCKED to the configured view. On
  // entry, snap to the deterministic front-facing "configured" pose so the
  // locked camera never strands on a prior canvas orbit (which would expose
  // scene edges / a partial frame). The camera then holds this pose — only the
  // P2 camera journey (programmatic setLookAt, still honored while disabled)
  // may move it. This is the configured landing view of the built app.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || viewMode !== 'preview-app') return;
    // APP-REALITY P2 — if this hub has an authored camera JOURNEY, land on its
    // first waypoint and start the deterministic play (the per-frame block
    // below drives it). Otherwise snap to the static configured front pose.
    if (hasJourney(hub)) {
      const first = sampleJourney(hub!.cameraKeyframes, 0);
      if (first) {
        c.setLookAt(
          first.position.x, first.position.y, first.position.z,
          first.target.x, first.target.y, first.target.z,
          false,
        );
        applyCameraFov(c, first.fov);
      }
      journeyStartRef.current = null;
      journeyActiveRef.current = true;
    } else {
      const pose = computeCanvasCameraPose({ x: 0, y: 0, z: 0 });
      c.setLookAt(
        pose.position.x, pose.position.y, pose.position.z,
        pose.target.x, pose.target.y, pose.target.z,
        true,
      );
      journeyActiveRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, hub?.hubId]);

  // APP-REALITY P2 — CAPTURE the current free canvas-camera pose as a journey
  // waypoint on the active hub (canvas writes the SHARED source graph). The
  // live pose is read here (the bridge owns the controls), so the HUD button
  // stays a thin signal. receiveEndValue=false reads the settled live pose.
  useEffect(() => {
    if (captureKeyframeSignal === 0) return;
    const c = controlsRef.current;
    if (!c || viewMode !== 'canvas') return;
    const hubId = useGraphEditorStore.getState().activeHubId;
    if (!hubId) return;
    const pos = new THREE.Vector3();
    const tgt = new THREE.Vector3();
    c.getPosition(pos, false);
    c.getTarget(tgt, false);
    const cam = c.camera as THREE.PerspectiveCamera;
    const fov = cam && cam.isPerspectiveCamera ? cam.fov : 45;
    const kf = buildCameraKeyframe(
      { x: pos.x, y: pos.y, z: pos.z },
      { x: tgt.x, y: tgt.y, z: tgt.z },
      fov,
    );
    const src = useGraphSourceStore.getState();
    const existing = src.hubs.find((h) => h.hubId === hubId)?.cameraKeyframes ?? [];
    src.updateHub(hubId, { cameraKeyframes: [...existing, kf] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureKeyframeSignal]);

  // APP-REALITY P2 — replay the journey from t=0 (Preview "replay" button).
  useEffect(() => {
    if (journeyReplaySignal === 0) return;
    if (viewMode !== 'preview-app' || !hasJourney(hub)) return;
    journeyStartRef.current = null;
    journeyActiveRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyReplaySignal]);

  // APP-REALITY P5 — reframe the locked preview camera for the device so the
  // device's re-laid-out composition fills its frame (mobile pulls in closer to
  // fill the tall portrait window). Skips when a journey owns the camera.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || viewMode !== 'preview-app' || hasJourney(hub)) return;
    // PROD-FINISH Phase B — pull the locked preview camera CLOSER on every
    // device so the authored composition FILLS the frame and the product hero
    // reads punchy (the prior desktop z=14 left the composition at ~34% of frame
    // height — heroes read small in a large empty surface). z chosen so the
    // tallest composition (acquire: reserve text y≈2.05 → pedestal y≈-2.3) still
    // clears the frame at fov 45 (half-height = z·0.414): z=10.5 → ±4.35.
    const z = deviceMode === 'mobile' ? 11 : 10.5; // mobile portrait keeps its proven framing
    c.setLookAt(0, 0, z, 0, 0, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceMode, viewMode, hub?.hubId]);

  // APP-REALITY P3 — entering Edit-in-Preview snaps the (now locked) canvas
  // camera to the configured shipped framing: the journey landing pose if the
  // hub has one, else the deterministic front pose. The user then edits against
  // exactly what ships. Leaving it re-enables free orbit at the current pose.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || viewMode !== 'canvas' || !editInPreview) return;
    if (hasJourney(hub)) {
      const first = sampleJourney(hub!.cameraKeyframes, 0);
      if (first) {
        c.setLookAt(
          first.position.x, first.position.y, first.position.z,
          first.target.x, first.target.y, first.target.z,
          true,
        );
        applyCameraFov(c, first.fov);
      }
    } else {
      const pose = computeCanvasCameraPose({ x: 0, y: 0, z: 0 });
      c.setLookAt(
        pose.position.x, pose.position.y, pose.position.z,
        pose.target.x, pose.target.y, pose.target.z,
        true,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editInPreview, viewMode]);

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
      // APP-REALITY P1 regression-fix (SC-027 / INV-20): snapshot the LIVE pose
      // (receiveEndValue=false), NOT the transition destination. The new
      // preview-app entry effect is defined earlier and runs `setLookAt(front,
      // true)` in the same commit, which overwrites _sphericalEnd/_targetEnd;
      // reading the END value here would checkpoint the front pose over the
      // user's last canvas orbit and break canvas→preview-app→canvas restore.
      c.getPosition(pos, false);
      c.getTarget(tgt, false);
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

  // PHASE1 (SC-V-A4) — Atelier inspect camera. The award-winning configurator
  // pattern: the CAMERA stays head-on (so the premium flat UI never skews) and
  // the WATCH turntables (AtelierWatchRig) for full 360° any-angle inspect; the
  // camera only DOLLIES for the macro loupe. We ease to a head-on hero pose then
  // clamp polar/azimuth to that pose so only distance (zoom) remains free.
  useEffect(() => {
    if (viewMode !== 'preview-app' || activeHubId !== 's6-atelier') return;
    if (!controlsRef.current) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      const cc = controlsRef.current;
      if (!cc) return;
      cc.enabled = true;
      void cc.setLookAt(0, 0.55, 8.2, 0, 0.1, 0.42, true).then(() => {
        if (cancelled) return;
        const cur = controlsRef.current;
        if (!cur) return;
        cur.minPolarAngle = cur.maxPolarAngle = cur.polarAngle;
        cur.minAzimuthAngle = cur.maxAzimuthAngle = cur.azimuthAngle;
      });
    }, 120);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [viewMode, activeHubId]);

  // PHASE3 (P3-1) — camera DOLLY-THROUGH on a hub transition. When the curtain
  // begins closing (token bump), pull the camera back along its view direction
  // (and rise a touch) so the OUTGOING hub recedes into depth behind the
  // curtain; the landing effect (firing on the committed activeHubId change at
  // peak cover) then eases forward to the incoming hero pose — the camera
  // visibly travels THROUGH 3D space rather than cutting. Atelier and authored
  // journeys own their own camera, so they are exempt.
  useEffect(() => {
    if (hubTransitionToken === 0) return;
    const c = controlsRef.current;
    if (!c || viewMode !== 'preview-app') return;
    if (activeHubId === 's6-atelier') return;
    if (hasJourney(hub)) return;
    const pos = new THREE.Vector3();
    const tgt = new THREE.Vector3();
    c.getPosition(pos, false);
    c.getTarget(tgt, false);
    const dir = pos.clone().sub(tgt);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    const back = pos.clone().addScaledVector(dir, 5.4);
    back.y += 0.7;
    void c.setLookAt(back.x, back.y, back.z, tgt.x, tgt.y, tgt.z, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubTransitionToken]);

  useFrame((state) => {
    const c = controlsRef.current;
    if (!c) return;
    // EDITOR-EXP P4 (C21) — drei <TransformControls> toggles controls.enabled
    // directly on `dragging-changed` (to auto-suspend the camera during a gizmo
    // drag). That is exactly what we want while the canvas camera is free, but
    // in preview-app and Edit-in-Preview the camera is LOCKED. A gizmo drag in
    // Edit-in-Preview would otherwise leave controls.enabled=true on release and
    // strand the lock. Re-assert the lock every frame (idempotent) so the
    // auto-suspend never unlocks a locked camera.
    // PHASE1 (SC-V-A4) — the Atelier is the one preview-app surface where the
    // user MUST orbit + loupe-zoom the watch. Exempt it from the camera lock
    // (bounded constraints keep it framed; see the CameraControls props below).
    const atelierInspect = viewMode === 'preview-app' && activeHubId === 's6-atelier';
    const shouldLock = !atelierInspect && (viewMode === 'preview-app' || (viewMode === 'canvas' && editInPreview));
    if (shouldLock && c.enabled) c.enabled = false;
    setCameraDistance(c.distance);
    // APP-REALITY P2 — drive the deterministic camera journey in preview-app.
    if (viewMode === 'preview-app' && journeyActiveRef.current && hasJourney(hub)) {
      const dur = journeyDurationSeconds(hub!.cameraKeyframes);
      if (journeyStartRef.current == null) journeyStartRef.current = state.clock.elapsedTime;
      const elapsed = state.clock.elapsedTime - journeyStartRef.current;
      const progress = dur > 0 ? Math.min(1, elapsed / dur) : 1;
      const s = sampleJourney(hub!.cameraKeyframes, progress);
      if (s) {
        c.setLookAt(
          s.position.x, s.position.y, s.position.z,
          s.target.x, s.target.y, s.target.z,
          false,
        );
        applyCameraFov(c, s.fov);
      }
      if (progress >= 1) journeyActiveRef.current = false; // hold final pose
    }
    // PHASE3 (P3-5) — cinematic IDLE camera language. In preview-app (non-
    // atelier, non-journey), once the hub has settled and no hub transition is
    // mid-flight, the locked camera BREATHES: a slow orbit sway + dolly +
    // target parallax around the hero pose, eased in, so the scene always feels
    // alive and directed — never a static frozen frame. The amplitude ramps in
    // over ~1s so it never pops when the curtain finishes opening.
    if (
      viewMode === 'preview-app' &&
      !atelierInspect &&
      !hasJourney(hub) &&
      useHubTransitionStore.getState().phase === 'idle'
    ) {
      const tt = state.clock.elapsedTime;
      if (activeHubId !== driftHubRef.current) {
        driftHubRef.current = activeHubId;
        hubSettleClockRef.current = tt;
      }
      const ramp = Math.min(1, Math.max(0, (tt - hubSettleClockRef.current - 0.6) / 1.0));
      if (ramp > 0) {
        const zHero = deviceMode === 'mobile' ? 11 : 10.5;
        const dx = (Math.sin(tt * 0.16) * 0.42 + Math.sin(tt * 0.41) * 0.12) * ramp;
        const dy = Math.sin(tt * 0.12 + 1.3) * 0.24 * ramp;
        const dz = Math.sin(tt * 0.09) * 0.32 * ramp;
        c.setLookAt(dx, dy, zHero + dz, dx * 0.18, dy * 0.1, 0, false);
      }
    }
    // APP-REALITY P1 — feed the live canvas angle read-out (CanvasCameraHud).
    // Throttled to real motion so the store isn't thrashed every frame.
    if (viewMode === 'canvas') {
      const az = (c.azimuthAngle * 180) / Math.PI;
      const pol = (c.polarAngle * 180) / Math.PI;
      const dist = c.distance;
      const last = lastViewRef.current;
      if (
        !last ||
        Math.abs(az - last.az) > 0.25 ||
        Math.abs(pol - last.pol) > 0.25 ||
        Math.abs(dist - last.dist) > 0.05
      ) {
        lastViewRef.current = { az, pol, dist };
        setCanvasView({ azimuthDeg: az, polarDeg: pol, distance: dist });
      }
    } else if (lastViewRef.current !== null) {
      lastViewRef.current = null;
      setCanvasView(null);
    }
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
    // APP-REALITY P1 — canvas is fully free now (SC-071 pan boundary
    // deliberately superseded). No pan clamp in any scene-bridge mode.
    c.setBoundary(undefined);
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

  // SC-O10 — live transmission budget bridge. The count is owned by the DOM-free
  // runtime module (transmission-budget.ts); this exposes it as a live getter so
  // Playwright verification reads the current admitted Path-B surface count at
  // any scene state. Never exceeds MAX_TRANSMISSION (2) by construction.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    Object.defineProperty(window, '__PRISM_TRANSMISSION_COUNT__', {
      configurable: true,
      get: () => getTransmissionCount(),
    });
    return () => {
      delete (window as unknown as Record<string, unknown>).__PRISM_TRANSMISSION_COUNT__;
    };
  }, []);

  // APP-REALITY P1 — Preview-app LOCKS the camera (it IS the running app: the
  // configured view / camera journey owns the camera, the user cannot orbit it
  // and so can never expose scene edges or a blank backdrop). Canvas is FULLY
  // FREE — orbit/pan/zoom like a real 3D editor (SC-071 rail superseded). When
  // `enabled={false}`, programmatic `setLookAt` still works (P2 journey).
  const isPreview = viewMode === 'preview-app';
  // APP-REALITY P3 — Edit-in-Preview also locks the camera (shipped framing).
  const framed = viewMode === 'canvas' && editInPreview;
  // PHASE1 (SC-V-A4) — the Atelier unlocks bounded orbit + loupe zoom.
  const atelierInspect = isPreview && activeHubId === 's6-atelier';
  return (
    // EDITOR-EXP P4 (C21) — `makeDefault` registers this as r3f's default
    // controls (useThree().controls). drei's <TransformControls> reads that and,
    // on its `dragging-changed` event, sets controls.enabled = !dragging — so the
    // camera AUTO-SUSPENDS for the duration of a gizmo drag (no camera/gizmo
    // fight) and resumes on release. This is the canvas/preview-app camera only;
    // the galaxy/topology ControlsBridge is left non-default so galaxy nav and
    // the preview camera-lock behavior are unchanged.
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={(!isPreview && !framed) || atelierInspect}
      minDistance={atelierInspect ? 3 : 1.5}
      maxDistance={atelierInspect ? 11 : 220}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
      smoothTime={0.24}
      draggingSmoothTime={0.12}
      dollyToCursor={!atelierInspect}
      truckSpeed={atelierInspect ? 0 : 1.1}
      azimuthRotateSpeed={0.7}
      polarRotateSpeed={0.7}
      dollySpeed={0.75}
      infinityDolly={false}
    />
  );
}

/** One loaded backdrop plane (texture lazily fetched; disposed on change). */
function SceneBackdropLayer({
  url,
  z,
  opacity,
  width,
  height,
}: {
  url: string;
  z: number;
  opacity: number;
  width: number;
  height: number;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
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
  }, [url]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    // APP-REALITY P4/P9 — feather the backdrop image into the skybox atmosphere
    // (radial alpha falloff) so the hub's hero composition bleeds off into the
    // app surface instead of presenting a hard-edged floating card (the seam the
    // advocate flagged). Oversized + edge-feathered = a full-bleed hero, not a
    // panel. The crisp MSDF/mesh content nodes still sit on top.
    <mesh position={[0, 0, z]} name="hub:scene-backdrop-layer">
      <planeGeometry args={[width * 1.34, height * 1.5]} />
      <meshBasicMaterial
        map={texture}
        color={'#ffffff' /* sanctioned: no-tint texture passthrough */}
        transparent
        alphaMap={getBackdropFalloffTexture()}
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function SceneBackdrop({ hub }: { hub: PrismHub | undefined }) {
  const mockupUrl = hub?.layout?.mockupUrl ?? null;
  const aspect = hub?.layout?.viewportWidth && hub?.layout?.viewportHeight
    ? hub.layout.viewportWidth / hub.layout.viewportHeight
    : 16 / 9;
  const width = 10;
  const height = width / aspect;

  // UI-FIDELITY-2 W3 — the assembled view honors the hub's `background[]`
  // layer stack (SC-036/SC-037 source of truth), matching compiled-view.ts:
  // layers draw back-to-front behind the content with per-layer opacity;
  // legacy `layout.mockupUrl` remains the single-layer fallback. The ink
  // plane stays at the very back so a hub with no loaded layers never goes
  // void-transparent.
  const layers =
    hub?.background && hub.background.length > 0
      ? hub.background
          .filter((l) => !!l.sourceUrl)
          .map((l) => ({
            id: l.id,
            url: l.sourceUrl as string,
            // source z is "behind-ness" (more negative = deeper); keep every
            // layer behind content (-2) and in front of the ink floor (-2.6).
            z: -2 + Math.max(-0.55, Math.min(0, (l.z ?? 0) * 0.15)),
            opacity: l.opacity ?? 1,
          }))
      : mockupUrl
        ? [{ id: 'legacy-mockup', url: mockupUrl, z: -2, opacity: 1 }]
        : [];

  return (
    <group name="hub:scene-backdrop">
      {/* PROD-FINISH Phase A — a SUBTLE, colour-matched central deepening behind
          content (not a hard dark ellipse). The premium dark nebula skybox is
          now the full-bleed app surface; this pool only gently seats the content
          for legibility. Colour = the skybox's dark base (DS.void) and opacity
          is low, so the textured skybox shows THROUGH the corners (no flat
          plate) and the smooth wide feather has near-zero contrast against the
          atmosphere → no visible oval/seam on any aspect. */}
      <mesh position={[0, 0, -2.6]} name="hub:scene-backdrop-ink">
        <planeGeometry args={[width * 1.9, height * 2.0]} />
        <meshBasicMaterial
          color={DS.void}
          transparent
          alphaMap={getBackdropFalloffTexture()}
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {layers.map((l) => (
        <SceneBackdropLayer
          key={`${l.id}:${l.url}`}
          url={l.url}
          z={l.z}
          opacity={l.opacity}
          width={width}
          height={height}
        />
      ))}
    </group>
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
  // APP-REALITY P3 — hide the editor viewport-frame scaffolding in Edit-in-
  // Preview so the canvas reads as the shipped app (gizmo + rings still show).
  const editInPreview = useGraphEditorStore((s) => s.editInPreview);

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

  return viewMode === 'canvas' && !editInPreview ? (
    <group name="canvas:viewport-frame" position={[0, 0, -1.2]} renderOrder={10}>
      <lineSegments geometry={outerGeom} material={outerMat} renderOrder={10} />
      <lineSegments ref={safeRef} geometry={safeGeom} material={safeMat} renderOrder={11} />
    </group>
  ) : null;
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
  // EDITOR-EXP P4 (C22 / D-DRAG) — Transform tools author the node's OWN schema
  // field (scenePosition), but now via the STAGING overlay (usePreviewStateStore),
  // not a direct source write. (STEP8 canvas-spec SC-9 named scenePosition the
  // legitimate target; P4's D-DRAG decision adds: stage it, don't persist on
  // drag.) `stagePreview` is read above.
  // STEP8 — gizmo axis set is lifted to the store so the toolbar Move/Rotate/
  // Scale buttons and the g/r/s shortcuts drive the same value.
  const mode = useGraphEditorStore((s) => s.canvasGizmoMode);
  const setMode = useGraphEditorStore((s) => s.setCanvasGizmoMode);
  // EDITOR-EXP P4 (C18) — transform space (world/local) + (C19) snapping. Both
  // lifted to the store so the toolbar controls and keyboard shortcuts converge.
  const gizmoSpace = useGraphEditorStore((s) => s.gizmoSpace);
  const toggleGizmoSpace = useGraphEditorStore((s) => s.toggleGizmoSpace);
  const snapEnabled = useGraphEditorStore((s) => s.snapEnabled);
  // EDITOR-EXP P4 (C22 / D-DRAG) — transforms STAGE through the preview overlay
  // (the same staging buffer C9 color/material uses), NOT the source store. The
  // canvas composes source ⊕ overlay live (AssembledSceneNode.composedNode), so
  // the staged scenePosition renders as a live ghost; Save (commitPreviewToSource)
  // commits the canonical position. We never write source / autosave on drag.
  const stagePreview = usePreviewStateStore((s) => s.set);
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

  // EDITOR-EXP P4 (C22) — read this node's staged preview patch so the gizmo
  // anchor follows the GHOST (the composed source ⊕ overlay pose), keeping the
  // handles attached to the visibly-moved artifact across drags before Save.
  const previewPatch = usePreviewStateStore((s) =>
    selectedNodeId ? s.patches[selectedNodeId] ?? null : null,
  );
  const sourceNode = useMemo(
    () => nodes.find((n) => n.nodeId === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  // The composed node is what the renderer draws (the ghost); the gizmo must
  // anchor on it so handles track the staged pose. Identity-stable when no patch.
  const node = useMemo(
    () => (sourceNode ? composeNodeWithPreview(sourceNode, previewPatch) : null),
    [sourceNode, previewPatch],
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
          // EDITOR-EXP P4 (C22) — Escape rewinds the STAGED ghost to the
          // drag-start pose by re-staging the prior scenePosition through the
          // preview overlay (never writing source).
          const restored = restorePriorCanvasTransform(prior);
          stagePreview(captured.nodeId, { scenePosition: restored });
        }
        return;
      }
      if (isEditableTarget(e.target)) return;
      // EDITOR-EXP P4 (C18) — 'x' toggles world ⇄ local transform space
      // (Blender-style; complements g/r/s mode keys).
      if (e.key === 'x' || e.key === 'X') {
        toggleGizmoSpace();
        return;
      }
      const next = gizmoModeForKey(e.key);
      if (next) setMode(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCanvasMode, isEditMode, nodeId, stagePreview, setMode, toggleGizmoSpace, node]);

  // STEP8 — never mount handles on a locked node (canvas-spec §5 lock/unlock).
  if (!isCanvasMode || !isEditMode || !node || isLocked) return null;

  const sp = readSceneTransform(node);
  const ct = readCanvasTransform(node);

  // FIDELITY-2 W4 — gizmo offset fix (carried flag, W0 root-cause): the
  // three-stdlib TransformControls helper is a WORLD-space gizmo — it copies
  // the attached object's worldPosition into its own LOCAL handle positions
  // and then composes its parent's transform on top. Mounted INSIDE the
  // translated anchor it rendered at 2·(sp+ct) — visibly offset from the
  // artifact whenever scenePosition ≠ 0 (drags still worked because deltas
  // are plane-relative). The controls now mount as a SIBLING of the anchor
  // (identity parent); placement comes solely from the proxy's matrixWorld.
  return (
    <>
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
      </group>
      {/* EDITOR-EXP P4 (C19) — visible world-grid hint while snapping is on.
          Renders a faint grid + axis lines centered on the gizmo anchor so the
          user can read the snap cadence. Authoring-only (canvas), never built. */}
      {snapEnabled ? (
        <group position={[sp.x + ct.x, sp.y + ct.y, sp.z + ct.z]} renderOrder={8}>
          <gridHelper
            args={[GIZMO_TRANSLATE_SNAP * 16, 16, DS.metal400, DS.metal400]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <lineBasicMaterial attach="material" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
          </gridHelper>
        </group>
      ) : null}
      {proxy ? (
        <TransformControls
          object={proxy}
          mode={mode}
          // EDITOR-EXP P4 (C18) — world/local transform space from the store.
          space={gizmoSpace}
          // EDITOR-EXP P4 (C21) — larger handles so touch / coarse-pointer drags
          // land reliably (default size 1 is fiddly on touch).
          size={1.35}
          showX
          showY
          showZ
          // EDITOR-EXP P4 (C19) — snap to the world grid only while enabled.
          // null disables the per-axis snap (drei forwards these straight to the
          // three-stdlib TransformControls translation/rotation/scale snaps).
          translationSnap={snapEnabled ? GIZMO_TRANSLATE_SNAP : null}
          rotationSnap={snapEnabled ? GIZMO_ROTATE_SNAP : null}
          scaleSnap={snapEnabled ? GIZMO_SCALE_SNAP : null}
          onMouseDown={() => {
            isDraggingRef.current = true;
            // EBR2-C-03 — capture scenePosition at drag start so
            // onObjectChange can write back start + delta. Cleared on mouseUp.
            // Read from the COMPOSED node (ghost) so successive drags accumulate
            // off the staged pose, not the stale source pose.
            dragStartSP.current = readSceneTransform(node);
          }}
          onMouseUp={() => {
            isDraggingRef.current = false;
            dragStartSP.current = null;
          }}
          onObjectChange={() => {
            // EDITOR-EXP P4 (C22 / D-DRAG) — proxy local pose is the drag delta
            // from its anchor origin (identity at drag start). The new
            // scenePosition is the captured drag-start sp composed with the
            // proxy delta: translate additive, rotation Euler-additive, scale
            // multiplicative. We STAGE it through the preview overlay (NOT
            // source / autosave) so the canvas shows a live ghost; Save commits.
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
            stagePreview(node.nodeId, { scenePosition: next });
          }}
        />
      ) : null}
    </>
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

// EDITOR-EXP P5 (C28) — a TIGHT rectangular selection frame + corner handles.
//
// A single circular ring (boundingSphere-sized) is ambiguous on wide artifacts
// — a one-line headline is far wider than tall, so the ring balloons to the
// diagonal and no longer reads as "this is selected". This draws a snug
// rectangle hugging the measured silhouette (hw/hh half-extents in the node's
// outer space) plus four L-shaped corner handles, so selection is unmistakable
// at any aspect ratio. Pure line geometry (no fill, no glyphs — INV-11 is about
// content text, this is editor chrome), built once per (hw,hh) and disposed on
// unmount, so there is no per-frame allocation.
function SelectionFrame({
  hw,
  hh,
  color,
  z,
}: {
  hw: number;
  hh: number;
  color: string;
  z: number;
}) {
  const geom = useMemo(() => {
    // Outline rectangle (closed loop) + four corner brackets, all in one
    // LineSegments buffer (pairs of vertices). The corner length scales with
    // the box so it stays proportional on tiny and huge artifacts alike.
    const cl = Math.min(hw, hh) * 0.4;
    const seg: number[] = [];
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      seg.push(x1, y1, 0, x2, y2, 0);
    };
    // Box edges.
    line(-hw, -hh, hw, -hh);
    line(hw, -hh, hw, hh);
    line(hw, hh, -hw, hh);
    line(-hw, hh, -hw, -hh);
    // Corner brackets (drawn slightly inset so they sit on the frame).
    // bottom-left
    line(-hw, -hh, -hw + cl, -hh);
    line(-hw, -hh, -hw, -hh + cl);
    // bottom-right
    line(hw, -hh, hw - cl, -hh);
    line(hw, -hh, hw, -hh + cl);
    // top-right
    line(hw, hh, hw - cl, hh);
    line(hw, hh, hw, hh - cl);
    // top-left
    line(-hw, hh, -hw + cl, hh);
    line(-hw, hh, -hw, hh - cl);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    return g;
  }, [hw, hh]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <group position={[0, 0, z]} renderOrder={12}>
      {/* The thin frame line. */}
      <lineSegments geometry={geom} renderOrder={12}>
        <lineBasicMaterial color={color} transparent opacity={0.92} depthTest={false} toneMapped={false} />
      </lineSegments>
      {/* Corner-handle dots so the frame reads as a grabbable selection even
          on a thin rule of text. Cheap small quads, no per-frame work. */}
      {[
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ].map(([cx, cy], i) => (
        <mesh key={i} position={[cx, cy, 0]}>
          <planeGeometry args={[0.045, 0.045]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} depthTest={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

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
  // APP-REALITY P5 — active Preview device mode (drives the responsive override).
  const deviceMode = useGraphEditorStore((s) => s.deviceMode);
  // EDITOR-EXP P1 (built-freeze) — rebuild identity, hoisted here so the BUILT
  // snapshot below can key off it (the once-per-build pop effect reuses it).
  const rebuildVersion = useGraphEditorStore((s) => s.nodeRebuildVersion[node.nodeId] ?? 0);
  const buildKey = node.nodeId + ':' + rebuildVersion;
  // EDITOR-EXP P1 (built-freeze, C5/C8 + INV-R6 + canvas-spec §6) — capture the
  // committed node AS OF the last (re)build. Refreshed synchronously (derive-
  // during-render, never stale-by-one) only when buildKey changes (an explicit
  // Build). A bare Save (overlay→source) or a live overlay edit does NOT bump
  // buildKey, so the snapshot — and therefore preview-app — stays frozen until
  // Build re-realizes the node.
  const builtNodeRef = useRef<PrismNode>(node);
  const builtKeyRef = useRef(buildKey);
  if (builtKeyRef.current !== buildKey) {
    builtKeyRef.current = buildKey;
    builtNodeRef.current = node;
  }
  // `composedNode` is the node the renderer actually reads. Canvas authoring
  // reads source ⊕ preview-overlay so edits show up LIVE before Save (the
  // ghost). preview-app (the running app) reads the BUILT snapshot only, so a
  // staged or Saved-but-unbuilt edit never changes the played app until an
  // explicit per-node Build (C5 proof: edit position → unchanged in preview →
  // Save → still unchanged → Build → moves). In canvas this is byte-identical
  // to the prior composeNodeWithPreview(node, previewPatch), so canvas
  // authoring (gizmo ghost, in-place setSpec, SC-069 ct writes) is unchanged.
  const composedNode = previewMode
    ? builtNodeRef.current
    : composeNodeWithPreview(node, previewPatch);
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
  // APP-REALITY P5 — compose the per-device responsive override: absolute pose
  // overrides + a scale multiplier so the built composition RE-LAYS-OUT for the
  // device (real responsive, not a resized frame). Absent → authored layout.
  const rdp = composedNode.responsiveScenePos?.[deviceMode];
  if (rdp) {
    if (rdp.x !== undefined) sp.x = rdp.x;
    if (rdp.y !== undefined) sp.y = rdp.y;
    if (rdp.z !== undefined) sp.z = rdp.z;
    if (rdp.scale !== undefined) {
      sp.scaleX *= rdp.scale;
      sp.scaleY *= rdp.scale;
      sp.scaleZ *= rdp.scale;
    }
  }
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
  // P5 punch-list (P4 advocate flag 2026-06-11) — the ring used to size ONCE
  // from the schema envelope (visual.transform), so a live reshape (the
  // meshPrimitive dimension faders, an imageSpec fit change, a rebuild into a
  // different artifact) left it stale around the new silhouette. Measure the
  // mounted artifact's first mesh boundingSphere inside the same effects that
  // apply those reshapes (below) and keep the envelope as the pre-measure
  // fallback. State-gated behind an epsilon so it updates only on real
  // reshapes — never per frame.
  const [measuredRing, setMeasuredRing] = useState<number | null>(null);
  // EDITOR-EXP P5 (C28) — a circular boundingSphere ring is a poor selection
  // cue for WIDE artifacts (a one-line headline is ~8× wider than tall): the
  // ring balloons to the diagonal and reads as "nothing near my text". Measure
  // the artifact's tight half-width / half-height (boundingBox, centered on the
  // node origin like every MSDF block) so selection draws a snug RECTANGLE +
  // corner handles around the real silhouette. Same epsilon-gated state as the
  // ring — recomputed only on real reshapes, never per frame, no allocation.
  const [measuredBox, setMeasuredBox] = useState<{ hw: number; hh: number } | null>(null);
  const measureArtifactRing = () => {
    const g = popRef.current;
    if (!g) return;
    let firstMesh: THREE.Mesh | null = null;
    g.traverse((obj) => {
      if (!firstMesh && (obj as THREE.Mesh).isMesh) firstMesh = obj as THREE.Mesh;
    });
    if (!firstMesh) return; // no mesh mounted (stage-0 bubble path) — keep fallback
    const mesh: THREE.Mesh = firstMesh;
    const geom = mesh.geometry;
    if (!geom.boundingSphere) geom.computeBoundingSphere();
    const radius = geom.boundingSphere?.radius;
    if (!radius || !Number.isFinite(radius)) return;
    // Accumulate scale from the mesh up to the pop wrapper so internally
    // scaled artifacts measure true (the wrapper's own build-pop scale and
    // the outer scenePosition/canvasTransform scales stay excluded — the
    // ring lives in that same outer space and scales with it).
    let s = 1;
    let walker: THREE.Object3D | null = mesh;
    while (walker && walker !== g) {
      s *= Math.max(Math.abs(walker.scale.x), Math.abs(walker.scale.y), Math.abs(walker.scale.z));
      walker = walker.parent;
    }
    // 0.9 × boundingSphere radius ≈ the old envelope sizing for a square
    // plane (max(w,h)·0.62), so unreshaped nodes keep their familiar ring.
    const next = Math.max(radius * s * 0.9, 0.155);
    setMeasuredRing((cur) => (cur !== null && Math.abs(cur - next) < 0.01 ? cur : next));
    // Tight planar half-extents for the rectangular outline (C28). geom-local
    // box scaled by the same accumulated factor; a small pad keeps the outline
    // off the glyph edges. Z is ignored — selection is a screen-facing frame.
    if (!geom.boundingBox) geom.computeBoundingBox();
    const bb = geom.boundingBox;
    if (bb) {
      const hwGeom = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x));
      const hhGeom = Math.max(Math.abs(bb.min.y), Math.abs(bb.max.y));
      const hw = Math.max(hwGeom * s + 0.05, 0.12);
      const hh = Math.max(hhGeom * s + 0.05, 0.12);
      setMeasuredBox((cur) =>
        cur && Math.abs(cur.hw - hw) < 0.01 && Math.abs(cur.hh - hh) < 0.01
          ? cur
          : { hw, hh },
      );
    }
  };
  const ringSize = measuredRing ?? Math.max(w, h, 0.25) * 0.62;
  // Tight selection-box half-extents: measured silhouette, else the schema
  // envelope (visual.transform w/h), else the ring as a square fallback.
  const selBox = measuredBox ?? {
    hw: Math.max(w * 0.5, ringSize * 0.72),
    hh: Math.max(h * 0.5, ringSize * 0.72),
  };

  // STEP6 scope item 3 — once-per-build realization pop (see poppedBuilds note).
  // (rebuildVersion + buildKey are hoisted above for the P1 built-freeze snapshot.)
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
    // P5 — initial ring measurement for this build (artifact just mounted).
    measureArtifactRing();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the build identity
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
    // P5 — the spec apply can reshape the visible artifact; re-measure the ring.
    measureArtifactRing();
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
    // P5 — a dimension-fader reshape just landed (geometry swap, identity
    // held); re-measure so the selection ring tracks the new bounds.
    measureArtifactRing();
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
  // APP-REALITY P5 — responsively hidden on the active device (declutter).
  if (rdp?.hidden) return null;

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
        if (g) {
          // S3d (Master Law 0 corollary) — stamp the authoring nodeId onto the
          // mounted artifact root so the node-authorship gate can prove this
          // Object3D was produced by a graph node (not a hardcoded sibling).
          (g.userData as { prismNodeId?: string }).prismNodeId = node.nodeId;
          map.set(node.nodeId, g);
        } else map.delete(node.nodeId);
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
        // node declares plays. This drives ANIMATION only.
        getSharedDriverHub().events.fire('click', { nodeId: node.nodeId });
        // APP-REALITY P7 — in preview-app (the running app) a Function-bound
        // element EXECUTES its binding on click: navigate to a hub, or open a
        // global element as an overlay (AMENDMENT 2026-06-14). It does NOT
        // select / open the inspector (that is canvas/editor behaviour).
        if (previewMode) {
          const fb = composedNode.functionBinding;
          if (fb) {
            const st = useGraphEditorStore.getState();
            if (fb.kind === 'navigate') {
              // PHASE3 (P3-1) — route through the gated in-canvas curtain
              // (close → swap → open) instead of an instant cut.
              requestHubNavigation(fb.hubId);
            } else if (fb.kind === 'overlay') {
              st.openOverlayElement({ elementId: fb.elementId, size: fb.size, anchor: fb.anchor });
            } else if (fb.kind === 'configure') {
              // F5 Atelier — tap a variant card → swap that layer's finish live.
              useConfiguratorStore.getState().setLayer(fb.layer as AtelierLayerId, fb.variant);
            } else if (fb.kind === 'configure-layer') {
              // F5 Atelier — tap a layer tab → make it the active catalog layer.
              useConfiguratorStore.getState().setActiveLayer(fb.layer as AtelierLayerId);
            } else if (fb.kind === 'atelier-action') {
              // F5 Atelier — save / share / reset the watch build.
              runAtelierAction(fb.action);
            }
          }
          return;
        }
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
      {/* EDITOR-EXP P5 (C28) — tight rectangular selection frame + corner
          handles, sized to the measured silhouette so it hugs wide text as
          snugly as a square icon. Replaces the ambiguous boundingSphere ring. */}
      {!previewMode && (isSelected || isMultiSelected || isHovered) && (
        <SelectionFrame
          hw={selBox.hw}
          hh={selBox.hh}
          color={isSelected ? DS.metal200 : isMultiSelected ? DS.metal400 : DS.ok}
          z={0.08}
        />
      )}
      {/* STEP8 — a thin amber frame marks a locked node (canvas-spec §5). A
          hair outside the selection frame so both read at once when selected. */}
      {!previewMode && isLocked && (
        <SelectionFrame hw={selBox.hw + 0.04} hh={selBox.hh + 0.04} color={DS.warn} z={0.07} />
      )}
    </group>
  );
}

function AssembledSceneDiagnostics({ nodes }: { nodes: PrismNode[] }) {
  const { camera, size, scene } = useThree();
  // POLISH (dev-only) — expose the live scene graph for verification introspection.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return;
    (window as unknown as { __PRISM_SCENE__?: THREE.Object3D }).__PRISM_SCENE__ = scene;
    return () => { delete (window as unknown as { __PRISM_SCENE__?: THREE.Object3D }).__PRISM_SCENE__; };
  }, [scene]);
  // S3d (PRISM-MASTER-SPEC Law 0 verification corollary) — node-authorship
  // probe. Walks the live scene + camera subtree (the hub-transition curtain is
  // camera-parented) and classifies every content artifact as node-authored
  // (carries an authoring nodeId / is in the node-group registry) or hardcoded
  // (mounted outside the node map → nodeId null). `scripts/node-authorship-gate.mjs`
  // and `/prism-verify` call this to FAIL on unsanctioned hardcoded drift and to
  // confirm a criterion's artifact was actually authored by a node. Editor-shell
  // dev scope (NODE_ENV gate + window) — FP-05 keeps the window binding OUT of the
  // pure runtime module (computeSceneAuthorship is arg-only / DOM-free).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return;
    const w = window as unknown as {
      __PRISM_NODE_AUTHORSHIP__?: () => ReturnType<typeof computeSceneAuthorship>;
      __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D>;
    };
    w.__PRISM_NODE_AUTHORSHIP__ = () =>
      computeSceneAuthorship(scene, w.__PRISM_EDITOR_NODE_GROUPS__ ?? null, camera);
    return () => { delete w.__PRISM_NODE_AUTHORSHIP__; };
  }, [scene, camera]);
  // PROD-FINISH — reliable hero on-screen measurement hook. Projects a node's
  // mounted artifact bounding box to NORMALIZED screen space (0..1, y-down to
  // match a screenshot) so the heroes verifier can confirm the product renders
  // WITHIN the frustum with real on-screen coverage — independent of camera fov
  // (which __PRISM_EDITOR_GET_NODE_WORLD_POS__ alone cannot give). Editor-shell
  // dev scope (NODE_ENV gate + window), FP-05 safe. Reads the group map the
  // AssembledSceneNode ref callback populates.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return;
    const w = window as unknown as {
      __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D>;
      __PRISM_EDITOR_GET_NODE_SCREEN_RECT__?: (nodeId: string) => {
        inFrustum: boolean;
        minX: number; minY: number; maxX: number; maxY: number;
        cx: number; cy: number; coverage: number;
      } | null;
    };
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    w.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__ = (nodeId: string) => {
      const group = w.__PRISM_EDITOR_NODE_GROUPS__?.get(nodeId);
      if (!group) return null;
      group.updateWorldMatrix(true, true);
      box.setFromObject(group, true);
      if (box.isEmpty()) return null;
      camera.updateMatrixWorld();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let anyInFront = false;
      const corners = [
        [box.min.x, box.min.y, box.min.z], [box.min.x, box.min.y, box.max.z],
        [box.min.x, box.max.y, box.min.z], [box.min.x, box.max.y, box.max.z],
        [box.max.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.max.z],
        [box.max.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.max.z],
      ];
      for (const [x, y, z] of corners) {
        v.set(x, y, z).project(camera);
        if (v.z < 1) anyInFront = true;
        const sx = (v.x * 0.5 + 0.5);
        const sy = (1 - (v.y * 0.5 + 0.5)); // y-down (screenshot space)
        minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
      }
      const clampedW = Math.max(0, Math.min(1, maxX) - Math.max(0, minX));
      const clampedH = Math.max(0, Math.min(1, maxY) - Math.max(0, minY));
      const coverage = clampedW * clampedH; // fraction of the viewport area
      const inFrustum =
        anyInFront && maxX > 0 && minX < 1 && maxY > 0 && minY < 1;
      return {
        inFrustum,
        minX, minY, maxX, maxY,
        cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
        coverage,
      };
    };
    return () => {
      delete w.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__;
    };
    // size is a dep so the hook recomputes against the current drawing buffer
    // aspect after a device-mode/viewport change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, size.width, size.height]);
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
    // APP-REALITY P7 — global elements (isGlobalElement, parentHubId '') are
    // opened as overlays, never placed in the graph; exclude them from the
    // galaxy/canvas-topology node spheres so they never render as a stray orphan.
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes.filter((n) => !n.isGlobalElement), edges: sourceEdges }),
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
  // UI-WOW-2 P4 — galaxy atmosphere quality: 'low' under adaptive low-quality
  // OR on a coarse-pointer device tier (t1/t0 = phones), so the additive
  // starfield/nebula/rings scale down where the frame budget is tight (INV-9).
  const galaxyQuality: 'low' | 'high' =
    qualityMode === 'low' ||
    (typeof document !== 'undefined' && document.documentElement.dataset.dsTier !== 't2')
      ? 'low'
      : 'high';

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

      {/* UI-WOW-2 P2 — galaxy atmosphere: additive starfield + nebula depth +
          glowing orrery rings. Standard-material additive geometry (self-blooms
          by accumulation) so it works under WebGPU where the legacy bloom
          composer + drei <Stars> are off. Galaxy-only; tier-scaled. */}
      {viewMode === 'galaxy' && <GalaxyHubBackdrop quality={galaxyQuality} />}

      {/* Lighting — photoreal with environment IBL + fills. PHASE3 (P3-3): named
          so the Atelier day/night reveal can dim them (restored on rig unmount). */}
      <ambientLight name="scene-amb" intensity={0.06} />
      <directionalLight name="scene-key" position={[120, 120, 100]} intensity={0.5} color={DS.ice200} castShadow={false} />
      <directionalLight name="scene-fill" position={[-100, -60, -100]} intensity={0.25} color={DS.metal100} />
      {/* PHASE1 (SC-V-A3) — the Atelier uses a real luxury-studio HDRI so the
          watch's metals + dial finishes throw crisp, angle-dependent specular
          as it orbits. Other hubs keep the cosmic night IBL. */}
      {activeHubId === 's6-atelier' ? (
        <Environment files="/prism-mock/orrery/assets/studio-hdri.png" environmentIntensity={1.0} />
      ) : (
        <Environment preset="night" environmentIntensity={0.55} />
      )}

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

// APP-REALITY P4 — full-viewport hub background ("the app surface").
//
// A camera-CENTERED gradient skybox sphere: because it surrounds the camera it
// fills the entire viewport on every device and aspect (desktop, mobile,
// constrained) — there is never a letterbox bar or an exposed scene edge, and
// resize/DPR/safe-area are handled for free (it is just geometry the renderer
// fills). It gives a subtle parallax as the canvas camera orbits, and a fixed
// designed atmosphere under the locked preview camera. Built from the hub's
// palette into a 2:1 equirect gradient (deep sky → warm brass horizon glow at
// eye level → dark ground), so the built composition reads as a premium app
// hero, not a 3D object floating in an editor void. `fog={false}` keeps the
// gradient pure; renderOrder -1 + depthWrite false keep it behind all content.
// PROD-FINISH Phase A — premium DARK nebula atmosphere. The prior build floored
// the corners to a flat blue-grey (#2b3550) vignette and blew the center bright
// with a strong brass key, so a dark pool plane over the bright center read as
// an OVAL on flat corners. This rebuild makes the WHOLE equirect one premium
// dark deep-space atmosphere — textured everywhere (nebula wisps + starfield +
// dither, so even pure-skybox corners carry depth and never read flat), dark in
// the corners (no bright halo), with only a MODERATE brass key behind content
// (no white-hot center to fight). Combines the DESIGN-REFERENCES toolkit's FBM /
// procedural-cloud + starfield techniques natively (no new dep; mirrors
// GalaxyAtmosphere.nebulaTexture). 2048×1024 + per-pixel dither + LinearFilter
// (no mipmaps) → no 8-bit banding.
const _hubSkyCache: Record<string, THREE.CanvasTexture> = {};
function buildHubSkyGradient(baseHex: string): THREE.CanvasTexture {
  const cacheKey = baseHex || DS.ink;
  if (_hubSkyCache[cacheKey]) return _hubSkyCache[cacheKey];
  const w = 2048;
  const h = 1024;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  // deterministic PRNG so the atmosphere is stable across builds (resume-safe).
  let seed = 0x9e3779b1 >>> 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  // 1. base vertical gradient — premium graphite/ink, DARK at every latitude so
  //    the corners (off-equator) never resolve to a flat light grey.
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#05070e'); // top pole (deep)
  base.addColorStop(0.42, '#0a0f19'); // upper sky
  base.addColorStop(0.54, '#0e1422'); // equator band (subtle lift behind content)
  base.addColorStop(0.72, '#080c15'); // lower sky
  base.addColorStop(1, baseHex && baseHex !== DS.ink ? baseHex : '#05080f'); // ground / hub tint
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // 2. nebula wisps — soft brass/ice clouds across the WHOLE canvas (incl. the
  //    off-equator bands that map to screen corners) so corners are textured,
  //    not flat. Screen-blended at low alpha; no purple (D2).
  ctx.globalCompositeOperation = 'screen';
  const tints = [DS.metal400, DS.metal600, DS.ice400, DS.ice500, DS.metal300];
  for (let i = 0; i < 78; i++) {
    const px = rnd() * w;
    const py = (0.08 + rnd() * 0.84) * h;
    const r = 90 + rnd() * 360;
    const a = 0.025 + rnd() * 0.06;
    const col = tints[(rnd() * tints.length) | 0];
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, dsAlpha(col, a));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // 3. MODERATE brass key glow behind content (equator center) — depth without a
  //    blown-out white core, so a content backdrop never needs a hard dark pool.
  const key = ctx.createRadialGradient(w * 0.5, h * 0.52, 0, w * 0.5, h * 0.52, w * 0.4);
  key.addColorStop(0, dsAlpha(DS.metal300, 0.30));
  key.addColorStop(0.4, dsAlpha(DS.metal500, 0.11));
  key.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, w, h);
  const ice = ctx.createRadialGradient(w * 0.27, h * 0.32, 0, w * 0.27, h * 0.32, w * 0.38);
  ice.addColorStop(0, dsAlpha(DS.ice400, 0.12));
  ice.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ice;
  ctx.fillRect(0, 0, w, h);
  // 4. gentle vignette (multiply) — corners a touch deeper, NOT floored to a
  //    flat plate; the starfield laid on top keeps them textured.
  ctx.globalCompositeOperation = 'multiply';
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.52, h * 0.22, w * 0.5, h * 0.52, w * 0.6);
  vig.addColorStop(0, '#ffffff');
  vig.addColorStop(0.64, '#cdd2dc');
  vig.addColorStop(1, '#8b93a4');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  // 5. starfield — two tiers laid on top of the vignette so corners stay
  //    textured (NOT a flat plate). A dense fine tier + a sparser BRIGHT/bigger
  //    tier whose stars span several texels so they survive the ~8× corner
  //    magnification on screen (fine sub-texel speckle alone gets filtered away).
  //    Brass/bone/ice, no purple. Each bright star gets a soft halo for depth.
  ctx.globalCompositeOperation = 'lighter';
  const starTints = [DS.textHi, DS.metal200, DS.ice200, DS.ice300, DS.metal100];
  for (let i = 0; i < 4200; i++) {
    const px = rnd() * w;
    const py = rnd() * h;
    const rad = rnd() * 1.3 + 0.35;
    const a = 0.16 + rnd() * 0.5;
    ctx.fillStyle = dsAlpha(starTints[(rnd() * starTints.length) | 0], a);
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 300; i++) {
    const px = rnd() * w;
    const py = rnd() * h;
    const rad = 1.3 + rnd() * 1.4;
    const a = 0.55 + rnd() * 0.4;
    const col = starTints[(rnd() * starTints.length) | 0];
    // small tight halo so the bright star reads as a crisp point, not a glow
    // blob that brightens a whole corner region (which would break uniformity).
    const halo = ctx.createRadialGradient(px, py, 0, px, py, rad * 1.8);
    halo.addColorStop(0, dsAlpha(col, a * 0.4));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(px - rad * 1.8, py - rad * 1.8, rad * 3.6, rad * 3.6);
    ctx.fillStyle = dsAlpha(col, a);
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // 6. LOW-FREQUENCY FBM atmospheric depth + per-pixel dither. The fine
  //    starfield/dither get filtered away at the heavy magnification of the
  //    widest viewport's corners (a star-free corner would otherwise render as a
  //    perfectly flat black plate). A continuous multi-octave value-noise field
  //    (DESIGN-REFERENCES FBM technique, native — no dep) guarantees EVERY
  //    region carries gentle dust/gas variation that survives magnification, so
  //    no corner is ever flat. Tiling bilinear value noise, 3 octaves.
  const mkNoise = (gw: number, gh: number) => {
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    return { gw, gh, g };
  };
  const sampleNoise = (ng: { gw: number; gh: number; g: Float32Array }, u: number, v: number) => {
    const { gw, gh, g } = ng;
    const x = u * gw - 0.5, y = v * gh - 0.5;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const ix0 = ((x0 % gw) + gw) % gw, ix1 = (ix0 + 1) % gw;
    const iy0 = ((y0 % gh) + gh) % gh, iy1 = (iy0 + 1) % gh;
    const a = g[iy0 * gw + ix0], b = g[iy0 * gw + ix1], c = g[iy1 * gw + ix0], e = g[iy1 * gw + ix1];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + e * sx) * sy;
  };
  const n1 = mkNoise(40, 22), n2 = mkNoise(96, 52), n3 = mkNoise(208, 110);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const fbm = sampleNoise(n1, u, v) * 0.55 + sampleNoise(n2, u, v) * 0.3 + sampleNoise(n3, u, v) * 0.15;
      const add = (fbm - 0.5) * 11 + (rnd() * 2 - 1) * 1.6; // low-freq depth + fine dither
      const i = (y * w + x) * 4;
      d[i] = Math.max(0, Math.min(255, d[i] + add));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + add));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + add));
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  _hubSkyCache[cacheKey] = tex;
  return tex;
}

// PROD-FINISH Phase A — smooth ANALYTIC radial feather (alpha) so the hub
// backdrop image / pool melts into the skybox atmosphere with NO banding and NO
// hard elliptical edge. The prior 256px 8-bit canvas-gradient quantized into
// visible stair-step bands when stretched across the plane. This is a high-res
// (1024²) per-pixel smoothstep falloff with a WIDE feather (fades from r≈0.36)
// + a small blue-ish dither on the alpha; LinearFilter + no mipmaps. Built once.
let _backdropFalloffTex: THREE.CanvasTexture | null = null;
function getBackdropFalloffTexture(): THREE.CanvasTexture {
  if (_backdropFalloffTex) return _backdropFalloffTex;
  const s = 1024;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(s, s);
  const d = img.data;
  let seed = 0x2545f491 >>> 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const cx = s / 2, cy = s / 2, R = s / 2;
  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (x - cx) / R, dy = (y - cy) / R;
      const r = Math.sqrt(dx * dx + dy * dy);
      // full opacity to r≈0.36, then a long smooth feather to 0 at r=1.
      let a = 1 - smooth(0.36, 1.0, r);
      a = a * a * (3 - 2 * a); // double-smooth → no perceptible boundary
      a = Math.max(0, Math.min(1, a + (rnd() * 2 - 1) * 0.012)); // dither (anti-band)
      const i = (y * s + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  _backdropFalloffTex = new THREE.CanvasTexture(cv);
  _backdropFalloffTex.colorSpace = THREE.SRGBColorSpace;
  _backdropFalloffTex.minFilter = THREE.LinearFilter;
  _backdropFalloffTex.magFilter = THREE.LinearFilter;
  _backdropFalloffTex.generateMipmaps = false;
  return _backdropFalloffTex;
}

function HubSceneBackground({ hub }: { hub?: PrismHub | null }) {
  const camera = useThree((s) => s.camera);
  const meshRef = useRef<THREE.Mesh>(null);
  const baseHex = hub?.layout?.backgroundColor || DS.ink;
  const tex = useMemo(() => buildHubSkyGradient(baseHex), [baseHex]);
  useEffect(() => () => tex.dispose(), [tex]);
  // Keep the skybox centred on the camera so its surface is never approached
  // (infinite-environment feel; always fills the frustum).
  useFrame(() => {
    if (meshRef.current) meshRef.current.position.copy(camera.position);
  });
  return (
    <mesh ref={meshRef} scale={480} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 64, 40]} />
      <meshBasicMaterial
        map={tex}
        side={THREE.BackSide}
        toneMapped={false}
        fog={false}
        depthWrite={false}
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
      // P6 capstone MUST-FIX (2026-06-11): load() alone is NOT enough —
      // createText() without a warmed factory returns the placeholder Group,
      // which left every legacy §13 textContent label (the demo hero headline
      // "Build worlds in seconds.") rendering as a blank slab in the editor.
      // The editor's scene runs under WebGPURenderer (the WebGL2 backend also
      // compiles the package's node material — P1 finding), so warming the
      // default factory is safe on every editor path.
      .then(() => ctx.fontAtlas.warmupDefaultFactory?.())
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

  // PROD-FINISH Phase B — PRELOAD every hub's hero GLB on mount so the product
  // hero appears immediately, not after a multi-second async load. The mesh
  // factory calls ctx.glbLoader.loadGLB(url) which is URL-keyed-cached; warming
  // that cache up front means navigating to a hub mounts the hero from cache
  // (next microtask) instead of leaving the first screen as empty atmosphere +
  // text for ~3s while a 2–4 MB GLB downloads. Reads ALL source nodes (every
  // hub) so hub→hub navigation is instant too. Cache-only warm — non-destructive
  // (INV-17), never touches the source graph.
  useEffect(() => {
    const ctx = getSharedNodeContext({ runPrimitives: false });
    const urls = Array.from(
      new Set(
        useGraphSourceStore
          .getState()
          .nodes.map((n) => n.meshUrl)
          .filter((u): u is string => !!u),
      ),
    );
    for (const url of urls) {
      ctx.glbLoader.loadGLB(url).catch(() => {
        /* poisoned-retry handled by the loader cache; a failed preload just
           falls back to the on-demand load when the node mounts. */
      });
    }
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
      {/* APP-REALITY P4 — full-viewport designed background (the app surface).
          THREE-D-BACKGROUNDS: when the hub carries a procedural volumetric-nebula
          background layer, that raymarched nebula OWNS the backdrop (it provides
          its own dark base + always fills the frustum), so the flat gradient
          skybox is suppressed to avoid a doubled/flattened sky. Legacy hubs (no
          nebula) keep the gradient skybox unchanged. */}
      {!hubSuppressesSkybox(hub) && <HubSceneBackground hub={hub} />}
      <HubBackgroundStack hub={hub} />
      <SceneBackdrop hub={hub} />
      <AssembledShadowCatcher />
      {/* RT-SC-10 / INV-R4 — authoring chrome only in canvas; preview-app is
          the running app (no frame, no gizmo). */}
      {!previewMode && (
        <>
          <CanvasViewportFrame breakpoint={hub?.responsiveBreakpoints?.desktop ?? null} />
          <CanvasTransformGizmo nodes={nodes} />
          <MarqueeSelectBridge />
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
        <Html center zIndexRange={[25, 0]}>
          <div className="px-3 py-2 rounded-md border border-white/10 bg-black/60 text-[10px] font-mono text-white/65">
            Warming renderer fonts
          </div>
        </Html>
      )}

      <AssembledSceneDiagnostics nodes={nodes} />
      {/* F5 ATELIER — applies configurator finish swaps to the proxy watch parts. */}
      <AtelierApplier previewMode={previewMode} />
      {/* F5.2 ATELIER — drag a catalog chip onto the matching part to apply it. */}
      <AtelierDragController previewMode={previewMode} />
      {/* PHASE1 ATELIER — watch turntable: drag/idle rotation + tilt for full
          any-angle inspect (SC-V-A4); specular sweep on the studio HDRI (A3).
          S3d: tagged at the mount HOST (not the rig file) so the node-authorship
          gate flags it as a known-hardcoded artifact pending its G1 greenlight. */}
      <group userData={{ prismHardcodedArtifact: 'configurator-watch' }}>
        <AtelierWatchRig previewMode={previewMode} />
      </group>
      {/* PHASE2 SIGNATURE (SC-V-O) — interactive 3D orrery complication on Celestia.
          S3d: known-hardcoded artifact tagged at the mount host (G2 greenlight). */}
      <group userData={{ prismHardcodedArtifact: 'orrery-complication' }}>
        <OrreryComplicationRig previewMode={previewMode} />
      </group>
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
  const placingClusterId = useGraphEditorStore((s) => s.placingClusterId);
  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const cloneDragActive = viewMode === 'galaxy' && draggingNodeId != null;
  // §13 criterion 21 — prebuilt-element drag-to-place. Mounts the placement
  // listener whenever a cluster is armed in galaxy mode (mutually exclusive
  // with clone-drag — both reuse the generic draggingPointerWorld slots).
  const placementActive = viewMode === 'galaxy' && placingClusterId != null;
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
      {placementActive && <ElementPlacementLayer hubs={sourceHubs} />}
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
  // INV-9 — record the device tier so the node factory gates true-3D extruded
  // text (T1+) vs a flat MSDF fallback (T0). Renderer-derived (backend ceiling)
  // + coarse-pointer mobile signal; failures leave it unset (factory → T1).
  try {
    const isMobile =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    setSharedNodeContextTier(detectCapabilityTier(renderer, { isMobile }).tier);
  } catch {
    /* tier stays unset → factory treats as T1 */
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

// THREE-D-BACKGROUNDS (C8 galaxy) — galaxy atmosphere, but when the ACTIVE hub
// carries a volumetric-nebula background the galaxy backdrop becomes that hub's
// nebula (env-only, planets render in front) so a chosen background renders in
// galaxy too; otherwise the default procedural GalaxyNebula. Starfield + orbit
// rings are unchanged either way.
function GalaxyHubBackdrop({ quality }: { quality: GalaxyQuality }) {
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const hubs = useGraphSourceStore((s) => s.hubs);
  const active = hubs.find((h) => h.hubId === activeHubId) ?? null;
  const hubHasNebula = !!active?.background?.some((l) => l.kind === 'volumetric-nebula');
  return (
    <>
      <GalaxyStarfield quality={quality} />
      {hubHasNebula ? <HubBackgroundStack hub={active} envOnly /> : <GalaxyNebula quality={quality} />}
      <GalaxyOrbitRings quality={quality} />
    </>
  );
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
            `radial-gradient(ellipse 70% 60% at 20% 20%, ${dsAlpha(DS.metal500, 0.12)} 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 80% 80%, ${dsAlpha(DS.ice500, 0.1)} 0%, transparent 55%), ${DS.void}`,
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
        {/* UI-FIDELITY-2 — rendered chrome: every registered DOM chrome
            surface draws as a real SDF slab (Fresnel bevels, live-scene
            refraction, pointer light) in this same unified canvas. */}
        <ChromeSlabLayer />
        {/* PHASE3 (P3-1) — TRUE in-WebGPU cinematic hub transition: a camera-
            parented brass curtain (renderOrder 9500, over scene + chrome) that
            closes → swaps → opens, replacing the Phase-2 DOM overlay. */}
        <HubSceneTransition />
      </Canvas>
    </div>
  );
}
