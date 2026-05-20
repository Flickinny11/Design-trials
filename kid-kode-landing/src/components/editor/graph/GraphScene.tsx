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

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView, type EditorGraph, type EditorHubView } from '@/lib/prism-graph/view-model';
import { useGraphEditorStore, type ViewMode } from '@/stores/useGraphEditorStore';
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
  restorePriorCanvasTransform,
  type CanvasTransform,
  type GizmoMode,
} from '@/lib/editor/canvas-transform-gizmo';
import { getSharedNodeContext } from '@/lib/prism/runtime/shared-context';
import type { PrismHub, PrismNode } from '@/lib/prism-graph/types';
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
      ctx.fillStyle = '#0a0d18';
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
  contains: 'rgba(93, 139, 255, 0.45)',
  'navigates-to': '#5ee0ff',
  triggers: 'rgba(85, 230, 165, 0.45)',
  'data-flow': 'rgba(85, 230, 165, 0.45)',
  'shares-state': '#a978ff',
  'depends-on': '#6b7694',
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

  const color = EDGE_COLORS[link.type] || '#ffffff';
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

  const color = EDGE_COLORS[link.type] || '#ffffff';

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
        const color = EDGE_COLORS[tether.type] || '#ffffff';
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

  const isSelected = selectedId === node.id;
  const isHovered = hoveredId === node.id || livePreviewHoverId === node.id;

  // Plan §P10: when the underlying PrismNode carries artifact data
  // (sourceAsset URL OR meshUrl OR codeRef) the editor renders the real
  // factory output via ArtifactNode. Stage-0 / intent-only nodes still
  // render as the existing glass sphere so they remain selectable.
  const renderArtifact = sourceNode ? hasArtifactData(sourceNode) : false;

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
    return h?.color || '#5d8bff';
  }, [hubs, node.hubIds]);

  const statusColor =
    node.status === 'verified' ? '#22c55e' :
    node.status === 'failed' ? '#ef4466' :
    node.status === 'code_generated' ? '#5d8bff' :
    node.status === 'image_ready' ? '#f5a524' : '#6b7694';

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
            emissive={frozen ? new THREE.Color('#8bb4ff') : new THREE.Color(hubColor)}
            emissiveIntensity={(frozen ? 0.22 : node.status === 'failed' ? 0.4 : 0.08) * dimFactor}
            emissiveMap={texture}
          />
        </mesh>
      )}

      {/* OUTER GLASS SHELL — photoreal refraction. Heros use expensive transmission material, rest use native dispersion */}
      {hero ? (
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
            color={frozen ? '#a5c8ff' : '#ffffff'}
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
            color={'#ffffff'}
          />
        </mesh>
      )}

      {/* SELECTION / HOVER RING */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 1.3, radius * 1.38, 80]} />
        <meshBasicMaterial
          color={isSelected ? '#ffd966' : '#5ee0ff'}
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
          <meshBasicMaterial color={'#5d8bff'} toneMapped={false} />
        </mesh>
      )}
      {node.hasAnimation && (
        <mesh position={[-radius * 0.85, radius * 0.85, 0]}>
          <sphereGeometry args={[0.58, 12, 12]} />
          <meshBasicMaterial color={'#a978ff'} toneMapped={false} />
        </mesh>
      )}

      {/* Frozen crystal overlay */}
      {frozen && (
        <mesh scale={1.22}>
          <icosahedronGeometry args={[radius, 1]} />
          <meshStandardMaterial
            color={'#8bb4ff'}
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
            emissive={new THREE.Color(hub.color)}
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
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={hub.color}
          transparent
          opacity={(isActive ? 0.085 : 0.035) * dimFactor}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial
          color={hub.color}
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
          color={hub.color}
          transparent
          opacity={(isActive ? 0.32 : 0.18) * dimFactor}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* Hub-center soft light — modestly brighter than pre-Phase-4 to
          give the mockup sphere a noticeable glow. */}
      <pointLight
        color={hub.color}
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
          color="#ffd966"
          emissive={new THREE.Color('#ffb24a')}
          emissiveIntensity={1.6}
          roughness={0.32}
          metalness={0.0}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 1.18, radius * 1.32, 96]} />
        <meshBasicMaterial
          color={isSelected ? '#fff1a8' : '#ffd966'}
          transparent
          opacity={isSelected ? 0.85 : 0.55}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <pointLight color="#ffd966" intensity={3.2} distance={260} decay={1.8} />
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
          node.status === 'verified' ? '#22c55e' :
          node.status === 'failed' ? '#ef4466' :
          node.status === 'code_generated' ? '#5d8bff' :
          node.status === 'image_ready' ? '#f5a524' : '#6b7694';

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
                    color: isSelected ? '#ffd966' : '#e8eaf5',
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
                  style={{ fontSize: 9, color: '#b5bddf', opacity: subNodeDetailOpacity }}
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
                  {node.hasBackend && <span style={{ color: '#5d8bff' }}>BE</span>}
                  {node.hasAnimation && <span style={{ color: '#a978ff' }}>○</span>}
                  {frozen && <span style={{ color: '#8bb4ff' }}>❄</span>}
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
                  style={{ color: '#c5ccea', textShadow: '0 1px 3px rgba(0,0,0,0.9)', opacity: subNodeDetailOpacity }}
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
      <meshBasicMaterial map={texture ?? undefined} color={texture ? '#ffffff' : '#07101f'} transparent opacity={1} toneMapped={false} />
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
        color: '#8bb4ff',
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
        color: '#a9c4ff',
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
          color="#5d8bff"
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
  const updateNode = useGraphSourceStore((s) => s.updateNode);
  // State-backed ref so the drei gizmo attaches deterministically on the
  // first render (a plain useRef holds null on the initial render and would
  // skip the gizmo mount until some unrelated state change re-rendered).
  const [proxy, setProxy] = useState<THREE.Group | null>(null);
  const priorCanvasTransform = useRef<CanvasTransform | null>(null);
  // EBR2-C-03 / §R2-C INV-25 — the anchor group is positioned at the
  // composed sp+ct world, and the proxy sits at identity local so
  // TransformControls computes drag deltas from a stable origin. We capture
  // the drag-start ct on onMouseDown so onObjectChange can write back
  // `new ct = start + proxy delta` without growing cumulative offset.
  const dragStartCT = useRef<CanvasTransform | null>(null);
  const isDraggingRef = useRef(false);
  const [mode, setMode] = useState<GizmoMode>('translate');

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
  const persistedCT = node?.canvasTransform;

  // EBR2-C-03 / §R2-C INV-25 — the parent anchor group already composes
  // scenePosition + canvasTransform into its world position (see return
  // below). The proxy stays at its parent's local origin so TransformControls
  // attaches at the composed sp+ct world. Each store update re-renders the
  // anchor at the new sp+ct and we reset the proxy back to identity so the
  // next drag frame computes deltas from a stable baseline.
  useEffect(() => {
    if (!proxy || !node) return;
    proxy.position.set(0, 0, 0);
    proxy.rotation.set(0, 0, 0);
    proxy.scale.set(1, 1, 1);
  }, [proxy, nodeId, persistedCT, node]);

  // Capture the prior snapshot on selection so Escape can roll back. Reset
  // when the selection clears, the user switches out of canvas mode, or the
  // user leaves edit mode (EBR2-C-02 / SC-068 — the snapshot should not
  // outlive an edit session).
  useEffect(() => {
    if (!isCanvasMode || !isEditMode || !node) {
      priorCanvasTransform.current = null;
      return;
    }
    priorCanvasTransform.current = readCanvasTransform(node);
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
        const prior = priorCanvasTransform.current;
        if (prior) {
          const restored = restorePriorCanvasTransform(prior);
          updateNode(captured.nodeId, { canvasTransform: restored });
        }
        return;
      }
      if (isEditableTarget(e.target)) return;
      const next = gizmoModeForKey(e.key);
      if (next) setMode(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCanvasMode, isEditMode, nodeId, updateNode, node]);

  if (!isCanvasMode || !isEditMode || !node) return null;

  const sp = node.scenePosition ?? { x: 0, y: 0, z: 0 };
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
            // EBR2-C-03 — capture ct at drag start so onObjectChange can
            // write back start + delta. Cleared on mouseUp.
            dragStartCT.current = readCanvasTransform(node);
          }}
          onMouseUp={() => {
            isDraggingRef.current = false;
            dragStartCT.current = null;
          }}
          onObjectChange={() => {
            // EBR2-C-03 — proxy local pose is the drag delta from its
            // anchor origin (identity at drag start). The new ct is the
            // captured drag-start ct composed with the proxy delta:
            // position is additive (drag offset adds to ct), rotation is
            // Euler-additive (TransformControls writes incremental rotation
            // from identity), scale is multiplicative (TransformControls
            // writes proxy.scale = startScale(=1) * factor so we multiply).
            const start = dragStartCT.current ?? readCanvasTransform(node);
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
            updateNode(node.nodeId, { canvasTransform: next });
          }}
        />
      ) : null}
    </group>
  );
}

function AssembledSceneNode({ node }: { node: PrismNode }) {
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const hoveredId = useGraphEditorStore((s) => s.hoveredNodeId);
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  const hoverNode = useGraphEditorStore((s) => s.hoverNode);
  const openInspector = useGraphEditorStore((s) => s.openInspector);
  const isSelected = selectedId === node.nodeId;
  const isHovered = hoveredId === node.nodeId;
  // EBR2-E-02 / §R2-E SC-072 — renderer reads source ⊕ preview overlay so
  // Inspector tab edits show up live before "Save" commits to source. The
  // selector returns the patch for this specific node (or null), so the
  // component re-renders only when this node's preview buffer changes.
  const previewPatch = usePreviewStateStore((s) => s.patches[node.nodeId] ?? null);
  const composedNode = composeNodeWithPreview(node, previewPatch);
  const sp = composedNode.scenePosition ?? { x: 0, y: 0, z: 0 };
  // EBR2-C-03 / §R2-C SC-069/SC-070 + INV-25 — the renderer is the only
  // consumer of scenePosition + canvasTransform for visible node placement.
  // Compose them here so the artifact, selection ring, and the gizmo anchor
  // (CanvasTransformGizmo, rendered as a sibling) all land at the same
  // world pose. Dragging a transform handle in canvas mode writes through
  // updateNode({ canvasTransform }); this read picks the new ct up on the
  // next render frame and the artifact visibly follows.
  const ct = readCanvasTransform(composedNode);
  const w = composedNode.visual?.transform?.width ?? 0.35;
  const h = composedNode.visual?.transform?.height ?? 0.35;
  const ringSize = Math.max(w, h, 0.25) * 0.62;

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
      rotation={[ct.rotationX, ct.rotationY, ct.rotationZ]}
      scale={[ct.scaleX, ct.scaleY, ct.scaleZ]}
      onClick={(e) => {
        e.stopPropagation();
        selectNode(node.nodeId);
        openInspector();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        hoverNode(node.nodeId);
      }}
      onPointerOut={() => hoverNode(null)}
    >
      <ArtifactNode node={node} layout="scene" />
      {(isSelected || isHovered) && (
        <mesh position={[0, 0, 0.08]}>
          <ringGeometry args={[ringSize, ringSize + 0.035, 64]} />
          <meshBasicMaterial color={isSelected ? '#8bb4ff' : '#55e6a5'} transparent opacity={0.85} toneMapped={false} />
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

  const usePost = qualityMode !== 'low';

  return (
    <>
      <Stars radius={800} depth={500} count={5000} factor={4} saturation={0.5} fade speed={0.3} />

      {/* Lighting — photoreal with environment IBL + fills */}
      <ambientLight intensity={0.06} />
      <directionalLight position={[120, 120, 100]} intensity={0.5} color="#e0edff" castShadow={false} />
      <directionalLight position={[-100, -60, -100]} intensity={0.25} color="#ffdbb8" />
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

function AssembledSceneContent({
  onPerf,
}: {
  onPerf: (factor: number) => void;
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
  const usePost = qualityMode !== 'low';

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
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 8]} intensity={0.8} color="#e0edff" castShadow={false} />
      <directionalLight position={[-4, -2, 5]} intensity={0.25} color="#ffdbb8" />
      <SceneBackdrop hub={hub} />
      <CanvasViewportFrame breakpoint={hub?.responsiveBreakpoints?.desktop ?? null} />
      <CanvasTransformGizmo nodes={nodes} />
      <KeyframeDemo />

      {fontReady ? (
        nodes.map((node) => (
          <AssembledSceneNode
            key={node.nodeId + ':' + (nodeRebuildVersion[node.nodeId] ?? 0)}
            node={node}
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

function SceneContent({
  onPerf,
}: {
  onPerf: (factor: number) => void;
}) {
  const editorRenderMode = useGraphEditorStore((s) => s.editorRenderMode);
  return editorRenderMode === 'scene'
    ? <AssembledSceneContent onPerf={onPerf} />
    : <TopologySceneContent onPerf={onPerf} />;
}

// ═══════════════════════════════════════════════════════════════════
// Canvas wrapper
// ═══════════════════════════════════════════════════════════════════
export default function GraphScene() {
  const [dpr, setDpr] = useState<[number, number]>([1, 2]);
  const editorRenderMode = useGraphEditorStore((s) => s.editorRenderMode);
  const camera = editorRenderMode === 'scene'
    ? { position: [0, 0, 10] as [number, number, number], fov: 45, near: 0.1, far: 2000 }
    : { position: [0, 0, 320] as [number, number, number], fov: 50, near: 0.1, far: 2000 };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Ambient nebula backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 20% 20%, rgba(93,139,255,0.12) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(169,120,255,0.1) 0%, transparent 55%), #04050a',
        }}
      />
      <Canvas
        key={editorRenderMode}
        dpr={dpr}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        camera={camera}
      >
        <fog attach="fog" args={['#05060a', 300, 900]} />
        <Suspense fallback={null}>
          <SceneContent onPerf={(factor) => setDpr([1, factor])} />
        </Suspense>
      </Canvas>
    </div>
  );
}
