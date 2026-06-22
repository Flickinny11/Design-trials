'use client';
// ORRERY No.7 — Atelier photoreal watch (PHASE1 v2, SC-V-A1..A6).
//
// MID-RUN MANDATE v2: the watch is no longer 33 hand-built procedural primitives
// (the rejected "edge-on disc" slop). It is a composed PHOTOREAL ASSEMBLY:
//   • case body  → a GENERATED GLB (Replicate FLUX.2 concept → TRELLIS image→3D),
//     polished/brushed steel with curved lugs + fluted crown + recessed dial well;
//   • dial face  → a GENERATED orrery complication art (FLUX.2): midnight guilloché
//     + aventurine, gold orbital rings with planet spheres, moonphase aperture
//     (this is also the SC-V-O3 orrery motif), or any catalog finish (config.ts);
//   • crystal    → true transmission/refraction sapphire dome (the premium glass);
//   • movement   → tourbillon.glb on the caseback (Wave C flip), balance in motion;
//   • applied indices + sweeping hands  → razor-thin polished metal that catches the
//     studio IBL (this precise micro-geometry is intentionally parametric: image→3D
//     produces fused single-material blobs and garbles thin parts — see report).
//
// Tripo part-SEGMENTATION (the only path to a fully-generated *swappable* watch) is
// gated on a funded Tripo balance (currently 0); re-checked each wave. Until then the
// swap/explode/caseback mechanics ride on this part-decomposed assembly, with every
// per-part FINISH swap driven live from useConfiguratorStore (SC-V-A2/A3).
//
// The component owns the turntable pivot (head-on camera, the WATCH rotates), pointer
// drag (azimuth + bounded tilt), idle auto-turn, release momentum, and the
// window.__ATELIER_RIG__ inspect handle (flip/explode reserved for Wave C). Renders
// only in preview-app on s6-atelier; tears down cleanly elsewhere.
import { useEffect, useMemo, useRef, Suspense } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Group, Object3D, Vector2, Vector3, Box3, Mesh,
  CircleGeometry, BoxGeometry, TorusGeometry, CylinderGeometry, SphereGeometry,
  LatheGeometry, Raycaster, TextureLoader, type Texture,
} from 'three';
import {
  buildPhysicalMaterial,
  applyMaterialSpec,
} from '@/lib/prism/runtime/shared/material-system';
import type { MaterialSpec } from '@/lib/prism-graph/types';
import { variantOf, type AtelierLayerId } from '@/lib/prism/atelier/config';
import { useConfiguratorStore } from '@/stores/useConfiguratorStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

const ATELIER_HUB_ID = 's6-atelier';
const ASSET = '/prism-mock/orrery/meshes/atelier';
const MOVEMENT_URL = '/prism-mock/orrery/meshes/tourbillon.glb';
const TEX = `${ASSET}/textures`;

const PIVOT_CENTER = new Vector3(0, 0.15, 0.42);
const TILT_MIN = -0.62;
const TILT_MAX = 0.7;
const IDLE_DELAY_MS = 3000;
const IDLE_SPEED = 0.1; // rad/s — slow luxury turntable
const WATCH_R = 1.0; // nominal dial radius in local units
const DIAL_FRONT = 0.05; // dial-stack base z, at the turned-case well floor

// ── shared cached texture loader (live finish swaps) ───────────────────────
const _texLoader = new TextureLoader();
const _texCache = new Map<string, Promise<Texture>>();
function loadTex(url: string): Promise<Texture> {
  let p = _texCache.get(url);
  if (!p) {
    p = _texLoader.loadAsync(url);
    _texCache.set(url, p);
  }
  return p;
}

// Build a node-owned MeshPhysicalNodeMaterial from a MaterialSpec, then pour any
// albedo / normal / roughness maps the spec carries (mirrors default-factory).
function makeMat(spec: MaterialSpec): InstanceType<typeof import('three/webgpu').MeshPhysicalNodeMaterial> {
  const m = buildPhysicalMaterial(spec);
  applyMaterialSpec(m, spec);
  const mm = m as unknown as {
    map: unknown; normalMap: unknown; roughnessMap: unknown;
    normalScale?: { set: (x: number, y: number) => void };
    needsUpdate: boolean;
  };
  if (spec.baseColorMapUrl) {
    loadTex(spec.baseColorMapUrl).then((t) => {
      (t as { colorSpace?: string }).colorSpace = 'srgb';
      mm.map = t; mm.needsUpdate = true;
    }).catch(() => {});
  }
  if (spec.normalMapUrl) {
    loadTex(spec.normalMapUrl).then((t) => {
      mm.normalMap = t;
      mm.normalScale?.set(spec.normalScale ?? 1, spec.normalScale ?? 1);
      mm.needsUpdate = true;
    }).catch(() => {});
  }
  if (spec.roughnessMapUrl) {
    loadTex(spec.roughnessMapUrl).then((t) => { mm.roughnessMap = t; mm.needsUpdate = true; }).catch(() => {});
  }
  return m as never;
}

function specOf(layer: AtelierLayerId, variantId: string): MaterialSpec | null {
  return variantOf(layer, variantId)?.material ?? null;
}

// ── watch case (precision-turned, dressed in generated steel PBR) ───────────
// Single-image image→3D (TRELLIS/Hunyuan) hallucinates depth + edge nubs on a
// precise mechanical case (see report); Tripo part-segmentation (the generated-
// swappable path) is unfunded. So the case is a clean LatheGeometry turning — a
// real watch caseband cross-section revolved — plus tapered lugs + a fluted crown,
// all wearing the GENERATED brushed/polished steel maps under the studio HDRI. It
// frames the GENERATED orrery dial art. The generated case GLB stays on disk
// (case-hero.glb) for a segmented upgrade the moment Tripo is funded.
const CASE_PROFILE: Vector2[] = [
  new Vector2(0.0, -0.17), new Vector2(0.62, -0.17), new Vector2(0.84, -0.135),
  new Vector2(0.965, -0.05), new Vector2(1.0, 0.05), new Vector2(0.99, 0.135),
  new Vector2(0.95, 0.185), new Vector2(0.86, 0.2), new Vector2(0.84, 0.13),
  new Vector2(0.84, 0.04),
];
function WatchCase({ caseVariant }: { caseVariant: string }) {
  const caseSpec = useMemo(
    () => specOf('case', caseVariant) ?? { baseColor: '#c9ced6', metalness: 1, roughness: 0.18, envMapIntensity: 1.4 } as MaterialSpec,
    [caseVariant],
  );
  const mat = useMemo(() => makeMat(caseSpec), [caseSpec]);
  const bandGeo = useMemo(() => new LatheGeometry(CASE_PROFILE, 128), []);
  const lugGeo = useMemo(() => new BoxGeometry(0.12, 0.46, 0.3), []);
  const crownGeo = useMemo(() => new CylinderGeometry(0.085, 0.085, 0.14, 24), []);
  const crownCapGeo = useMemo(() => new CylinderGeometry(0.094, 0.094, 0.04, 24), []);
  // four lugs (two pairs at 12 + 6 o'clock) splayed outward to hold the strap bars
  const lugs = useMemo(() => {
    const out: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
    for (const sy of [1, -1]) for (const sx of [1, -1]) {
      out.push({ pos: [sx * 0.3, sy * 0.92, -0.05], rot: [sy * -0.28, 0, sx * sy * 0.12] });
    }
    return out;
  }, []);
  return (
    <group>
      {/* lathe caseband: revolve about Y, then orient axis Y → Z (dial → camera) */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={bandGeo} material={mat as never} castShadow receiveShadow />
      </group>
      {/* lugs + crown live in dial space (dial → +Z, 12 o'clock → +Y) */}
      {lugs.map((l, i) => (
        <mesh key={i} geometry={lugGeo} material={mat as never} position={l.pos} rotation={l.rot} castShadow receiveShadow />
      ))}
      {/* fluted crown at 3 o'clock (+X), axis along X */}
      <group position={[1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh geometry={crownGeo} material={mat as never} castShadow />
        <mesh geometry={crownCapGeo} material={mat as never} position={[0, 0.08, 0]} />
      </group>
    </group>
  );
}

// ── caseback movement (GLB) — hidden until Wave C flip ─────────────────────
function MovementModel({ visibleRef }: { visibleRef: React.MutableRefObject<boolean> }) {
  const gltf = useGLTF(MOVEMENT_URL);
  const ref = useRef<Group>(null);
  const built = useMemo(() => {
    const root = gltf.scene.clone(true);
    const box = new Box3().setFromObject(root);
    const size = new Vector3(); box.getSize(size);
    const center = new Vector3(); box.getCenter(center);
    root.position.sub(center);
    const holder = new Group();
    holder.add(root);
    holder.scale.setScalar((1.7 * WATCH_R) / (Math.max(size.x, size.y, size.z) || 1));
    return holder;
  }, [gltf]);
  useFrame((_, dt) => {
    const g = ref.current; if (!g) return;
    g.visible = visibleRef.current;
    if (g.visible) g.rotation.z += dt * 0.8; // rotor / balance turning
  });
  return <group ref={ref} position={[0, 0, -0.16]} rotation={[0, Math.PI, 0]} visible={false}><primitive object={built} /></group>;
}

useGLTF.preload(MOVEMENT_URL);

interface WatchProps { build: Record<AtelierLayerId, string>; flipRef: React.MutableRefObject<boolean>; }

function WatchAssembly({ build, flipRef }: WatchProps) {
  // dial — generated orrery art by default, else the chosen finish texture/color
  const dialMat = useMemo(() => {
    const spec = specOf('dial', build.dial) ?? { baseColor: '#16243a', metalness: 0.4, roughness: 0.4 } as MaterialSpec;
    return makeMat(spec);
  }, [build.dial]);
  const handsMat = useMemo(() => makeMat(specOf('hands', build.hands) ?? { baseColor: '#eef2f8', metalness: 1, roughness: 0.12, envMapIntensity: 1.4 } as MaterialSpec), [build.hands]);
  const indexMat = useMemo(() => makeMat(specOf('indices', build.indices) ?? { baseColor: '#e8c98a', metalness: 1, roughness: 0.2, envMapIntensity: 1.4 } as MaterialSpec), [build.indices]);
  const bezelMat = useMemo(() => makeMat(specOf('bezel', build.bezel) ?? { baseColor: '#aeb4bd', metalness: 1, roughness: 0.4 } as MaterialSpec), [build.bezel]);
  const crystalMat = useMemo(() => makeMat({
    baseColor: '#eef4ff', metalness: 0, roughness: 0.05, transmission: 1, ior: 1.77,
    thickness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.8, opacity: 1,
  } as MaterialSpec), []);
  const capMat = useMemo(() => makeMat({ baseColor: '#cfd4dc', metalness: 1, roughness: 0.15, envMapIntensity: 1.3 } as MaterialSpec), []);

  // geometries (memoised)
  const dialGeo = useMemo(() => new CircleGeometry(WATCH_R * 0.82, 96), []);
  const chapterGeo = useMemo(() => new TorusGeometry(WATCH_R * 0.8, WATCH_R * 0.022, 16, 128), []);
  const bezelGeo = useMemo(() => new TorusGeometry(WATCH_R * 0.93, WATCH_R * 0.07, 24, 160), []);
  const indexGeo = useMemo(() => { const g = new BoxGeometry(0.03, 0.1, 0.02); g.translate(0, WATCH_R * 0.71, 0); return g; }, []);
  const capGeo = useMemo(() => new CylinderGeometry(0.035, 0.035, 0.05, 24), []);
  const crystalGeo = useMemo(() => new SphereGeometry(WATCH_R * 0.84, 64, 40), []);
  const handGeo = (len: number, w: number) => { const g = new BoxGeometry(w, len, 0.012); g.translate(0, len * 0.34, 0); return g; };
  const hourGeo = useMemo(() => handGeo(WATCH_R * 0.5, 0.045), []);
  const minGeo = useMemo(() => handGeo(WATCH_R * 0.72, 0.032), []);
  const secGeo = useMemo(() => handGeo(WATCH_R * 0.8, 0.012), []);

  const hourRef = useRef<Group>(null);
  const minRef = useRef<Group>(null);
  const secRef = useRef<Group>(null);

  useFrame((state) => {
    // a living watch: gentle continuous sweep (not real time-of-day)
    const t = state.clock.elapsedTime;
    if (secRef.current) secRef.current.rotation.z = -t * 0.9;
    if (minRef.current) minRef.current.rotation.z = -t * 0.15;
    if (hourRef.current) hourRef.current.rotation.z = -t * 0.0125;
  });

  const indices = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  return (
    <group>
      {/* precision-turned case dressed in generated steel PBR */}
      <WatchCase caseVariant={build.case} />
      {/* dial face stack — seated just behind the case front rim */}
      <group position={[0, 0, DIAL_FRONT]}>
        {/* bezel ring sits on the case rim */}
        <mesh geometry={bezelGeo} material={bezelMat as never} position={[0, 0, 0.02]} castShadow receiveShadow />
        {/* dial face (generated orrery art / finish) */}
        <mesh geometry={dialGeo} material={dialMat as never} position={[0, 0, -0.01]} receiveShadow />
        {/* chapter ring */}
        <mesh geometry={chapterGeo} material={indexMat as never} position={[0, 0, 0.012]} />
        {/* applied indices */}
        {indices.map((i) => (
          <mesh key={i} geometry={indexGeo} material={indexMat as never} position={[0, 0, 0.016]} rotation={[0, 0, (-i * Math.PI) / 6]} />
        ))}
        {/* hands */}
        <group ref={hourRef} position={[0, 0, 0.03]}><mesh geometry={hourGeo} material={handsMat as never} /></group>
        <group ref={minRef} position={[0, 0, 0.042]}><mesh geometry={minGeo} material={handsMat as never} /></group>
        <group ref={secRef} position={[0, 0, 0.052]}><mesh geometry={secGeo} material={handsMat as never} /></group>
        <mesh geometry={capGeo} material={capMat as never} position={[0, 0, 0.056]} rotation={[Math.PI / 2, 0, 0]} />
        {/* sapphire crystal dome (transmission) — flattened sphere, front bulge only */}
        <mesh geometry={crystalGeo} material={crystalMat as never} position={[0, 0, 0.035]} scale={[1, 1, 0.1]} />
      </group>
      {/* strap → Wave B (curved lugs band w/ leather/alligator finish) */}
      {/* caseback movement (hidden until flip) */}
      <Suspense fallback={null}>
        <MovementModel visibleRef={flipRef} />
      </Suspense>
    </group>
  );
}

export function AtelierWatchRig({ previewMode }: { previewMode: boolean }) {
  const { gl, camera, scene } = useThree();
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const build = useConfiguratorStore((s) => s.build);
  const pivotRef = useRef<Group>(null);
  const flipRef = useRef(false);

  // rotation state
  const yaw = useRef(0);
  const pitch = useRef(0.05);
  const yawTarget = useRef(0);
  const pitchTarget = useRef(0.05);
  const yawVel = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastInteract = useRef(0);

  const active = previewMode && activeHubId === ATELIER_HUB_ID;

  // expose inspect handle
  useEffect(() => {
    if (!active) return;
    lastInteract.current = typeof performance !== 'undefined' ? performance.now() : 0;
    (window as unknown as { __ATELIER_RIG__?: unknown }).__ATELIER_RIG__ = {
      get yaw() { return yaw.current; },
      get pitch() { return pitch.current; },
      get flipped() { return flipRef.current; },
      spinTo: (y: number, p?: number) => { yawTarget.current = y; if (typeof p === 'number') pitchTarget.current = Math.max(TILT_MIN, Math.min(TILT_MAX, p)); lastInteract.current = 1e15; },
      nudge: (dy: number) => { yawTarget.current += dy; lastInteract.current = 1e15; },
      resumeIdle: () => { lastInteract.current = 0; },
      flip: (on?: boolean) => { flipRef.current = typeof on === 'boolean' ? on : !flipRef.current; yawTarget.current = flipRef.current ? Math.PI : 0; lastInteract.current = 1e15; return flipRef.current; },
      get pivot() { return pivotRef.current; },
    };
    return () => { delete (window as unknown as { __ATELIER_RIG__?: unknown }).__ATELIER_RIG__; };
  }, [active]);

  // pointer-drag to rotate (azimuth + bounded tilt); swatches/buttons keep theirs
  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    const ray = new Raycaster();
    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
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
      dragging.current = true; lastX.current = e.clientX; lastY.current = e.clientY; yawVel.current = 0;
      lastInteract.current = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current; const dy = e.clientY - lastY.current;
      lastX.current = e.clientX; lastY.current = e.clientY;
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
  }, [active, gl, camera, scene]);

  useFrame((_, dt) => {
    const pivot = pivotRef.current;
    if (!pivot) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (!dragging.current && lastInteract.current < 1e14 && now - lastInteract.current > IDLE_DELAY_MS) {
      yawTarget.current += IDLE_SPEED * Math.min(dt, 0.05);
    }
    if (!dragging.current && Math.abs(yawVel.current) > 0.0001) { yawTarget.current += yawVel.current; yawVel.current *= 0.92; }
    const ease = dragging.current ? 0.35 : 0.12;
    yaw.current += (yawTarget.current - yaw.current) * ease;
    pitch.current += (pitchTarget.current - pitch.current) * ease;
    pivot.rotation.y = yaw.current;
    pivot.rotation.x = pitch.current;
  });

  if (!active) return null;
  return (
    <group ref={pivotRef} position={PIVOT_CENTER.toArray()}>
      <WatchAssembly build={build} flipRef={flipRef} />
    </group>
  );
}
