// W8 E8 — the section-aware in-view geometry + DriverHub inview source.
// Pure/unit coverage for the real intersection driver (no three, no DOM).

import { describe, it, expect } from 'vitest';
import { createDriverHub } from '@/lib/prism/runtime/shared/drivers';
import {
  viewportFromNdc,
  isEnterTransition,
  INVIEW_MARGIN,
} from '@/lib/prism/runtime/shared/inview';

describe('W8 E8 — viewportFromNdc', () => {
  it('a centred, in-front node is visible with mid progress', () => {
    const vp = viewportFromNdc({ x: 0, y: 0, z: 0.5 });
    expect(vp.visible).toBe(true);
    expect(vp.progress).toBeCloseTo(0.5, 5);
  });

  it('progress runs 0 (entering at bottom) → 1 (exiting at top)', () => {
    expect(viewportFromNdc({ x: 0, y: -1, z: 0 }).progress).toBeCloseTo(0, 5);
    expect(viewportFromNdc({ x: 0, y: 1, z: 0 }).progress).toBeCloseTo(1, 5);
  });

  it('a node behind the camera (z >= 1) is never visible', () => {
    expect(viewportFromNdc({ x: 0, y: 0, z: 1.2 }).visible).toBe(false);
  });

  it('honours the frustum margin at the edges', () => {
    // Just inside the margin → visible.
    expect(viewportFromNdc({ x: 0, y: 1 + INVIEW_MARGIN - 0.01, z: 0 }).visible).toBe(
      true,
    );
    // Just outside the margin → not visible.
    expect(viewportFromNdc({ x: 0, y: 1 + INVIEW_MARGIN + 0.01, z: 0 }).visible).toBe(
      false,
    );
  });

  it('progress stays clamped even when off-screen', () => {
    const vp = viewportFromNdc({ x: 3, y: 5, z: 0 });
    expect(vp.progress).toBe(1);
    expect(vp.visible).toBe(false);
  });
});

describe('W8 E8 — isEnterTransition', () => {
  it('is true only on the false→true rising edge', () => {
    const off = { visible: false, progress: 0 };
    const on = { visible: true, progress: 0.2 };
    expect(isEnterTransition(off, on)).toBe(true);
    expect(isEnterTransition(on, on)).toBe(false);
    expect(isEnterTransition(on, off)).toBe(false);
    expect(isEnterTransition(off, off)).toBe(false);
  });
});

describe('W8 E8 — DriverHub inview source', () => {
  it('defaults an unknown node to { visible:false, progress:0 }', () => {
    const hub = createDriverHub();
    expect(hub.inview.get('nope')).toEqual({ visible: false, progress: 0 });
  });

  it('notifies the right node subscriber and ignores others', () => {
    const hub = createDriverHub();
    const seen: Array<{ visible: boolean; progress: number }> = [];
    const un = hub.inview.subscribe('a', (vp) => seen.push(vp));
    hub.inview.set('b', { visible: true, progress: 0.5 }); // other node — ignored
    hub.inview.set('a', { visible: true, progress: 0.4 });
    expect(seen).toEqual([{ visible: true, progress: 0.4 }]);
    un();
    hub.inview.set('a', { visible: false, progress: 1 });
    expect(seen).toHaveLength(1); // unsubscribed
  });

  it('skips the notify on a sub-epsilon no-op update but streams real motion', () => {
    const hub = createDriverHub();
    let count = 0;
    hub.inview.subscribe('a', () => (count += 1));
    hub.inview.set('a', { visible: true, progress: 0.5 });
    hub.inview.set('a', { visible: true, progress: 0.5 }); // identical — skipped
    hub.inview.set('a', { visible: true, progress: 0.500001 }); // sub-epsilon — skipped
    expect(count).toBe(1);
    hub.inview.set('a', { visible: true, progress: 0.6 }); // real move
    expect(count).toBe(2);
    hub.inview.set('a', { visible: false, progress: 0.6 }); // visibility flip
    expect(count).toBe(3);
  });

  it('reset() clears the inview source', () => {
    const hub = createDriverHub();
    hub.inview.set('a', { visible: true, progress: 0.9 });
    hub.reset();
    expect(hub.inview.get('a')).toEqual({ visible: false, progress: 0 });
  });
});
