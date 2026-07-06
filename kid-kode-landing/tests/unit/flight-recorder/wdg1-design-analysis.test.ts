// W-DG1 — flight-record the design-grammar harvest (deliverable 7, per DEV-1).
//
// The harvest is analysis telemetry: which technique families were distilled,
// from which public sources, at what readiness, and which exemplars we
// generated. This suite proves the additive `design_analysis_event` record
// type + `recordDesignAnalysis` helper work end-to-end through the real writer
// pipeline (scrub + consent + envelope), and REPLAYS the committed corpus into
// the recorder so the harvest lands in the training substrate as real records.
//
// Exemplar *generation* spend is metered through the existing `capability_usage`
// record (DEV-1) — never faked as a new type.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FlightRecorderWriter } from '@/lib/flight-recorder/writer';
import {
  __setWriter,
  recordDesignAnalysis,
  recordCapabilityUsage,
} from '@/lib/flight-recorder';
import { FLIGHT_RECORD_TYPES } from '@/lib/flight-recorder/schema';
import { MemorySink } from './mem-sink';

const FAM_DIR = path.join(process.cwd(), 'design-grammar', 'families');

function loadFamilies(): any[] {
  return fs
    .readdirSync(FAM_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(FAM_DIR, f), 'utf8')));
}

describe('W-DG1 design_analysis_event — 8th record type + harvest replay', () => {
  let training: MemorySink;
  let writer: FlightRecorderWriter;
  beforeEach(() => {
    training = new MemorySink('training');
    writer = new FlightRecorderWriter({
      manualFlush: true,
      trainingSinks: [training],
      quarantineSinks: [new MemorySink('q')],
    });
    __setWriter(writer);
  });
  afterEach(() => {
    __setWriter(null);
  });

  it('registers design_analysis_event in the record-type set', () => {
    expect(FLIGHT_RECORD_TYPES).toContain('design_analysis_event');
  });

  it('distill event: family fields survive; touchpoint is design-grammar; PII scrubbed', async () => {
    recordDesignAnalysis({
      touchpoint: 'design-grammar',
      actor: { consentOverride: true, actorIdentifiers: ['Ada Lovelace'] },
      stage: 'distill',
      family_id: 'layered-photo-parallax-hero',
      source_url:
        'https://www.sliderrevolution.com/templates/zero-point-energy-drink-showcase-template/',
      source_type: 'sr-template',
      analysis_depth: 'deep',
      readiness: 'partial',
      element_types: ['hero', 'product-showcase'],
      exemplar_count: 1,
      ok: true,
      // A distiller name in free text must be redacted at write (I-PII), like
      // every other string, without corrupting the surrounding structure.
      detail: 'distilled by Ada Lovelace from the monitor seed',
    });
    await writer.flush();

    expect(training.records).toHaveLength(1);
    const r = training.records[0] as Record<string, any>;
    expect(r.record_type).toBe('design_analysis_event');
    expect(r.stage).toBe('distill');
    expect(r.family_id).toBe('layered-photo-parallax-hero');
    expect(r.source_url).toContain('sliderrevolution.com'); // public URL, not PII
    expect(r.source_type).toBe('sr-template');
    expect(r.analysis_depth).toBe('deep');
    expect(r.readiness).toBe('partial');
    expect(r.element_types).toEqual(['hero', 'product-showcase']);
    expect(r.exemplar_count).toBe(1);
    expect(r.touchpoint).toBe('design-grammar');
    expect(r.detail).not.toContain('Ada Lovelace');
    expect(r.detail).toContain('distilled by');
  });

  it('gap event: readiness + note recorded honestly for a non-ready family', async () => {
    recordDesignAnalysis({
      touchpoint: 'design-grammar',
      actor: { consentOverride: true },
      stage: 'gap',
      family_id: 'glitch-cyber-fx',
      readiness: 'gap',
      ok: false,
      detail: 'no glitch TSL post pass; no photosensitivity safety rail',
    });
    await writer.flush();
    const r = training.records[0] as Record<string, any>;
    expect(r.record_type).toBe('design_analysis_event');
    expect(r.stage).toBe('gap');
    expect(r.readiness).toBe('gap');
    expect(r.ok).toBe(false);
  });

  it('replays the committed corpus: one distill per family + one capability_usage per exemplar', async () => {
    const families = loadFamilies();
    expect(families.length).toBeGreaterThanOrEqual(14);

    let exemplarCount = 0;
    for (const fam of families) {
      const src = fam.sources?.[0] ?? {};
      recordDesignAnalysis({
        touchpoint: 'design-grammar',
        actor: { consentOverride: true },
        stage: 'distill',
        family_id: fam.id,
        source_url: src.url,
        source_type: src.sourceType,
        analysis_depth: src.analysisDepth,
        readiness: fam.capabilities?.readiness,
        element_types: fam.elementTypes,
        exemplar_count: fam.exemplars?.length ?? 0,
        ok: true,
      });
      if (fam.capabilities?.readiness !== 'ready') {
        recordDesignAnalysis({
          touchpoint: 'design-grammar',
          actor: { consentOverride: true },
          stage: 'gap',
          family_id: fam.id,
          readiness: fam.capabilities?.readiness,
          ok: false,
          detail: (fam.capabilities?.gapNotes ?? [])[0],
        });
      }
      // Exemplar generation spend rides the EXISTING capability_usage record.
      for (const ex of fam.exemplars ?? []) {
        exemplarCount += 1;
        recordCapabilityUsage({
          touchpoint: 'design-grammar',
          actor: { consentOverride: true },
          capability_id: `${ex.generator}.text-to-image`,
          result_asset_ref: ex.path,
          ok: true,
          prism: {
            'prism.cost.unit': 'usd',
            'prism.cost.amount': 0.06,
            'prism.cost.estimated': true,
            'prism.capability.live': ex.mode === 'live',
          },
        });
      }
    }
    await writer.flush();

    const analysis = training.records.filter(
      (r) => r.record_type === 'design_analysis_event',
    );
    const usage = training.records.filter(
      (r) => r.record_type === 'capability_usage',
    );
    const nonReady = families.filter(
      (f) => f.capabilities?.readiness !== 'ready',
    ).length;

    expect(analysis.length).toBe(families.length + nonReady);
    expect(usage.length).toBe(exemplarCount);
    expect(exemplarCount).toBeGreaterThanOrEqual(6); // ≥6 exemplars (D4 target)
    // Every harvest record is partitioned under the design-grammar touchpoint.
    for (const r of training.records) {
      expect(r.touchpoint).toBe('design-grammar');
    }

    // Optional: dump the replayed ledger as evidence (gated so CI stays hermetic).
    if (process.env.WDG1_LEDGER === '1') {
      const out = path.join(
        process.cwd(),
        'notes',
        'verification',
        'shell-wdg1',
        'harvest-ledger.ndjson',
      );
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(
        out,
        training.records.map((r) => JSON.stringify(r)).join('\n') + '\n',
      );
    }
  });
});
