'use client';

// PRISM EDITOR CHROME LAYER — in-canvas renderer (UI-FIDELITY-2 W1).
//
// Mounts INSIDE the one unified GraphScene canvas (INV: one renderer, no
// second canvas). Renders every registered DOM chrome surface as an instanced
// SDF slab parented to the camera (screen-locked plane at CHROME_DISTANCE),
// drawn after the scene with depthTest off — so glass slabs refract whatever
// the live scene just rendered via the shared viewport texture (zero extra
// passes), and metal/ceramic slabs pick up the active hub's IBL.
//
// Also owns:
//  • the pointer light — a real THREE.PointLight riding the cursor on the
//    chrome plane (damped), so bevels/brushing answer with true speculars;
//  • the in-scene nebula background (TSL backgroundNode) replacing the CSS
//    backdrop at t2, so glass at screen edges has real content to refract.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { tsl } from './tsl';
import { DS, dsHexNumber } from '@/components/editor/design-system';
import {
  getChromeSlabRegistry,
  readQuantizedRect,
  type ChromeSlabEntry,
} from './registry';
import {
  createChromeTextures,
  createChromeUniforms,
  createGlassSlabMaterial,
  createOpaqueSlabMaterial,
  type ChromeInstanceBuffers,
} from './material';

const CHROME_DISTANCE = 2.0; // world units in front of the camera (near=0.1)
const OPAQUE_RENDER_ORDER = 9000;
const GLASS_RENDER_ORDER = 9100; // glass refracts opaque chrome beneath it

function makeBuffers(capacity: number): ChromeInstanceBuffers {
  const mk = (itemSize: number) => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * itemSize), itemSize);
    a.setUsage(THREE.DynamicDrawUsage);
    return a;
  };
  return { aRect: mk(4), aRadii: mk(4), aState: mk(4), aMisc: mk(4), aClip: mk(4) };
}

function attachBuffers(geo: THREE.InstancedBufferGeometry | THREE.PlaneGeometry, bufs: ChromeInstanceBuffers) {
  geo.setAttribute('aRect', bufs.aRect as unknown as THREE.BufferAttribute);
  geo.setAttribute('aRadii', bufs.aRadii as unknown as THREE.BufferAttribute);
  geo.setAttribute('aState', bufs.aState as unknown as THREE.BufferAttribute);
  geo.setAttribute('aMisc', bufs.aMisc as unknown as THREE.BufferAttribute);
  geo.setAttribute('aClip', bufs.aClip as unknown as THREE.BufferAttribute);
}

function radiiOf(e: ChromeSlabEntry): [number, number, number, number] {
  const r = e.opts.radius ?? 12;
  return typeof r === 'number' ? [r, r, r, r] : r;
}

const STYLE_ID: Record<string, number> = { glass: 0, metal: 1, ceramic: 2, well: 3 };

/** The TSL nebula — same composition as the CSS backdrop, now refractable. */
function nebulaBackgroundNode() {
  const { vec2, vec3, vec4, smoothstep, length, screenUV } = tsl;
  const uvn = vec2(screenUV.x, screenUV.y.oneMinus()); // CSS top-left coords
  const metal = new THREE.Color(DS.metal500);
  const ice = new THREE.Color(DS.ice500);
  const voidC = new THREE.Color(DS.void);
  const d1 = length(uvn.sub(vec2(0.2, 0.2)).div(vec2(0.7, 0.6)));
  const d2 = length(uvn.sub(vec2(0.8, 0.8)).div(vec2(0.6, 0.5)));
  const g1 = smoothstep(0.55, 0.0, d1).mul(0.12);
  const g2 = smoothstep(0.55, 0.0, d2).mul(0.1);
  const col = vec3(voidC.r, voidC.g, voidC.b)
    .add(vec3(metal.r, metal.g, metal.b).mul(g1))
    .add(vec3(ice.r, ice.g, ice.b).mul(g2));
  return vec4(col, 1.0);
}

export function ChromeSlabLayer() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  const registry = getChromeSlabRegistry();
  const uniforms = useMemo(() => createChromeUniforms(), []);
  // fal-generated Patina micro-maps (page-lifetime; cheap, cached by the browser).
  const textures = useMemo(() => createChromeTextures(), []);

  // Capacity-managed buffers + meshes (rebuilt when slab count outgrows them).
  const stateRef = useRef<{
    capacity: number;
    opaque: THREE.InstancedMesh | null;
    glass: THREE.InstancedMesh | null;
    opaqueBufs: ChromeInstanceBuffers | null;
    glassBufs: ChromeInstanceBuffers | null;
    group: THREE.Group;
    light: THREE.PointLight;
    lightTarget: THREE.Vector3;
    pointerCss: THREE.Vector2;
    pointerIn: boolean;
    dummy: THREE.Object3D;
  } | null>(null);

  // ── Mount: camera-parented group + meshes + pointer light + background.
  useEffect(() => {
    // Children of the camera only render if the camera is in the scene graph.
    if (camera.parent == null) scene.add(camera);

    const group = new THREE.Group();
    group.name = 'chrome-slab-layer';
    camera.add(group);

    const capacity = 64;
    const opaqueBufs = makeBuffers(capacity);
    const glassBufs = makeBuffers(capacity);

    // Chrome owns its lighting domain: hub light rigs vary wildly per hub
    // (a bright key washed ceramic cards to white at canvas zoom) — slabs
    // are lit ONLY by the pointer light + the scene environment (IBL stays
    // reactive to the active hub, which is the desired behavior).
    const light = new THREE.PointLight(dsHexNumber(DS.metal100), 0, 1.6, 2);
    light.name = 'chrome-pointer-light';
    const chromeLights = tsl.lights([light]);

    const mkMesh = (bufs: ChromeInstanceBuffers, glass: boolean) => {
      const geo = new THREE.PlaneGeometry(1, 1);
      attachBuffers(geo, bufs);
      const mat = glass
        ? createGlassSlabMaterial(bufs, uniforms, textures)
        : createOpaqueSlabMaterial(bufs, uniforms, textures);
      (mat as unknown as Record<string, unknown>).lightsNode = chromeLights;
      const mesh = new THREE.InstancedMesh(geo, mat, capacity);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = glass ? GLASS_RENDER_ORDER : OPAQUE_RENDER_ORDER;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(mesh);
      return mesh;
    };
    const opaque = mkMesh(opaqueBufs, false);
    const glass = mkMesh(glassBufs, true);

    // Pointer light mounted under the camera group (position driven per frame).
    group.add(light);

    // In-scene nebula so glass has real content to refract at screen edges.
    const sceneAny = scene as unknown as { backgroundNode?: unknown };
    const prevBackground = sceneAny.backgroundNode;
    sceneAny.backgroundNode = nebulaBackgroundNode();

    const pointerCss = new THREE.Vector2(-4096, -4096);
    const onMove = (ev: PointerEvent) => {
      pointerCss.set(ev.clientX, ev.clientY);
      if (stateRef.current) stateRef.current.pointerIn = true;
    };
    const onLeave = () => {
      if (stateRef.current) stateRef.current.pointerIn = false;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    stateRef.current = {
      capacity,
      opaque,
      glass,
      opaqueBufs,
      glassBufs,
      group,
      light,
      lightTarget: new THREE.Vector3(),
      pointerCss,
      pointerIn: false,
      dummy: new THREE.Object3D(),
    };
    registry.layerActive = true;

    return () => {
      registry.layerActive = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      sceneAny.backgroundNode = prevBackground;
      camera.remove(group);
      for (const mesh of [opaque, glass]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, scene, uniforms, textures]);

  // ── Per-frame sync: rects → instances; pointer → uniforms + light.
  useFrame((_, delta) => {
    const s = stateRef.current;
    if (!s || !s.opaque || !s.glass || !s.opaqueBufs || !s.glassBufs) return;

    const entries = registry.entries();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cam = camera as THREE.PerspectiveCamera;
    const worldH = 2 * CHROME_DISTANCE * Math.tan((cam.fov * Math.PI) / 360);
    const pxToWorld = worldH / size.height;
    const halfW = size.width / 2;
    const halfH = size.height / 2;

    // Damped pointer → uniform (CSS px) + light on the chrome plane.
    const k = 1 - Math.exp(-delta * 18);
    uniforms.pointer.value.lerp(s.pointerCss, k);
    uniforms.pointerActive.value +=
      ((s.pointerIn ? 1 : 0) - uniforms.pointerActive.value) * (1 - Math.exp(-delta * 6));
    s.light.position.set(
      (uniforms.pointer.value.x - halfW) * pxToWorld,
      (halfH - uniforms.pointer.value.y) * pxToWorld,
      -CHROME_DISTANCE + 0.85,
    );
    s.light.intensity = 1.5 * uniforms.pointerActive.value;

    const damp = 1 - Math.exp(-delta * 14);
    let oi = 0;
    let gi = 0;
    const writeInstance = (
      mesh: THREE.InstancedMesh,
      bufs: ChromeInstanceBuffers,
      i: number,
      e: ChromeSlabEntry,
    ) => {
      const { x, y, w, h } = e.rect;
      const cx = x + w / 2;
      const cy = y + h / 2;
      s.dummy.position.set((cx - halfW) * pxToWorld, (halfH - cy) * pxToWorld, -CHROME_DISTANCE);
      s.dummy.scale.set(w * pxToWorld, h * pxToWorld, 1);
      s.dummy.rotation.set(0, 0, 0);
      s.dummy.updateMatrix();
      mesh.setMatrixAt(i, s.dummy.matrix);
      bufs.aRect.setXYZW(i, cx, cy, w, h);
      const [tl, tr, br, bl] = radiiOf(e);
      bufs.aRadii.setXYZW(i, tl, tr, br, bl);
      e.hoverK += (e.hover - e.hoverK) * damp;
      e.pressK += (e.press - e.pressK) * damp;
      bufs.aState.setXYZW(i, e.opts.borderPx ?? 1, e.opts.accent ?? 0, e.hoverK, e.pressK);
      // aMisc.w (the reserved slot) carries the EDITOR-EXP P2 hero amount: 0 for
      // a normal flat slab, ~1 for a raised/extruded metal key (heroDepthPx
      // normalized). The opaque shader reads it to grow the bevel into a thick
      // chamfered side + lit top cap + shaded base.
      const heroAmt = e.opts.hero ? Math.min(1, (e.opts.heroDepthPx ?? 10) / 12) : 0;
      bufs.aMisc.setXYZW(
        i,
        e.opts.frost ?? 0.5,
        e.opts.brushAxis === 'y' ? 1 : 0,
        STYLE_ID[e.opts.material] ?? 1,
        heroAmt,
      );
      // Ancestor-overflow clip window (huge default = unclipped).
      let minX = -1e6;
      let minY = -1e6;
      let maxX = 1e6;
      let maxY = 1e6;
      for (const clipEl of e.clipEls) {
        const r = clipEl.getBoundingClientRect();
        if (r.left > minX) minX = r.left;
        if (r.top > minY) minY = r.top;
        if (r.right < maxX) maxX = r.right;
        if (r.bottom < maxY) maxY = r.bottom;
      }
      bufs.aClip.setXYZW(i, minX, minY, maxX, maxY);
    };

    for (const e of entries) {
      e.visible = e.el.isConnected && readQuantizedRect(e.el, dpr, e.rect);
      if (!e.visible) continue;
      if (e.opts.material === 'glass') {
        if (gi < s.capacity) writeInstance(s.glass, s.glassBufs, gi++, e);
      } else {
        if (oi < s.capacity) writeInstance(s.opaque, s.opaqueBufs, oi++, e);
      }
    }

    s.opaque.count = oi;
    s.glass.count = gi;
    s.opaque.instanceMatrix.needsUpdate = true;
    s.glass.instanceMatrix.needsUpdate = true;
    for (const bufs of [s.opaqueBufs, s.glassBufs]) {
      bufs.aRect.needsUpdate = true;
      bufs.aRadii.needsUpdate = true;
      bufs.aState.needsUpdate = true;
      bufs.aMisc.needsUpdate = true;
      bufs.aClip.needsUpdate = true;
    }
  });

  return null;
}
