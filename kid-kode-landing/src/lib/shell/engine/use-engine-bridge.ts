'use client';

// PRISM SHELL — ENGINE BRIDGE HOOK (SHELL W1, 2026-07-04)
//
// The single point where the builder shell touches the engine host. Owns the
// host lifecycle (resolve → mount → unmount → dispose), serializes every
// outbound command, parses every inbound event, and logs BOTH directions
// into the builder store's wire log before anything is applied — the W1
// gate's round-trip evidence is produced here, not reconstructed later.
//
// Everything crossing this file is a serialized envelope; components never
// see the host object, only sendCommand(PrismShellCommand).

import { useCallback, useEffect, useRef } from 'react';
import {
  parseEngineEvent,
  serializeShellCommand,
  type PrismShellCommand,
} from '../../../../packages/shared-interfaces/src/prism-shell';
import { useBuilderStore } from '../builder-store';
import { resolveEngineHost, type PrismEngineHost } from './engine-host';

export interface EngineBridge {
  /** Serialize + log + deliver one command to the engine host. */
  sendCommand: (command: PrismShellCommand) => void;
}

export function useEngineBridge(opts: {
  /** DOM id of the shell-owned container the engine mounts into. */
  containerId: string;
  /** Opaque graph reference (never inline data — contract discipline). */
  graphRef: string;
  /** UXV-F3: when the project is already built at page load, PreviewRegion
   *  renders ConductorPreview and the engine container is never in the DOM —
   *  requesting a mount can only ever fail (CONTAINER_MISSING on every
   *  reload of a built project). Suppress the mount/unmount commands; the
   *  session, wire log, and event subscription stay live. */
  suppressMount?: boolean;
}): EngineBridge {
  const hostRef = useRef<PrismEngineHost | null>(null);

  const sendCommand = useCallback((command: PrismShellCommand) => {
    const host = hostRef.current;
    if (!host) return;
    const wire = serializeShellCommand(command);
    // The envelope was just built by our own serializer; parse cost is
    // negligible at command rates and keeps the log fields honest (id/ts
    // exactly as they crossed, not re-derived).
    const envelope = JSON.parse(wire) as { id: string; ts: number };
    useBuilderStore.getState().logWire({
      dir: 'shell→engine',
      type: command.type,
      id: envelope.id,
      ts: envelope.ts,
      wire,
    });
    host.send(wire);
  }, []);

  const { containerId, graphRef, suppressMount = false } = opts;

  useEffect(() => {
    const host = resolveEngineHost();
    hostRef.current = host;
    const store = useBuilderStore.getState();
    store.beginEngineSession(host.kind);

    const unsubscribe = host.onEvent((wire) => {
      const s = useBuilderStore.getState();
      let envelope;
      try {
        envelope = parseEngineEvent(wire);
      } catch {
        // Foreign/malformed traffic from the engine side: logged as a
        // contract fault, never half-applied (prism-shell.ts discipline).
        s.logWire({ dir: 'engine→shell', type: 'unparseable', id: '—', ts: Date.now(), wire });
        s.applyEngineEvent({
          type: 'error',
          error: {
            code: 'CONTRACT_PARSE_FAILED',
            message: 'shell could not parse an inbound engine event envelope',
            source: 'contract',
            recoverable: true,
          },
        });
        return;
      }
      s.logWire({
        dir: 'engine→shell',
        type: envelope.event.type,
        id: envelope.id,
        ts: envelope.ts,
        wire,
      });
      s.applyEngineEvent(envelope.event);
    });

    // Mount AFTER subscribing so the `mounted` event is never missed.
    if (!suppressMount) {
      sendCommand({
        type: 'mount',
        containerId,
        graphRef,
        initialMode: 'preview-app',
      });
    }

    return () => {
      if (!suppressMount) sendCommand({ type: 'unmount' });
      unsubscribe();
      host.dispose();
      hostRef.current = null;
    };
  }, [containerId, graphRef, sendCommand, suppressMount]);

  return { sendCommand };
}
