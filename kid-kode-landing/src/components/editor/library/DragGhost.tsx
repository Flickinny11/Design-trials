'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — DRAG-TO-CANVAS (spec §7.3 / INV-0.3).
//
// While a tile is being dragged (store.dragEntryId set), a translucent GHOST of the
// entry follows the pointer on the canvas plane (z=0) with a pulsing drop ring. On
// pointer-up: if the pointer travelled past a tap threshold AND landed in the canvas
// zone (right of the palette), the entry is INSTANTIATED there as a node (one action,
// Node Law); a tap-in-place defers to the tile's quick-add. Editor chrome.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';
import type { LabHub } from '@/components/editor/composite/composite-schema';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { PreviewContent } from './LibraryTile';
import { useLibraryStore } from './use-library-store';
import type { LibraryEntry } from './library-catalog';

const PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z = 0 drop plane
const CANVAS_MIN_X = -5.0; // right of the palette shelf → the canvas zone
const TAP_EPS = 0.6; // travel under this = a tap (tile quick-add), not a drag
const RING_MAT = new THREE.MeshBasicMaterial({ color: '#9fe9ff', toneMapped: false, transparent: true, opacity: 0.8 });

export function DragGhost({
  matSets,
  hubs,
  onCanvasDrop,
}: {
  matSets: Record<string, WornMaps>;
  hubs: LabHub[];
  /** ADDITIVE (editor-integration I-2): when provided, a valid drop on the
   *  canvas routes the entry HERE (the editor adds it to the REAL app graph)
   *  instead of the library-local store.instantiate. The lab passes nothing, so
   *  its in-canvas instantiate behavior is unchanged. */
  onCanvasDrop?: (entry: LibraryEntry, world: { x: number; y: number }) => void;
}) {
  const wornMaps = useWornMaps();
  const dragEntryId = useLibraryStore((s) => s.dragEntryId);
  const ghostRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const world = useRef(new THREE.Vector3());
  const { camera, pointer, raycaster, controls } = useThree();
  // keep the latest drop handler reachable from the once-bound pointerup effect.
  const dropRef = useRef(onCanvasDrop);
  dropRef.current = onCanvasDrop;

  const entry = useMemo(() => {
    if (!dragEntryId) return null;
    return useLibraryStore.getState().catalog().find((e) => e.id === dragEntryId) ?? null;
  }, [dragEntryId]);

  // freeze OrbitControls while a tile is being dragged (else the drag also rotates
  // the camera — the controls listen on the same DOM pointer stream).
  useEffect(() => {
    const c = controls as unknown as { enabled: boolean } | null;
    if (!c) return;
    c.enabled = !dragEntryId;
    return () => { c.enabled = true; };
  }, [dragEntryId, controls]);

  // global pointer-up: decide tap vs drop-on-canvas.
  useEffect(() => {
    const onUp = () => {
      const st = useLibraryStore.getState();
      if (!st.dragEntryId) return;
      const ent = st.catalog().find((e) => e.id === st.dragEntryId);
      const start = st.dragStart;
      const w = world.current;
      const moved = start ? Math.hypot(w.x - start.x, w.y - start.y) : 999;
      if (ent && moved > TAP_EPS && w.x > CANVAS_MIN_X) {
        if (dropRef.current) {
          // editor: instantiate into the REAL app graph, then clear the drag.
          dropRef.current(ent, { x: w.x, y: w.y });
          st.endDrag();
        } else {
          st.instantiate(ent, { x: w.x, y: w.y });
        }
      } else {
        st.endDrag();
      }
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, []);

  useFrame((state) => {
    if (!dragEntryId) return;
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(PLANE, world.current);
    if (ghostRef.current) {
      ghostRef.current.position.set(world.current.x, world.current.y, 0.5);
      ghostRef.current.rotation.y = state.clock.elapsedTime * 0.6;
    }
    if (ringRef.current) {
      ringRef.current.position.set(world.current.x, world.current.y, 0.2);
      const inZone = world.current.x > CANVAS_MIN_X;
      ringRef.current.scale.setScalar((inZone ? 1.1 : 0.7) + 0.08 * Math.sin(state.clock.elapsedTime * 6));
      (ringRef.current.material as THREE.MeshBasicMaterial).color.set(inZone ? '#9fe9ff' : '#7a8aa0');
    }
  });

  if (!dragEntryId || !entry) return null;
  return (
    <group>
      <mesh ref={ringRef} material={RING_MAT} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.85, 0.98, 40]} />
      </mesh>
      <group ref={ghostRef} scale={0.85}>
        <PreviewContent spec={entry.spec} wornMaps={wornMaps} matSets={matSets} hubs={hubs} />
        <CompositeText position={[0, -1.0, 0.2]} fontSize={0.16} letterSpacing={0.03} variant="bright">
          {entry.label.toUpperCase()}
        </CompositeText>
      </group>
    </group>
  );
}
