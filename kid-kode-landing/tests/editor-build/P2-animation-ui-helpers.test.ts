// P2 TOOLBAR WIRING (Task B) — pure-helper acceptance tests for the Animation
// toolbar group (canvas-spec §5 Animation group, §8.2 drivers, §8.3 catalog;
// criteria 12/13). Exercises src/components/editor/animation-tools/
// binding-helpers.ts: append/remove/reorder/driver-swap immutability, search +
// category filtering caps, pagination clamping, and the `ab-` base36 id format.

import { describe, expect, it } from 'vitest';
import {
  BINDING_ID_RE,
  DRIVER_OPTIONS,
  appendBinding,
  clampPage,
  driverLabel,
  filterPrimitives,
  mintBindingId,
  moveBinding,
  pageCount,
  pageSlice,
  removeBinding,
  setBindingDriver,
  setBindingParams,
  sortBindings,
} from '@/components/editor/animation-tools/binding-helpers';
import type { AnimationBinding } from '@/lib/prism-graph/types';

const freezeDeep = (bindings: AnimationBinding[]): AnimationBinding[] => {
  for (const b of bindings) {
    if (b.params) Object.freeze(b.params);
    Object.freeze(b);
  }
  return Object.freeze(bindings) as unknown as AnimationBinding[];
};

const fixture = (): AnimationBinding[] =>
  freezeDeep([
    { id: 'ab-a-1', primitive: 'fade', driver: 'time', params: {}, order: 0 },
    { id: 'ab-a-2', primitive: 'spin', driver: 'scroll', params: { speed: 2 }, order: 1 },
    { id: 'ab-a-3', primitive: 'shimmer', driver: 'pointer', params: {}, order: 2 },
  ]);

describe('P2 animation UI helpers — binding id minting', () => {
  it("mints 'ab-' + base36 time + base36 seq (Lighting makeLight convention)", () => {
    const id = mintBindingId();
    expect(id).toMatch(BINDING_ID_RE);
    expect(id.startsWith('ab-')).toBe(true);
  });

  it('stays unique even when now collides (module sequence)', () => {
    const a = mintBindingId(1234567);
    const b = mintBindingId(1234567);
    expect(a).not.toBe(b);
    expect(a).toMatch(BINDING_ID_RE);
    expect(b).toMatch(BINDING_ID_RE);
  });

  it('encodes the injected timestamp in base36', () => {
    const id = mintBindingId(36 ** 4); // '10000' in base36
    expect(id.split('-')[1]).toBe('10000');
  });
});

describe('P2 animation UI helpers — appendBinding', () => {
  it('appends { id, primitive, driver: time, params: {} } with the next order', () => {
    const cur = fixture();
    const next = appendBinding(cur, 'glass-refraction');
    expect(next).toHaveLength(4);
    const added = next[3];
    expect(added.primitive).toBe('glass-refraction');
    expect(added.driver).toBe('time');
    expect(added.params).toEqual({});
    expect(added.order).toBe(3);
    expect(added.id).toMatch(BINDING_ID_RE);
  });

  it('works from an undefined list (legacy node without animationBindings)', () => {
    const next = appendBinding(undefined, 'fade');
    expect(next).toHaveLength(1);
    expect(next[0].order).toBe(0);
    expect(next[0].driver).toBe('time');
  });

  it('never mutates the input (frozen fixture) and returns fresh entries', () => {
    const cur = fixture();
    const next = appendBinding(cur, 'spin');
    expect(next).not.toBe(cur);
    expect(next[0]).not.toBe(cur[0]); // entries are copies
    expect(cur).toHaveLength(3); // untouched
  });

  it('accepts an explicit id (deterministic apply path)', () => {
    const next = appendBinding([], 'fade', 'ab-fixed-1');
    expect(next[0].id).toBe('ab-fixed-1');
  });

  it('continues past sparse orders without colliding', () => {
    const sparse: AnimationBinding[] = freezeDeep([
      { id: 'ab-x-1', primitive: 'fade', driver: 'time', order: 5 },
    ]);
    const next = appendBinding(sparse, 'spin');
    expect(next[1].order).toBe(6);
  });
});

describe('P2 animation UI helpers — removeBinding', () => {
  it('removes by id and closes the order gap (0..n-1)', () => {
    const next = removeBinding(fixture(), 'ab-a-2');
    expect(next.map((b) => b.id)).toEqual(['ab-a-1', 'ab-a-3']);
    expect(next.map((b) => b.order)).toEqual([0, 1]);
  });

  it('is a content-equal copy for an unknown id, never a mutation', () => {
    const cur = fixture();
    const next = removeBinding(cur, 'ab-missing');
    expect(next).toEqual(cur.map((b) => ({ ...b })));
    expect(next).not.toBe(cur);
  });
});

describe('P2 animation UI helpers — moveBinding (arrow reorder, criterion 13)', () => {
  it('moves an entry up and rewrites normalized order values', () => {
    const next = moveBinding(fixture(), 'ab-a-3', -1);
    expect(next.map((b) => b.id)).toEqual(['ab-a-1', 'ab-a-3', 'ab-a-2']);
    expect(next.map((b) => b.order)).toEqual([0, 1, 2]);
  });

  it('moves an entry down', () => {
    const next = moveBinding(fixture(), 'ab-a-1', 1);
    expect(next.map((b) => b.id)).toEqual(['ab-a-2', 'ab-a-1', 'ab-a-3']);
    expect(next.map((b) => b.order)).toEqual([0, 1, 2]);
  });

  it('clamps at the edges (no wrap-around)', () => {
    const up = moveBinding(fixture(), 'ab-a-1', -1);
    expect(up.map((b) => b.id)).toEqual(['ab-a-1', 'ab-a-2', 'ab-a-3']);
    const down = moveBinding(fixture(), 'ab-a-3', 1);
    expect(down.map((b) => b.id)).toEqual(['ab-a-1', 'ab-a-2', 'ab-a-3']);
  });

  it('respects stored order over array position (sorts before moving)', () => {
    const shuffled: AnimationBinding[] = freezeDeep([
      { id: 'b', primitive: 'spin', driver: 'time', order: 1 },
      { id: 'a', primitive: 'fade', driver: 'time', order: 0 },
    ]);
    const next = moveBinding(shuffled, 'b', -1);
    expect(next.map((x) => x.id)).toEqual(['b', 'a']);
    expect(next.map((x) => x.order)).toEqual([0, 1]);
  });

  it('never mutates the input', () => {
    const cur = fixture();
    moveBinding(cur, 'ab-a-2', 1);
    expect(cur.map((b) => b.order)).toEqual([0, 1, 2]);
  });
});

describe('P2 animation UI helpers — setBindingDriver (driver chips, §8.2)', () => {
  it('swaps ONLY the driver field; id/params/order untouched (INV-6)', () => {
    const cur = fixture();
    const next = setBindingDriver(cur, 'ab-a-2', 'event');
    expect(next[1].driver).toBe('event');
    expect(next[1].id).toBe('ab-a-2');
    expect(next[1].params).toEqual({ speed: 2 });
    expect(next[1].order).toBe(1);
    expect(next[0].driver).toBe('time'); // others untouched
    expect(cur[1].driver).toBe('scroll'); // input not mutated
  });

  it('covers the full 5-driver vocabulary', () => {
    expect(DRIVER_OPTIONS.map((d) => d.driver)).toEqual([
      'time',
      'scroll',
      'pointer',
      'state',
      'event',
    ]);
    expect(driverLabel('time')).toBe('Load/Time');
    expect(driverLabel('event')).toBe('Event');
  });
});

describe('P2 animation UI helpers — setBindingParams (ControlPanel sink)', () => {
  it('replaces params with a defensive copy', () => {
    const cur = fixture();
    const params = { speed: 4, color: '#ffd86b', loop: true };
    const next = setBindingParams(cur, 'ab-a-1', params);
    expect(next[0].params).toEqual(params);
    expect(next[0].params).not.toBe(params); // copied, not aliased
    expect(next[0].driver).toBe('time'); // driver untouched
    expect(cur[0].params).toEqual({}); // input not mutated
  });
});

describe('P2 animation UI helpers — sortBindings', () => {
  it('orders by `order`, falling back to array position, stably', () => {
    const messy: AnimationBinding[] = freezeDeep([
      { id: 'c', primitive: 'x', driver: 'time', order: 2 },
      { id: 'a', primitive: 'x', driver: 'time', order: 0 },
      { id: 'noorder', primitive: 'x', driver: 'time' }, // position 2 → key 2, after 'c'
      { id: 'b', primitive: 'x', driver: 'time', order: 1 },
    ]);
    expect(sortBindings(messy).map((b) => b.id)).toEqual(['a', 'b', 'c', 'noorder']);
  });
});

describe('P2 animation UI helpers — filterPrimitives (search + chips + cap)', () => {
  const defs = [
    { name: 'fade', label: 'Fade', category: 'fade', description: 'opacity tween' },
    { name: 'glass-refraction', label: 'Glass Refraction', category: 'glass', description: 'dispersion lens' },
    { name: 'smoke-plume', label: 'Smoke Plume', category: 'smoke', description: 'volumetric ink' },
    { name: 'kinetic-rise', label: 'Kinetic Rise', category: 'text', description: 'per-glyph rise' },
    { name: 'glass-shatter', label: 'Glass Shatter', category: 'glass', description: 'break apart' },
  ];

  it('matches case-insensitively across name/label/description/category', () => {
    expect(filterPrimitives(defs, 'GLASS', null).map((d) => d.name)).toEqual([
      'glass-refraction',
      'glass-shatter',
    ]);
    expect(filterPrimitives(defs, 'ink', null).map((d) => d.name)).toEqual(['smoke-plume']);
    expect(filterPrimitives(defs, '', null)).toHaveLength(5);
  });

  it('narrows by category chip, composing with the query', () => {
    expect(filterPrimitives(defs, '', 'glass')).toHaveLength(2);
    expect(filterPrimitives(defs, 'shatter', 'glass').map((d) => d.name)).toEqual([
      'glass-shatter',
    ]);
    expect(filterPrimitives(defs, 'shatter', 'text')).toHaveLength(0);
  });

  it('caps the result count (312-registry safety)', () => {
    expect(filterPrimitives(defs, '', null, 2)).toHaveLength(2);
    expect(filterPrimitives(defs, 'glass', null, 1).map((d) => d.name)).toEqual([
      'glass-refraction',
    ]);
  });
});

describe('P2 animation UI helpers — pagination', () => {
  it('computes page count with a floor of 1', () => {
    expect(pageCount(0, 9)).toBe(1);
    expect(pageCount(9, 9)).toBe(1);
    expect(pageCount(10, 9)).toBe(2);
    expect(pageCount(312, 9)).toBe(35);
  });

  it('clamps the page index into range', () => {
    expect(clampPage(-3, 20, 9)).toBe(0);
    expect(clampPage(99, 20, 9)).toBe(2);
  });

  it('slices the visible page, clamped', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(pageSlice(items, 0, 9)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pageSlice(items, 2, 9)).toEqual([18, 19]);
    expect(pageSlice(items, 99, 9)).toEqual([18, 19]); // clamped to last page
  });
});
