// Driver dispatch — maps a node-declared animation `trigger` onto playback of
// that animation's already-built `PrimitiveResult`, using the shared
// `DriverHub` inputs.
//
// Spec: PRISM-CANVAS-EDITOR-SPEC.md §8.2 (Driver model) + §16 (Preview).
//
// INV-6 (driver-decoupled playback): an animation's keyframes/states are
// INDEPENDENT of what plays them back. This module is the embodiment of that
// invariant — it ONLY calls playback methods on the gsap timeline
// (`play` / `progress` / `reverse` / `restart` / `pause`) and registers the
// primitive's per-frame `onTick`. It NEVER reads or writes the timeline's
// keyframes, and re-running it with a different `trigger` produces identical
// keyframes (proven in driver-dispatch.test.ts).
//
// The `trigger` enum (CinematicPrimitiveTrigger) is the per-animation driver
// assignment the spec's toolbar trigger buttons write. The mapping:
//   - 'time'   → TimeDriver: continuous timelines self-run via gsap; nothing
//                to wire here (the keyframe editor scrubs them).
//   - 'load'   → TimeDriver: play a paused timeline once when the node mounts.
//   - 'inview' → InviewDriver (W8 E8): a REAL per-node viewport-intersection
//                test (the host projects the node's world centre through the
//                live camera every frame and feeds `hub.inview`). The timeline
//                plays once on the rising edge (section scrolls on-screen);
//                with `info.replay` it resets on exit so it re-fires on the
//                next entry. This generalizes M2's authored inview idiom into a
//                driver — keyframes untouched (INV-6).
//   - 'scroll' → ScrollDriver: scrub the timeline by scroll progress 0..1. With
//                `info.section` it scrubs by this node's SECTION-relative
//                progress (from `hub.inview`) instead — SR-style per-section
//                scrub. Default = global scroll (unchanged).
//   - 'hover'  → StateDriver: play forward on hover-in, reverse on hover-out.
//   - 'click'  → EventDriver: (re)play on a fired click event for this node.
//
// Empty timelines (parallax-scroll / magnetic-cursor consume their driver
// input directly inside the primitive) have duration 0, so the timeline-play
// branches are no-ops for them — their motion still happens, via `ctx.scroll` /
// `ctx.pointer` + `onTick`, which this module also wires.

import type { CinematicPrimitiveTrigger } from '../../../prism-graph/cinematic-primitives';
import type { PrimitiveResult } from './primitives/types';
import type { DriverHub } from './drivers';

interface PlayableTimeline {
  play?: (from?: number) => unknown;
  pause?: () => unknown;
  reverse?: () => unknown;
  restart?: () => unknown;
  progress?: (value?: number) => unknown;
  duration?: () => number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Read the timeline's total duration in seconds (0 for empty / stub). */
function durationOf(tl: PlayableTimeline): number {
  if (typeof tl.duration !== 'function') return 0;
  try {
    const d = tl.duration();
    return typeof d === 'number' && Number.isFinite(d) ? d : 0;
  } catch {
    return 0;
  }
}

export interface AttachDriverInfo {
  /** Id of the node whose animation this is — used to address hover state and
   *  click events to the right node. */
  nodeId: string;
  /** W8 E8 — when true, a `scroll`-triggered timeline scrubs by this node's
   *  SECTION-relative progress (0 as the node enters from the bottom, 1 as it
   *  exits past the top) read from `hub.inview`, instead of the global scroll
   *  source. This is what makes "each section plays through its own animation
   *  as you pass it" (SR-style). Absent/false → global scroll (unchanged). */
  section?: boolean;
  /** W8 E8 — when true, an `inview` reveal resets to t=0 as the section leaves
   *  the viewport so it replays on the next entry. Absent/false → play once and
   *  hold (the reveal stays revealed). */
  replay?: boolean;
}

/** The driver surface the factory sees on `NodeContext.drivers`. Carries the
 *  shared hub (for per-node result registration / diagnostics) plus a bound
 *  `attach`. */
export interface NodeDrivers {
  hub: DriverHub;
  attach(
    result: PrimitiveResult,
    trigger: CinematicPrimitiveTrigger,
    info: AttachDriverInfo,
  ): () => void;
}

/** Bind a hub into the `NodeDrivers` surface the factory consumes. */
export function makeNodeDrivers(hub: DriverHub): NodeDrivers {
  return {
    hub,
    attach: (result, trigger, info) =>
      attachPrimitiveDriver(hub, result, trigger, info),
  };
}

/**
 * Wire a built `PrimitiveResult` to its declared `trigger` using the hub's
 * driver inputs. Returns a `detach()` that unsubscribes everything this call
 * wired up. `detach()` does NOT kill the timeline or dispose the primitive —
 * the factory's `userData.cleanup` owns that.
 */
export function attachPrimitiveDriver(
  hub: DriverHub,
  result: PrimitiveResult,
  trigger: CinematicPrimitiveTrigger,
  info: AttachDriverInfo,
): () => void {
  const detachers: Array<() => void> = [];
  const tl = result.timeline as unknown as PlayableTimeline;
  const hasTimeline = typeof tl?.play === 'function';
  const duration = hasTimeline ? durationOf(tl) : 0;

  // Per-frame tick (independent of trigger) — e.g. magnetic-cursor's lerp.
  if (result.needsTick && typeof result.onTick === 'function') {
    const onTick = result.onTick;
    const unregister = hub.frame.add((deltaMs) => onTick(deltaMs / 1000));
    detachers.push(unregister);
  }

  switch (trigger) {
    case 'load': {
      // Play a paused, keyframed timeline once when the node mounts. Empty
      // timelines (duration 0) no-op — their motion comes from their driver
      // input.
      if (hasTimeline && duration > 0 && typeof tl.play === 'function') {
        tl.play(0);
      }
      break;
    }
    case 'inview': {
      // W8 E8 — REAL section-aware reveal. Gate playback on the host's per-node
      // viewport-intersection feed instead of playing unconditionally on mount.
      if (hasTimeline && duration > 0 && typeof tl.play === 'function') {
        // If the node is already on-screen when it mounts (e.g. the landing
        // hub), reveal immediately; otherwise wait for the rising edge.
        if (hub.inview.get(info.nodeId).visible) {
          tl.play(0);
        }
        let wasVisible = hub.inview.get(info.nodeId).visible;
        detachers.push(
          hub.inview.subscribe(info.nodeId, (vp) => {
            if (vp.visible && !wasVisible) {
              // Rising edge — the section just scrolled on-screen.
              if (typeof tl.restart === 'function') tl.restart();
              else tl.play?.(0);
            } else if (!vp.visible && wasVisible && info.replay) {
              // Falling edge with replay — rewind so the next entry re-fires.
              tl.pause?.();
              tl.progress?.(0);
            }
            wasVisible = vp.visible;
          }),
        );
      }
      break;
    }
    case 'scroll': {
      // Scrub the timeline by live scroll progress. Empty timelines no-op
      // (parallax-scroll moves via ctx.scroll inside the primitive).
      if (hasTimeline && duration > 0 && typeof tl.progress === 'function') {
        const apply = (p: number): void => {
          tl.progress!(clamp01(p));
        };
        if (info.section) {
          // W8 E8 — SECTION-relative scrub: this node scrubs through its own
          // animation as it passes through the viewport (SR signature).
          apply(hub.inview.get(info.nodeId).progress);
          detachers.push(
            hub.inview.subscribe(info.nodeId, (vp) => apply(vp.progress)),
          );
        } else {
          // Global scroll (unchanged). Seed with the current progress so a node
          // that mounts mid-scroll is already at the right phase.
          apply(hub.scroll.progress);
          detachers.push(hub.scroll.subscribe(apply));
        }
      }
      break;
    }
    case 'hover': {
      // StateDriver: play forward while hovered, reverse when un-hovered.
      // The host sets `hover:<nodeId>` true/false (e.g. from a pointer raycast
      // or a programmatic state). Empty timelines no-op (magnetic-cursor
      // tracks the pointer continuously via onTick instead).
      if (hasTimeline && duration > 0) {
        const key = `hover:${info.nodeId}`;
        detachers.push(
          hub.state.subscribe((name, value) => {
            if (name !== key) return;
            if (value) {
              tl.play?.();
            } else {
              tl.reverse?.();
            }
          }),
        );
      }
      break;
    }
    case 'click': {
      // EventDriver: (re)play on a click for THIS node. The host fires either
      // a node-addressed `click:<nodeId>` event or a generic `click` event
      // carrying `{ nodeId }`.
      if (hasTimeline && duration > 0) {
        const replay = (): void => {
          if (typeof tl.restart === 'function') tl.restart();
          else tl.play?.(0);
        };
        detachers.push(hub.events.subscribe(`click:${info.nodeId}`, replay));
        detachers.push(
          hub.events.subscribe('click', (payload) => {
            const id = (payload as { nodeId?: string } | undefined)?.nodeId;
            if (id === info.nodeId) replay();
          }),
        );
      }
      break;
    }
    case 'time':
    default:
      // Continuous timelines (repeat:-1) self-run via gsap's global ticker;
      // pure time-scrub playback is owned by the keyframe editor. Nothing to
      // wire on the driver side.
      break;
  }

  return () => {
    for (const d of detachers) {
      try {
        d();
      } catch {
        /* ignore */
      }
    }
    detachers.length = 0;
  };
}
