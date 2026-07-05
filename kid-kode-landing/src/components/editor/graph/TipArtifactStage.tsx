'use client';

// GUIDED-TIPS — the in-scene 3D popup artifact (C7 / C8 / C6 hero).
//
// Mounted INSIDE GraphScene's single <Canvas> (INV-1/FP-2: no 2nd renderer, no
// 2nd canvas). When the walkthrough is running it builds the active step's
// animatable registry primitive (glass / holographic / glitch / kinetic-text)
// via the same buildSubject + def.create + seek engine the catalog uses, wraps
// it in a holder it camera-anchors to the popup's transparent artifact-window
// rect (published each frame by WalkthroughPopup), and animates it. A
// self-contained stage glow (and, for glass, lit bokeh) makes it pop without
// polluting the main scene's lighting. Drawn HUD-style (depthTest off, high
// renderOrder) so it always reads inside the framed window.

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWalkthroughStore } from '@/stores/useWalkthroughStore';
import { WALKTHROUGH_STEPS } from '@/lib/editor/walkthrough/steps';
import { buildSubject, setTextSubjectAtlas } from '@/lib/prism/animatable/subjects';
import { getFontRegistry } from '@/lib/prism/text/font-registry';
import { getPrimitive } from '@/lib/prism/animatable/registry';
import '@/lib/prism/animatable/primitives'; // side-effect: populate the registry
import type { Animatable } from '@/lib/prism/animatable/contract';
import { DS } from '@/components/editor/design-system';

// Dedicated render layer so the artifact's studio lights illuminate ONLY the
// artifact (three.js lights respect layers) — never the main scene. The camera
// is opted into this layer so it still SEES the artifact.
const TIP_LAYER = 11;

const safeDur = (inst: Animatable): number => {
  const d = inst.duration();
  return Number.isFinite(d) ? Math.max(0.05, d) : 4;
};

/** Soft radial glow texture (bright core → transparent rim), cached per accent. */
const glowCache = new Map<string, THREE.Texture>();
function glowTexture(hex: string): THREE.Texture {
  const cached = glowCache.get(hex);
  if (cached) return cached;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  const col = new THREE.Color(hex);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c, dy = (y - c) / c;
      const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const a = Math.pow(Math.max(0, 1 - dist), 2.4);
      const i = (y * size + x) * 4;
      data[i] = Math.round(col.r * 255);
      data[i + 1] = Math.round(col.g * 255);
      data[i + 2] = Math.round(col.b * 255);
      data[i + 3] = Math.round(255 * a);
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.needsUpdate = true;
  glowCache.set(hex, tex);
  return tex;
}

/** Dark radial stage texture (graphite core → near-black rim) so the artifact
 *  reads against a clean controlled stage, not the busy live scene behind. */
let stageTex: THREE.Texture | null = null;
function stageTexture(): THREE.Texture {
  if (stageTex) return stageTex;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  const core = new THREE.Color('#1a1e28');
  const rim = new THREE.Color('#06070d');
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c, dy = (y - c) / c;
      const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const t = Math.pow(dist, 1.3);
      const col = core.clone().lerp(rim, t);
      const i = (y * size + x) * 4;
      data[i] = Math.round(col.r * 255);
      data[i + 1] = Math.round(col.g * 255);
      data[i + 2] = Math.round(col.b * 255);
      data[i + 3] = Math.round(255 * (0.97 - 0.18 * t));
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.needsUpdate = true;
  stageTex = tex;
  return tex;
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose?.();
    const mat = m.material;
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((mm) => mm?.dispose?.());
  });
}

export default function TipArtifactStage() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  const status = useWalkthroughStore((s) => s.status);
  const stepIndex = useWalkthroughStore((s) => s.stepIndex);
  const reducedMotion = useWalkthroughStore((s) => s.reducedMotion);
  const rect = useWalkthroughStore((s) => s.artifactFrameRect);

  const running = status === 'running';
  const step = running ? WALKTHROUGH_STEPS[stepIndex] ?? null : null;
  const primName = step?.artifact.primitive ?? null;

  const holderRef = useRef<THREE.Group | null>(null);
  const instRef = useRef<Animatable | null>(null);
  const elapsedRef = useRef(0);
  const baseHeightRef = useRef(1);

  // Best-effort: inject the Inter MSDF atlas so the kinetic-text artifact builds
  // real glyphs (INV-11). Falls back to the primitive's own visual otherwise.
  useEffect(() => {
    let off = false;
    getFontRegistry()
      .resolveAtlas('Inter', 400)
      .then((a) => { if (!off) setTextSubjectAtlas(a); })
      .catch(() => {});
    return () => { off = true; };
  }, []);

  // Build / rebuild the artifact when the step (primitive) changes.
  useEffect(() => {
    const teardown = () => {
      if (instRef.current) { try { instRef.current.dispose(); } catch { /* */ } instRef.current = null; }
      if (holderRef.current) { scene.remove(holderRef.current); disposeTree(holderRef.current); holderRef.current = null; }
    };
    if (!running || !step) { teardown(); return; }
    const def = getPrimitive(step.artifact.primitive);
    if (!def) { teardown(); return; }
    teardown();

    const holder = new THREE.Group();
    holder.name = 'tip-artifact-holder';
    const { object, subject } = buildSubject(step.artifact.subject ?? def.subject, { volumetric: def.volumetric });
    holder.add(object);

    let inst: Animatable | null = null;
    try {
      inst = def.create({ object, subject, scene, userData: {} }, step.artifact.params);
      inst.seek(0);
    } catch (e) {
      console.warn('[guided-tips] artifact create failed:', def.name, e);
    }

    // Clean dark stage panel BEHIND the artifact so it reads as a contained
    // hero, not the busy live scene. Sized generously; the scrim frame hides its
    // edges. Drawn over the scene (depthTest off) but behind the artifact.
    const stage = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 5),
      new THREE.MeshBasicMaterial({ map: stageTexture(), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    stage.position.z = -1.15;
    stage.renderOrder = 9980;
    holder.add(stage);

    // Self-contained stage glow (no scene-light pollution) + lit bokeh for glass.
    const accentHex = step.artifact.accent === 'ice' ? DS.ice300 : DS.metal300;
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: glowTexture(accentHex), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity: 0.8, toneMapped: false }),
    );
    glow.position.z = -0.9;
    glow.renderOrder = 9990;
    holder.add(glow);

    // Lit bokeh behind glass so a clear refractor has bright structure to bend
    // (the catalog's clear-glass fix). Emissive → reads regardless of scene env.
    if (def.category === 'glass') {
      const bokehColors = ['#c6c9cd', '#a9c2d1', '#eef0f3'];
      for (let i = 0; i < 3; i++) {
        const col = new THREE.Color(bokehColors[i]);
        const blob = new THREE.Mesh(
          new THREE.SphereGeometry(0.16 + i * 0.05, 18, 14),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.4, roughness: 0.4, metalness: 0 }),
        );
        blob.position.set((i - 1) * 0.45, (i % 2 ? 0.3 : -0.3), -0.45);
        holder.add(blob);
      }
    }

    // Layer-isolated studio rig — these lights live on TIP_LAYER ONLY, so they
    // illuminate just the artifact (which also carries TIP_LAYER) and NEVER the
    // main scene (scene objects are layer-0 only). The artifact keeps layer 0 so
    // the render camera still sees it (no camera-layer change → robust against
    // any custom render camera). Warm brass key + cool ice fill + soft ambient.
    const amb = new THREE.AmbientLight(0xffffff, 0.9);
    const key = new THREE.DirectionalLight(0xfff3df, 2.6);
    key.position.set(2.5, 3, 4);
    const fill = new THREE.DirectionalLight(0x9fb6c8, 0.8);
    fill.position.set(-3, -1.5, 2);
    for (const l of [amb, key, fill]) l.layers.set(TIP_LAYER);
    holder.add(amb, key, fill);

    // HUD-style: always read inside the framed window regardless of nearby scene
    // geometry. Glass keeps depthTest (its transmission pass needs scene depth);
    // everything else draws on top.
    const glassy = def.category === 'glass';
    object.traverse((o) => {
      // Enable (not set) TIP_LAYER so the artifact keeps layer 0 (camera sees
      // it) AND receives the TIP_LAYER studio lights.
      o.layers.enable(TIP_LAYER);
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.renderOrder = 10000;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mm) => {
        if (!mm) return;
        if (!glassy) { mm.depthTest = false; mm.depthWrite = false; }
      });
    });
    // bokeh also need the studio lights.
    holder.children.forEach((c) => { if (c !== object) c.layers.enable(TIP_LAYER); });

    const box = new THREE.Box3().setFromObject(object);
    const h = box.max.y - box.min.y;
    baseHeightRef.current = Number.isFinite(h) && h > 0.001 ? h : 1;

    scene.add(holder);
    holderRef.current = holder;
    instRef.current = inst;
    elapsedRef.current = (reducedMotion ? 0.42 : 0) * (inst ? safeDur(inst) : 4);

    return teardown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, primName, stepIndex, scene]);

  useFrame((_, delta) => {
    const holder = holderRef.current;
    if (!holder) return;
    if (!rect || !running) { holder.visible = false; return; }
    holder.visible = true;

    const inst = instRef.current;
    if (inst) {
      if (!reducedMotion) elapsedRef.current += delta;
      const dur = safeDur(inst);
      try { inst.seek(elapsedRef.current % dur); } catch { /* logged on create */ }
    }

    // Camera-anchor the holder to the popup's artifact-window rect.
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const ndcX = (cx / size.width) * 2 - 1;
    const ndcY = -((cy / size.height) * 2 - 1);
    const d = 2.6;
    const persp = camera as THREE.PerspectiveCamera;
    let halfH: number, halfW: number;
    if (persp.isPerspectiveCamera) {
      halfH = Math.tan(((persp.fov * Math.PI) / 180) / 2) * d;
      halfW = halfH * persp.aspect;
    } else {
      const o = camera as THREE.OrthographicCamera;
      halfH = ((o.top - o.bottom) / 2) / (o.zoom || 1);
      halfW = ((o.right - o.left) / 2) / (o.zoom || 1);
    }
    const local = new THREE.Vector3(ndcX * halfW, ndcY * halfH, -d);
    camera.updateMatrixWorld();
    holder.position.copy(camera.localToWorld(local));
    holder.quaternion.copy(camera.quaternion);
    const worldWinH = (rect.h / size.height) * 2 * halfH;
    const s = (worldWinH * 0.72) / baseHeightRef.current;
    holder.scale.setScalar(s > 0 && Number.isFinite(s) ? s : 1);

    // debug: project holder center back to screen px
    const proj = holder.position.clone().project(camera);
    (window as unknown as { __TIP_ART_DBG__?: unknown }).__TIP_ART_DBG__ = {
      visible: holder.visible,
      children: holder.children.length,
      worldPos: { x: +holder.position.x.toFixed(2), y: +holder.position.y.toFixed(2), z: +holder.position.z.toFixed(2) },
      screen: { x: Math.round(((proj.x + 1) / 2) * size.width), y: Math.round(((1 - proj.y) / 2) * size.height) },
      rectCenter: { x: Math.round(rect.x + rect.w / 2), y: Math.round(rect.y + rect.h / 2) },
      scale: +holder.scale.x.toFixed(3),
      camType: persp.isPerspectiveCamera ? 'persp' : 'ortho',
    };
  });

  return null;
}
