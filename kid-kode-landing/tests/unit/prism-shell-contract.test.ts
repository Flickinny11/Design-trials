// SHELL W0 — shell↔engine contract round-trip tests (prism-shell.ts).
//
// The Prime Boundary's only crossing is this wire format, so every command
// and event variant must survive serialize → JSON wire → parse byte-exact,
// and malformed/foreign traffic must fail loudly instead of half-applying.

import { describe, expect, it } from 'vitest';
import {
  PRISM_SHELL_CONTRACT_VERSION,
  parseEngineEvent,
  parseShellCommand,
  serializeEngineEvent,
  serializeShellCommand,
  type PrismEngineEvent,
  type PrismShellCommand,
} from '../../packages/shared-interfaces/src/prism-shell';
import {
  PRISM_COLLAB_CONTRACT_VERSION,
  collabOpSchema,
  presenceStateSchema,
  roomEventEnvelopeSchema,
  type RoomEventEnvelope,
} from '../../packages/shared-interfaces/src/prism-collab';
import {
  PRISM_BRAND_SCHEMA_VERSION,
  brandProfileSchema,
  parseBrandProfile,
} from '../../packages/shared-interfaces/src/prism-brand';

// Every command variant, exercising optional fields on and off.
const COMMANDS: PrismShellCommand[] = [
  { type: 'mount', containerId: 'prism-preview-root', graphRef: 'live-graph', initialMode: 'preview-app' },
  { type: 'mount', containerId: 'prism-preview-root' },
  { type: 'unmount' },
  { type: 'set-mode', mode: 'galaxy' },
  { type: 'set-mode', mode: 'canvas' },
  { type: 'set-mode', mode: 'preview-app' },
  { type: 'focus-camera', target: { kind: 'hub', hubId: 'home-hub' }, animate: true },
  { type: 'focus-camera', target: { kind: 'node', nodeId: 'node-42' } },
  { type: 'set-selection', nodeId: 'node-42' },
  { type: 'set-selection', nodeId: null },
  { type: 'open-prompt-edit', scope: { kind: 'node', nodeId: 'node-42' } },
  { type: 'open-prompt-edit', scope: { kind: 'hub', hubId: 'home-hub' } },
  { type: 'open-prompt-edit', scope: { kind: 'app' } },
];

// Every event variant.
const EVENTS: PrismEngineEvent[] = [
  { type: 'mounted', mode: 'preview-app', graphRef: 'live-graph' },
  { type: 'unmounted' },
  { type: 'mode-changed', mode: 'canvas' },
  { type: 'camera-focused', target: { kind: 'node', nodeId: 'node-42' } },
  { type: 'selection-changed', nodeId: 'node-42', origin: 'user' },
  { type: 'selection-changed', nodeId: null, origin: 'command' },
  { type: 'node-verified', nodeId: 'node-7', wave: 0 },
  { type: 'node-mounted', nodeId: 'node-7', wave: 0 },
  { type: 'build-wave', wave: 2, status: 'started' },
  { type: 'build-wave', wave: 2, status: 'completed' },
  { type: 'prompt-edit-opened', scope: { kind: 'app' } },
  {
    type: 'error',
    error: { code: 'ENGINE_CRASH', message: 'boom', source: 'engine', recoverable: false },
  },
];

describe('prism-shell command round-trip', () => {
  for (const command of COMMANDS) {
    it(`round-trips ${command.type}${'mode' in command ? `:${command.mode}` : ''}`, () => {
      const wire = serializeShellCommand(command, { id: 'test-id', ts: 1751600000000 });
      const parsed = parseShellCommand(wire);
      expect(parsed.command).toEqual(command);
      expect(parsed.v).toBe(PRISM_SHELL_CONTRACT_VERSION);
      expect(parsed.kind).toBe('prism-shell-command');
      expect(parsed.id).toBe('test-id');
      expect(parsed.ts).toBe(1751600000000);
    });
  }

  it('assigns id/ts when not provided', () => {
    const parsed = parseShellCommand(serializeShellCommand({ type: 'unmount' }));
    expect(parsed.id.length).toBeGreaterThan(0);
    expect(parsed.ts).toBeGreaterThan(0);
  });

  it('rejects an unknown command type', () => {
    const wire = JSON.stringify({
      v: 1, kind: 'prism-shell-command', id: 'x', ts: 1,
      command: { type: 'self-destruct' },
    });
    expect(() => parseShellCommand(wire)).toThrow();
  });

  it('rejects a non-canonical view mode literal', () => {
    const wire = JSON.stringify({
      v: 1, kind: 'prism-shell-command', id: 'x', ts: 1,
      command: { type: 'set-mode', mode: 'split' },
    });
    expect(() => parseShellCommand(wire)).toThrow();
  });

  it('rejects a foreign contract version', () => {
    const wire = JSON.stringify({
      v: 99, kind: 'prism-shell-command', id: 'x', ts: 1,
      command: { type: 'unmount' },
    });
    expect(() => parseShellCommand(wire)).toThrow();
  });

  it('rejects an event envelope fed to the command parser (kind mismatch)', () => {
    const wire = serializeEngineEvent({ type: 'unmounted' });
    expect(() => parseShellCommand(wire)).toThrow();
  });
});

describe('prism-shell event round-trip', () => {
  for (const event of EVENTS) {
    it(`round-trips ${event.type}${'status' in event ? `:${event.status}` : ''}`, () => {
      const wire = serializeEngineEvent(event, { id: 'evt-id', ts: 1751600000001 });
      const parsed = parseEngineEvent(wire);
      expect(parsed.event).toEqual(event);
      expect(parsed.v).toBe(PRISM_SHELL_CONTRACT_VERSION);
      expect(parsed.kind).toBe('prism-engine-event');
    });
  }

  it('rejects a negative build wave', () => {
    const wire = JSON.stringify({
      v: 1, kind: 'prism-engine-event', id: 'x', ts: 1,
      event: { type: 'node-mounted', nodeId: 'n', wave: -1 },
    });
    expect(() => parseEngineEvent(wire)).toThrow();
  });

  it('selection round-trip: shell command and engine echo carry the same node id', () => {
    const cmd = parseShellCommand(
      serializeShellCommand({ type: 'set-selection', nodeId: 'node-neo' }),
    );
    const echo = parseEngineEvent(
      serializeEngineEvent({ type: 'selection-changed', nodeId: 'node-neo', origin: 'command' }),
    );
    expect(cmd.command.type).toBe('set-selection');
    expect(echo.event.type).toBe('selection-changed');
    if (cmd.command.type === 'set-selection' && echo.event.type === 'selection-changed') {
      expect(echo.event.nodeId).toBe(cmd.command.nodeId);
      expect(echo.event.origin).toBe('command');
    }
  });
});

describe('prism-collab types (decision E — shapes only)', () => {
  it('round-trips a presence state through JSON', () => {
    const presence = {
      actor: { actorId: 'a1', displayName: 'Logan', colorSeed: 3 },
      cursor: { x: 0.25, y: 0.75 },
      selection: ['node-1', 'node-2'],
      editingNodeId: 'node-1',
      camera: {
        position: [0, 4, 12] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
        mode: 'canvas' as const,
      },
      updatedAt: 1751600000002,
    };
    const parsed = presenceStateSchema.parse(JSON.parse(JSON.stringify(presence)));
    expect(parsed).toEqual(presence);
  });

  it('round-trips a per-property LWW op and enforces required fields', () => {
    const op = {
      nodeId: 'node-1',
      path: 'scenePosition.x',
      value: 4.2,
      seq: 17,
      actor: 'a1',
      ts: 1751600000003,
    };
    expect(collabOpSchema.parse(JSON.parse(JSON.stringify(op)))).toEqual(op);
    expect(() => collabOpSchema.parse({ ...op, path: '' })).toThrow();
  });

  it('round-trips a room event envelope and rejects a foreign version', () => {
    const envelope: RoomEventEnvelope = {
      v: PRISM_COLLAB_CONTRACT_VERSION,
      kind: 'prism-room-event',
      roomId: 'project-9',
      ts: 1751600000004,
      event: {
        type: 'op-committed',
        op: { nodeId: 'node-1', path: 'caption', value: 'Hi', seq: 18, actor: 'a1', ts: 1 },
      },
    };
    const parsed = roomEventEnvelopeSchema.parse(JSON.parse(JSON.stringify(envelope)));
    expect(parsed).toEqual(envelope);
    expect(() => roomEventEnvelopeSchema.parse({ ...envelope, v: 2 })).toThrow();
  });
});

describe('prism-brand profile', () => {
  it('parses a full profile and round-trips through JSON', () => {
    const profile = {
      v: PRISM_BRAND_SCHEMA_VERSION,
      name: 'Kriptik',
      logo: { assetId: 'asset-logo-1', mimeType: 'image/svg+xml', alt: 'Kriptik mark' },
      palette: { primary: '#ff2a38', secondary: '#16161d', accent: '#e8ecf2', neutrals: ['#030408', '#16161d'] },
      typePrefs: {
        display: { classification: 'serif' as const, family: 'Fraunces' },
        text: { classification: 'mono' as const },
      },
      toneDescriptors: ['confident', 'precise'],
    };
    expect(parseBrandProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
  });

  it('rejects a malformed palette hex', () => {
    expect(() =>
      brandProfileSchema.parse({
        v: 1,
        name: 'X',
        palette: { primary: 'red' },
        toneDescriptors: [],
      }),
    ).toThrow();
  });
});
