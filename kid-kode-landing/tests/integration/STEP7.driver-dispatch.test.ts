// STEP7 — driver dispatch (trigger → playback) + INV-6.
//
// Spec: PRISM-CANVAS-EDITOR-SPEC.md §8.2 (Driver model), §16 (Preview),
// INV-6 (an animation's keyframes are INDEPENDENT of its driver). The dispatch
// is the embodiment of INV-6 — it only PLAYS a built animation under its
// declared trigger and never touches the keyframes.

import { describe, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import { createDriverHub } from '@/lib/prism/runtime/shared/drivers';
import { attachPrimitiveDriver } from '@/lib/prism/runtime/shared/driver-dispatch';
import type { PrimitiveResult } from '@/lib/prism/runtime/shared/primitives/types';

/** A PrimitiveResult whose timeline is a spy object (deterministic — no real
 *  gsap ticker). `duration` controls the empty-vs-keyframed branch. */
function spyResult(opts: { duration?: number; needsTick?: boolean } = {}): {
  result: PrimitiveResult;
  tl: {
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    reverse: ReturnType<typeof vi.fn>;
    restart: ReturnType<typeof vi.fn>;
    progress: ReturnType<typeof vi.fn>;
    duration: ReturnType<typeof vi.fn>;
  };
  onTick: ReturnType<typeof vi.fn>;
} {
  const duration = opts.duration ?? 1;
  const tl = {
    play: vi.fn(),
    pause: vi.fn(),
    reverse: vi.fn(),
    restart: vi.fn(),
    progress: vi.fn(),
    duration: vi.fn(() => duration),
  };
  const onTick = vi.fn();
  const result: PrimitiveResult = {
    timeline: tl as unknown as PrimitiveResult['timeline'],
    cleanup: () => {},
    needsTick: opts.needsTick ?? false,
    onTick: opts.needsTick ? onTick : undefined,
  };
  return { result, tl, onTick };
}

describe('STEP7 dispatch — per-frame onTick registration (PointerDriver)', () => {
  it('registers needsTick onTick on the frame ticker and forwards seconds', () => {
    const hub = createDriverHub();
    const { result, onTick } = spyResult({ needsTick: true });
    const detach = attachPrimitiveDriver(hub, result, 'hover', { nodeId: 'n1' });
    expect(hub.frame.size()).toBe(1);
    hub.frame.tick(1000); // 1000ms → 1s
    expect(onTick).toHaveBeenCalledWith(1);
    detach();
    expect(hub.frame.size()).toBe(0); // detach unregisters
  });
});

describe('STEP7 dispatch — TimeDriver (load / inview / time)', () => {
  it("'load' plays a keyframed timeline once on attach", () => {
    const hub = createDriverHub();
    const { result, tl } = spyResult({ duration: 1.5 });
    attachPrimitiveDriver(hub, result, 'load', { nodeId: 'n1' });
    expect(tl.play).toHaveBeenCalledWith(0);
  });

  it("'inview' plays immediately when the node is already on-screen at mount", () => {
    const hub = createDriverHub();
    hub.inview.set('n1', { visible: true, progress: 0.3 }); // landing hub, on-screen
    const { result, tl } = spyResult({ duration: 1.4 });
    attachPrimitiveDriver(hub, result, 'inview', { nodeId: 'n1' });
    expect(tl.play).toHaveBeenCalledWith(0);
  });

  it("'inview' does NOT play while the node is off-screen (real intersection)", () => {
    const hub = createDriverHub();
    // Default viewport is { visible: false } — the node is below the fold.
    const { result, tl } = spyResult({ duration: 1.4 });
    attachPrimitiveDriver(hub, result, 'inview', { nodeId: 'n1' });
    expect(tl.play).not.toHaveBeenCalled();
    expect(tl.restart).not.toHaveBeenCalled();
  });

  it("'inview' fires on the rising edge when the section scrolls on-screen", () => {
    const hub = createDriverHub();
    const { result, tl } = spyResult({ duration: 1.4 });
    attachPrimitiveDriver(hub, result, 'inview', { nodeId: 'n1' });
    expect(tl.restart).not.toHaveBeenCalled();
    hub.inview.set('n1', { visible: true, progress: 0.1 }); // enters view
    expect(tl.restart).toHaveBeenCalledTimes(1);
    // Re-asserting visibility does not re-fire (only the rising edge does).
    hub.inview.set('n1', { visible: true, progress: 0.6 });
    expect(tl.restart).toHaveBeenCalledTimes(1);
  });

  it("'inview' with replay rewinds on exit so it re-fires on the next entry", () => {
    const hub = createDriverHub();
    const { result, tl } = spyResult({ duration: 1.4 });
    attachPrimitiveDriver(hub, result, 'inview', { nodeId: 'n1', replay: true });
    hub.inview.set('n1', { visible: true, progress: 0.1 });
    expect(tl.restart).toHaveBeenCalledTimes(1);
    hub.inview.set('n1', { visible: false, progress: 1 }); // exits → rewind
    expect(tl.progress).toHaveBeenLastCalledWith(0);
    hub.inview.set('n1', { visible: true, progress: 0.1 }); // re-enters → re-fire
    expect(tl.restart).toHaveBeenCalledTimes(2);
  });

  it("'time' does not force-play (continuous timelines self-run)", () => {
    const hub = createDriverHub();
    const { result, tl } = spyResult({ duration: 8 });
    attachPrimitiveDriver(hub, result, 'time', { nodeId: 'n1' });
    expect(tl.play).not.toHaveBeenCalled();
  });

  it('an empty timeline (duration 0) is never force-played', () => {
    const hub = createDriverHub();
    const { result, tl } = spyResult({ duration: 0 });
    attachPrimitiveDriver(hub, result, 'inview', { nodeId: 'n1' });
    expect(tl.play).not.toHaveBeenCalled();
  });
});

describe('STEP7 dispatch — ScrollDriver (scroll)', () => {
  it('scrubs the timeline progress by live scroll progress and seeds current', () => {
    const hub = createDriverHub();
    hub.scroll.set(0.2); // current progress before attach
    const { result, tl } = spyResult({ duration: 1 });
    const detach = attachPrimitiveDriver(hub, result, 'scroll', { nodeId: 'n1' });
    // Seeded with the current progress on attach.
    expect(tl.progress).toHaveBeenLastCalledWith(0.2);
    hub.scroll.set(0.75);
    expect(tl.progress).toHaveBeenLastCalledWith(0.75);
    detach();
    hub.scroll.set(0.9);
    // No further scrub after detach.
    expect(tl.progress).toHaveBeenLastCalledWith(0.75);
  });

  it('with section:true scrubs by the node section progress, not global scroll (E8)', () => {
    const hub = createDriverHub();
    hub.scroll.set(0.9); // global scroll — must be IGNORED in section mode
    hub.inview.set('n1', { visible: true, progress: 0.25 });
    const { result, tl } = spyResult({ duration: 1 });
    const detach = attachPrimitiveDriver(hub, result, 'scroll', {
      nodeId: 'n1',
      section: true,
    });
    // Seeded with the node's section progress, not the global 0.9.
    expect(tl.progress).toHaveBeenLastCalledWith(0.25);
    hub.inview.set('n1', { visible: true, progress: 0.8 });
    expect(tl.progress).toHaveBeenLastCalledWith(0.8);
    // Global scroll changes do not move a section-scrubbed timeline.
    hub.scroll.set(0.1);
    expect(tl.progress).toHaveBeenLastCalledWith(0.8);
    detach();
  });
});

describe('STEP7 dispatch — StateDriver (hover)', () => {
  it('plays forward on hover-in and reverses on hover-out, addressed by node', () => {
    const hub = createDriverHub();
    const { result, tl } = spyResult({ duration: 0.4 });
    attachPrimitiveDriver(hub, result, 'hover', { nodeId: 'n1' });
    hub.state.set('hover:other', true); // different node → ignored
    expect(tl.play).not.toHaveBeenCalled();
    hub.state.set('hover:n1', true);
    expect(tl.play).toHaveBeenCalledTimes(1);
    hub.state.set('hover:n1', false);
    expect(tl.reverse).toHaveBeenCalledTimes(1);
  });
});

describe('STEP7 dispatch — EventDriver (click)', () => {
  it('replays on a node-addressed click event', () => {
    const hub = createDriverHub();
    const { result, tl } = spyResult({ duration: 1.4 });
    attachPrimitiveDriver(hub, result, 'click', { nodeId: 'n1' });
    hub.events.fire('click:n1');
    expect(tl.restart).toHaveBeenCalledTimes(1);
  });

  it('replays on a generic click carrying the matching nodeId only', () => {
    const hub = createDriverHub();
    const { result, tl } = spyResult({ duration: 1.4 });
    attachPrimitiveDriver(hub, result, 'click', { nodeId: 'n1' });
    hub.events.fire('click', { nodeId: 'other' });
    expect(tl.restart).not.toHaveBeenCalled();
    hub.events.fire('click', { nodeId: 'n1' });
    expect(tl.restart).toHaveBeenCalledTimes(1);
  });
});

describe('STEP7 dispatch — INV-6 (keyframes independent of driver)', () => {
  it('re-attaching with a different trigger leaves the keyframes identical', () => {
    const hub = createDriverHub();
    // A REAL gsap timeline with concrete keyframes (the "animation").
    const obj = { x: 0 };
    const tl = gsap.timeline({ paused: true });
    tl.to(obj, { x: 10, duration: 1 });
    tl.to(obj, { x: 0, duration: 1 });

    // Snapshot the keyframe model: each child tween's target end-value + its
    // timing (duration + start time). These ARE the keyframes; a driver must
    // never change them. (We pull scalar fields only — gsap's live `vars`
    // object holds back-references that aren't JSON-serializable.)
    const snapshot = () =>
      JSON.stringify({
        duration: tl.duration(),
        children: tl.getChildren(false, true, false).map((c) => {
          const tween = c as gsap.core.Tween;
          return {
            x: (tween.vars as { x?: number }).x,
            varsDuration: (tween.vars as { duration?: number }).duration,
            duration: tween.duration(),
            startTime: tween.startTime(),
          };
        }),
      });

    const before = snapshot();

    const result: PrimitiveResult = {
      timeline: tl,
      cleanup: () => {},
    };

    // Attach as 'scroll', then 'hover', then 'click', then 'load' — every
    // driver reassignment. None may mutate the keyframes.
    const triggers = ['scroll', 'hover', 'click', 'load', 'inview', 'time'] as const;
    for (const trig of triggers) {
      const detach = attachPrimitiveDriver(hub, result, trig, { nodeId: 'n1' });
      expect(snapshot()).toBe(before);
      detach();
      expect(snapshot()).toBe(before);
    }

    tl.kill();
  });
});
