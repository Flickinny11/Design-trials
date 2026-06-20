'use client';
// ORRERY No.7 — Atelier drag-drop controller (F5.2).
// Pick up a catalog swatch and drag it onto the watch: a ghost chip follows the
// pointer through a Rapier spring (real momentum), turns arc-cyan over the watch
// (valid socket), is magnetically biased toward the watch centre when near, and
// on a valid drop springs into the socket and applies that finish. R3F click
// semantics (down+up on the SAME object) separate a tap (handled by the existing
// configure binding) from a drag (handled here) — no double-apply. Spec §3.2 B.
import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  Mesh, BoxGeometry, MeshStandardMaterial, Color, Vector2, Vector3, Plane, Raycaster,
  type Object3D,
} from 'three';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useConfiguratorStore } from '@/stores/useConfiguratorStore';
import { LAYERS_BY_ID, type AtelierLayerId } from '@/lib/prism/atelier/config';
import { ensureRapier, rapierReady, makeChipSim, stepChipToward, disposeChipSim, type ChipSim } from '@/lib/prism/atelier/physics';

const ATELIER_HUB_ID = 's6-atelier';
const DRAG_THRESHOLD = 6;
const WATCH_CENTER = new Vector3(0, 0.05, 0.5);
const VALID = new Color('#1ec8ff');
const NEUTRAL = new Color('#e8c98a');

type Phase = 'drag' | 'settle' | 'remove';
interface DragState {
  layer: AtelierLayerId;
  variant: string;
  swatchColor: string;
  startX: number;
  startY: number;
  active: boolean;
  overValid: boolean;
  phase: Phase;
  settle: number;
  target: Vector3;
  ghost: Mesh | null;
  sim: ChipSim | null;
}

function nodeIdAt(root: Object3D, ray: Raycaster, ndc: Vector2, cam: Parameters<Raycaster['setFromCamera']>[1]): string | null {
  ray.setFromCamera(ndc, cam);
  for (const h of ray.intersectObjects(root.children, true)) {
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
  const plane = useRef(new Plane(new Vector3(0, 0, 1), -0.5));

  useEffect(() => { void ensureRapier(); }, []);

  const cleanup = (d: DragState) => {
    if (d.ghost) {
      scene.remove(d.ghost);
      d.ghost.geometry.dispose();
      (d.ghost.material as MeshStandardMaterial).dispose();
    }
    if (d.sim) disposeChipSim(d.sim);
    drag.current = null;
  };

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
      if (drag.current) return;
      const id = nodeIdAt(scene, ray.current, toNdc(e), camera);
      if (!id || !id.startsWith('orr-atelier-cat-')) return;
      const node = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id);
      const fb = node?.functionBinding;
      if (!fb || fb.kind !== 'configure') return;
      drag.current = {
        layer: fb.layer as AtelierLayerId, variant: fb.variant,
        swatchColor: (node?.materialSpec?.baseColor as string | undefined) ?? '#e8c98a',
        startX: e.clientX, startY: e.clientY, active: false, overValid: false,
        phase: 'drag', settle: 0, target: planePoint(toNdc(e)), ghost: null, sim: null,
      };
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.phase !== 'drag') return;
      const ndc = toNdc(e);
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
        const start = planePoint(ndc);
        const g = new Mesh(
          new BoxGeometry(0.34, 0.34, 0.34),
          new MeshStandardMaterial({ color: new Color(d.swatchColor), emissive: NEUTRAL.clone(), emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.3 }),
        );
        g.raycast = () => {};
        g.renderOrder = 50;
        g.position.copy(start);
        scene.add(g);
        d.ghost = g;
        d.active = true;
        const R = rapierReady();
        if (R) d.sim = makeChipSim(R, start);
      }
      d.target.copy(planePoint(ndc));
      const overId = nodeIdAt(scene, ray.current, ndc, camera);
      d.overValid = !!overId && overId.startsWith('orr-atelier-watch-');
      if (d.ghost) {
        const mat = d.ghost.material as MeshStandardMaterial;
        mat.emissive.copy(d.overValid ? VALID : NEUTRAL);
        mat.emissiveIntensity = d.overValid ? 0.95 : 0.35;
      }
    };
    const onUp = () => {
      const d = drag.current;
      if (!d) return;
      if (!d.active) { drag.current = null; return; }       // a tap — let onClick handle it
      if (d.overValid) { d.phase = 'settle'; d.settle = 0.45; } // spring into the socket, then apply
      else d.phase = 'remove';
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (drag.current) cleanup(drag.current);
    };
  }, [gl, camera, scene, size, activeHubId, previewMode]);

  useFrame((_s, delta) => {
    const d = drag.current;
    if (!d || !d.active || !d.ghost) return;
    const dt = Math.min(delta, 1 / 30);
    if (d.phase === 'remove') { cleanup(d); return; }
    const settling = d.phase === 'settle';
    const eff = settling
      ? WATCH_CENTER.clone()
      : d.target.clone().lerp(WATCH_CENTER, d.overValid ? 0.4 : 0);
    if (d.sim) {
      const p = stepChipToward(d.sim, eff, dt);
      d.ghost.position.set(p.x, p.y, p.z);
    } else {
      d.ghost.position.lerp(eff, Math.min(1, dt * 12));
    }
    if (settling) {
      d.settle -= dt;
      const k = Math.max(0, d.settle / 0.45);
      d.ghost.scale.setScalar(0.4 + 0.6 * k); // shrink into the socket
      if (d.settle <= 0) {
        useConfiguratorStore.getState().setLayer(d.layer, d.variant);
        cleanup(d);
      }
    }
  });

  return null;
}
