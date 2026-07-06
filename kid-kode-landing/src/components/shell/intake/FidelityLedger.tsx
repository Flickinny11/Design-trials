'use client';

// PRISM SHELL — FIDELITY LEDGER (W-IMPORT, D4).
//
// The honest per-feature import report: carried / adapted / needs-you. Rendered
// post-plan in the brief phase (where the imported plan is reviewed) and, once
// approved, persisted onto the project. "needs-you" is shown as a first-class,
// neutral status — a feature the developer wires, not a failure (I-HONEST-FIDELITY).

import type { FidelityReport, FidelityStatus } from '../../../../packages/shared-interfaces/src/prism-ingest';

const STATUS_LABEL: Record<FidelityStatus, string> = {
  carried: 'Carried',
  adapted: 'Adapted',
  'needs-you': 'Needs you',
};

export default function FidelityLedger({ report }: { report: FidelityReport }) {
  const { summary, features } = report;
  return (
    <section className="iv-fidelity" aria-label="Import fidelity report">
      <div className="iv-fidelity-head">
        <span className="iv-brief-seeds-kicker">Import fidelity — what carried from {report.repoRef}</span>
        <div className="iv-fidelity-summary">
          <span className="iv-fidelity-tally" data-status="carried">{summary.carried} carried</span>
          <span className="iv-fidelity-tally" data-status="adapted">{summary.adapted} adapted</span>
          <span className="iv-fidelity-tally" data-status="needs-you">{summary.needsYou} needs you</span>
        </div>
      </div>
      <ul className="iv-fidelity-list">
        {features.map((f, i) => (
          <li key={i} className="iv-fidelity-item" data-status={f.status} data-category={f.category}>
            <span className="iv-fidelity-badge" data-status={f.status}>{STATUS_LABEL[f.status]}</span>
            <span className="iv-fidelity-body">
              <span className="iv-fidelity-name">{f.name}</span>
              <span className="iv-fidelity-reason">{f.reason}</span>
              {f.detail ? <span className="iv-fidelity-detail">{f.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="iv-fidelity-foot">
        Honest by design — Prism never claims a feature carried that didn’t. “Needs you”
        is what you connect after import (your database, auth provider, custom logic).
      </p>
    </section>
  );
}
