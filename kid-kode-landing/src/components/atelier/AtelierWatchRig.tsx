'use client';
// ORRERY No.7 — Atelier watch turntable rig (PHASE1, SC-V-A3/A4).
// The award-winning configurator pattern: the camera stays head-on (so the
// premium flat UI never skews) and the WATCH itself rotates. On mount we collect
// every mounted `orr-atelier-watch-*` part Object3D and `attach` them (world
// transform preserved) under a single pivot Group centred on the watch, then
// drive that pivot from pointer drag (azimuth + bounded tilt), idle auto-turn,
// and release momentum. Loupe zoom is the camera dolly (SceneControlsBridge).
// The pivot is the single owner of the watch's gross transform, and is reused by
// the inspect controller (caseback flip / exploded view) in later waves via the
// `window.__ATELIER_RIG__` handle. Reverts cleanly on unmount.
import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Group, Object3D, Vector2, Vector3, Raycaster } from 'three';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

const ATELIER_HUB_ID = 's6-atelier';
const PART_PREFIX = 'orr-atelier-watch-';
const PIVOT_CENTER = new Vector3(0, 0.05, 0.42);
const TILT_MIN = -0.55;
const TILT_MAX = 0.62;
const IDLE_DELAY_MS = 2600;
const IDLE_SPEED = 0.12; // rad/s slow luxury turntable

interface Captured { obj: Object3D; parent: Object3D; }

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

export function AtelierWatchRig({ previewMode }: { previewMode: boolean }) {
  const { gl, camera, scene } = useThree();
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const pivotRef = useRef<Group | null>(null);
  const capturedRef = useRef<Captured[]>([]);
  // rotation state
  const yaw = useRef(0);
  const pitch = useRef(0.06);
  const yawTarget = useRef(0);
  const pitchTarget = useRef(0.06);
  const yawVel = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastInteract = useRef(0);

  // ---- reparent the watch parts under a pivot when the Atelier is active ----
  useEffect(() => {
    if (!previewMode || activeHubId !== ATELIER_HUB_ID) return;
    let cancelled = false;
    let tries = 0;
    const build = () => {
      if (cancelled) return;
      const groups = (window as unknown as { __PRISM_EDITOR_NODE_GROUPS__?: Map<string, Object3D> })
        .__PRISM_EDITOR_NODE_GROUPS__;
      const parts: Object3D[] = [];
      if (groups) {
        for (const [id, g] of groups) if (id.startsWith(PART_PREFIX) && g) parts.push(g);
      }
      if (parts.length < 5 && tries < 25) { tries += 1; window.setTimeout(build, 160); return; }
      if (parts.length === 0) return;
      const parent = parts[0].parent ?? scene;
      const pivot = new Group();
      pivot.name = '__atelier_watch_pivot__';
      pivot.position.copy(PIVOT_CENTER);
      parent.add(pivot);
      const captured: Captured[] = [];
      for (const p of parts) {
        captured.push({ obj: p, parent: p.parent ?? parent });
        pivot.attach(p); // preserves world transform
      }
      pivotRef.current = pivot;
      capturedRef.current = captured;
      lastInteract.current = (typeof performance !== 'undefined' ? performance.now() : 0);
      // verification + later-wave handle
      (window as unknown as { __ATELIER_RIG__?: unknown }).__ATELIER_RIG__ = {
        get yaw() { return yaw.current; },
        get pitch() { return pitch.current; },
        spinTo: (y: number, p?: number) => { yawTarget.current = y; if (typeof p === 'number') pitchTarget.current = Math.max(TILT_MIN, Math.min(TILT_MAX, p)); lastInteract.current = 1e15; },
        nudge: (dy: number) => { yawTarget.current += dy; lastInteract.current = 1e15; },
        resumeIdle: () => { lastInteract.current = 0; },
        pivot,
        partCount: parts.length,
      };
    };
    window.setTimeout(build, 260);
    return () => {
      cancelled = true;
      const pivot = pivotRef.current;
      if (pivot) {
        pivot.rotation.set(0, 0, 0);
        pivot.updateMatrixWorld(true);
        for (const c of capturedRef.current) {
          try { c.parent.attach(c.obj); } catch { /* node already unmounted */ }
        }
        try { pivot.parent?.remove(pivot); } catch { /* ignore */ }
      }
      pivotRef.current = null;
      capturedRef.current = [];
      delete (window as unknown as { __ATELIER_RIG__?: unknown }).__ATELIER_RIG__;
    };
  }, [previewMode, activeHubId, scene]);

  // ---- pointer-drag to rotate the watch (azimuth + bounded tilt) ----
  useEffect(() => {
    if (!previewMode || activeHubId !== ATELIER_HUB_ID) return;
    const el = gl.domElement;
    const ray = new Raycaster();
    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const onDown = (e: PointerEvent) => {
      const id = nodeIdAt(scene, ray, toNdc(e), camera);
      // Swatch chips + HUD buttons own their own pointer interactions; the watch
      // (and empty studio space) drives the turntable.
      if (id && (id.startsWith('orr-atelier-cat-') || id.startsWith('orr-atelier-btn-'))) return;
      dragging.current = true;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      yawVel.current = 0;
      lastInteract.current = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      const dy = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      yawTarget.current += dx * 0.0095;
      pitchTarget.current = Math.max(TILT_MIN, Math.min(TILT_MAX, pitchTarget.current + dy * 0.007));
      yawVel.current = dx * 0.0095;
      lastInteract.current = performance.now();
    };
    const onUp = () => { dragging.current = false; lastInteract.current = performance.now(); };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [previewMode, activeHubId, gl, camera, scene]);

  useFrame((_, dt) => {
    const pivot = pivotRef.current;
    if (!pivot) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    // idle auto-turntable when untouched (and not pinned by a probe spin)
    if (!dragging.current && lastInteract.current < 1e14 && now - lastInteract.current > IDLE_DELAY_MS) {
      yawTarget.current += IDLE_SPEED * Math.min(dt, 0.05);
    }
    // release momentum
    if (!dragging.current && Math.abs(yawVel.current) > 0.0001) {
      yawTarget.current += yawVel.current;
      yawVel.current *= 0.92;
    }
    const ease = dragging.current ? 0.35 : 0.12;
    yaw.current += (yawTarget.current - yaw.current) * ease;
    pitch.current += (pitchTarget.current - pitch.current) * ease;
    pivot.rotation.y = yaw.current;
    pivot.rotation.x = pitch.current;
  });

  return null;
}
