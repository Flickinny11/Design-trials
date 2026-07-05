// W8 E2/E11 — public template preview. Runs a template's real .prism graph in
// the Prism runtime (the SAME ConductorRuntime the shipped app uses), so the
// gallery "Preview" shows the live, reactive template — scroll-scrub, cursor
// field, custom cursor, transition — not a static thumbnail. "Remix" forks it
// into the visitor's account (behind sign-up).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import ConductorRuntime from '@/components/prism-player/ConductorRuntime';
import { getTemplate } from '@/lib/templates/registry';
import type { GraphSource } from '@/lib/prism-graph/types';
import './template-preview.css';

export function generateStaticParams() {
  return [];
}

export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = getTemplate(slug);
  if (!template) notFound();

  const remixHref = `/sign-up?next=${encodeURIComponent(`/app?remix=${slug}`)}`;

  return (
    <div className={`tpl-page ${shellDisplay.variable} ${shellMono.variable}`}>
      <ConductorRuntime graph={template.graph as unknown as GraphSource} />
      <header className="tpl-badge" aria-label="Template banner">
        <div className="tpl-badge-main">
          <span className="tpl-badge-dot" aria-hidden />
          <span className="tpl-badge-name">{template.name}</span>
          <span className="tpl-badge-tag">Prism template</span>
        </div>
        <div className="tpl-badge-caps" aria-label="Capabilities">
          {template.capabilities.map((c) => (
            <span key={c} className="tpl-cap">
              {c}
            </span>
          ))}
        </div>
      </header>
      <div className="tpl-actions">
        <Link href="/gallery" className="tpl-btn tpl-btn--quiet">
          ← Gallery
        </Link>
        <Link href={remixHref} className="tpl-btn tpl-btn--primary" data-cursor-target>
          Remix into my account →
        </Link>
      </div>
    </div>
  );
}
