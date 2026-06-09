// Material+Lighting — capability tier detection + the runtime watchdog.
//
// Spec refs:
//   §10/§17, INV-9 / runtime INV-R14 — heavy effects (T2 GI/AO) are gated behind
//   capability detection; an explicit preference clamps DOWN to the ceiling,
//   never up; the watchdog degrades the tier after a sustained low-rate window.

import { describe, expect, it } from 'vitest';
import {
  createTierWatchdog,
  detectBackend,
  detectCapabilityTier,
} from '@/lib/prism/runtime/shared/capability-tier';

/** Minimal renderer stubs matching what detectBackend reads off a real renderer. */
const webgpuRenderer = { backend: { isWebGPUBackend: true } };
const webgl2Renderer = { backend: { isWebGLBackend: true } };
const stubRenderer = {};

describe('detectBackend', () => {
  it('reads webgpu / webgl2 off the backend flags', () => {
    expect(detectBackend(webgpuRenderer)).toBe('webgpu');
    expect(detectBackend(webgl2Renderer)).toBe('webgl2');
  });

  it('returns null for a stub / non-renderer', () => {
    expect(detectBackend(stubRenderer)).toBeNull();
    expect(detectBackend(null)).toBeNull();
    expect(detectBackend(undefined)).toBeNull();
  });
});

describe('detectCapabilityTier', () => {
  it('webgpu + desktop → T2 (full screen-space GI path)', () => {
    const p = detectCapabilityTier(webgpuRenderer, { isMobile: false });
    expect(p.tier).toBe('T2');
    expect(p.backend).toBe('webgpu');
    expect(p.screenSpaceGI).toBe(true);
    expect(p.shadows).toBe(true);
    expect(p.maxDynamicLights).toBeGreaterThan(0);
  });

  it('webgl2 → T1 (soft shadows, no screen-space GI)', () => {
    const p = detectCapabilityTier(webgl2Renderer, { isMobile: false });
    expect(p.tier).toBe('T1');
    expect(p.screenSpaceGI).toBe(false);
    expect(p.shadows).toBe(true);
  });

  it('webgpu + mobile → T1 (heavy path is desktop-only)', () => {
    const p = detectCapabilityTier(webgpuRenderer, { isMobile: true });
    expect(p.tier).toBe('T1');
    expect(p.screenSpaceGI).toBe(false);
  });

  it('null/stub backend → T0 (IBL + ambient floor only)', () => {
    const p = detectCapabilityTier(stubRenderer);
    expect(p.tier).toBe('T0');
    expect(p.shadows).toBe(false);
    expect(p.screenSpaceGI).toBe(false);
    expect(p.maxDynamicLights).toBe(0);
  });

  it('an explicit T2 preference clamps DOWN to T1 on a webgl2 backend (never up)', () => {
    const p = detectCapabilityTier(webgl2Renderer, { preference: 'T2', isMobile: false });
    expect(p.tier).toBe('T1');
    expect(p.reason).toMatch(/clamp/i);
  });

  it('an explicit T0 preference is honored on a webgpu desktop (clamp is one-way)', () => {
    const p = detectCapabilityTier(webgpuRenderer, { preference: 'T0', isMobile: false });
    expect(p.tier).toBe('T0');
  });
});

describe('createTierWatchdog', () => {
  it('downgrades after a sustained low-rate window', () => {
    let downgradedTo: string | null = null;
    const win = 16;
    const wd = createTierWatchdog({
      initialTier: 'T2',
      floorRate: 30,
      window: win,
      onDowngrade: (next) => {
        downgradedTo = next;
      },
    });

    // Feed `win` frames at ~120fps first: a healthy window must NOT downgrade.
    for (let i = 0; i < win; i++) wd.sample(1 / 120);
    expect(wd.tier()).toBe('T2');
    expect(downgradedTo).toBeNull();

    // Now feed a sustained low-rate window: ~15fps (below the 30 floor) for a
    // full `win` of streak frames. Need `win` frames to fill the ring, then
    // `win` more below-floor frames to trip the streak.
    for (let i = 0; i < win * 2; i++) wd.sample(1 / 15);

    expect(downgradedTo).toBe('T1');
    expect(wd.tier()).toBe('T1');
  });

  it('does not downgrade past T0', () => {
    const wd = createTierWatchdog({ initialTier: 'T0', floorRate: 30, window: 16 });
    for (let i = 0; i < 200; i++) wd.sample(1 / 5);
    expect(wd.tier()).toBe('T0');
  });

  it('reset restores a tier and clears the streak', () => {
    const wd = createTierWatchdog({ initialTier: 'T2', floorRate: 30, window: 16 });
    wd.reset('T1');
    expect(wd.tier()).toBe('T1');
  });
});
