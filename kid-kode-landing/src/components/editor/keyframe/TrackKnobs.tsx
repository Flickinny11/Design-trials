'use client';

// TrackKnobs — the worn-metal CUBE knobs riding the milled channels, in the exact
// finish of the founder-approved chassis buttons:
//   • one FADER knob per property track — its x is mapped from the property VALUE
//     at the current playhead. Dragging it along the groove writes a keyframe at
//     the playhead time and the bound node updates live. Hover spins it end-over-
//     end (the chassis signature) so you see through the milled slot.
//   • the PLAYHEAD handle knob rides the TIME ruler — dragging it scrubs time.
//   • keyframe PIP markers seated in each groove at the value of every stored
//     keyframe, so a track's keyframes are visible at a glance.
//
// Drag is resolved by unprojecting the pointer onto the groove's plane (editor
// chrome — window access is allowed; this is not runtime/node code).

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import {
  CUBE_K,
  CUBE_K_CORNER,
  FRONT_Z,
  LAYOUT,
  SPIN_DURATION,
  SPIN_TURNS,
  type TrackDef,
  easeInOutCubic,
  timeToX,
  valueToX,
  xToTime,
  xToValue,
} from './keyframe-config';
import { pointsFor } from './keyframe-engine';
import { useKeyframeStore } from './use-keyframe-store';

const KNOB_Z = FRONT_Z - 0.08; // knob center: seated in the channel, proud of the front face
const TWO_PI = Math.PI * 2;
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));

// Verification registry — each knob registers a spin trigger + a force-spin
// setter, keyed by id ('playhead' | trackId). The route's probes call into this
// so an evaluate_script can deterministically fire hover-spin or freeze a spin
// progress for see-through capture (editor chrome — window access is allowed).
const KNOB_REGISTRY = new Map<string, { trigger: () => void; setForce: (p: number | null) => void }>();
if (typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>;
  w.__PRISM_KEYFRAME_HOVER__ = (id: string) => KNOB_REGISTRY.get(id)?.trigger();
  w.__PRISM_KEYFRAME_FORCESPIN__ = (id: string, p: number | null) => KNOB_REGISTRY.get(id)?.setForce(p);
}

// ── drag (shared) ────────────────────────────────────────────────────────────
interface DragState {
  kind: 'fader' | 'playhead';
  track?: TrackDef;
  z: number;
}

function useGrooveDrag() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const drag = useRef<DragState | null>(null);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const onMove = useCallback(
    (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      plane.setComponents(0, 0, 1, -d.z);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      const store = useKeyframeStore.getState();
      if (d.kind === 'playhead') {
        store.setPlayhead(xToTime(hit.x));
      } else if (d.track) {
        store.writeKeyframe(d.track.id, store.playhead, xToValue(d.track, hit.x));
      }
    },
    [camera, gl, ndc, ray, plane, hit],
  );

  const onUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }, [onMove]);

  const start = useCallback(
    (d: DragState) => {
      drag.current = d;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onMove, onUp],
  );

  const isDragging = useCallback(() => drag.current !== null, []);

  return { start, isDragging };
}

// ── a single worn-cube knob ────────────────────────────────────────────────────
interface KnobProps {
  id: string; // 'playhead' | trackId — for the verification registry
  maps: WornMaps;
  tint?: string; // optional albedo tint (the playhead steel)
  envBoost?: number;
  /** live x reader (value- or time-mapped) */
  readX: () => number;
  y: number;
  onGrab: () => void;
  /** spin is suppressed while a drag is in flight */
  draggingRef: () => boolean;
  size?: number;
}

function Knob({ id, maps, tint, envBoost = 0, readX, y, onGrab, draggingRef, size = CUBE_K }: KnobProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });
  const force = useRef<number | null>(null);

  // register verification triggers
  useEffect(() => {
    KNOB_REGISTRY.set(id, {
      trigger: () => {
        spin.current.active = true;
        spin.current.start = elapsed.current;
      },
      setForce: (p) => {
        force.current = p;
        if (p == null && meshRef.current) meshRef.current.rotation.x = 0;
      },
    });
    return () => {
      KNOB_REGISTRY.delete(id);
    };
  }, [id]);

  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial();
    applyWornMaterial(mat, maps);
    if (tint) mat.color = new THREE.Color(tint);
    if (envBoost) mat.envMapIntensity = (mat.envMapIntensity ?? 1) + envBoost;
    return mat;
  }, [maps, tint, envBoost]);

  // aoMap needs a 2nd UV set; BoxGeometry only ships `uv`. Mirror it to uv1.
  useEffect(() => {
    const geo = meshRef.current?.geometry;
    if (geo && geo.attributes.uv && !geo.attributes.uv1) {
      geo.setAttribute('uv1', geo.attributes.uv);
    }
  }, []);

  useFrame((state) => {
    const g = groupRef.current;
    const mesh = meshRef.current;
    if (!g || !mesh) return;
    elapsed.current = state.clock.elapsedTime;
    g.position.x = readX();
    if (force.current != null) {
      mesh.rotation.x = easeInOutCubic(THREE.MathUtils.clamp(force.current, 0, 1)) * REST_TURNS * TWO_PI;
      return;
    }
    const s = spin.current;
    if (s.active && !draggingRef()) {
      const t = (elapsed.current - s.start) / SPIN_DURATION;
      if (t >= 1) {
        mesh.rotation.x = 0;
        s.active = false;
      } else {
        mesh.rotation.x = easeInOutCubic(t) * REST_TURNS * TWO_PI;
      }
    }
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (draggingRef()) return;
    spin.current.active = true;
    spin.current.start = elapsed.current;
    document.body.style.cursor = 'ew-resize';
  };
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = '';
  };
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    spin.current.active = false;
    meshRef.current!.rotation.x = 0;
    onGrab();
  };

  return (
    <group ref={groupRef} position={[readX(), y, KNOB_Z]}>
      <RoundedBox
        ref={meshRef}
        args={[size, size, size]}
        radius={CUBE_K_CORNER}
        smoothness={5}
        material={material}
        castShadow
        receiveShadow
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerDown={onDown}
      >
        {/* engraved grip notch on the front face — reads as a grabbable fader cap */}
        <mesh position={[0, 0, size / 2 + 0.002]}>
          <boxGeometry args={[0.045, size * 0.62, 0.02]} />
          <meshStandardMaterial color="#0a0d12" roughness={0.3} metalness={0.5} />
        </mesh>
      </RoundedBox>
    </group>
  );
}

// ── keyframe pip markers per track ──────────────────────────────────────────────
const PIP_MAT = new THREE.MeshStandardMaterial({
  color: '#e7eef9',
  roughness: 0.35,
  metalness: 0.6,
  emissive: '#2c3a52',
  emissiveIntensity: 0.5,
});

function KeyframeMarkers() {
  // re-read when keyframes change
  const rev = useKeyframeStore((s) => s.rev);
  const node = useKeyframeStore((s) => s.node);
  const pips = useMemo(() => {
    const out: { key: string; x: number; y: number }[] = [];
    for (const tr of LAYOUT.tracks) {
      for (const p of pointsFor(node, tr.id)) {
        out.push({ key: `${tr.id}:${p.t}`, x: valueToX(tr, p.v), y: tr.y });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, node]);

  return (
    <>
      {pips.map((p) => (
        <mesh
          key={p.key}
          position={[p.x, p.y - 0.27, FRONT_Z - 0.02]}
          rotation={[0, 0, Math.PI / 4]}
          material={PIP_MAT}
        >
          <boxGeometry args={[0.1, 0.1, 0.03]} />
        </mesh>
      ))}
    </>
  );
}

// ── the knobs layer ──────────────────────────────────────────────────────────
export function TrackKnobs({ maps }: { maps: Record<string, WornMaps> }) {
  const { start, isDragging } = useGrooveDrag();

  return (
    <>
      {/* playhead handle on the TIME ruler */}
      <Knob
        id="playhead"
        maps={maps.gunmetal}
        tint="#cdd6e2"
        envBoost={0.4}
        size={CUBE_K * 0.92}
        y={LAYOUT.rulerY}
        readX={() => timeToX(useKeyframeStore.getState().playhead)}
        onGrab={() => start({ kind: 'playhead', z: KNOB_Z })}
        draggingRef={isDragging}
      />

      {/* one fader knob per property track */}
      {LAYOUT.tracks.map((track) => (
        <Knob
          key={track.id}
          id={track.id}
          maps={maps[track.textureKey]}
          y={track.y}
          readX={() => valueToX(track, useKeyframeStore.getState().valueAt(track.id))}
          onGrab={() => start({ kind: 'fader', track, z: KNOB_Z })}
          draggingRef={isDragging}
        />
      ))}

      <KeyframeMarkers />
    </>
  );
}
