// PRISM FLIGHT RECORDER — dev ledger (deliverable 6). Dev-only.
//
// A minimal server-rendered view of the training corpus: record counts by
// type / day / touchpoint, the consent split (training vs quarantine), and a
// last-N scrubbed sample browser. This is the SEED surface the W-IM investor
// mezzanine later reads from. Guarded out of production (notFound). Plain
// chrome/DOM (NOT the Prism WebGPU runtime), so the no-dom-ui law does not apply.

import { notFound } from 'next/navigation';
import { readLedger, type LedgerCounts } from '@/server/flight-recorder/reader';
import { OTEL_ALIGNMENT, FLIGHT_RECORDER_SCHEMA_VERSION } from '@/lib/flight-recorder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const C = {
  bg: '#0b0d10', panel: '#14181d', line: '#232a31', text: '#e7edf3', dim: '#8a97a5',
  accent: '#e0b043', good: '#5bd6a6', warn: '#e2704a', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

function CountTable({ title, rows }: { title: string; rows: Record<string, number> }) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dim, marginBottom: 8 }}>{title}</div>
      {entries.length === 0 ? (
        <div style={{ color: C.dim, fontStyle: 'italic' }}>none yet</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: C.mono, fontSize: 13 }}>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: '5px 0', color: C.text }}>{k}</td>
                <td style={{ padding: '5px 0', textAlign: 'right', color: C.accent, fontWeight: 600 }}>{v.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: '14px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: tone ?? C.text, fontFamily: C.mono }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default async function FlightRecorderDevLedger() {
  if (process.env.NODE_ENV === 'production') notFound();
  const ledger = await readLedger(25);
  const t: LedgerCounts = ledger.training;
  const q: LedgerCounts = ledger.quarantine;

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: '28px 24px 64px', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, margin: 0, letterSpacing: '-0.01em' }}>Flight Recorder — Dev Ledger</h1>
          <span style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>schema {FLIGHT_RECORDER_SCHEMA_VERSION} · OTel GenAI {OTEL_ALIGNMENT.semconvVersion} ({OTEL_ALIGNMENT.genaiStatus})</span>
        </div>
        <p style={{ color: C.dim, fontSize: 13, marginTop: 6, maxWidth: 720 }}>
          The training corpus + OTel-compatible observability record. Every record is scrubbed at write (I-PII / INV-19) and consent-gated (I-CONSENT): consent=false is quarantined out of the training sink. Generated {ledger.generatedAt}.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '18px 0 22px' }}>
          <Stat label="training records" value={t.total} tone={C.good} />
          <Stat label="quarantined (opt-out)" value={q.total} tone={q.total > 0 ? C.warn : C.dim} />
          <Stat label="consent=true" value={t.consentTrue} />
          <Stat label="record types" value={Object.keys(t.byType).length} />
          <Stat label="touchpoints" value={Object.keys(t.byTouchpoint).length} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <CountTable title="By record type" rows={t.byType} />
          <CountTable title="By touchpoint" rows={t.byTouchpoint} />
          <CountTable title="By day" rows={t.byDay} />
        </div>

        <h2 style={{ fontSize: 16, margin: '30px 0 10px' }}>Last {ledger.recent.length} records <span style={{ color: C.dim, fontSize: 12, fontWeight: 400 }}>(scrubbed view)</span></h2>
        {ledger.recent.length === 0 ? (
          <div style={{ color: C.dim, fontStyle: 'italic', fontSize: 14 }}>No records yet — run a build, a generation, or a node edit to populate the corpus.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ledger.recent.map((r) => (
              <details key={r.record_id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 12px' }}>
                <summary style={{ cursor: 'pointer', fontFamily: C.mono, fontSize: 12.5, display: 'flex', gap: 10, flexWrap: 'wrap', color: C.text }}>
                  <span style={{ color: C.accent, minWidth: 130 }}>{r.record_type}</span>
                  <span style={{ color: C.dim }}>{r.touchpoint}</span>
                  <span style={{ color: r.consent ? C.good : C.warn }}>consent={String(r.consent)}</span>
                  <span style={{ color: C.dim }}>{r.created_at}</span>
                </summary>
                <pre style={{ margin: '8px 0 0', overflow: 'auto', fontSize: 11.5, lineHeight: 1.5, color: '#c7d2dc', fontFamily: C.mono }}>{JSON.stringify(r, null, 2)}</pre>
              </details>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
