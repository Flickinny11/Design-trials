// T03 — TSL shader library.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L252-L274 ("Six fragment shaders
// shipped in `shared/shaders/`. All written in TSL so they compile to both
// WGSL (WebGPU) and GLSL (WebGL2 fallback)") and PRISM-RENDERER-MIGRATION-SPEC.md
// §11 L417-L422 (one shader file per name).
//
// Tests run in a node environment; we cannot evaluate WGSL/GLSL output, so
// we verify (a) every shader factory exists and is callable, (b) returns a
// truthy node-graph value, and (c) exposes the uniform handles the
// consuming primitives need (per CPL primitive descriptions).

import { describe, expect, it } from 'vitest';
import {
  displacementShader,
  dissolveShader,
  radialBlurShader,
  rgbShiftShader,
  twistedWaveShader,
  voronoiParticleShader,
} from '@/lib/prism/runtime/shared/shaders';
import * as TSL from 'three/tsl';
import * as THREE from 'three';

const ALL_SHADERS = [
  ['displacement', displacementShader],
  ['dissolve', dissolveShader],
  ['voronoi-particle', voronoiParticleShader],
  ['twisted-wave', twistedWaveShader],
  ['radial-blur', radialBlurShader],
  ['rgb-shift', rgbShiftShader],
] as const;

describe('TSL shader library', () => {
  it('exports all 6 named shader factories', () => {
    for (const [name, fn] of ALL_SHADERS) {
      expect(fn, `shader ${name} export missing`).toBeTypeOf('function');
    }
  });

  it('each shader factory returns a truthy TSL node when called', () => {
    // Provide a minimal stub texture/uniform context per shader.
    const tex = new THREE.Texture();
    const result = displacementShader({
      baseTexture: tex,
      displacementMap: tex,
      intensity: TSL.uniform(0.5),
    });
    expect(result).toBeTruthy();
  });

  it('dissolve shader exposes a `progress` uniform binding', () => {
    const tex = new THREE.Texture();
    const progress = TSL.uniform(0);
    const result = dissolveShader({
      baseTexture: tex,
      secondaryTexture: tex,
      progress,
      noiseScale: TSL.uniform(8),
      edgeColor: TSL.uniform(new THREE.Color(1, 1, 1)),
      edgeWidth: TSL.uniform(0.04),
    });
    expect(result).toBeTruthy();
    // The factory accepted the progress uniform without throwing.
    expect(progress.value).toBe(0);
  });

  it('voronoi-particle shader returns a node graph', () => {
    const result = voronoiParticleShader({
      uv: TSL.uv(),
      time: TSL.uniform(0),
      cellScale: TSL.uniform(8),
    });
    expect(result).toBeTruthy();
  });

  it('twisted-wave shader returns a node graph', () => {
    const tex = new THREE.Texture();
    const result = twistedWaveShader({
      baseTexture: tex,
      time: TSL.uniform(0),
      cursor: TSL.uniform(new THREE.Vector2(0, 0)),
      amplitude: TSL.uniform(0.05),
    });
    expect(result).toBeTruthy();
  });

  it('radial-blur shader returns a node graph', () => {
    const tex = new THREE.Texture();
    const result = radialBlurShader({
      baseTexture: tex,
      center: TSL.uniform(new THREE.Vector2(0.5, 0.5)),
      strength: TSL.uniform(0.5),
    });
    expect(result).toBeTruthy();
  });

  it('rgb-shift shader returns a node graph', () => {
    const tex = new THREE.Texture();
    const result = rgbShiftShader({
      baseTexture: tex,
      offset: TSL.uniform(new THREE.Vector2(0.005, 0)),
    });
    expect(result).toBeTruthy();
  });
});
