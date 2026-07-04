// SHELL W1 — stub engine protocol round-trip tests.
//
// Drives the DOM-free StubEngineCore over the REAL wire format (serialized
// envelopes both directions) and asserts the contract semantics the builder
// shell depends on: mount/mounted, mode-change acknowledgement, the
// selection echo (`origin:'command'`) vs user selection (`origin:'user'`),
// structured errors for unknown nodes and malformed traffic, and the
// store-side echo discipline (events never produce commands).

import { beforeEach, describe, expect, it } from 'vitest';
import {
  parseEngineEvent,
  serializeShellCommand,
  type PrismEngineEvent,
  type PrismShellCommand,
} from '../../packages/shared-interfaces/src/prism-shell';
import { StubEngineCore } from '../../src/lib/shell/engine/stub-engine-core';
import { useBuilderStore } from '../../src/lib/shell/builder-store';

/** Core with an immediate scheduler + captured (parsed) events. */
function makeCore() {
  const events: PrismEngineEvent[] = [];
  const core = new StubEngineCore(
    (wire) => events.push(parseEngineEvent(wire).event),
    {},
    (fn) => fn(), // immediate — tests run synchronously
  );
  const send = (command: PrismShellCommand) => core.receive(serializeShellCommand(command));
  return { core, events, send };
}

describe('stub engine — command→event round trip over the wire', () => {
  it('answers mount with mounted (+ wave-0 hydration) in envelope form', () => {
    const { events, send } = makeCore();
    send({ type: 'mount', containerId: 'preview-root', graphRef: 'stub-graph:demo' });
    const mounted = events.find((e) => e.type === 'mounted');
    expect(mounted).toEqual({ type: 'mounted', mode: 'preview-app', graphRef: 'stub-graph:demo' });
    // scripted wave-0 hydration exercises the build chrome event types
    expect(events.filter((e) => e.type === 'build-wave').map((e) => e.status)).toEqual([
      'started',
      'completed',
    ]);
    expect(events.filter((e) => e.type === 'node-verified')).toHaveLength(3);
    expect(events.filter((e) => e.type === 'node-mounted')).toHaveLength(3);
  });

  it('honors initialMode on mount', () => {
    const { events, send } = makeCore();
    send({ type: 'mount', containerId: 'c', initialMode: 'galaxy' });
    expect(events.find((e) => e.type === 'mounted')).toMatchObject({ mode: 'galaxy' });
  });

  it('acknowledges set-mode with mode-changed after the transition', () => {
    const { core, events, send } = makeCore();
    send({ type: 'mount', containerId: 'c' });
    send({ type: 'set-mode', mode: 'canvas' });
    expect(core.mode).toBe('canvas');
    expect(events.at(-1)).toEqual({ type: 'mode-changed', mode: 'canvas' });
  });

  it('echoes a shell set-selection as selection-changed origin:command', () => {
    const { events, send } = makeCore();
    send({ type: 'mount', containerId: 'c' });
    send({ type: 'set-selection', nodeId: 'node-hero-title' });
    expect(events.at(-1)).toEqual({
      type: 'selection-changed',
      nodeId: 'node-hero-title',
      origin: 'command',
    });
    send({ type: 'set-selection', nodeId: null });
    expect(events.at(-1)).toEqual({
      type: 'selection-changed',
      nodeId: null,
      origin: 'command',
    });
  });

  it('reports a user click as selection-changed origin:user', () => {
    const { core, events } = makeCore();
    core.userSelect('node-pricing-table');
    expect(events.at(-1)).toEqual({
      type: 'selection-changed',
      nodeId: 'node-pricing-table',
      origin: 'user',
    });
  });

  it('rejects selecting an unknown node with a structured node error', () => {
    const { core, events, send } = makeCore();
    send({ type: 'mount', containerId: 'c' });
    send({ type: 'set-selection', nodeId: 'node-does-not-exist' });
    expect(events.at(-1)).toMatchObject({
      type: 'error',
      error: { code: 'NODE_NOT_FOUND', source: 'node', recoverable: true },
    });
    expect(core.selectedNodeId).toBeNull();
  });

  it('answers open-prompt-edit with prompt-edit-opened for every scope kind', () => {
    const { events, send } = makeCore();
    send({ type: 'mount', containerId: 'c' });
    const scopes = [
      { kind: 'node', nodeId: 'node-hero-title' },
      { kind: 'hub', hubId: 'hub-home' },
      { kind: 'app' },
    ] as const;
    for (const scope of scopes) {
      send({ type: 'open-prompt-edit', scope });
      expect(events.at(-1)).toEqual({ type: 'prompt-edit-opened', scope });
    }
  });

  it('answers focus-camera with camera-focused for hub and node targets', () => {
    const { events, send } = makeCore();
    send({ type: 'mount', containerId: 'c' });
    send({ type: 'focus-camera', target: { kind: 'hub', hubId: 'hub-home' }, animate: true });
    expect(events.at(-1)).toEqual({
      type: 'camera-focused',
      target: { kind: 'hub', hubId: 'hub-home' },
    });
    send({ type: 'focus-camera', target: { kind: 'node', nodeId: 'node-hero-cta' } });
    expect(events.at(-1)).toEqual({
      type: 'camera-focused',
      target: { kind: 'node', nodeId: 'node-hero-cta' },
    });
  });

  it('answers malformed traffic with a structured contract error, never silence', () => {
    const { core, events } = makeCore();
    core.receive('{"not":"an envelope"}');
    expect(events.at(-1)).toMatchObject({
      type: 'error',
      error: { code: 'CONTRACT_PARSE_FAILED', source: 'contract', recoverable: true },
    });
  });

  it('answers unmount with unmounted', () => {
    const { events, send } = makeCore();
    send({ type: 'mount', containerId: 'c' });
    send({ type: 'unmount' });
    expect(events.at(-1)).toEqual({ type: 'unmounted' });
  });

  it('goes silent after dispose (no events across a dead boundary)', () => {
    const { core, events, send } = makeCore();
    send({ type: 'mount', containerId: 'c' });
    const count = events.length;
    core.dispose();
    send({ type: 'set-mode', mode: 'galaxy' });
    core.userSelect('node-hero-title');
    expect(events).toHaveLength(count);
  });
});

describe('builder store — echo discipline + wire log', () => {
  beforeEach(() => {
    useBuilderStore.getState().beginEngineSession('stub');
  });

  it('applies selection echoes to state WITHOUT emitting any command', () => {
    const store = useBuilderStore.getState();
    const logBefore = useBuilderStore.getState().wireLog.length;
    store.applyEngineEvent({
      type: 'selection-changed',
      nodeId: 'node-hero-title',
      origin: 'command',
    });
    const after = useBuilderStore.getState();
    expect(after.selectedNodeId).toBe('node-hero-title');
    expect(after.lastSelectionOrigin).toBe('command');
    // Echo discipline is structural: applying events cannot grow the log —
    // only sendCommand/onEvent (the bridge) write log entries.
    expect(after.wireLog.length).toBe(logBefore);
  });

  it('tracks mode round-trip state (pending until the engine confirms)', () => {
    const store = useBuilderStore.getState();
    store.noteModeRequested('canvas');
    expect(useBuilderStore.getState().pendingMode).toBe('canvas');
    store.applyEngineEvent({ type: 'mode-changed', mode: 'canvas' });
    const after = useBuilderStore.getState();
    expect(after.mode).toBe('canvas');
    expect(after.pendingMode).toBeNull();
  });

  it('caps the wire log as a ring buffer', () => {
    const store = useBuilderStore.getState();
    for (let i = 0; i < 300; i += 1) {
      store.logWire({ dir: 'shell→engine', type: 'set-mode', id: `cmd-${i}`, ts: i, wire: '{}' });
    }
    const log = useBuilderStore.getState().wireLog;
    expect(log.length).toBe(250);
    expect(log[0].id).toBe('cmd-50');
    expect(log.at(-1)?.id).toBe('cmd-299');
  });

  it('clears an in-flight mode request when an error settles it', () => {
    const store = useBuilderStore.getState();
    store.noteModeRequested('galaxy');
    expect(useBuilderStore.getState().pendingMode).toBe('galaxy');
    store.applyEngineEvent({
      type: 'error',
      error: { code: 'X', message: 'transition failed', source: 'engine', recoverable: true },
    });
    // the pending bead must never pulse forever on a failed transition
    expect(useBuilderStore.getState().pendingMode).toBeNull();
  });

  it('marks the engine errored only on unrecoverable errors', () => {
    const store = useBuilderStore.getState();
    store.applyEngineEvent({
      type: 'error',
      error: { code: 'X', message: 'soft', source: 'node', recoverable: true },
    });
    expect(useBuilderStore.getState().engineStatus).toBe('booting');
    store.applyEngineEvent({
      type: 'error',
      error: { code: 'Y', message: 'hard', source: 'engine', recoverable: false },
    });
    expect(useBuilderStore.getState().engineStatus).toBe('error');
  });
});
