// Driver hub — the runtime side of the Canvas-spec Driver model (§8.2).
//
// Spec: PRISM-CANVAS-EDITOR-SPEC.md §8.2 (Driver model) + §16 (Preview:
// drivers respond to real input). The five drivers are:
//   - TimeDriver    — master clock (continuous gsap timelines self-run; the
//                     keyframe editor scrubs them — owned elsewhere).
//   - ScrollDriver  — scroll progress 0→1 (this module's `scroll` source).
//   - PointerDriver — hover bool / pointer xy (this module's `pointer` source).
//   - StateDriver   — named state inputs (this module's `state` source).
//   - EventDriver   — click/submit/custom triggers (this module's `events`).
//
// THE RULE (anchor / task): drivers only PLAY what a node already declares.
// This module supplies the *inputs* (real scroll, real pointer, named states,
// fired events) and a per-frame ticker. It never authors motion and never
// touches a node's keyframes (INV-6). The mapping from a node's declared
// `trigger` to playback lives in `driver-dispatch.ts`.
//
// DOM-PURITY (FP-05 / INV-15): this module lives under `runtime/` and is
// strictly free of `window.*` / `document.*`. The *host* (GraphScene's
// SceneDriverHost, an editor-shell surface) reads real DOM input and pushes it
// in via the `set*` / `fire` setters below. Primitives consume the read-only
// surfaces (`pointer.ndc`, `scroll.progress`, …) exactly as they do in the
// node test environment.

import type {
  PointerSource,
  PrimitiveResult,
  ScrollSource,
} from './primitives/types';

/** A value a named state input can carry. */
export type StateValue = boolean | number | string;

/** Reactive named-state source. Backs the `StateDriver` (idle/hover/pressed/
 *  loading/success/error…). Read-only surface consumed by dispatch; the host
 *  drives it via the mutable extension. */
export interface StateSource {
  /** Current value of a named state, or undefined if never set. */
  get(name: string): StateValue | undefined;
  /** Subscribe to ANY state change. Returns an unsubscribe fn. */
  subscribe(cb: (name: string, value: StateValue) => void): () => void;
}

/** Reactive event source. Backs the `EventDriver` (click/submit/custom). */
export interface EventSource {
  /** Subscribe to a named event. Returns an unsubscribe fn. */
  subscribe(name: string, cb: (payload: unknown) => void): () => void;
}

/** Per-frame ticker. Primitives that declare `needsTick` register their
 *  `onTick` here via dispatch; the host calls `tick(deltaMs)` once per rendered
 *  frame. Kept separate from gsap's global ticker so a built scene that is not
 *  currently mounted (e.g. galaxy mode) simply stops being ticked. */
export interface FrameDriver {
  /** Register a per-frame callback. Returns an unregister fn. */
  add(cb: (deltaMs: number) => void): () => void;
  /** Invoke every registered callback with the elapsed milliseconds. */
  tick(deltaMs: number): void;
  /** Number of registered callbacks (diagnostics / tests). */
  size(): number;
}

/** Host-writable pointer source. */
export interface MutablePointerSource extends PointerSource {
  /** Whether the pointer is currently over the built view. */
  readonly active: boolean;
  /** Push the latest pointer position (NDC, +y up) and active flag. */
  set(ndc: { x: number; y: number }, active?: boolean): void;
}

/** Host-writable scroll source. */
export interface MutableScrollSource extends ScrollSource {
  /** Push the latest scroll progress (clamped to 0..1). */
  set(progress: number): void;
}

/** Host-writable state source. */
export interface MutableStateSource extends StateSource {
  /** Set a named state value, notifying subscribers when it changes. */
  set(name: string, value: StateValue): void;
}

/** Host-writable event source. */
export interface MutableEventSource extends EventSource {
  /** Fire a named event with an optional payload. */
  fire(name: string, payload?: unknown): void;
}

/** The bundle of driver sources + ticker shared by primitives and the host. */
export interface DriverHub {
  pointer: MutablePointerSource;
  scroll: MutableScrollSource;
  state: MutableStateSource;
  events: MutableEventSource;
  frame: FrameDriver;
  /** Diagnostic registry: per-node PrimitiveResults attached via dispatch.
   *  Lets the debug handle inspect/replay a node's declared animations without
   *  reaching into the scene graph. Keyed by nodeId. */
  registerNodeResult(nodeId: string, result: PrimitiveResult): void;
  /** Drop all results for a node (called from the factory's cleanup). */
  clearNodeResults(nodeId: string): void;
  /** Read a node's attached results (diagnostics / replay). */
  getNodeResults(nodeId: string): readonly PrimitiveResult[];
  /** Reset every source + ticker to its initial state (test escape hatch). */
  reset(): void;
}

function createPointerSource(): MutablePointerSource {
  let ndc = { x: 0, y: 0 };
  let active = false;
  const subs = new Set<(p: { x: number; y: number }) => void>();
  return {
    get ndc() {
      return ndc;
    },
    get active() {
      return active;
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    set(next, isActive) {
      ndc = { x: next.x, y: next.y };
      if (typeof isActive === 'boolean') active = isActive;
      for (const cb of subs) cb(ndc);
    },
  };
}

function createScrollSource(): MutableScrollSource {
  let progress = 0;
  const subs = new Set<(p: number) => void>();
  return {
    get progress() {
      return progress;
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    set(next) {
      const clamped = next < 0 ? 0 : next > 1 ? 1 : next;
      progress = clamped;
      for (const cb of subs) cb(clamped);
    },
  };
}

function createStateSource(): MutableStateSource {
  const values = new Map<string, StateValue>();
  const subs = new Set<(name: string, value: StateValue) => void>();
  return {
    get(name) {
      return values.get(name);
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    set(name, value) {
      // Only notify on an actual change so a StateDriver animation does not
      // re-fire every time the host re-asserts the same state.
      if (values.get(name) === value) return;
      values.set(name, value);
      for (const cb of subs) cb(name, value);
    },
  };
}

function createEventSource(): MutableEventSource {
  const named = new Map<string, Set<(payload: unknown) => void>>();
  return {
    subscribe(name, cb) {
      let set = named.get(name);
      if (!set) {
        set = new Set();
        named.set(name, set);
      }
      set.add(cb);
      return () => {
        const s = named.get(name);
        if (s) s.delete(cb);
      };
    },
    fire(name, payload) {
      const set = named.get(name);
      if (!set) return;
      // Snapshot so a handler that unsubscribes mid-dispatch can't mutate the
      // live set being iterated.
      for (const cb of [...set]) {
        try {
          cb(payload);
        } catch {
          /* a broken handler must not break the fire loop */
        }
      }
    },
  };
}

function createFrameDriver(): FrameDriver {
  const cbs = new Set<(deltaMs: number) => void>();
  return {
    add(cb) {
      cbs.add(cb);
      return () => cbs.delete(cb);
    },
    tick(deltaMs) {
      for (const cb of [...cbs]) {
        try {
          cb(deltaMs);
        } catch {
          /* one bad ticker must not stall the rest of the frame */
        }
      }
    },
    size() {
      return cbs.size;
    },
  };
}

/** Construct a fresh DriverHub. The runtime keeps a single shared instance
 *  (see `shared-context.ts::getSharedDriverHub`); tests can build throwaways. */
export function createDriverHub(): DriverHub {
  let pointer = createPointerSource();
  let scroll = createScrollSource();
  let state = createStateSource();
  let events = createEventSource();
  let frame = createFrameDriver();
  const nodeResults = new Map<string, PrimitiveResult[]>();

  return {
    get pointer() {
      return pointer;
    },
    get scroll() {
      return scroll;
    },
    get state() {
      return state;
    },
    get events() {
      return events;
    },
    get frame() {
      return frame;
    },
    registerNodeResult(nodeId, result) {
      let list = nodeResults.get(nodeId);
      if (!list) {
        list = [];
        nodeResults.set(nodeId, list);
      }
      list.push(result);
    },
    clearNodeResults(nodeId) {
      nodeResults.delete(nodeId);
    },
    getNodeResults(nodeId) {
      return nodeResults.get(nodeId) ?? [];
    },
    reset() {
      pointer = createPointerSource();
      scroll = createScrollSource();
      state = createStateSource();
      events = createEventSource();
      frame = createFrameDriver();
      nodeResults.clear();
    },
  };
}
