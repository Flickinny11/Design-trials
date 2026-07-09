'use client';

// PRISM SHELL — GUIDED BUILD / INTAKE SHELL (SHELL W2, spec §3 / S5)
//
// The intake surface root: a phase machine over Phase 0 (prompt capture),
// Phase 1 (decision cards + direction boards), and Phase 2 (build brief +
// approval gate). Runs standalone at /app/build; a launchpad may pass an
// initial prompt via ?prompt=. All state lives in the intake store (I3).

import { useEffect } from 'react';
import Link from 'next/link';
import { useIntakeStore } from '@/lib/shell/intake/intake-store';
import PromptCapture from './PromptCapture';
import DecisionDeck from './DecisionDeck';
import BuildBrief from './BuildBrief';

export default function IntakeShell({
  initialPrompt,
  initialImport,
}: {
  initialPrompt?: string;
  /** UXV-F1: ?import=github pre-opens the GitHub repo importer on Phase 0. */
  initialImport?: boolean;
}) {
  const phase = useIntakeStore((s) => s.phase);
  const setPrompt = useIntakeStore((s) => s.setPrompt);
  const setGithub = useIntakeStore((s) => s.setGithub);
  const reset = useIntakeStore((s) => s.reset);

  // Fresh intake per mount; seed from the launchpad prompt if present.
  useEffect(() => {
    reset();
    if (initialPrompt && initialPrompt.trim()) setPrompt(initialPrompt.trim());
    if (initialImport) setGithub(true, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UXV-F4: phase transitions (prompt → cards → brief) keep the previous
  // scroll offset; land each phase at its heading.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);

  return (
    <div className="iv-root">
      <header className="iv-topbar">
        <Link href="/app" className="iv-wordmark" aria-label="Back to your studio">
          Prism<span className="iv-wordmark-dot">.</span>
        </Link>
        <span className="iv-topbar-kicker">Guided build</span>
        <Link href="/app" className="iv-topbar-exit">
          Exit
        </Link>
      </header>

      <main className="iv-main" data-phase={phase}>
        {phase === 'prompt' ? <PromptCapture /> : null}
        {phase === 'cards' ? <DecisionDeck /> : null}
        {phase === 'brief' ? <BuildBrief /> : null}
      </main>
    </div>
  );
}
