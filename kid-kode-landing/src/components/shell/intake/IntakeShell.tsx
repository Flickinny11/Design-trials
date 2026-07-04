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

export default function IntakeShell({ initialPrompt }: { initialPrompt?: string }) {
  const phase = useIntakeStore((s) => s.phase);
  const setPrompt = useIntakeStore((s) => s.setPrompt);
  const reset = useIntakeStore((s) => s.reset);

  // Fresh intake per mount; seed from the launchpad prompt if present.
  useEffect(() => {
    reset();
    if (initialPrompt && initialPrompt.trim()) setPrompt(initialPrompt.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
