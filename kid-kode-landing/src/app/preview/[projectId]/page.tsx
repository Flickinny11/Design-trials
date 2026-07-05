// PRISM SHELL — SHAREABLE PREVIEW ROUTE (SHELL W5 / E14, 2026-07-04)
//
// The Lovable-class shareable preview: a public, token-guarded page that runs
// a Conductor-authored app in the Prism runtime. NOT under the /app session
// guard — a share link is openable by anyone with the token, which IS the
// capability (I5: a reference bound to ONE project snapshot; it grants read of
// that snapshot and nothing else — see preview-tokens.ts). A missing/invalid
// token renders a clean "unavailable" state and leaks nothing about existence.

import './preview.css';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import ConductorRuntime from '@/components/prism-player/ConductorRuntime';
import { readPreviewGraph } from '@/server/conductor/preview-tokens';
import type { GraphSource } from '@/lib/prism-graph/types';

export const dynamic = 'force-dynamic';

function appNameOf(graph: GraphSource): string {
  const root = graph.rootNodes?.[0];
  const name = root?.spec?.name;
  return typeof name === 'string' && name.length > 0 ? name : 'Prism preview';
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { projectId } = await params;
  const { t } = await searchParams;
  const resolved = t ? await readPreviewGraph(t) : null;
  const ok = resolved != null && resolved.pointer.projectId === projectId;

  return (
    <div className={`cr-page ${shellDisplay.variable} ${shellMono.variable}`}>
      {ok ? (
        <>
          <ConductorRuntime graph={resolved!.graph as unknown as GraphSource} />
          <header className="cr-badge" aria-label="Preview banner">
            <span className="cr-badge-dot" aria-hidden />
            <span className="cr-badge-name">{appNameOf(resolved!.graph as unknown as GraphSource)}</span>
            <span className="cr-badge-tag">Prism preview</span>
          </header>
        </>
      ) : (
        <main className="cr-unavailable" role="alert">
          <div className="cr-unavailable-card">
            <h1 className="cr-unavailable-title">Preview unavailable</h1>
            <p className="cr-unavailable-body">
              This preview link is missing, expired, or no longer valid. Ask the
              builder for a fresh share link.
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
