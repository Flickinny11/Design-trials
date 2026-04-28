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
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useElementImageStore } from '@/stores/useElementImageStore';
import { useForceGraph, type SimNode, type SimLink } from '@/lib/useForceGraph';
import { generateNodeTexture } from '@/lib/nodeTexture';
import HubLabels from '@/components/editor/graph/HubLabels';

// Hub mockup texture cache — fetched once on demand, reused across hubs.
let HUB_MOCKUP_TEXTURE_PROMISE: Promise<THREE.CanvasTexture> | null = null;
function loadHubMockupTexture(): Promise<THREE.CanvasTexture> {
  if (HUB_MOCKUP_TEXTURE_PROMISE) return HUB_MOCKUP_TEXTURE_PROMISE;
  HUB_MOCKUP_TEXTURE_PROMISE = new Promise((resolve, reject) => {
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
    img.onerror = () => reject(new Error('failed to load scifi-mockup-v1.png'));
    img.src = '/prism-assets/scifi-mockup-v1.png';
  });
  return HUB_MOCKUP_TEXTURE_PROMISE;
}

// ═══════════════════════════════════════════════════════════════════
// Edge colors by type
// ═══════════════════════════════════════════════════════════════════
const EDGE_COLORS: Record<string, string> = {
  contains: '#b5bddf',
  'navigates-to': '#5ee0ff',
  triggers: '#ff9a44',
  'data-flow': '#55e6a5',
  'shares-state': '#a978ff',
  'depends-on': '#6b7694',
};

// ═══════════════════════════════════════════════════════════════════
// Edge line (updates positions per-frame from sim)
// ═══════════════════════════════════════════════════════════════════
function Edge({ link }: { link: SimLink }) {
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
  const opacity = link.type === 'contains' ? 0.28 : 0.62;

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
// GlassNode — the photoreal glass-sphere element
// Dual-mesh approach (per research):
//   inner opaque textured sphere shows the element image
//   outer thin-shell sphere is refractive glass with dispersion
// ═══════════════════════════════════════════════════════════════════
function GlassNode({
  node,
  hero,
  hubs,
}: {
  node: SimNode;
  hero: boolean; // use expensive MeshTransmissionMaterial for 1-2 heroes
  hubs: EditorHubView[];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const hoveredId = useGraphEditorStore((s) => s.hoveredNodeId);
  const livePreviewHoverId = useGraphEditorStore((s) => s.livePreviewHoverId);
  const frozen = useGraphEditorStore((s) => s.frozenNodeIds.has(node.id));
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  const hoverNode = useGraphEditorStore((s) => s.hoverNode);
  const openInspector = useGraphEditorStore((s) => s.openInspector);

  const isSelected = selectedId === node.id;
  const isHovered = hoveredId === node.id || livePreviewHoverId === node.id;

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
      onPointerOver={(e) => {
        e.stopPropagation();
        hoverNode(node.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        hoverNode(null);
        document.body.style.cursor = 'default';
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectNode(node.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        selectNode(node.id);
        openInspector();
      }}
    >
      {/* INNER: textured element sphere */}
      <mesh ref={innerRef} castShadow receiveShadow>
        <sphereGeometry args={[radius, 72, 72]} />
        <meshPhysicalMaterial
          map={texture}
          metalness={0.35}
          roughness={0.28}
          clearcoat={0.65}
          clearcoatRoughness={0.18}
          emissive={frozen ? new THREE.Color('#8bb4ff') : new THREE.Color(hubColor)}
          emissiveIntensity={frozen ? 0.22 : node.status === 'failed' ? 0.4 : 0.08}
          emissiveMap={texture}
        />
      </mesh>

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
            transmission={0.95}
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
            opacity={0.52}
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
function HubHulls({
  hubs,
  hubCenters,
  simNodes,
}: {
  hubs: EditorHubView[];
  hubCenters: Record<string, any>;
  simNodes: SimNode[];
}) {
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const selectedHubId = useGraphEditorStore((s) => s.selectedHubId);
  const selectHub = useGraphEditorStore((s) => s.selectHub);

  // Hub mockup texture (CanvasTexture from /prism-assets/scifi-mockup-v1.png)
  // — wrapped onto the inner sphere of every hub.
  const [mockupTexture, setMockupTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadHubMockupTexture().then((tex) => {
      if (!cancelled) setMockupTexture(tex);
    }).catch(() => {
      // Texture optional — hub renders without if asset missing.
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {hubs.map((hub) => {
        const center = hubCenters[hub.id];
        if (!center) return null;

        const hubNodes = simNodes.filter((n) => n.hubIds.includes(hub.id));
        if (!hubNodes.length) return null;

        let maxDist = 20;
        hubNodes.forEach((n) => {
          const d = Math.sqrt(
            (n.x - center.x) ** 2 + (n.y - center.y) ** 2 + (n.z - center.z) ** 2
          );
          if (d > maxDist) maxDist = d;
        });
        const radius = maxDist + 10;
        // Inner mockup-textured sphere is capped well below the node cloud's
        // outer reach so element-spheres orbit *outside* the opaque hub
        // surface and stay visible. The outer translucent hull (`radius`)
        // still wraps the full constellation.
        const innerRadius = Math.min(radius * 0.45, 32);
        const isActive = activeHubId === hub.id || selectedHubId === hub.id;

        return (
          <group
            key={hub.id}
            position={[center.x, center.y, center.z]}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'default';
            }}
            onClick={(e) => {
              e.stopPropagation();
              selectHub(hub.id);
            }}
          >
            {/* Inner mockup sphere — wraps scifi-mockup-v1.png as CanvasTexture
                with MeshPhysicalMaterial (transmission/clearcoat/ior layered
                vocabulary). */}
            {mockupTexture && (
              <mesh>
                <sphereGeometry args={[innerRadius, 64, 64]} />
                <meshPhysicalMaterial
                  map={mockupTexture}
                  emissiveMap={mockupTexture}
                  emissive={new THREE.Color(hub.color)}
                  emissiveIntensity={isActive ? 0.32 : 0.18}
                  metalness={0.1}
                  roughness={0.3}
                  clearcoat={0.6}
                  clearcoatRoughness={0.1}
                  transmission={0.4}
                  thickness={0.5}
                  ior={1.6}
                  transparent
                  opacity={0.85}
                />
              </mesh>
            )}
            <mesh>
              <sphereGeometry args={[radius, 32, 32]} />
              <meshBasicMaterial
                color={hub.color}
                transparent
                opacity={isActive ? 0.085 : 0.035}
                side={THREE.BackSide}
                toneMapped={false}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[radius, 24, 24]} />
              <meshBasicMaterial
                color={hub.color}
                transparent
                opacity={isActive ? 0.05 : 0.022}
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
                opacity={isActive ? 0.32 : 0.18}
                side={THREE.DoubleSide}
                toneMapped={false}
              />
            </mesh>
            {/* Hub-center soft light — modestly brighter than pre-Phase-4 to
                give the mockup sphere a noticeable glow. */}
            <pointLight
              color={hub.color}
              intensity={isActive ? 2.4 : 1.0}
              distance={radius * 3}
              decay={1.6}
            />
          </group>
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
            style={{ pointerEvents: 'none' }}
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
              {tier >= 2 && (
                <div
                  className="flex items-center gap-1.5 justify-center font-mono mt-0.5"
                  style={{ fontSize: 9, color: '#b5bddf' }}
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
              {tier >= 3 && (
                <div
                  className="font-mono mt-0.5 text-center"
                  style={{ fontSize: 9, color: statusColor }}
                >
                  score {node.verificationScore.toFixed(2)}
                </div>
              )}
              {tier >= 4 && (
                <div
                  className="mt-1 max-w-[200px] mx-auto text-[10px] text-center leading-snug"
                  style={{ color: '#c5ccea', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
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
    const camX = center.x + 50;
    const camY = center.y + 30;
    const camZ = center.z + 90;
    c.setLookAt(camX, camY, camZ, center.x, center.y, center.z, true).then(() => {
      clearFlyTarget();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToHubId]);

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

// ═══════════════════════════════════════════════════════════════════
// Scene content
// ═══════════════════════════════════════════════════════════════════
function SceneContent({
  onPerf,
}: {
  onPerf: (factor: number) => void;
}) {
  const pinnedPositions = useGraphEditorStore((s) => s.pinnedPositions);
  const resetSignal = useGraphEditorStore((s) => s.resetCameraSignal);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const qualityMode = useGraphEditorStore((s) => s.qualityMode);

  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const editorGraph = useMemo<EditorGraph>(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );

  const { simNodes, simLinks, hubCenters } = useForceGraph(
    editorGraph.nodes,
    editorGraph.edges,
    editorGraph.hubs,
    pinnedPositions,
    resetSignal
  );

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

      <HubHulls hubs={editorGraph.hubs} hubCenters={hubCenters} simNodes={simNodes} />

      {simLinks.map((link) => (
        <Edge key={link.id} link={link} />
      ))}
      {simLinks.slice(0, 20).map((link) => (
        <EdgeParticle key={'p-' + link.id} link={link} />
      ))}

      {simNodes.map((node) => (
        <GlassNode key={node.id} node={node} hero={heroIds.has(node.id)} hubs={editorGraph.hubs} />
      ))}

      <NodeLabels simNodes={simNodes} />
      <HubLabels hubs={editorGraph.hubs} hubCenters={hubCenters} />
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
// Canvas wrapper
// ═══════════════════════════════════════════════════════════════════
export default function GraphScene() {
  const [dpr, setDpr] = useState<[number, number]>([1, 2]);

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
        dpr={dpr}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        camera={{ position: [0, 0, 320], fov: 50, near: 0.1, far: 2000 }}
      >
        <fog attach="fog" args={['#05060a', 300, 900]} />
        <Suspense fallback={null}>
          <SceneContent onPerf={(factor) => setDpr([1, factor])} />
        </Suspense>
      </Canvas>
    </div>
  );
}
