// EB-08-05 — Transform-edit ↔ keyframe-capture integration in canvas mode.
//
// Spec refs:
//   §6 SC-042  "Transform editing in `canvas` mode writes only to
//               `canvasTransform` (or `editorTransform`); never to
//               `scenePosition`."
//   §6 SC-045  "Animation tab in Inspector exposes coordinate-space picker
//               and trigger picker."
//   §7 INV-21  "Every keyframe declares its `coordinateSpace` from the
//               canonical 5. No keyframe is space-agnostic."
//   §8 FP-08   "Keyframe object literal without `coordinateSpace`."
//
// haltCheck (from ralph-state.json EB-08-05):
//   "Editing canvasTransform via gizmos and clicking 'save as keyframe'
//    creates a PrismKeyframe with coordinateSpace='hub-scene' (or canvas-mode
//    default); keyframe appears in animation timeline."
//
// Strategy:
//   - Unit-test the pure capture helper that translates a CanvasTransform
//     pose into a PrismKeyframe (default canvas space = 'hub-scene').
//   - Source-shape: Inspector.tsx wires the helper to a "save as keyframe"
//     button and renders node.keyframes in the Animation tab timeline (the
//     "appears in animation timeline" half of the haltCheck). The two-runtime
//     snapshot gates the live UI half.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  captureCanvasTransformAsKeyframe,
  type CaptureKeyframeOptions,
} from '@/lib/prism-graph/keyframe-capture';
import {
  KEYFRAME_COORDINATE_SPACES,
  KEYFRAME_TRIGGERS,
} from '@/lib/prism-graph/types';
import { CANVAS_TRANSFORM_IDENTITY } from '@/lib/editor/canvas-transform-gizmo';

const repoRoot = join(__dirname, '..', '..');
const inspectorSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx'),
  'utf8',
);
const captureSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'prism-graph', 'keyframe-capture.ts'),
  'utf8',
);

describe('EB-08-05 — captureCanvasTransformAsKeyframe()', () => {
  describe('default canvas-mode coordinate space (haltCheck default)', () => {
    it('defaults coordinateSpace to "hub-scene"', () => {
      const kf = captureCanvasTransformAsKeyframe(CANVAS_TRANSFORM_IDENTITY);
      expect(kf.coordinateSpace).toBe('hub-scene');
    });

    it('returned coordinateSpace is one of the canonical 5 (INV-21)', () => {
      const kf = captureCanvasTransformAsKeyframe(CANVAS_TRANSFORM_IDENTITY);
      expect(KEYFRAME_COORDINATE_SPACES).toContain(kf.coordinateSpace);
    });
  });

  describe('params: packs translation, rotation, and scale (SC-042)', () => {
    it('packs translation as translateX / translateY / translateZ', () => {
      const kf = captureCanvasTransformAsKeyframe({
        x: 3.5,
        y: -2,
        z: 0.25,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      });
      expect(kf.params?.translateX).toBe(3.5);
      expect(kf.params?.translateY).toBe(-2);
      expect(kf.params?.translateZ).toBe(0.25);
    });

    it('packs rotation axes as rotateX / rotateY / rotateZ', () => {
      const kf = captureCanvasTransformAsKeyframe({
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0.1,
        rotationY: 0.2,
        rotationZ: 1.57,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      });
      expect(kf.params?.rotateX).toBeCloseTo(0.1, 5);
      expect(kf.params?.rotateY).toBeCloseTo(0.2, 5);
      expect(kf.params?.rotateZ).toBeCloseTo(1.57, 5);
    });

    it('packs uniform scale into a single `scale` numeric value', () => {
      const kf = captureCanvasTransformAsKeyframe({
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1.25,
        scaleY: 1.25,
        scaleZ: 1.25,
      });
      expect(kf.params?.scale).toBeCloseTo(1.25, 5);
    });

    it('preserves per-axis scale as scaleX / scaleY / scaleZ', () => {
      const kf = captureCanvasTransformAsKeyframe({
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1.1,
        scaleY: 1.2,
        scaleZ: 0.9,
      });
      expect(kf.params?.scaleX).toBeCloseTo(1.1, 5);
      expect(kf.params?.scaleY).toBeCloseTo(1.2, 5);
      expect(kf.params?.scaleZ).toBeCloseTo(0.9, 5);
    });
  });

  describe('opts: override coordinateSpace / trigger / t / ease', () => {
    it('accepts a coordinateSpace override from opts', () => {
      const kf = captureCanvasTransformAsKeyframe(CANVAS_TRANSFORM_IDENTITY, {
        coordinateSpace: 'viewport-composition',
      });
      expect(kf.coordinateSpace).toBe('viewport-composition');
    });

    it('accepts a canonical trigger from opts (SC-044 enum)', () => {
      const kf = captureCanvasTransformAsKeyframe(CANVAS_TRANSFORM_IDENTITY, {
        trigger: 'click',
      });
      expect(kf.trigger).toBe('click');
      expect(KEYFRAME_TRIGGERS).toContain(kf.trigger!);
    });

    it('accepts a t value from opts', () => {
      const kf = captureCanvasTransformAsKeyframe(CANVAS_TRANSFORM_IDENTITY, {
        t: 0.5,
      });
      expect(kf.t).toBe(0.5);
    });

    it('accepts an ease label from opts', () => {
      const kf = captureCanvasTransformAsKeyframe(CANVAS_TRANSFORM_IDENTITY, {
        ease: 'easeInOut',
      });
      expect(kf.ease).toBe('easeInOut');
    });

    it('every canonical coordinate space round-trips through opts', () => {
      for (const space of KEYFRAME_COORDINATE_SPACES) {
        const kf = captureCanvasTransformAsKeyframe(
          CANVAS_TRANSFORM_IDENTITY,
          { coordinateSpace: space },
        );
        expect(kf.coordinateSpace).toBe(space);
      }
    });
  });

  describe('shape contract', () => {
    it('CaptureKeyframeOptions surface includes coordinateSpace / trigger / t / ease', () => {
      const opts: CaptureKeyframeOptions = {
        coordinateSpace: 'hub-scene',
        trigger: 'load',
        t: 0,
        ease: 'easeOut',
      };
      const kf = captureCanvasTransformAsKeyframe(CANVAS_TRANSFORM_IDENTITY, opts);
      expect(kf.coordinateSpace).toBe('hub-scene');
      expect(kf.trigger).toBe('load');
      expect(kf.t).toBe(0);
      expect(kf.ease).toBe('easeOut');
    });

    it('keyframe-capture.ts source declares `coordinateSpace:` literally (FP-08 hook)', () => {
      // Defense-in-depth: the FP-08 hook greps for `{ t: …, params|values: … }`
      // blocks missing `coordinateSpace`. Verify the source pins the canonical
      // default literally — not just at the type level.
      expect(captureSrc).toMatch(/coordinateSpace/);
      expect(captureSrc).toMatch(/['"]hub-scene['"]/);
    });
  });
});

describe('EB-08-05 — Inspector wires "save as keyframe" in the Animation tab', () => {
  it('Inspector.tsx imports captureCanvasTransformAsKeyframe', () => {
    expect(inspectorSrc).toMatch(
      /from\s+['"]@\/lib\/prism-graph\/keyframe-capture['"]/,
    );
    expect(inspectorSrc).toMatch(/\bcaptureCanvasTransformAsKeyframe\b/);
  });

  it('Inspector.tsx renders a "save as keyframe" CTA in the Animation tab', () => {
    expect(inspectorSrc).toMatch(/save\s*as\s*keyframe/i);
  });

  it('Inspector.tsx surfaces node.keyframes in the Animation tab timeline', () => {
    // The captured PrismKeyframe must "appear in animation timeline" per
    // haltCheck. Source-shape: AnimationTab reads node.keyframes (the new
    // PrismKeyframe[] field, not the legacy frame store) and renders at least
    // one element (a count, list, or chip per keyframe).
    expect(inspectorSrc).toMatch(/node\.keyframes/);
  });

  it('Inspector.tsx writes captured keyframes through usePreviewStateStore (FP-15 / SC-072) — never updateNode directly', () => {
    // EBR2-E-02 / §R2-E SC-072 + FP-15: Inspector tab writes route through
    // the ephemeral usePreviewStateStore buffer; the Save button is what
    // later commits the buffer to the source store (EBR2-E-03). The capture
    // therefore lands as a preview-state patch carrying `keyframes:`. (The
    // original assertion pinned updateNode({ keyframes }) — that direct
    // source-store write is the exact FP-15 bypass the hook now blocks.)
    expect(inspectorSrc).toMatch(
      /usePreviewStateStore\.getState\(\)\.set\(\s*[\w.]+\s*,\s*\{[\s\S]{0,200}?keyframes\s*:/,
    );
    // FP-15 negative pin: the forbidden direct-source-store call form must
    // not return to Inspector.tsx (any tab).
    expect(inspectorSrc).not.toMatch(/useGraphSourceStore\.getState\(\)\.updateNode\s*\(/);
    // And no updateNode call (however obtained) may carry a keyframes patch.
    expect(inspectorSrc).not.toMatch(/updateNode\s*\([\s\S]{0,120}?\{\s*keyframes\s*:/);
  });
});

describe('EB-08-05 — snapshot directory (post-implementation gate)', () => {
  it('EB-08-05 snapshot directory contains outer.png + inner.png + state.json', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-08-05');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});
