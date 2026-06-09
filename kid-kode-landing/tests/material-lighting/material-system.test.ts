// Material+Lighting — the material-system factories + receivesLighting
// resolution + the schema param round-trip.
//
// Spec refs:
//   §11 — MeshPhysicalNodeMaterial PBR (dispersion/transmission/ior).
//   §10 decision 7 / INV-8 — unlit image planes preserve the baked look
//        (toneMapped=false). resolveReceivesLighting honors explicit + default.
//   INV-5 — one schema-driven control vocabulary (materialSpecToParams round-trip).

import { describe, expect, it } from 'vitest';
import {
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
} from 'three/webgpu';
import { MATERIAL_SPEC_DEFAULT } from '@/lib/prism-graph/types';
import {
  buildPhysicalMaterial,
  buildUnlitMaterial,
  isLit,
  materialSpecToParams,
  paramsToMaterialSpec,
  resolveReceivesLighting,
} from '@/lib/prism/runtime/shared/material-system';

describe('buildPhysicalMaterial', () => {
  it('applies dispersion / transmission / ior from the spec', () => {
    const mat = buildPhysicalMaterial({
      transmission: 0.8,
      ior: 1.52,
      dispersion: 0.3,
    });
    expect(mat).toBeInstanceOf(MeshPhysicalNodeMaterial);
    expect(mat.transmission).toBeCloseTo(0.8, 5);
    expect(mat.ior).toBeCloseTo(1.52, 5);
    expect((mat as unknown as { dispersion: number }).dispersion).toBeCloseTo(0.3, 5);
    // Transmissive → transparent.
    expect(mat.transparent).toBe(true);
  });

  it('falls back to MATERIAL_SPEC_DEFAULT for unset fields', () => {
    const mat = buildPhysicalMaterial();
    expect(mat.metalness).toBeCloseTo(MATERIAL_SPEC_DEFAULT.metalness!, 5);
    expect(mat.roughness).toBeCloseTo(MATERIAL_SPEC_DEFAULT.roughness!, 5);
    // Opaque default → not transparent.
    expect(mat.transparent).toBe(false);
  });
});

describe('buildUnlitMaterial', () => {
  it('is a basic node material with toneMapped=false (baked look preserved)', () => {
    const mat = buildUnlitMaterial({ color: '#b9532e' });
    expect(mat).toBeInstanceOf(MeshBasicNodeMaterial);
    expect(mat.toneMapped).toBe(false);
  });

  it('honors opacity → transparent', () => {
    const mat = buildUnlitMaterial({ color: '#ffffff', opacity: 0.5 });
    expect(mat.opacity).toBeCloseTo(0.5, 5);
    expect(mat.transparent).toBe(true);
  });
});

describe('resolveReceivesLighting / isLit', () => {
  it('explicit receivesLighting wins over the per-render-mode default', () => {
    expect(resolveReceivesLighting({ receivesLighting: true, renderMode: 'sprite' })).toBe(true);
    expect(resolveReceivesLighting({ receivesLighting: false, renderMode: 'mesh' })).toBe(false);
  });

  it('falls back to the safe default per render mode (image planes UNLIT, meshes LIT)', () => {
    expect(resolveReceivesLighting({ renderMode: 'sprite' })).toBe(false);
    expect(resolveReceivesLighting({ renderMode: 'plane' })).toBe(false);
    expect(resolveReceivesLighting({ renderMode: 'parallax-plane' })).toBe(false);
    expect(resolveReceivesLighting({ renderMode: 'mesh' })).toBe(true);
  });

  it('isLit resolves raw fields the same way', () => {
    expect(isLit(true, 'sprite')).toBe(true);
    expect(isLit(false, 'mesh')).toBe(false);
    expect(isLit(undefined, 'mesh')).toBe(true);
    expect(isLit(undefined, 'sprite')).toBe(false);
  });
});

describe('materialSpecToParams / paramsToMaterialSpec round-trip', () => {
  it('a spec → params → spec preserves the schema-covered fields', () => {
    const spec = {
      baseColor: '#cfd6e6',
      metalness: 0.9,
      roughness: 0.12,
      transmission: 0.85,
      ior: 1.52,
      dispersion: 0.3,
      clearcoat: 0.4,
      iridescence: 0.2,
      thickness: 1.2,
      emissive: '#112233',
      emissiveIntensity: 0.5,
      envMapIntensity: 1.5,
      opacity: 0.9,
    };
    const params = materialSpecToParams(spec);
    const back = paramsToMaterialSpec(params);
    // Every schema-covered key round-trips exactly.
    for (const k of Object.keys(spec) as (keyof typeof spec)[]) {
      expect(back[k]).toEqual(spec[k]);
    }
  });

  it('materialSpecToParams fills defaults for an undefined spec', () => {
    const params = materialSpecToParams();
    expect(params.baseColor).toBe(MATERIAL_SPEC_DEFAULT.baseColor);
    expect(params.metalness).toBe(MATERIAL_SPEC_DEFAULT.metalness);
  });
});
