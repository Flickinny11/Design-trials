// W-2D — render_mode_event (10th record type) round-trips through the
// recorder: surface + from/to modes + hub ref survive, free text (hub titles)
// is PII-scrubbed at write, and consent=false quarantines (I-CONSENT).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FlightRecorderWriter } from '@/lib/flight-recorder/writer';
import {
  __setWriter,
  recordRenderMode,
  FLIGHT_RECORD_TYPES,
} from '@/lib/flight-recorder';
import { MemorySink } from './mem-sink';

describe('W-2D render_mode_event — 10th record type', () => {
  let training: MemorySink;
  let quarantine: MemorySink;
  let writer: FlightRecorderWriter;
  beforeEach(() => {
    training = new MemorySink('training');
    quarantine = new MemorySink('q');
    writer = new FlightRecorderWriter({
      manualFlush: true,
      trainingSinks: [training],
      quarantineSinks: [quarantine],
    });
    __setWriter(writer);
  });
  afterEach(() => {
    __setWriter(null);
  });

  it('is registered in FLIGHT_RECORD_TYPES', () => {
    expect(FLIGHT_RECORD_TYPES).toContain('render_mode_event');
  });

  it('canvas-hud toggle: surface + from/to + hub ref survive; hub hint scrubbed', async () => {
    recordRenderMode({
      touchpoint: 'render-mode',
      actor: { projectId: 'proj-w2d', tenantId: 'tenant-hash', consentOverride: true },
      surface: 'canvas-hud',
      hub_ref: 'hub-ledger-1234',
      from_mode: '3d',
      to_mode: '2d',
      // A user hub title can carry personal info — must be redacted at write.
      hub_hint: 'Ledger for sam@example.com',
    });
    await writer.flush();

    expect(training.records).toHaveLength(1);
    const r = training.records[0] as unknown as Record<string, unknown>;
    expect(r.record_type).toBe('render_mode_event');
    expect(r.surface).toBe('canvas-hud');
    expect(r.hub_ref).toBe('hub-ledger-1234');
    expect(r.from_mode).toBe('3d');
    expect(r.to_mode).toBe('2d');
    expect(r.touchpoint).toBe('render-mode');
    expect(String(r.hub_hint)).not.toContain('example.com');
    expect(String(r.hub_hint)).toContain('Ledger');
  });

  it('conductor assignment: fresh 2d assignment (no from_mode) records', async () => {
    recordRenderMode({
      touchpoint: 'render-mode',
      actor: { projectId: 'proj-w2d', consentOverride: true },
      surface: 'conductor',
      hub_ref: 'hub-data',
      to_mode: '2d',
      detail: 'planner assigned flat composition (data-heavy section)',
    });
    await writer.flush();

    expect(training.records).toHaveLength(1);
    const r = training.records[0] as unknown as Record<string, unknown>;
    expect(r.surface).toBe('conductor');
    expect(r.from_mode).toBeUndefined();
    expect(r.to_mode).toBe('2d');
  });

  it('consent=false quarantines the render-mode event (I-CONSENT)', async () => {
    recordRenderMode({
      touchpoint: 'render-mode',
      actor: { projectId: 'proj-w2d', consentOverride: false },
      surface: 'hub-inspector',
      hub_ref: 'hub-x',
      from_mode: '2d',
      to_mode: '3d',
    });
    await writer.flush();

    expect(training.records).toHaveLength(0);
    expect(quarantine.records).toHaveLength(1);
    expect((quarantine.records[0] as unknown as Record<string, unknown>).record_type).toBe(
      'render_mode_event',
    );
  });
});
