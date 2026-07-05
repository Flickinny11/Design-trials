'use client';

// PRISM MARKETING — GENERATED PBR MATERIAL LOADER (SHELL W9, DL13)
//
// Loads one of OUR OWN baked matched-latent + delit PBR sets into a
// MeshPhysicalMaterial. The maps live under
// public/prism-mock/editor/textures/generated/<id>/ (committed); they are baked
// by the Replicate FLUX pipeline in the gitignored root .assetgen/ (see
// notes/verification/shell-w9/assetgen-provenance.md). Every map comes from the
// same source plate — the scratch in albedo IS the bump in normal IS the
// roughness change.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

const TEX_ROOT = '/prism-mock/editor/textures/generated';

export interface GeneratedPBROptions {
  repeat?: [number, number];
  metalness?: number;
  roughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  envMapIntensity?: number;
  normalScale?: number;
  color?: string;
  sheen?: number;
  sheenColor?: string;
}

export function useGeneratedPBR(id: string, opts: GeneratedPBROptions = {}): THREE.MeshPhysicalMaterial {
  const material = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const load = (map: string, srgb = false) => {
      const t = loader.load(`${TEX_ROOT}/${id}/${map}.png`);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(opts.repeat?.[0] ?? 1.5, opts.repeat?.[1] ?? 1.5);
      t.anisotropy = 4;
      return t;
    };
    const m = new THREE.MeshPhysicalMaterial({
      color: opts.color ?? '#ffffff',
      map: load('albedo', true),
      normalMap: load('normal'),
      roughnessMap: load('rough'),
      metalnessMap: load('metal'),
      aoMap: load('ao'),
      metalness: opts.metalness ?? 1,
      roughness: opts.roughness ?? 1,
      clearcoat: opts.clearcoat ?? 0,
      clearcoatRoughness: opts.clearcoatRoughness ?? 0.5,
      envMapIntensity: opts.envMapIntensity ?? 1,
      sheen: opts.sheen ?? 0,
    });
    // Only assign sheenColor when a sheen is actually in play — passing
    // `undefined` to the constructor trips a THREE.Material warning.
    if (opts.sheen && opts.sheenColor) m.sheenColor = new THREE.Color(opts.sheenColor);
    m.normalScale.setScalar(opts.normalScale ?? 1);
    return m;
    // The id + option primitives are the identity; a new set means a new material.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(
    () => () => {
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] as const) {
        material[key]?.dispose();
      }
      material.dispose();
    },
    [material],
  );
  return material;
}
