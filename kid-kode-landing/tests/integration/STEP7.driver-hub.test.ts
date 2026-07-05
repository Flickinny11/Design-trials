// STEP7 — DriverHub (scroll / pointer / state / event sources + frame ticker).
//
// Spec: PRISM-CANVAS-EDITOR-SPEC.md §8.2 (Driver model) + §16 (Preview:
// drivers respond to real input). The hub is the runtime side of the four
// interactive drivers — it carries the INPUTS primitives/dispatch consume and
// the per-frame ticker that drives `onTick` primitives.

import { describe, expect, it, vi } from 'vitest';
import { createDriverHub } from '@/lib/prism/runtime/shared/drivers';
import type { PrimitiveResult } from '@/lib/prism/runtime/shared/primitives/types';

describe('STEP7 DriverHub — pointer source (PointerDriver input)', () => {
  it('set() updates ndc + active and notifies subscribers', () => {
    const hub = createDriverHub();
    const seen: Array<{ x: number; y: number }> = [];
    hub.pointer.subscribe((ndc) => seen.push({ ...ndc }));
    hub.pointer.set({ x: 0.5, y: -0.25 }, true);
    expect(hub.pointer.ndc).toEqual({ x: 0.5, y: -0.25 });
    expect(hub.pointer.active).toBe(true);
    expect(seen).toEqual([{ x: 0.5, y: -0.25 }]);
  });

  it('unsubscribe stops further notifications', () => {
    const hub = createDriverHub();
    const cb = vi.fn();
    const off = hub.pointer.subscribe(cb);
    hub.pointer.set({ x: 1, y: 0 });
    off();
    hub.pointer.set({ x: -1, y: 0 });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('STEP7 DriverHub — scroll source (ScrollDriver input)', () => {
  it('clamps progress to 0..1 and notifies subscribers', () => {
    const hub = createDriverHub();
    const seen: number[] = [];
    hub.scroll.subscribe((p) => seen.push(p));
    hub.scroll.set(0.4);
    hub.scroll.set(1.8); // clamps to 1
    hub.scroll.set(-3); // clamps to 0
    expect(seen).toEqual([0.4, 1, 0]);
    expect(hub.scroll.progress).toBe(0);
  });
});

describe('STEP7 DriverHub — state source (StateDriver input)', () => {
  it('notifies only on an actual change and exposes get()', () => {
    const hub = createDriverHub();
    const cb = vi.fn();
    hub.state.subscribe(cb);
    hub.state.set('hover:n1', true);
    hub.state.set('hover:n1', true); // no change → no notify
    hub.state.set('hover:n1', false);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(hub.state.get('hover:n1')).toBe(false);
    expect(hub.state.get('missing')).toBeUndefined();
  });
});

describe('STEP7 DriverHub — event source (EventDriver input)', () => {
  it('delivers a fired event with payload to named subscribers only', () => {
    const hub = createDriverHub();
    const clickCb = vi.fn();
    const otherCb = vi.fn();
    hub.events.subscribe('click', clickCb);
    hub.events.subscribe('submit', otherCb);
    hub.events.fire('click', { nodeId: 'n1' });
    expect(clickCb).toHaveBeenCalledWith({ nodeId: 'n1' });
    expect(otherCb).not.toHaveBeenCalled();
  });

  it('a thrown handler does not break the fire loop', () => {
    const hub = createDriverHub();
    const good = vi.fn();
    hub.events.subscribe('click', () => {
      throw new Error('boom');
    });
    hub.events.subscribe('click', good);
    expect(() => hub.events.fire('click')).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe('STEP7 DriverHub — frame ticker (drives onTick primitives)', () => {
  it('add/tick invokes callbacks with the elapsed ms; size() reflects count', () => {
    const hub = createDriverHub();
    const a = vi.fn();
    const b = vi.fn();
    const offA = hub.frame.add(a);
    hub.frame.add(b);
    expect(hub.frame.size()).toBe(2);
    hub.frame.tick(16);
    expect(a).toHaveBeenCalledWith(16);
    expect(b).toHaveBeenCalledWith(16);
    offA();
    expect(hub.frame.size()).toBe(1);
    hub.frame.tick(8);
    expect(a).toHaveBeenCalledTimes(1); // not called after unregister
    expect(b).toHaveBeenCalledTimes(2);
  });
});

describe('STEP7 DriverHub — node-result registry (diagnostics / replay)', () => {
  function fakeResult(): PrimitiveResult {
    return {
      timeline: { kill: () => {} } as unknown as PrimitiveResult['timeline'],
      cleanup: () => {},
    };
  }

  it('registers, reads, and clears per-node results', () => {
    const hub = createDriverHub();
    hub.registerNodeResult('n1', fakeResult());
    hub.registerNodeResult('n1', fakeResult());
    expect(hub.getNodeResults('n1')).toHaveLength(2);
    hub.clearNodeResults('n1');
    expect(hub.getNodeResults('n1')).toHaveLength(0);
  });

  it('reset() returns every source + ticker to its initial state', () => {
    const hub = createDriverHub();
    const cb = vi.fn();
    hub.frame.add(cb);
    hub.pointer.set({ x: 1, y: 1 }, true);
    hub.registerNodeResult('n1', fakeResult());
    hub.reset();
    expect(hub.frame.size()).toBe(0);
    expect(hub.pointer.ndc).toEqual({ x: 0, y: 0 });
    expect(hub.pointer.active).toBe(false);
    expect(hub.scroll.progress).toBe(0);
    expect(hub.getNodeResults('n1')).toHaveLength(0);
  });
});
