// PRISM SHELL — REAL ENGINE ADAPTER (SHELL W2 TASK 0, 2026-07-04)
//
// The founder addendum (SHELL-W1-BUILDER-SHELL-PROMPT.md 2026-07-04 13:40,
// re-issued as W2 Task 0 at 13:56) supersedes this file's W1 "engine session
// merges it" note: the REAL prototype — the certified ORRERY runtime, the
// same scene the `/` route mounts — must host inside PreviewRegion behind
// the W0 contract, via additive adapter code only. Deviation W2-D1 records
// the mechanism.
//
// Transport: an IFRAME onto the shell route /app/engine-frame, which
// composes the UNMODIFIED `/` page component plus a shell-owned bridge
// (EngineFrameBridge). Every message crossing the boundary is a serialized
// prism-shell.ts envelope; this host only wraps/unwraps the transport
// carrier. The iframe (not a same-tree mount) is deliberate: the prototype
// installs global keybinds (undo/redo, Cmd+K, Escape→canvas), a body scroll
// lock, and its own WebGPU context — the frame document isolates all of it
// from the chat column, and fullscreen / open-in-new-tab / device-size frame
// controls fall out of the same anatomy (the Lovable/Claude-Design pattern
// the founder named).
//
// Lifecycle: `mount` creates (or recreates — that IS refresh/rebuild) the
// iframe inside the shell-owned container; command wires queue until the
// frame bridge says hello, then flush in order. `unmount` tears the iframe
// down and this host answers with the `unmounted` event itself (the frame
// document may already be gone).

import {
  parseShellCommand,
  serializeEngineEvent,
} from '../../../../packages/shared-interfaces/src/prism-shell';
import type { PrismEngineHost } from './engine-host';

/** Route the iframe loads — the prototype + bridge composition. */
export const ENGINE_FRAME_ROUTE = '/app/engine-frame';

/** Transport carriers (wiring only — payloads are contract envelopes). */
export interface ShellToFrameCarrier {
  __prismShellWire: string;
}
export interface FrameToShellCarrier {
  __prismEngineWire?: string;
  __prismEngineHello?: true;
}

export class RealEngineHost implements PrismEngineHost {
  readonly kind = 'real' as const;

  private readonly listeners = new Set<(wire: string) => void>();
  private iframe: HTMLIFrameElement | null = null;
  private frameReady = false;
  private queue: string[] = [];
  private disposed = false;

  constructor() {
    window.addEventListener('message', this.onMessage);
  }

  // ── PrismEngineHost ────────────────────────────────────────────────────────

  send(wire: string): void {
    if (this.disposed) return;
    let envelope;
    try {
      envelope = parseShellCommand(wire);
    } catch {
      this.emit(
        serializeEngineEvent({
          type: 'error',
          error: {
            code: 'CONTRACT_PARSE_FAILED',
            message: 'engine host could not parse an outbound command envelope',
            source: 'contract',
            recoverable: true,
          },
        }),
      );
      return;
    }

    const command = envelope.command;
    if (command.type === 'mount') {
      this.attach(command.containerId, wire);
      return;
    }
    if (command.type === 'unmount') {
      // Forward best-effort (the bridge may confirm), then tear down and
      // answer authoritatively from this side of the transport.
      this.post(wire);
      this.teardownFrame();
      this.emit(serializeEngineEvent({ type: 'unmounted' }));
      return;
    }
    this.deliver(wire);
  }

  onEvent(listener: (wire: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('message', this.onMessage);
    this.teardownFrame();
    this.listeners.clear();
    this.queue = [];
  }

  // ── Frame lifecycle ────────────────────────────────────────────────────────

  private attach(containerId: string, mountWire: string, attempt = 0): void {
    const container = document.getElementById(containerId);
    if (!container) {
      // UXV-F3: on a fresh page load the mount command can race the React
      // commit of the conditional container div — retry over a few frames
      // before declaring the container missing (persona evidence:
      // notes/verification/wuxv/p3-developer/ CONTAINER_MISSING on reload).
      if (attempt < 5 && !this.disposed) {
        const raf =
          typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 32);
        raf(() => {
          if (!this.disposed) this.attach(containerId, mountWire, attempt + 1);
        });
        return;
      }
      this.emit(
        serializeEngineEvent({
          type: 'error',
          error: {
            code: 'CONTAINER_MISSING',
            message: `mount container #${containerId} is not in the document`,
            source: 'contract',
            recoverable: false,
          },
        }),
      );
      return;
    }
    // Re-mount == refresh/rebuild: drop any existing frame first.
    this.teardownFrame();

    this.queue = [mountWire];
    const iframe = document.createElement('iframe');
    iframe.src = ENGINE_FRAME_ROUTE;
    iframe.title = 'Prism engine — live prototype';
    // Sizing/edges live in builder.css (.bw1-engine-frame — layout plumbing).
    iframe.className = 'bw1-engine-frame';
    iframe.setAttribute('data-prism-real-engine', 'true');
    iframe.setAttribute('allow', 'fullscreen');
    container.appendChild(iframe);
    this.iframe = iframe;
  }

  private teardownFrame(): void {
    this.frameReady = false;
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }

  // ── Transport ──────────────────────────────────────────────────────────────

  private deliver(wire: string): void {
    if (this.frameReady) {
      this.post(wire);
    } else {
      this.queue.push(wire);
    }
  }

  private post(wire: string): void {
    const target = this.iframe?.contentWindow;
    if (!target) return;
    const carrier: ShellToFrameCarrier = { __prismShellWire: wire };
    target.postMessage(carrier, window.location.origin);
  }

  private onMessage = (event: MessageEvent): void => {
    if (this.disposed) return;
    if (event.origin !== window.location.origin) return;
    if (!this.iframe || event.source !== this.iframe.contentWindow) return;
    const data = event.data as FrameToShellCarrier | null;
    if (!data || typeof data !== 'object') return;

    if (data.__prismEngineHello) {
      this.frameReady = true;
      const pending = this.queue;
      this.queue = [];
      for (const wire of pending) this.post(wire);
      return;
    }
    if (typeof data.__prismEngineWire === 'string') {
      this.emit(data.__prismEngineWire);
    }
  };

  private emit(wire: string): void {
    for (const listener of this.listeners) listener(wire);
  }
}

/** Factory the host resolver consumes (W2 Task 0: the adapter EXISTS now —
 *  the real engine is the default host; the stub is a dev fixture). */
export const realEngineHostFactory: (() => PrismEngineHost) | null = () =>
  new RealEngineHost();
