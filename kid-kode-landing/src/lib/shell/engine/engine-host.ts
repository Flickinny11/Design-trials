// PRISM SHELL — ENGINE HOST BOUNDARY (SHELL W1, 2026-07-04)
//
// The shell side of the Prime Boundary (spec §0 / I0). A PrismEngineHost is
// whatever lives inside the preview frame — the real Three.js/WebGPU engine
// or the W1 stub — and the shell talks to it EXCLUSIVELY in serialized
// contract envelopes (packages/shared-interfaces/src/prism-shell.ts). The
// wire string is the boundary: the shell never holds an engine object beyond
// this interface, and nothing here imports engine-interior modules.

import { realEngineHostFactory } from './real-engine-adapter';
import { StubEngineHost } from './stub-engine';

export interface PrismEngineHost {
  /** Which implementation answered the resolver (surfaced in dev chrome). */
  readonly kind: 'stub' | 'real';
  /** Deliver one serialized PrismShellCommandEnvelope. */
  send(wire: string): void;
  /** Subscribe to serialized PrismEngineEventEnvelopes. Returns unsubscribe. */
  onEvent(listener: (wire: string) => void): () => void;
  /** Tear down everything the host attached (canvas, observers, timers). */
  dispose(): void;
}

/** Resolve the engine implementation for this session.
 *
 *  `NEXT_PUBLIC_PRISM_ENGINE=real` selects the real engine adapter once the
 *  engine session merges one (W0 report §6.7: the embed stays against the
 *  stub until then). Until that adapter exists the flag falls back to the
 *  stub — loudly, via a console.warn, never silently. */
export function resolveEngineHost(): PrismEngineHost {
  const wantReal = process.env.NEXT_PUBLIC_PRISM_ENGINE === 'real';
  if (wantReal) {
    if (realEngineHostFactory) return realEngineHostFactory();
    // eslint-disable-next-line no-console
    console.warn(
      '[prism-shell] NEXT_PUBLIC_PRISM_ENGINE=real but no real engine adapter ' +
        'is registered yet (engine session not merged) — falling back to the stub.',
    );
  }
  return new StubEngineHost();
}
