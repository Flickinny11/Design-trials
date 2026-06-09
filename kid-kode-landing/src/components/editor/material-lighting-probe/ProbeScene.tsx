'use client';

// ProbeScene — the client probe component behind /material-lighting-probe.
//
// ONE WebGPURenderer on a full-size canvas. It mounts three artifacts that
// exercise the Material + Lighting subsystem end-to-end:
//   (a) a LIT glassy sphere (left)  — buildPhysicalMaterial, castShadow.
//   (b) an UNLIT image plane (right)— buildUnlitMaterial; receivesLighting=false,
//       so lights/env never touch its color (the baked-diffusion guarantee).
//   (c) a shadow-catching ground    — MeshStandardNodeMaterial, receiveShadow.
//
// The scene-wide lighting comes from `createLightingRig`, so the rig owns the
// env/IBL, the key/fill/rim lights, soft shadows, and the capability-gated T2
// post path. The loop is `rig.render() || renderer.render(scene, camera)`.
//
// This file lives under src/components/** (NOT the prism runtime), so it MAY use
// the '@/' alias and DOM (window/document) freely — exactly what a verification
// surface needs. It is deliberately simple + robust (try/catch around init).

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MeshStandardNodeMaterial, WebGPURenderer } from 'three/webgpu';
import {
  createLightingRig,
  type LightingRigHandle,
} from '@/lib/prism/runtime/shared/lighting-rig';
import {
  buildPhysicalMaterial,
  buildUnlitMaterial,
  tagUnlitObject,
} from '@/lib/prism/runtime/shared/material-system';
import type { LightingTier, LightingTierPreference } from '@/lib/prism-graph/types';

// The handle the verification harness reads off `window`.
interface MlProbeHandle {
  ready: boolean;
  readonly backend: string;
  getProfile: () => unknown;
  setKeyIntensity: (v: number) => void;
  toggleKey: () => void;
  setReceivesLighting: (which: 'sphere' | 'plane', lit: boolean) => void;
  /** Exact CSS-pixel screen centers of the two artifacts, for precise sampling. */
  getScreenPoints: () => { sphere: { x: number; y: number }; plane: { x: number; y: number }; w: number; h: number };
}

declare global {
  // eslint-disable-next-line no-var
  var __mlProbe: MlProbeHandle | undefined;
}

function parseTierParam(search: string): LightingTierPreference {
  const m = /[?&]tier=(T0|T1|T2)/.exec(search);
  return (m?.[1] as LightingTier | undefined) ?? 'auto';
}

function parseMobileParam(search: string): boolean {
  return /[?&]mobile=1\b/.test(search);
}

export default function ProbeScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let renderer: WebGPURenderer | null = null;
    let rig: LightingRigHandle | null = null;
    let raf = 0;
    let backendName = 'unknown';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06070d');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 2.4, 7.5);
    camera.lookAt(0, 0.4, 0);

    // ── Artifacts ──────────────────────────────────────────────────────────
    // (a) LIT glassy sphere on the left.
    const sphereGeo = new THREE.SphereGeometry(1, 64, 48);
    const sphereMat = buildPhysicalMaterial({
      baseColor: '#cfd6e6',
      metalness: 0.1,
      roughness: 0.25,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(-1.8, 0.6, 0);
    sphere.castShadow = true;
    sphere.name = 'lit-sphere';
    scene.add(sphere);

    // (b) UNLIT image plane on the right (receivesLighting=false → baked look).
    const planeGeo = new THREE.PlaneGeometry(2, 2.4);
    const planeMat = buildUnlitMaterial({ color: '#b9532e' });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.position.set(1.9, 0.8, 0);
    plane.name = 'unlit-plane';
    // criterion 17 @ T2: tag onto the unlit layer so the rig's screen-space
    // GI/AO mask excludes it (its baked color stays byte-identical to T0/T1).
    tagUnlitObject(plane);
    scene.add(plane);

    // (c) Large shadow-catching ground (MeshStandardNodeMaterial, receiveShadow).
    // A lit node material so the ground reacts to the rig lights and renders the
    // soft shadow cast by the sphere.
    const groundGeo = new THREE.PlaneGeometry(40, 40);
    const groundMat = new MeshStandardNodeMaterial();
    groundMat.color = new THREE.Color('#1a1d27');
    groundMat.roughness = 0.9;
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    ground.name = 'shadow-ground';
    scene.add(ground);

    // ── Lighting rig (scene-wide env/IBL + lights + shadows + T2 post) ───────
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const tier = parseTierParam(search);
    const isMobile = parseMobileParam(search);

    function setSize() {
      if (!renderer) return;
      const w = canvas!.clientWidth || window.innerWidth;
      const h = canvas!.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      rig?.setSize(w, h);
    }

    async function init() {
      try {
        renderer = new WebGPURenderer({
          canvas: canvas!,
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        });
        (renderer as unknown as { toneMapping: THREE.ToneMapping }).toneMapping =
          THREE.ACESFilmicToneMapping;
        (renderer as unknown as { toneMappingExposure: number }).toneMappingExposure = 1.1;
        renderer.shadowMap.enabled = true;
        await renderer.init();

        try {
          const n = (renderer.backend?.constructor?.name || '').toLowerCase();
          backendName = n.includes('webgpu') ? 'webgpu' : n.includes('webgl') ? 'webgl2' : 'unknown';
        } catch {
          backendName = 'unknown';
        }

        rig = createLightingRig(scene, camera, renderer, {
          tier,
          isMobile,
          size: {
            width: canvas!.clientWidth || window.innerWidth,
            height: canvas!.clientHeight || window.innerHeight,
          },
        });

        setSize();
        window.addEventListener('resize', setSize);

        exposeHandle();
        loop();
      } catch (err) {
        // Verification surface: never hard-crash the page — record the failure
        // on the handle so the harness can read it.
        globalThis.__mlProbe = {
          ready: false,
          get backend() {
            return 'init-failed';
          },
          getProfile: () => ({ error: (err as Error).message }),
          setKeyIntensity: () => {},
          toggleKey: () => {},
          setReceivesLighting: () => {},
        getScreenPoints: () => ({ sphere: { x: 0, y: 0 }, plane: { x: 0, y: 0 }, w: 0, h: 0 }),
        };
      }
    }

    let firstFrameDrawn = false;
    let keyOn = true;
    let lastKeyIntensity = 1.3;

    function loop() {
      if (disposed || !renderer) return;
      raf = requestAnimationFrame(loop);
      sphere.rotation.y += 0.004;
      const drew = rig?.render() ?? false;
      if (!drew) renderer.render(scene, camera);
      if (!firstFrameDrawn) {
        firstFrameDrawn = true;
        const h = globalThis.__mlProbe;
        if (h) h.ready = true;
      }
    }

    function exposeHandle() {
      globalThis.__mlProbe = {
        ready: false,
        get backend() {
          return backendName;
        },
        getProfile: () => rig?.profile ?? null,
        setKeyIntensity(v: number) {
          lastKeyIntensity = v;
          rig?.updateLight('key', { intensity: v });
        },
        toggleKey() {
          keyOn = !keyOn;
          rig?.updateLight('key', { intensity: keyOn ? lastKeyIntensity : 0 });
        },
        setReceivesLighting(which: 'sphere' | 'plane', lit: boolean) {
          // Swap the artifact's material lane to demonstrate the receivesLighting
          // contract: lit → physical PBR; unlit → baked basic material.
          const target = which === 'sphere' ? sphere : plane;
          const old = target.material as THREE.Material;
          if (which === 'plane') {
            target.material = lit
              ? buildPhysicalMaterial({ baseColor: '#b9532e', roughness: 0.6 })
              : buildUnlitMaterial({ color: '#b9532e' });
          } else {
            target.material = lit
              ? buildPhysicalMaterial({ baseColor: '#cfd6e6', metalness: 0.1, roughness: 0.25 })
              : buildUnlitMaterial({ color: '#cfd6e6' });
          }
          old.dispose();
        },
        getScreenPoints() {
          const w = canvas!.clientWidth || window.innerWidth;
          const h = canvas!.clientHeight || window.innerHeight;
          const project = (obj: THREE.Object3D) => {
            const v = obj.position.clone().project(camera);
            return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
          };
          return { sphere: project(sphere), plane: project(plane), w, h };
        },
      };
    }

    void init();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', setSize);
      rig?.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      planeGeo.dispose();
      planeMat.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      try {
        renderer?.dispose();
      } catch {
        /* ignore */
      }
      if (globalThis.__mlProbe) globalThis.__mlProbe.ready = false;
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#06070d' }}>
      <canvas
        ref={canvasRef}
        data-component="ml-probe-canvas"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
