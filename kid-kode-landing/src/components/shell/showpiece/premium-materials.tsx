'use client';

// PRISM SHELL — SHARED SHOWPIECE MATERIALS + STUDIO (SHELL W1, 2026-07-04)
//
// The premium.ts material language for shell showpiece islands, single-
// sourced (W0 criteria-judge direction: material language lives in ONE
// place). W0's PremiumIconSet and every W1 3D control island (mode switch,
// send button, inspector jewel) build from THESE recipes — gunmetal housing,
// machined steel, brushed/polished chrome, signal-red jewels, smoked glass —
// so the shell's objects read as one machined product family (DL2/DL11/DL12/
// DL14).
//
// Lighting/IBL discipline is W0's: a LOCAL procedural RoomEnvironment PMREM
// (zero remote assets — the 2026-06-29 crash class) plus key/rim lights, so
// speculars visibly travel as forms move (DL4).

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CHROME,
  GUNMETAL,
  GUNMETAL_LIT,
  RED_DEEP,
  RED_HOT,
  SIGNAL_RED,
  SMOKED_GLASS,
  STEEL,
} from '@/components/shell/design/prism-premium-tokens';

// ── Local procedural IBL (no remote HDRI) ────────────────────────────────────

export function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    return () => {
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

// ── Machined material recipes (premium.ts identity hexes) ────────────────────

export function usePremiumMaterials() {
  const materials = useMemo(() => {
    const gunmetal = new THREE.MeshStandardMaterial({
      color: GUNMETAL,
      metalness: 0.92,
      roughness: 0.34,
    });
    const gunmetalLit = new THREE.MeshStandardMaterial({
      color: GUNMETAL_LIT,
      metalness: 0.9,
      roughness: 0.42,
    });
    // Steel — a mid-luminance machined metal between gunmetal and chrome, for
    // forms that must hold their own against a chrome sibling.
    const steel = new THREE.MeshStandardMaterial({
      color: STEEL,
      metalness: 0.92,
      roughness: 0.3,
    });
    const chrome = new THREE.MeshPhysicalMaterial({
      color: CHROME,
      metalness: 1,
      roughness: 0.18,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
    });
    const brushed = new THREE.MeshPhysicalMaterial({
      color: CHROME,
      metalness: 0.95,
      roughness: 0.38,
    });
    const redJewel = new THREE.MeshPhysicalMaterial({
      color: SIGNAL_RED,
      metalness: 0.25,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: new THREE.Color(RED_DEEP),
      emissiveIntensity: 0.55,
    });
    const redHot = new THREE.MeshStandardMaterial({
      color: RED_HOT,
      emissive: new THREE.Color(RED_HOT),
      emissiveIntensity: 1.4,
      metalness: 0.1,
      roughness: 0.4,
    });
    const smokedGlass = new THREE.MeshPhysicalMaterial({
      color: SMOKED_GLASS.color,
      transmission: SMOKED_GLASS.transmission,
      attenuationColor: new THREE.Color(SMOKED_GLASS.attenuationColor),
      attenuationDistance: SMOKED_GLASS.attenuationDistance,
      envMapIntensity: SMOKED_GLASS.envMapIntensity,
      metalness: 0,
      roughness: 0.08,
      ior: 1.5,
      thickness: 0.7,
    });
    return { gunmetal, gunmetalLit, steel, chrome, brushed, redJewel, redHot, smokedGlass };
  }, []);
  // Dispose on unmount — islands are bounded and leave nothing behind.
  useEffect(
    () => () => {
      for (const mat of Object.values(materials)) mat.dispose();
    },
    [materials],
  );
  return materials;
}
export type PremiumMaterials = ReturnType<typeof usePremiumMaterials>;

// ── Standard key/rim light rig (W0 values) ───────────────────────────────────

export function StudioLights({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <directionalLight position={[3.5, 5, 4]} intensity={1.6 * intensity} color={'#ffffff'} />
      <pointLight
        position={[-4, -1.5, -3]}
        intensity={26 * intensity}
        distance={14}
        color={SIGNAL_RED}
      />
      <pointLight
        position={[4.5, 2.5, 3.5]}
        intensity={9 * intensity}
        distance={16}
        color={'#f6f8fb'}
      />
    </>
  );
}
