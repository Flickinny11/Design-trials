'use client';
// ORRERY No.7 — Atelier drag-drop controller (F5.2).
// Pick up a catalog swatch and drag it onto the watch: a ghost chip follows the
// pointer, the matching part "socket" validates (ghost turns green), and a drop
// over the right part applies that finish with a snap. R3F's click semantics
// (down+up on the SAME object) naturally separate a tap (which the existing
// configure binding handles) from a drag (handled here) — no double-apply.
// Spec §3.2 B. Rapier magnetic-settle is layered on in F5.2b.
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  Color,
  Vector2,
  Vector3,
  Plane,
  Raycaster,
  type Object3D,
} from 'three';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useConfiguratorStore } from '@/stores/useConfiguratorStore';
import { LAYERS_BY_ID, type AtelierLayerId } from '@/lib/prism/atelier/config';

const ATELIER_HUB_ID = 's6-atelier';
const DRAG_THRESHOLD = 6; // px before a press becomes a drag
const VALID = new Color('#1ec8ff');
const NEUTRAL = new Color('#e8c98a');

interface DragState {
  layer: AtelierLayerId;
  variant: string;
  swatchColor: string;
  targetNodeId: string | null;
  startX: number;
  startY: number;
  active: boolean;
  overValid: boolean;
  ghost: Mesh | null;
}

function nodeIdAt(root: Object3D, ray: Raycaster, ndc: Vector2, cam: Parameters<Raycaster['setFromCamera']>[1]): string | null {
  ray.setFromCamera(ndc, cam);
  const hits = ray.intersectObjects(root.children, true);
  for (const h of hits) {
    let o: Object3D | null = h.object;
    while (o) {
      const nid = (o.userData as { nodeId?: string } | undefined)?.nodeId;
      if (nid) return nid;
      o = o.parent;
    }
  }
  return null;
}

export function AtelierDragController({ previewMode }: { previewMode: boolean }) {
  const { gl, camera, scene, size } = useThree();
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const drag = useRef<DragState | null>(null);
  const ray = useRef(new Raycaster());
  const plane = useRef(new Plane(new Vector3(0, 0, 1), -0.5)); // z≈0.5 (watch face)

  useEffect(() => {
    if (!previewMode || activeHubId !== ATELIER_HUB_ID) return;
    const el = gl.domElement;

    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const planePoint = (ndc: Vector2) => {
      ray.current.setFromCamera(ndc, camera);
      const out = new Vector3();
      ray.current.ray.intersectPlane(plane.current, out);
      return out;
    };

    const onDown = (e: PointerEvent) => {
      const id = nodeIdAt(scene, ray.current, toNdc(e), camera);
      if (!id || !id.startsWith('orr-atelier-cat-')) return;
      const node = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id);
      const fb = node?.functionBinding;
      if (!fb || fb.kind !== 'configure') return;
      const layer = fb.layer as AtelierLayerId;
      const target = LAYERS_BY_ID[layer]?.nodeIds[0] ?? null;
      const swatchColor =
        (node?.materialSpec?.baseColor as string | undefined) ?? '#e8c98a';
      drag.current = {
        layer, variant: fb.variant, swatchColor, targetNodeId: target,
        startX: e.clientX, startY: e.clientY, active: false, overValid: false, ghost: null,
      };
    };

    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const ndc = toNdc(e);
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
        // promote to active drag — spawn the ghost
        const g = new Mesh(
          new BoxGeometry(0.34, 0.34, 0.34),
          new MeshStandardMaterial({ color: new Color(d.swatchColor), emissive: NEUTRAL.clone(), emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.3 }),
        );
        g.raycast = () => {}; // ghost never blocks socket raycasts
        g.renderOrder = 50;
        scene.add(g);
        d.ghost = g;
        d.active = true;
      }
      if (d.ghost) d.ghost.position.copy(planePoint(ndc));
      // Valid drop = over the watch assembly. The chip carries its own layer, so
      // the whole watch is the socket for a finish (parts overlap in screen space
      // — a case finish dropped at centre lands on the dial mesh but still means
      // "apply to the watch"). Precise per-socket snapping is for F5.3 assembly.
      const overId = nodeIdAt(scene, ray.current, ndc, camera);
      d.overValid = !!overId && overId.startsWith('orr-atelier-watch-');
      if (d.ghost) {
        const mat = d.ghost.material as MeshStandardMaterial;
        mat.emissive.copy(d.overValid ? VALID : NEUTRAL);
        mat.emissiveIntensity = d.overValid ? 0.9 : 0.35;
      }
    };

    const finish = () => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      if (d.active && d.overValid) {
        useConfiguratorStore.getState().setLayer(d.layer, d.variant);
      }
      if (d.ghost) {
        scene.remove(d.ghost);
        d.ghost.geometry.dispose();
        (d.ghost.material as MeshStandardMaterial).dispose();
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      const d = drag.current;
      if (d?.ghost) scene.remove(d.ghost);
      drag.current = null;
    };
  }, [gl, camera, scene, size, activeHubId, previewMode]);

  return null;
}
