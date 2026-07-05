'use client';

// PRISM MARKETING — WEBGPU-SAFE STUDIO ENVIRONMENT (SHELL W9)
//
// The premium IBL for W9 showpieces on EITHER backend. On WebGPU the r184
// PMREMGenerator's async path (`fromSceneAsync`) is the supported route — the
// sync `fromScene` is what failed in W6 and forced that hero onto WebGL2.
// Local procedural RoomEnvironment only (zero remote assets — the 2026-06-29
// crash class). Falls back silently to analytic lights (ForgeLights) if the
// environment cannot build; showpieces must remain readable on lights alone.

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SIGNAL_RED } from '@/components/shell/design/prism-premium-tokens';

export function ForgeEnvironment({ intensity = 1 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    let cancelled = false;
    let tex: THREE.Texture | null = null;
    let pmrem: { dispose: () => void } | null = null;
    (async () => {
      try {
        const room = new RoomEnvironment();
        const gen = new THREE.PMREMGenerator(gl as unknown as THREE.WebGLRenderer) as unknown as {
          fromScene: (s: THREE.Scene, sigma?: number) => { texture: THREE.Texture };
          fromSceneAsync?: (s: THREE.Scene, sigma?: number) => Promise<{ texture: THREE.Texture }>;
          dispose: () => void;
        };
        pmrem = gen;
        const rt = gen.fromSceneAsync
          ? await gen.fromSceneAsync(room, 0.04)
          : gen.fromScene(room, 0.04);
        if (cancelled) {
          rt.texture.dispose();
          return;
        }
        tex = rt.texture;
        scene.environment = tex;
        scene.environmentIntensity = intensity;
      } catch {
        // Analytic lights carry the scene; nothing to clean up.
      }
    })();
    return () => {
      cancelled = true;
      if (scene.environment === tex) scene.environment = null;
      tex?.dispose();
      pmrem?.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}

/** The W0 key/rim rig re-tuned for the black atelier: a cool key, a signal-red
 *  underlight, a chrome kicker. Works on both backends; carries the scene when
 *  the PMREM env cannot build. */
export function ForgeLights({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <directionalLight position={[3.5, 5.5, 4]} intensity={1.5 * intensity} color="#ffffff" />
      <pointLight position={[-4, -1.6, -3]} intensity={30 * intensity} distance={16} color={SIGNAL_RED} />
      <pointLight position={[4.5, 2.5, 3.5]} intensity={10 * intensity} distance={18} color="#f6f8fb" />
      <ambientLight intensity={0.08 * intensity} />
    </>
  );
}
