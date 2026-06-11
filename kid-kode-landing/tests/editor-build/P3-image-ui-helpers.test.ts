// P3-image-ui-helpers — Image toolbar group pure helpers (canvas-spec §5
// Image tools; P3 Task B).
//
// Covers:
//   1. buildImageNode output is a BORN-Populated image-plane node: renderMode
//      'sprite', visual.sourceAsset = url (the artifact), plane sized from
//      the source pixels (width capped at IMAGE_MAX_EXTENT, height from the
//      aspect), spawn point distinct from the Add Text and Add Element spawn
//      points, the 'New image' caption convention, minimal-node conventions
//      (codeRef '' / backendRef null / serviceTag 'main' / empty specs).
//   2. imagePlaneSize aspect sizing incl. degenerate inputs.
//   3. isImageBearingNode gates Replace/presentation to image render modes
//      that actually carry a sourceAsset.
//   4. imageSpec immutable update helpers: effectiveImageSpec defaulting,
//      withImageSpecPatch / withCropPatch whole-object replacement semantics
//      (fresh object, inputs untouched, 0..1 clamping).
//   5. normalizeImageUrl paste-a-link normalization.

import { describe, expect, it } from 'vitest';
import type { ImageSpec, PrismNode } from '@/lib/prism-graph/types';
import { IMAGE_SPEC_DEFAULT } from '@/lib/prism-graph/types';
import {
  CROP_FULL_FRAME,
  IMAGE_MAX_EXTENT,
  IMAGE_SPAWN_POSITION,
  buildImageNode,
  clamp01,
  effectiveImageSpec,
  imageDisplayName,
  imageNodeCaption,
  imagePlaneSize,
  isImageBearingNode,
  normalizeImageUrl,
  withCropPatch,
  withImageSpecPatch,
} from '@/components/editor/image-tools/image-helpers';
import {
  BUBBLE_SPAWN_POSITION,
  isStage0Bubble,
} from '@/components/editor/add-tools/create-element-node';
import { buildTextNode } from '@/lib/prism/text/create-text-node';

const URL = '/prism-assets/uploads/cat.png';

function makeImageNode(over: Partial<PrismNode> = {}): PrismNode {
  return {
    nodeId: 'node-img-1',
    parentHubId: 'hub-1',
    subtype: 'image',
    serviceTag: 'main',
    renderMode: 'sprite',
    visual: {
      sourceAsset: URL,
      transform: { x: 0, y: 0, z: 0, width: 1.2, height: 0.8 },
    },
    intent: {
      caption: 'New image',
      behaviorSpec: {
        interactions: [], apiCalls: [], dataBindings: [],
        emits: [], listens: [], triggersDownstream: [],
      },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: '',
    backendRef: null,
    ...over,
  } as PrismNode;
}

describe('imagePlaneSize — aspect sizing to a sane max', () => {
  it('caps width at IMAGE_MAX_EXTENT and derives height from the aspect', () => {
    expect(imagePlaneSize(2000, 1000)).toEqual({ width: 1.2, height: 0.6 });
    expect(IMAGE_MAX_EXTENT).toBe(1.2);
  });

  it('square sources spawn square', () => {
    expect(imagePlaneSize(1024, 1024)).toEqual({ width: 1.2, height: 1.2 });
  });

  it('portrait sources get height = max / aspect', () => {
    const { width, height } = imagePlaneSize(1000, 2000);
    expect(width).toBe(1.2);
    expect(height).toBeCloseTo(2.4, 10);
  });

  it('degenerate / unknown dimensions fall back to a square', () => {
    expect(imagePlaneSize(0, 0)).toEqual({ width: 1.2, height: 1.2 });
    expect(imagePlaneSize(undefined, undefined)).toEqual({ width: 1.2, height: 1.2 });
    expect(imagePlaneSize(NaN, 500)).toEqual({ width: 1.2, height: 1.2 });
    expect(imagePlaneSize(-10, 500)).toEqual({ width: 1.2, height: 1.2 });
  });

  it('extreme strips stay inside the clamp band (never invisible or huge)', () => {
    expect(imagePlaneSize(10000, 10).height).toBeGreaterThanOrEqual(0.06);
    expect(imagePlaneSize(10, 10000).height).toBeLessThanOrEqual(3);
  });
});

describe('buildImageNode — born Populated (it has an artifact)', () => {
  const built = buildImageNode({ parentHubId: 'hub-1', url: URL, width: 1200, height: 600 });

  it('is an image-plane node: renderMode sprite + visual.sourceAsset artifact', () => {
    expect(built.renderMode).toBe('sprite');
    expect(built.visual?.sourceAsset).toBe(URL);
    expect(built.parentHubId).toBe('hub-1');
    expect(built.subtype).toBe('image');
  });

  it('sizes the plane from the source pixels', () => {
    expect(built.visual?.transform.width).toBe(1.2);
    expect(built.visual?.transform.height).toBeCloseTo(0.6, 10);
  });

  it('spawns at (-0.9, -0.8, 0.2) — distinct from the text and bubble spawns', () => {
    expect(built.scenePosition).toEqual(IMAGE_SPAWN_POSITION);
    expect(built.scenePosition).not.toBe(IMAGE_SPAWN_POSITION); // copy, not shared ref
    expect(IMAGE_SPAWN_POSITION.x).toBe(-0.9);
    expect(IMAGE_SPAWN_POSITION.y).toBe(-0.8);
    expect(IMAGE_SPAWN_POSITION.z).toBe(0.2);
    // Never stacks on the Add Element bubble spawn (+0.9, -0.8, 0.2) ...
    expect(IMAGE_SPAWN_POSITION.x).not.toBe(BUBBLE_SPAWN_POSITION.x);
    // ... nor on the Add Text spawn (0, -0.8, 0.2).
    const textSpawn = buildTextNode({ parentHubId: 'hub-1' }).scenePosition!;
    expect(IMAGE_SPAWN_POSITION.x).not.toBe(textSpawn.x);
  });

  it('follows the minimal-node conventions (mirrors text/bubble builders)', () => {
    expect(built.codeRef).toBe('');
    expect(built.backendRef).toBeNull();
    expect(built.serviceTag).toBe('main');
    expect(built.intent?.visualSpec?.textContent).toEqual([]);
    expect(built.intent?.behaviorSpec?.interactions).toEqual([]);
  });

  it('captions with the New image convention (plain language, no machine ids)', () => {
    expect(built.intent?.caption).toBe('New image · cat.png');
    expect(
      buildImageNode({ parentHubId: 'h', url: 'data:image/png;base64,AAAA' }).intent?.caption,
    ).toBe('New image');
    expect(
      buildImageNode({ parentHubId: 'h', url: URL, caption: 'Hero shot' }).intent?.caption,
    ).toBe('Hero shot');
    expect(
      buildImageNode({ parentHubId: 'h', url: URL, sourceName: 'holiday photo.jpg' })
        .intent?.caption,
    ).toBe('New image · holiday photo.jpg');
  });

  it('is NOT a Stage-0 bubble — the artifact makes it Populated at birth', () => {
    expect(isStage0Bubble(built as PrismNode)).toBe(false);
  });
});

describe('imageDisplayName / imageNodeCaption', () => {
  it('extracts a decoded file tail, stripping query and hash', () => {
    expect(imageDisplayName('https://cdn.x.com/a/b/her%20photo.png?w=2#frag')).toBe('her photo.png');
    expect(imageDisplayName('/prism-assets/uploads/cat.png')).toBe('cat.png');
  });

  it('returns null for non-human sources (data/blob/bare-host)', () => {
    expect(imageDisplayName('data:image/png;base64,AAAA')).toBeNull();
    expect(imageDisplayName('blob:https://x.com/123')).toBeNull();
    expect(imageDisplayName('https://example.com')).toBeNull();
    expect(imageDisplayName('')).toBeNull();
  });

  it('caption falls back to the plain default', () => {
    expect(imageNodeCaption(undefined)).toBe('New image');
    expect(imageNodeCaption('https://example.com')).toBe('New image');
    expect(imageNodeCaption('pic.webp')).toBe('New image · pic.webp');
  });
});

describe('isImageBearingNode — Replace / presentation gate', () => {
  it('accepts sprite / plane / parallax-plane nodes with a sourceAsset', () => {
    expect(isImageBearingNode(makeImageNode())).toBe(true);
    expect(isImageBearingNode(makeImageNode({ renderMode: 'plane' }))).toBe(true);
    expect(isImageBearingNode(makeImageNode({ renderMode: 'parallax-plane' }))).toBe(true);
  });

  it('treats a missing renderMode as the legacy sprite default', () => {
    expect(isImageBearingNode(makeImageNode({ renderMode: undefined }))).toBe(true);
  });

  it('rejects nodes without a sourceAsset, and non-image modes', () => {
    const bare = makeImageNode();
    bare.visual = { ...bare.visual, sourceAsset: undefined };
    expect(isImageBearingNode(bare)).toBe(false);
    expect(isImageBearingNode(makeImageNode({ renderMode: 'text' as PrismNode['renderMode'] }))).toBe(false);
    expect(isImageBearingNode(makeImageNode({ renderMode: 'mesh' as PrismNode['renderMode'] }))).toBe(false);
    expect(isImageBearingNode(null)).toBe(false);
    expect(isImageBearingNode(undefined)).toBe(false);
  });
});

describe('effectiveImageSpec — defaulted read', () => {
  it('absence resolves to IMAGE_SPEC_DEFAULT + full-frame crop', () => {
    expect(effectiveImageSpec(undefined)).toEqual({
      fit: 'cover',
      crop: { x: 0, y: 0, width: 1, height: 1 },
      cornerRadius: 0,
      opacity: 1,
    });
    expect(CROP_FULL_FRAME).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('partial specs merge over the defaults without mutating the input', () => {
    const spec: ImageSpec = { fit: 'contain', crop: { x: 0.2 } };
    const eff = effectiveImageSpec(spec);
    expect(eff.fit).toBe('contain');
    expect(eff.crop).toEqual({ x: 0.2, y: 0, width: 1, height: 1 });
    expect(eff.opacity).toBe(1);
    expect(spec.crop).toEqual({ x: 0.2 }); // untouched
  });
});

describe('withImageSpecPatch — immutable whole-object replacement', () => {
  it('returns a FRESH fully-populated object and never mutates the inputs', () => {
    const current: ImageSpec = { fit: 'contain', opacity: 0.5 };
    const currentSnapshot = JSON.parse(JSON.stringify(current));
    const next = withImageSpecPatch(current, { cornerRadius: 0.3 });
    expect(next).not.toBe(current);
    expect(next).toEqual({ fit: 'contain', cornerRadius: 0.3, opacity: 0.5 });
    expect(current).toEqual(currentSnapshot);
    expect(IMAGE_SPEC_DEFAULT).toEqual({ fit: 'cover', cornerRadius: 0, opacity: 1 });
  });

  it('applies defaults when current is absent', () => {
    expect(withImageSpecPatch(undefined, { fit: 'fill' })).toEqual({
      fit: 'fill',
      cornerRadius: 0,
      opacity: 1,
    });
  });

  it('clamps cornerRadius and opacity to 0..1', () => {
    expect(withImageSpecPatch(undefined, { cornerRadius: 1.4 }).cornerRadius).toBe(1);
    expect(withImageSpecPatch(undefined, { cornerRadius: -0.2 }).cornerRadius).toBe(0);
    expect(withImageSpecPatch(undefined, { opacity: 7 }).opacity).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });

  it('copies the crop sub-object so the previous spec is never aliased', () => {
    const current: ImageSpec = { crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } };
    const next = withImageSpecPatch(current, { opacity: 0.8 });
    expect(next.crop).toEqual(current.crop);
    expect(next.crop).not.toBe(current.crop);
  });
});

describe('withCropPatch — clamped crop window updates', () => {
  it('merges the patch over the current crop (full-frame default)', () => {
    const next = withCropPatch(undefined, { x: 0.25 });
    expect(next.crop).toEqual({ x: 0.25, y: 0, width: 1, height: 1 });
    expect(next.fit).toBe('cover'); // whole-object: defaults ride along
  });

  it('preserves untouched fields from the current crop', () => {
    const current: ImageSpec = { crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.7 } };
    const next = withCropPatch(current, { width: 0.9 });
    expect(next.crop).toEqual({ x: 0.1, y: 0.2, width: 0.9, height: 0.7 });
    expect(current.crop).toEqual({ x: 0.1, y: 0.2, width: 0.6, height: 0.7 });
  });

  it('clamps every crop field to the normalized 0..1 domain', () => {
    const next = withCropPatch(undefined, { x: -1, y: 2, width: 1.5, height: -0.5 });
    expect(next.crop).toEqual({ x: 0, y: 1, width: 1, height: 0 });
  });

  it('ignores non-finite patch values', () => {
    const next = withCropPatch(undefined, { x: NaN, y: Infinity });
    expect(next.crop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe('normalizeImageUrl — paste-a-link normalization (no validation theater)', () => {
  it('passes http(s), root-relative, data:image and blob: through', () => {
    expect(normalizeImageUrl('https://x.com/a.png')).toBe('https://x.com/a.png');
    expect(normalizeImageUrl('http://x.com/a.png')).toBe('http://x.com/a.png');
    expect(normalizeImageUrl('/prism-assets/uploads/a.png')).toBe('/prism-assets/uploads/a.png');
    expect(normalizeImageUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(normalizeImageUrl('blob:https://x.com/123')).toBe('blob:https://x.com/123');
  });

  it('upgrades protocol-relative and bare-host forms to https', () => {
    expect(normalizeImageUrl('//cdn.x.com/a.png')).toBe('https://cdn.x.com/a.png');
    expect(normalizeImageUrl('example.com/cat.png')).toBe('https://example.com/cat.png');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeImageUrl('  https://x.com/a.png  ')).toBe('https://x.com/a.png');
  });

  it('rejects empty / script-ish / non-image-data / nonsense input', () => {
    expect(normalizeImageUrl('')).toBeNull();
    expect(normalizeImageUrl('   ')).toBeNull();
    expect(normalizeImageUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeImageUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeImageUrl('data:text/html,<b>x</b>')).toBeNull();
    expect(normalizeImageUrl('not a url at all')).toBeNull();
    expect(normalizeImageUrl('justwords')).toBeNull();
  });
});
