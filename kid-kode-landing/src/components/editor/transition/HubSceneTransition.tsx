'use client';

/**
 * PHASE3 (P3-1) — TRUE in-WebGPU cinematic hub transition.
 *
 * Fixes Phase-2 flag #4. The Phase-2 in-canvas curtain "rendered but never
 * covered the viewport" because it was a frustum-culled, scene-ROOTED plane that
 * merely copied the camera pose each frame. The two camera-aligned objects that
 * DO composite in this exact pipeline (`HubSceneBackground`, `ChromeSlabLayer`)
 * reveal the fix:
 *   1. `frustumCulled = false` (a near-camera plane otherwise fails the
 *      bounding-sphere frustum test and is silently skipped — the exact
 *      "projected corners cover the screen, yet invisible" symptom);
 *   2. PARENT the quad to the camera, and put the camera in the scene graph
 *      (`if (camera.parent == null) scene.add(camera); camera.add(group)`) —
 *      THREE only renders camera children when the camera is itself in the
 *      scene graph (the non-obvious `ChromeSlabLayer.tsx` idiom).
 *
 * The look: a dimensional brass curtain (pleated, draped, with a luminous god-
 * ray seam) that closes from both sides across the viewport, holds through the
 * hub swap, then sweeps open to reveal the new hub. Built entirely in TSL on one
 * screen-space quad — no DOM overlay (verify: `__PRISM_HUB_TRANSITION__.inCanvas`
 * is true and there is no `.ds-hub-morph-stage` DOM node). Paired with a camera
 * dolly-through in SceneControlsBridge so the move reads as travelling THROUGH
 * 3D space, not a cut.
 *
 * Timing is frame-driven (dt-clamped) and the content swap is GATED to peak
 * coverage (see useHubTransitionStore) so the expensive activeHubId mount fires
 * while the curtain is fully closed — a frozen-at-full-cover curtain during the
 * main-thread stall is exactly what hides the swap.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import * as TSLNS from 'three/tsl';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import {
  useHubTransitionStore,
  requestHubNavigation,
} from '@/stores/useHubTransitionStore';

const TSL = TSLNS as unknown as Record<string, (...a: unknown[]) => unknown> & {
  screenUV: unknown;
};

const PI2 = 6.28318530718;
const QUAD_DISTANCE = 0.35; // world units in front of the camera (near = 0.1)
const TRANSITION_RENDER_ORDER = 9500; // over scene + chrome slabs (9000/9100)

// Tuned so the curtain reaches full cover quickly (swap hides under it), holds
// through the heavy mount, then opens a touch slower for a luxurious reveal.
const CLOSE_S = 0.34;
const HOLD_S = 0.2;
const OPEN_S = 0.46;

// Live coverage, readable by the verification getter without a store re-render.
let liveCover = 0;
// Verification-only: when set to a number, freezes the curtain at that coverage
// (the state machine is paused) so deterministic frames can be captured.
let debugHold: number | null = null;

function smooth01(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

/** Brass curtain TSL — closes from both edges, pleated + draped, lit seam. */
function makeCurtainMaterial(): {
  material: THREE.Material;
  uCover: { value: number };
  uTime: { value: number };
} {
  const {
    uniform, vec3, vec4, float, smoothstep, mix, clamp, abs, max, sin, pow,
  } = TSL as unknown as Record<string, (...a: unknown[]) => any>;
  const screenUV = (TSL as any).screenUV;

  const uCover = uniform(0) as unknown as { value: number } & any;
  const uTime = uniform(0) as unknown as { value: number } & any;

  const x = screenUV.x;
  const y = screenUV.y;

  // Closing edges: left panel spans x < leftEdge; right panel spans x > rightStart.
  // Panels close slightly PAST centre (0.52) so they OVERLAP at full cover and
  // leave no scene sliver to leak through during the swap.
  const half = uCover.mul(0.52);
  const leftEdge = half; // 0 → 0.52 as cover 0 → 1
  const rightStart = float(1).sub(half); // 1 → 0.48
  const feather = float(0.02);

  // Coverage alpha (feathered leading edges).
  const leftA = float(1).sub(smoothstep(leftEdge.sub(feather), leftEdge, x));
  const rightA = smoothstep(rightStart, rightStart.add(feather), x);
  const coverageA = max(leftA, rightA);

  // Distance from each panel's own leading (inner) edge → drape shading.
  const dLeadL = leftEdge.sub(x); // >0 inside left panel
  const dLeadR = x.sub(rightStart); // >0 inside right panel
  const dLead = max(dLeadL, dLeadR); // depth into whichever panel covers this px

  // Pleats: vertical brass folds, phase-warped by y so the drape undulates
  // (dimensional, not a flat wipe) and drifts slowly with time.
  const warp = sin(y.mul(4.2).add(uTime.mul(1.15))).mul(0.55);
  const pleatRaw = sin(x.mul(PI2).mul(22).add(warp)); // -1..1
  const pleat = pleatRaw.mul(0.5).add(0.5); // 0..1

  const brassDark = vec3(0.02, 0.014, 0.007);
  const brassMid = vec3(0.5, 0.36, 0.165);
  const brassLite = vec3(0.96, 0.82, 0.55);
  const folds = mix(brassDark, brassMid, pow(pleat, float(0.7)));
  const lit = mix(folds, brassLite, pow(pleat, float(2.4)));
  // Crisp specular crest riding each fold ridge → metallic, not fuzzy.
  const crest = pow(clamp(pleatRaw, float(0), float(1)), float(13)).mul(0.62);

  // Drape depth: darker toward the inner leading edge, brighter toward the
  // outer screen edge → catches the light like real hanging cloth.
  const shade = clamp(float(0.5).add(dLead.mul(1.7)), float(0.4), float(1.05));
  // Gentle vertical gravity-fall gradient.
  const fall = mix(float(1.06), float(0.82), y.oneMinus());
  const crestGold = vec3(1.0, 0.95, 0.82);
  let col = lit.mul(shade).mul(fall).add(crestGold.mul(crest));

  // Luminous god-ray seam riding each closing edge (warm ice-gold), brightest
  // as the curtain nears closed.
  const seamGold = vec3(1.0, 0.92, 0.72);
  const seamL = smoothstep(feather.mul(2.4), float(0), abs(x.sub(leftEdge)));
  const seamR = smoothstep(feather.mul(2.4), float(0), abs(x.sub(rightStart)));
  const seam = max(seamL, seamR).mul(uCover);
  // Central meeting flash when nearly closed.
  const centerFlash = smoothstep(float(0.04), float(0), abs(x.sub(0.5)))
    .mul(smoothstep(float(0.82), float(1.0), uCover));
  const glow = max(seam, centerFlash);
  col = col.add(seamGold.mul(glow).mul(0.9));

  const material = new THREE.MeshBasicNodeMaterial();
  (material as any).colorNode = col;
  (material as any).opacityNode = coverageA;
  material.transparent = true;
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  material.side = THREE.DoubleSide;

  return { material, uCover, uTime };
}

export function HubSceneTransition() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const viewMode = useGraphEditorStore((s) => s.viewMode);

  const built = useMemo(() => makeCurtainMaterial(), []);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const timerRef = useRef(0);
  const lastTokenRef = useRef(0);
  const coverRef = useRef(0);
  const pendingCommitRef = useRef(false);

  // Mount the camera-parented quad (the ChromeSlabLayer idiom) + the verify hook.
  useEffect(() => {
    if (viewMode !== 'preview-app') return;
    if (camera.parent == null) scene.add(camera);
    const group = new THREE.Group();
    group.name = 'hub-scene-transition';
    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, built.material);
    mesh.frustumCulled = false;
    mesh.renderOrder = TRANSITION_RENDER_ORDER;
    mesh.position.set(0, 0, -QUAD_DISTANCE);
    mesh.visible = false;
    group.add(mesh);
    camera.add(group);
    meshRef.current = mesh;
    groupRef.current = group;

    useHubTransitionStore.getState()._setDriverMounted(true);
    (window as unknown as Record<string, unknown>).__PRISM_HUB_TRANSITION__ = {
      inCanvas: true,
      get phase() {
        return useHubTransitionStore.getState().phase;
      },
      get cover() {
        return liveCover;
      },
      get token() {
        return useHubTransitionStore.getState().token;
      },
      begin(hubId: string) {
        requestHubNavigation(hubId);
      },
      // Verification-only: freeze the curtain at a coverage in [0,1] for
      // deterministic frame capture; pass null to resume the state machine.
      setHold(v: number | null) {
        debugHold = v;
      },
    };

    return () => {
      useHubTransitionStore.getState()._setDriverMounted(false);
      camera.remove(group);
      geo.dispose();
      built.material.dispose();
      meshRef.current = null;
      groupRef.current = null;
      delete (window as unknown as Record<string, unknown>).__PRISM_HUB_TRANSITION__;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, scene, viewMode]);

  useFrame((_, rawDt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 1 / 30); // clamp the giant first-frame dt

    // Verification-only: hold the curtain at a fixed coverage for capture.
    if (debugHold != null) {
      const held = Math.max(0, Math.min(1, debugHold));
      coverRef.current = held;
      liveCover = held;
      built.uCover.value = held;
      built.uTime.value += dt;
      mesh.visible = held > 0.001;
      if (mesh.visible) {
        const camH = camera as THREE.PerspectiveCamera;
        const wH = 2 * QUAD_DISTANCE * Math.tan((camH.fov * Math.PI) / 360);
        const wW = wH * (size.width / Math.max(1, size.height));
        mesh.scale.set(wW * 1.05, wH * 1.05, 1);
      }
      return;
    }

    const st = useHubTransitionStore.getState();

    if (st.token !== lastTokenRef.current) {
      lastTokenRef.current = st.token;
      timerRef.current = 0; // a fresh request resets the close timer
    }

    let cover = coverRef.current;
    const phase = st.phase;
    if (phase === 'closing') {
      timerRef.current += dt;
      cover = smooth01(timerRef.current / CLOSE_S);
      if (timerRef.current >= CLOSE_S) {
        cover = 1;
        // Defer the swap one frame so a FULLY-covered frame paints before the
        // heavy mount stalls the main thread (otherwise the stall freezes the
        // curtain a hair short of closed and a centre sliver of the swap leaks).
        pendingCommitRef.current = true;
        st._setPhase('holding');
        timerRef.current = 0;
      }
    } else if (phase === 'holding') {
      cover = 1;
      if (pendingCommitRef.current) {
        // First holding frame: the cover=1 frame has now painted → commit.
        pendingCommitRef.current = false;
        st._commit();
      } else {
        timerRef.current += dt;
        if (timerRef.current >= HOLD_S) {
          st._setPhase('opening');
          timerRef.current = 0;
        }
      }
    } else if (phase === 'opening') {
      timerRef.current += dt;
      cover = 1 - smooth01(timerRef.current / OPEN_S);
      if (timerRef.current >= OPEN_S) {
        cover = 0;
        st._setPhase('idle');
        timerRef.current = 0;
      }
    } else {
      // idle — ease any residual coverage to 0
      cover = Math.max(0, cover - dt * 5);
    }
    coverRef.current = cover;
    liveCover = cover;
    built.uCover.value = cover;
    built.uTime.value += dt;

    mesh.visible = cover > 0.001;
    if (mesh.visible) {
      // Size the quad to fill the viewport at QUAD_DISTANCE (fov/aspect live).
      const cam = camera as THREE.PerspectiveCamera;
      const worldH = 2 * QUAD_DISTANCE * Math.tan((cam.fov * Math.PI) / 360);
      const worldW = worldH * (size.width / Math.max(1, size.height));
      mesh.scale.set(worldW * 1.05, worldH * 1.05, 1);
    }
  });

  return null;
}
