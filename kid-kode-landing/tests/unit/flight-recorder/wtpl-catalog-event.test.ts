// W-TPL D6 — catalog_event (9th record type) round-trips through the recorder:
// stage + catalog metadata survive, user free text (hub name / search query) is
// PII-scrubbed at write, and the record is a labeled "archetype + grammar family
// → real graph" training example.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FlightRecorderWriter } from '@/lib/flight-recorder/writer';
import {
  __setWriter,
  recordCatalog,
  FLIGHT_RECORD_TYPES,
} from '@/lib/flight-recorder';
import { MemorySink } from './mem-sink';

describe('W-TPL catalog_event — 9th record type', () => {
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
    expect(FLIGHT_RECORD_TYPES).toContain('catalog_event');
  });

  it('instantiate-hub: catalog metadata survives, hub name PII scrubbed', async () => {
    recordCatalog({
      touchpoint: 'catalog',
      actor: { projectId: 'proj-tpl', tenantId: 'tenant-hash', consentOverride: true },
      stage: 'instantiate-hub',
      template_slug: 'meridian',
      archetype: 'landing',
      primary_family: 'layered-photo-parallax-hero',
      route: 'R2',
      node_count: 12,
      hub_ref: 'tpl-meridian-abcd1234',
      // A user hub name can carry personal info — must be redacted at write.
      detail: 'named by sam@example.com — "Sam’s launch page"',
    });
    await writer.flush();

    expect(training.records).toHaveLength(1);
    const r = training.records[0] as unknown as Record<string, unknown>;
    expect(r.record_type).toBe('catalog_event');
    expect(r.stage).toBe('instantiate-hub');
    expect(r.template_slug).toBe('meridian');
    expect(r.archetype).toBe('landing');
    expect(r.primary_family).toBe('layered-photo-parallax-hero');
    expect(r.route).toBe('R2');
    expect(r.node_count).toBe(12);
    expect(r.hub_ref).toBe('tpl-meridian-abcd1234');
    expect(r.touchpoint).toBe('catalog');
    // Email redacted; surrounding structure preserved.
    expect(String(r.detail)).not.toContain('example.com');
    expect(String(r.detail)).toContain('named by');
  });

  it('drop-section: section metadata survives', async () => {
    recordCatalog({
      touchpoint: 'catalog',
      actor: { projectId: 'proj-tpl', consentOverride: true },
      stage: 'drop-section',
      section_slug: 'sec-pricing-triptych',
      section_kind: 'pricing',
      node_count: 9,
      hub_ref: 'existing-hub-7',
      ok: true,
    });
    await writer.flush();

    expect(training.records).toHaveLength(1);
    const r = training.records[0] as unknown as Record<string, unknown>;
    expect(r.record_type).toBe('catalog_event');
    expect(r.stage).toBe('drop-section');
    expect(r.section_slug).toBe('sec-pricing-triptych');
    expect(r.section_kind).toBe('pricing');
    expect(r.node_count).toBe(9);
    expect(r.ok).toBe(true);
  });

  it('consent=false quarantines the catalog event (I-CONSENT)', async () => {
    recordCatalog({
      touchpoint: 'catalog',
      actor: { projectId: 'proj-tpl', consentOverride: false },
      stage: 'instantiate-hub',
      template_slug: 'abacus',
      archetype: 'pricing',
    });
    await writer.flush();

    expect(training.records).toHaveLength(0);
    expect(quarantine.records).toHaveLength(1);
    expect((quarantine.records[0] as unknown as Record<string, unknown>).record_type).toBe(
      'catalog_event',
    );
  });
});
