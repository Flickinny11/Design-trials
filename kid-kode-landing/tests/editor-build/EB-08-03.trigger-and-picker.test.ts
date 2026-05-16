// EB-08-03 — Typed trigger enum + animation tab pickers.
//
// Spec refs:
//   §6 SC-044  "Keyframe trigger enum:
//               'load' | 'scroll' | 'hover' | 'click' | 'in-view'."
//   §6 SC-045  "Animation tab in Inspector exposes coordinate-space picker
//               and trigger picker."
//   §7 INV-18  Additive schema growth.
//   §7 INV-21  Every keyframe declares its coordinateSpace (canonical 5).
//   §9 RA-03   The valid keyframe space set is fixed.
//
// haltCheck (from ralph-state.json EB-08-03):
//   "PrismKeyframeTrigger = 'load'|'scroll'|'hover'|'click'|'in-view';
//    Animation tab exposes coordinate-space + trigger pickers; existing
//    animation-keyframes.ts logic preserved."
//
// Source-shape strategy: matches the established editor-build pattern
// (EB-02-04, EB-05-04). AnimationTab is a non-trivial React subcomponent
// of Inspector.tsx; runtime correctness is gated by the two-runtime
// snapshot (kid-kode-landing/notes/ralph-snapshots/EB-08-03/). These
// assertions verify the *source contract* that makes the snapshot possible.

import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  KEYFRAME_COORDINATE_SPACES,
  KEYFRAME_TRIGGERS,
} from '@/lib/prism-graph/types';
import type { PrismKeyframeTrigger } from '@/lib/prism-graph/types';
import {
  ANIMATION_TAB_MODES,
  createKeyframeTimeline,
  captureKeyframe,
  replayKeyframeTimeline,
} from '@/lib/prism-graph/animation-keyframes';

const repoRoot = join(__dirname, '..', '..');
const inspectorSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx'),
  'utf8',
);
const animationEditsStoreSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useAnimationEditsStore.ts'),
  'utf8',
);
const animationKeyframesLib = readFileSync(
  join(repoRoot, 'src', 'lib', 'prism-graph', 'animation-keyframes.ts'),
  'utf8',
);

// Isolate the AnimationTab function body for picker assertions.
const animationTabMatch = inspectorSrc.match(
  /function\s+AnimationTab\s*\([\s\S]*?\n\}\n/,
);

describe('EB-08-03 — typed trigger enum + animation tab pickers (SC-044, SC-045)', () => {
  describe('SC-044: PrismKeyframeTrigger enum', () => {
    it('KEYFRAME_TRIGGERS preserves spec-declared order (load, scroll, hover, click, in-view)', () => {
      expect(KEYFRAME_TRIGGERS).toEqual([
        'load',
        'scroll',
        'hover',
        'click',
        'in-view',
      ]);
    });

    it('PrismKeyframeTrigger is the exact 5-member union', () => {
      expectTypeOf<PrismKeyframeTrigger>().toEqualTypeOf<
        'load' | 'scroll' | 'hover' | 'click' | 'in-view'
      >();
    });
  });

  describe('SC-045: Animation tab exposes coordinate-space + trigger pickers', () => {
    it('Inspector.tsx contains an AnimationTab function (preserved subcomponent)', () => {
      expect(animationTabMatch).not.toBeNull();
    });

    it('AnimationTab body imports / references KEYFRAME_COORDINATE_SPACES from the canonical types', () => {
      // The picker MUST source its options from the canonical exported
      // constant — not duplicate the string literals — so RA-03 invariance
      // is enforced at the type level (any new space added in types.ts
      // automatically appears in the picker).
      expect(inspectorSrc).toMatch(
        /import\s+\{[^}]*KEYFRAME_COORDINATE_SPACES[^}]*\}\s+from\s+['"]@\/lib\/prism-graph\/types['"]/,
      );
    });

    it('AnimationTab body imports / references KEYFRAME_TRIGGERS from the canonical types', () => {
      expect(inspectorSrc).toMatch(
        /import\s+\{[^}]*KEYFRAME_TRIGGERS[^}]*\}\s+from\s+['"]@\/lib\/prism-graph\/types['"]/,
      );
    });

    it('AnimationTab renders a coordinate-space picker (select / button group) bound to a setter', () => {
      // Source-shape: the picker is identified by a `data-testid="kf-coordinate-space-picker"`
      // anchor so KripVerify / runtime tests can target it; the data attribute
      // also serves as a stable lint marker.
      const body = animationTabMatch![0];
      expect(body).toMatch(/data-testid=["']kf-coordinate-space-picker["']/);
      // Picker must iterate the canonical constant — not hardcode literals.
      expect(body).toMatch(/KEYFRAME_COORDINATE_SPACES\.map\s*\(/);
    });

    it('AnimationTab renders a trigger picker (select / button group) bound to a setter', () => {
      const body = animationTabMatch![0];
      expect(body).toMatch(/data-testid=["']kf-trigger-picker["']/);
      expect(body).toMatch(/KEYFRAME_TRIGGERS\.map\s*\(/);
    });

    it('useAnimationEditsStore exposes setCoordinateSpace + setTrigger setters (additive INV-18)', () => {
      // Existing per-node edits state grows additively — no fields renamed or
      // deleted. The two setters route picker selections into the store so the
      // Inspector / runtime can read back the active coordinateSpace / trigger.
      expect(animationEditsStoreSrc).toMatch(
        /setCoordinateSpace\s*:\s*\([^)]*nodeId\s*:\s*string[^)]*,[^)]*space\s*:\s*PrismKeyframeCoordinateSpace[^)]*\)\s*=>\s*void/,
      );
      expect(animationEditsStoreSrc).toMatch(
        /setTrigger\s*:\s*\([^)]*nodeId\s*:\s*string[^)]*,[^)]*trigger\s*:\s*PrismKeyframeTrigger[^)]*\)\s*=>\s*void/,
      );
    });

    it('NodeEdits carries optional coordinateSpace + trigger fields (additive — existing fields untouched)', () => {
      // INV-18: every legacy field on NodeEdits (frames, primaryColor,
      // secondaryColor, radius, dirty, nodeId) MUST remain. The two new
      // fields are optional so existing graphs/edits round-trip unchanged.
      for (const existing of ['nodeId', 'frames', 'primaryColor', 'secondaryColor', 'radius', 'dirty']) {
        expect(animationEditsStoreSrc).toMatch(
          new RegExp(`\\b${existing}\\??\\s*:`),
        );
      }
      expect(animationEditsStoreSrc).toMatch(
        /coordinateSpace\?\s*:\s*PrismKeyframeCoordinateSpace/,
      );
      expect(animationEditsStoreSrc).toMatch(
        /trigger\?\s*:\s*PrismKeyframeTrigger/,
      );
    });

    it('AnimationTab wires picker onChange handlers to the new setters', () => {
      const body = animationTabMatch![0];
      // Picker handlers must call into the store — runtime gates this via the
      // two-runtime snapshot, but the source contract verifies the wire-up.
      expect(body).toMatch(/setCoordinateSpace\s*\(/);
      expect(body).toMatch(/setTrigger\s*\(/);
    });
  });

  describe('haltCheck: existing animation-keyframes.ts logic preserved', () => {
    it('exports the pure-logic surface untouched (createKeyframeTimeline, captureKeyframe, replayKeyframeTimeline)', () => {
      expect(typeof createKeyframeTimeline).toBe('function');
      expect(typeof captureKeyframe).toBe('function');
      expect(typeof replayKeyframeTimeline).toBe('function');
    });

    it('ANIMATION_TAB_MODES still exports the two original modes', () => {
      expect([...ANIMATION_TAB_MODES].sort()).toEqual([
        'i2v-frame-scrub',
        'timeline-keyframe',
      ]);
    });

    it('capture + replay round-trip still works (regression guard for the haltCheck preservation clause)', () => {
      const tl0 = createKeyframeTimeline({ durationMs: 1000 });
      const tl1 = captureKeyframe(tl0, 0, {
        scale: 1, opacity: 0, rotation: 0, x: 0, y: 0,
      });
      const tl2 = captureKeyframe(tl1, 1, {
        scale: 1, opacity: 1, rotation: 0, x: 0, y: 0,
      });
      const mid = replayKeyframeTimeline(tl2, 0.5);
      expect(mid.opacity).toBeCloseTo(0.5, 5);
    });

    it('animation-keyframes.ts source file has not been gutted (size sanity check)', () => {
      // Defensive: prevents a "preservation" claim that silently empties the
      // file. Threshold is conservative — current file is ~120 lines.
      expect(animationKeyframesLib.length).toBeGreaterThan(800);
      expect(animationKeyframesLib).toMatch(/export function createKeyframeTimeline/);
      expect(animationKeyframesLib).toMatch(/export function captureKeyframe/);
      expect(animationKeyframesLib).toMatch(/export function replayKeyframeTimeline/);
    });
  });

  describe('snapshot directory (post-implementation gate)', () => {
    it('EB-08-03 snapshot directory contains outer.png + inner.png + state.json', () => {
      const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-08-03');
      expect(existsSync(dir)).toBe(true);
      const files = readdirSync(dir);
      for (const name of ['outer.png', 'inner.png', 'state.json']) {
        expect(files).toContain(name);
      }
    });
  });

  describe('sanity: coordinateSpace + trigger constants reachable for picker iteration', () => {
    it('canonical coordinate spaces are non-empty and iterable', () => {
      expect(KEYFRAME_COORDINATE_SPACES.length).toBe(5);
    });

    it('canonical triggers are non-empty and iterable', () => {
      expect(KEYFRAME_TRIGGERS.length).toBe(5);
    });
  });
});
