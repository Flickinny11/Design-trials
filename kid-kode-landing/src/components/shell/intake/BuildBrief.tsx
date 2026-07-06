'use client';

// PRISM SHELL — PHASE 2 BUILD BRIEF (SHELL W2, spec §3 / I7)
//
// The approval gate. Prism proposes a brief assembled from the prompt, the
// answers, and the chosen Direction (whose tokens already seeded the Brand
// Profile shown here). EVERY line is editable free-text. Nothing proceeds until
// the user approves (I7 blocks); "try a different approach" branches back to
// the cards. Approval persists the brief to a real project and hands the
// builder off in `plan-pending` (W2-D4) — the real plan/build lands in W5.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIntakeStore } from '@/lib/shell/intake/intake-store';
import { DIRECTION_BY_ID } from '@/lib/shell/intake/intake-model';
import { finalizeIntake } from '@/lib/shell/intake-client';
import { attachFidelity } from '@/lib/shell/ingest-client';
import PrimaryButton3D from './PrimaryButton3D';
import FidelityLedger from './FidelityLedger';

export default function BuildBrief() {
  const router = useRouter();
  const brief = useIntakeStore((s) => s.brief);
  const editBriefLine = useIntakeStore((s) => s.editBriefLine);
  const editBriefTitle = useIntakeStore((s) => s.editBriefTitle);
  const branch = useIntakeStore((s) => s.branch);
  const branchCount = useIntakeStore((s) => s.branchCount);
  const fastPath = useIntakeStore((s) => s.fastPath);
  const importOrigin = useIntakeStore((s) => s.importOrigin);
  const importFidelity = useIntakeStore((s) => s.importFidelity);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!brief) return null;
  const direction = brief.chosenDirectionId ? DIRECTION_BY_ID.get(brief.chosenDirectionId)?.token ?? null : null;
  const bp = brief.brandProfile;

  async function onApprove() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const project = await finalizeIntake(brief!);
      // W-IMPORT: attach the fidelity ledger to the created project (best-effort —
      // a failure here never blocks the build handoff, I-FAILOPEN).
      if (importOrigin && importFidelity) {
        await attachFidelity(project.id, importFidelity);
      }
      router.push(`/app/builder/${project.id}`);
    } catch {
      setError('Could not save your brief. Please try again.');
      setPending(false);
    }
  }

  return (
    <div className="iv-phase iv-phase2">
      <div className="iv-brief-head">
        <p className="iv-kicker">Build brief · your approval required</p>
        <input
          className="iv-brief-title"
          value={brief.title}
          maxLength={200}
          onChange={(e) => editBriefTitle(e.target.value)}
          aria-label="Edit the project title"
          placeholder="Name your build"
        />
        <p className="iv-lede">
          This is what Prism will build. Edit any line — then approve to start,
          or try a different approach.
          {fastPath ? ' (You skipped the questions; every line is still yours to edit.)' : ''}
        </p>
      </div>

      <div className="iv-brief-brand">
        <div className="iv-brief-brand-swatches" aria-label="Seeded brand palette">
          {[bp.palette.primary, bp.palette.secondary, bp.palette.accent].filter(Boolean).map((c, i) => (
            <span key={i} className="iv-brief-swatch" style={{ background: c as string }} />
          ))}
        </div>
        <div className="iv-brief-brand-meta">
          <span className="iv-brief-brand-name">{direction ? direction.name : 'Prism Premium'}</span>
          <span className="iv-brief-brand-tone">{bp.toneDescriptors.join(' · ') || 'confident · premium'}</span>
        </div>
      </div>

      <ul className="iv-brief-lines">
        {brief.lines.map((line) => (
          <li key={line.id} className="iv-brief-line" data-key={line.key}>
            <span className="iv-brief-line-label">{line.label}</span>
            <textarea
              className="iv-brief-line-value"
              rows={line.value.length > 80 ? 2 : 1}
              value={line.value}
              onChange={(e) => editBriefLine(line.id, e.target.value)}
              aria-label={`Edit: ${line.label}`}
            />
          </li>
        ))}
      </ul>

      {importOrigin && importFidelity ? <FidelityLedger report={importFidelity} /> : null}

      {brief.seedsUsed.length ? (
        <div className="iv-brief-seeds">
          <span className="iv-brief-seeds-kicker">Seeds used</span>
          <ul className="iv-brief-seeds-list">
            {brief.seedsUsed.map((s, i) => (
              <li key={i} className="iv-brief-seed">
                <span className="iv-brief-seed-kind">{s.kind}</span>
                {s.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="iv-brief-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="iv-brief-actions">
        <PrimaryButton3D
          label="Approve & build"
          sublabel="Locks the brief and opens the builder"
          kind="seal"
          pending={pending}
          disabled={!brief.title.trim()}
          onClick={onApprove}
          ariaLabel="Approve the build brief and open the builder"
        />
        <button type="button" className="iv-ghostbtn" onClick={branch} disabled={pending}>
          Try a different approach
          {branchCount > 0 ? ` · attempt ${branchCount + 1}` : ''}
        </button>
      </div>
    </div>
  );
}
