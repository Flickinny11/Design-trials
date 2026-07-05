// Text System P1/A1 — msdf-material: live property surface + TSL graph shape.
// Node env, stub Texture — TSL graph construction is pure JS (no renderer).

import { describe, expect, it } from 'vitest';
import { Color, NoColorSpace, Texture } from 'three';
import { createMsdfNodeMaterial } from '@/lib/prism/text/msdf-material';

describe('createMsdfNodeMaterial', () => {
  it('keeps the standard property surface LIVE for the text primitives', () => {
    const mat = createMsdfNodeMaterial({ atlas: new Texture() });
    expect(mat.transparent).toBe(true);
    expect(mat.color).toBeInstanceOf(Color);
    expect(mat.emissive).toBeInstanceOf(Color);
    expect(typeof mat.emissiveIntensity).toBe('number');
    expect(typeof mat.opacity).toBe('number');
    // Settable — primitives mutate these directly every frame.
    mat.color.set('#ff0000');
    expect(mat.color.getHexString()).toBe('ff0000');
    mat.emissive.set('#00ff00');
    expect(mat.emissive.getHexString()).toBe('00ff00');
    mat.emissiveIntensity = 1.4;
    expect(mat.emissiveIntensity).toBe(1.4);
    mat.opacity = 0.25;
    expect(mat.opacity).toBe(0.25);
  });

  it('applies the catalog proxy-glyph defaults and solid fill colors', () => {
    const mat = createMsdfNodeMaterial({
      atlas: new Texture(),
      fill: { kind: 'solid', color: '#5ad4ff' },
    });
    expect(mat.roughness).toBeCloseTo(0.28);
    expect(mat.metalness).toBeCloseTo(0.35);
    expect(mat.envMapIntensity).toBeCloseTo(1.15);
    expect(mat.depthWrite).toBe(false);
    expect(mat.color.getHexString()).toBe('5ad4ff');
    expect(mat.emissiveIntensity).toBeCloseTo(0.7);
    // Solid keeps colorNode UNSET so primitives drive mat.color directly.
    expect(mat.colorNode).toBeFalsy();
    expect(mat.opacityNode).toBeTruthy();
  });

  it('glow overrides emissive color and intensity', () => {
    const mat = createMsdfNodeMaterial({
      atlas: new Texture(),
      fill: { kind: 'solid', color: '#5ad4ff' },
      glow: { color: '#ffaa00', intensity: 2.5 },
    });
    expect(mat.emissive.getHexString()).toBe('ffaa00');
    expect(mat.emissiveIntensity).toBe(2.5);
  });

  it('gradient / texture fills set a colorNode; outline forces one', () => {
    const gradient = createMsdfNodeMaterial({
      atlas: new Texture(),
      fill: { kind: 'gradient', from: '#ff0000', to: '#0000ff', angleDeg: 45 },
    });
    expect(gradient.colorNode).toBeTruthy();

    const textured = createMsdfNodeMaterial({
      atlas: new Texture(),
      fill: { kind: 'texture', url: '/x.png' },
      fillTexture: new Texture(),
    });
    expect(textured.colorNode).toBeTruthy();

    // texture fill WITHOUT an injected texture degrades to the live solid path
    // (the material never loads URLs itself).
    const pending = createMsdfNodeMaterial({
      atlas: new Texture(),
      fill: { kind: 'ai-texture', prompt: 'molten gold' },
    });
    expect(pending.colorNode).toBeFalsy();

    const outlined = createMsdfNodeMaterial({
      atlas: new Texture(),
      fill: { kind: 'solid', color: '#ffffff' },
      outline: { color: '#000000', width: 0.4 },
    });
    expect(outlined.colorNode).toBeTruthy();
    expect(outlined.opacityNode).toBeTruthy();
  });

  it('forces the atlas to NoColorSpace (MSDF is data, not color)', () => {
    const atlas = new Texture();
    atlas.colorSpace = 'srgb';
    createMsdfNodeMaterial({ atlas });
    expect(atlas.colorSpace).toBe(NoColorSpace);
  });
});
