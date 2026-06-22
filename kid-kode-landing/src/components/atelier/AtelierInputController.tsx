'use client';
// ORRERY No.7 — Atelier watch INPUT controller (FIX2 / G1).
//
// The watch is now a graph node (codeRef 'builtin:atelier-watch',
// watch-node-factory.ts) that owns ALL rendering + animation + the turntable
// state. This slim editor-shell component owns only the part that is inherently
// DOM-coupled — translating a real canvas pointer-drag into turntable rotation —
// and forwards it through the node's window.__ATELIER_RIG__ handle. This mirrors
// the SceneDriverHost pattern (the canvas owns pointer input; nodes consume it).
//
// It is a faithful port of the former AtelierWatchRig pointer effect: same NDC
// raycast that skips drags begun on a catalog card / action button (so a tap
// configures rather than spins), same drag sensitivity. Mounts only in
// preview-app on s6-atelier (the interactive surface), like the old rig.
import { useEffect, useRef } from 'react';
import { Raycaster, Vector2, type Object3D } from 'three';
import { useThree } from '@react-three/fiber';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

const ATELIER_HUB_ID = 's6-atelier';

interface AtelierRigInput {
  dragStart: () => void;
  dragBy: (dxPx: number, dyPx: number) => void;
  dragEnd: () => void;
}
function rig(): AtelierRigInput | null {
  return (window as unknown as { __ATELIER_RIG__?: AtelierRigInput }).__ATELIER_RIG__ ?? null;
}

export function AtelierInputController({ previewMode }: { previewMode: boolean }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const draggingRef = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);

  const active = previewMode && activeHubId === ATELIER_HUB_ID;

  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    const ray = new Raycaster();
    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    // Raycast the scene; walk up to the nearest authoring nodeId. Used to skip a
    // drag that begins on a catalog card / action button (those should tap-to-
    // configure, not spin the watch).
    const nodeIdAt = (e: PointerEvent): string | null => {
      ray.setFromCamera(toNdc(e), camera);
      for (const h of ray.intersectObjects(scene.children, true)) {
        let o: Object3D | null = h.object;
        while (o) { const nid = (o.userData as { nodeId?: string } | undefined)?.nodeId; if (nid) return nid; o = o.parent; }
      }
      return null;
    };
    const onDown = (e: PointerEvent) => {
      const id = nodeIdAt(e);
      if (id && (id.startsWith('orr-atelier-cat-') || id.startsWith('orr-atelier-btn-'))) return;
      draggingRef.current = true;
      lastX.current = e.clientX; lastY.current = e.clientY;
      rig()?.dragStart();
    };
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastX.current; const dy = e.clientY - lastY.current;
      lastX.current = e.clientX; lastY.current = e.clientY;
      rig()?.dragBy(dx, dy);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      rig()?.dragEnd();
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (draggingRef.current) { draggingRef.current = false; rig()?.dragEnd(); }
    };
  }, [active, gl, camera, scene]);

  return null;
}
