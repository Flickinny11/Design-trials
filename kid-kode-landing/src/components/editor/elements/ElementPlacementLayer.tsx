'use client';

// ElementPlacementLayer — drag-to-place for prebuilt clusters (§13, criterion
// 21). The cluster-library sibling of GraphScene's GalaxyCloneDragLayer.
//
// Mounted by SceneContent when `viewMode === 'galaxy'` AND
// `placingClusterId != null` (ClusterTile's pointerdown → browser →
// setPlacingCluster + setViewMode('galaxy') arms both). Owns:
//
//   1. A `pointermove` listener on the WebGL canvas: raycast the cursor into
//      world space (sample at a fixed forward distance so it follows pointer
//      motion through the galaxy rings), push the world point + the resolved
//      nearest-hub id through the editor-store setters (FP-11: never direct-
//      mutate — uses setDraggingPointerWorld / setDraggingNearestHub).
//   2. A transient `<line>` tether from cursor-world → nearest-hub center
//      (brass, design-tokens only) + a small ghost marker at the cursor.
//   3. A `pointerup` commit: resolve the target hub (nearest if the drag
//      produced one, else the active hub, else the first hub), build the
//      cluster's addNode inputs via `buildClusterNodeInputs`, land them with
//      `addNodesBatch` (every member tethered to the hub + a shared groupId
//      for ≥2 members — criterion 21), select the first placed node, and clear
//      placement.
//
// CLICK-TO-PLACE FALLBACK (criterion 21 via at least the click path): a tile
// pointerdown that releases without any pointermove still fires `pointerup`
// here. We resolve the hub from the active hub (or first hub) when the drag
// never set a nearest hub, so a plain click on a tile reliably places the
// cluster into the current hub and the placement completes.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { computeCloneDragTether } from '@/lib/editor/clone-drag-tether';
import { getHubWorldPositions } from '@/lib/prism-graph/hub-geometry';
import { getElement } from '@/lib/editor/elements/registry';
import { buildClusterNodeInputs } from '@/lib/editor/elements/instantiate';
import { DS } from '@/components/editor/design-system';
import type { PrismHub } from '@/lib/prism-graph/types';

const TETHER_COLOR = DS.brass300;
const SAMPLE_DISTANCE = 150;

export default function ElementPlacementLayer({
  hubs,
}: {
  hubs: ReadonlyArray<PrismHub>;
}) {
  const { camera, gl } = useThree();
  const setDraggingPointerWorld = useGraphEditorStore((s) => s.setDraggingPointerWorld);
  const setDraggingNearestHub = useGraphEditorStore((s) => s.setDraggingNearestHub);
  const draggingPointerWorld = useGraphEditorStore((s) => s.draggingPointerWorld);
  const draggingNearestHubId = useGraphEditorStore((s) => s.draggingNearestHubId);

  const raycasterRef = useRef(new THREE.Raycaster());
  const ndcRef = useRef(new THREE.Vector2());
  const pointRef = useRef(new THREE.Vector3());
  const lineRef = useRef<THREE.Line | null>(null);
  const ghostRef = useRef<THREE.Mesh | null>(null);

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

      const tether = computeCloneDragTether(pointRef.current, hubs as PrismHub[]);
      setDraggingPointerWorld(tether.tetherStart);
      setDraggingNearestHub(tether.nearestHubId);
    };

    // Pointer-up commits the cluster. Read the store imperatively (the listener
    // runs from a fresh event tick after the last pointermove write).
    const handleUp = () => {
      const ed = useGraphEditorStore.getState();
      const clusterId = ed.placingClusterId;
      if (!clusterId) return;

      const def = getElement(clusterId);
      if (!def) {
        ed.clearPlacement();
        return;
      }

      // Resolve the target hub: nearest from the drag, else the active hub,
      // else the first hub (the click-to-place fallback path).
      const hubId =
        ed.draggingNearestHubId ??
        ed.activeHubId ??
        (hubs.length > 0 ? hubs[0].hubId : null);
      if (!hubId) {
        ed.clearPlacement();
        return;
      }

      // Anchor: a sensible default in front of the hub (cluster origin = the
      // hub's scene origin). Members carry their own local poses; the anchor
      // only translates the whole cluster.
      const ids = useGraphSourceStore
        .getState()
        .addNodesBatch(buildClusterNodeInputs(def, hubId, { x: 0, y: 0, z: 0 }));
      if (ids.length > 0) ed.selectNode(ids[0]);
      ed.clearPlacement();
    };

    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerup', handleUp);
    return () => {
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerup', handleUp);
    };
  }, [gl, camera, hubs, setDraggingPointerWorld, setDraggingNearestHub]);

  const hubPositions = useMemo(
    () => getHubWorldPositions(hubs as PrismHub[]),
    [hubs],
  );

  useFrame(() => {
    if (!draggingPointerWorld) return;
    if (ghostRef.current) {
      ghostRef.current.position.set(
        draggingPointerWorld.x,
        draggingPointerWorld.y,
        draggingPointerWorld.z,
      );
    }
    if (!lineRef.current || !draggingNearestHubId) return;
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

  // No visuals until the first pointermove populates the slots (a pure click
  // still commits on pointerup via the active-hub fallback above).
  if (!draggingPointerWorld) return null;

  return (
    <>
      {/* Ghost hint — a small brass marker that rides the cursor in galaxy. */}
      <mesh ref={ghostRef as React.RefObject<THREE.Mesh>} data-component="element-placement-ghost">
        <sphereGeometry args={[3, 16, 12]} />
        <meshBasicMaterial color={TETHER_COLOR} transparent opacity={0.65} toneMapped={false} />
      </mesh>
      {/* Transient tether to the snap-target hub. */}
      {draggingNearestHubId && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <line ref={lineRef as any} data-component="element-placement-tether">
          <bufferGeometry />
          <lineBasicMaterial color={TETHER_COLOR} transparent opacity={0.85} toneMapped={false} />
        </line>
      )}
    </>
  );
}
