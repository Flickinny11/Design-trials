// PRISM SHELL — GUIDED BUILD / INTAKE ROUTE (SHELL W2, spec §3 / §12 W2)
//
// /app/build — the Guided Build intake. Under the /app/* session guard already
// (layout verifies Better Auth). A launchpad may deep-link with ?prompt=…;
// otherwise the flow starts at Phase 0 standalone. All the interactive work
// (phases, 3D islands, approval → finalize) lives in IntakeShell (client);
// this server component only resolves the seed prompt and mounts the fonts.

import '@/components/shell/design/prism-premium.css';
import './intake.css';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import IntakeShell from '@/components/shell/intake/IntakeShell';

export const metadata = { title: 'Guided build — Prism' };

export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.prompt) ? sp.prompt[0] : sp.prompt;
  const initialPrompt = typeof raw === 'string' ? raw.slice(0, 8000) : undefined;

  return (
    <div className={`iv-viewport ${shellDisplay.variable} ${shellMono.variable}`}>
      <IntakeShell initialPrompt={initialPrompt} />
    </div>
  );
}
