// W8 E10 — transition preset resolver + tone mapping (pure).

import { describe, it, expect } from 'vitest';
import {
  TRANSITION_PRESETS,
  resolveTransition,
  presetForTone,
} from '@/lib/prism-graph/transition-presets';

describe('W8 E10 — resolveTransition', () => {
  it('absent preset → the default brass curtain (byte-stable)', () => {
    const r = resolveTransition(undefined);
    expect(r.kind).toBe('curtain');
    expect(r.webglKind).toBe(0);
    expect(r.showVeil).toBe(false);
    expect(r.speed).toBe(1);
  });

  it('unknown kind falls back to curtain', () => {
    const r = resolveTransition({ kind: 'nope' as never });
    expect(r.kind).toBe('curtain');
  });

  it('maps each curated kind to a distinct webgl reveal', () => {
    expect(resolveTransition({ kind: 'wipe' }).webglKind).toBe(1);
    expect(resolveTransition({ kind: 'dissolve' }).webglKind).toBe(2);
    expect(resolveTransition({ kind: 'veil' }).showVeil).toBe(true);
    expect(resolveTransition({ kind: 'glass-sweep' }).showVeil).toBe(true);
  });

  it('honours explicit speed/accent overrides and clamps speed', () => {
    expect(resolveTransition({ kind: 'wipe', speed: 1.5 }).speed).toBe(1.5);
    expect(resolveTransition({ kind: 'wipe', speed: 9 }).speed).toBe(2);
    expect(resolveTransition({ kind: 'wipe', speed: 0.1 }).speed).toBe(0.5);
    expect(resolveTransition({ kind: 'curtain', accent: '#ff0000' }).accent).toBe(
      '#ff0000',
    );
  });

  it('exposes a curated preset list with unique kinds', () => {
    const kinds = TRANSITION_PRESETS.map((p) => p.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toContain('curtain');
    expect(kinds).toContain('dissolve');
    expect(kinds).toContain('wipe');
  });
});

describe('W8 E10 — presetForTone', () => {
  it('maps editorial/luxury tones to veil', () => {
    expect(presetForTone('Editorial magazine').kind).toBe('veil');
    expect(presetForTone('luxury atelier').kind).toBe('veil');
  });
  it('maps tech/data tones to wipe', () => {
    expect(presetForTone('SaaS analytics dashboard').kind).toBe('wipe');
  });
  it('maps soft/organic tones to dissolve', () => {
    expect(presetForTone('calm wellness').kind).toBe('dissolve');
  });
  it('falls back to curtain for an unknown tone', () => {
    expect(presetForTone('whatever').kind).toBe('curtain');
  });
});
