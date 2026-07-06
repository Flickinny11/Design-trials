'use client';

// PRISM SHELL — GITHUB IMPORT PANEL (W-IMPORT).
//
// Additive body of the intake `connect` card's GitHub section: a repo-URL input,
// an Analyze action, live analysis progress (streamed over the existing tRPC
// transport — I-SSE), and a friendly failure that degrades to plain guided-build
// (I-FAILOPEN). On success the synthesized plan is absorbed by the intake store,
// which lands the user at the existing approval gate. No certified iv-* class is
// restyled; this renders only inside the existing .iv-connect-github section.

import { useState } from 'react';
import { useIntakeStore } from '@/lib/shell/intake/intake-store';
import { analyzeRepo, type AnalyzeProgress } from '@/lib/shell/ingest-client';

export default function GithubImportPanel() {
  const githubImport = useIntakeStore((s) => s.githubImport);
  const setGithub = useIntakeStore((s) => s.setGithub);
  const applyImport = useIntakeStore((s) => s.applyImport);

  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalyzeProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  const repo = githubImport?.repo ?? '';
  const canAnalyze = repo.trim().length > 2 && !analyzing;

  async function onAnalyze() {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setError(null);
    setProgress([]);
    const outcome = await analyzeRepo(repo.trim(), (p) =>
      setProgress((prev) => {
        // Collapse a stage's start→ok into one line keyed by stage.
        const next = prev.filter((x) => x.stage !== p.stage);
        return [...next, p];
      }),
    );
    setAnalyzing(false);
    if (outcome.ok && outcome.result) {
      applyImport(outcome.result); // jumps to the brief phase (approval gate)
    } else {
      setError(outcome.error ?? 'Analysis failed — you can still build from a prompt.');
    }
  }

  return (
    <div className="iv-import">
      <input
        type="text"
        className="iv-url-input"
        value={repo}
        placeholder="owner/repo  ·  or  github.com/owner/repo"
        onChange={(e) => setGithub(true, e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAnalyze())}
        aria-label="GitHub repository to import"
        disabled={analyzing}
      />
      <button
        type="button"
        className="iv-url-read iv-import-analyze"
        disabled={!canAnalyze}
        onClick={onAnalyze}
        aria-label="Analyze this repository and synthesize a plan"
      >
        {analyzing ? 'Analyzing…' : 'Analyze repo'}
      </button>

      {progress.length > 0 ? (
        <ul className="iv-import-progress" aria-live="polite">
          {progress.map((p) => (
            <li key={p.stage} data-status={p.status}>
              <span className="iv-import-stage">{p.label}</span>
              {p.detail ? <span className="iv-import-detail"> — {p.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="iv-import-error" role="alert">{error}</p> : null}

      <p className="iv-connect-note">
        Import analyzes your repo and drafts a plan — you review and edit it like any
        guided build. A fidelity report shows exactly what carries, adapts, or needs you.
      </p>
    </div>
  );
}
