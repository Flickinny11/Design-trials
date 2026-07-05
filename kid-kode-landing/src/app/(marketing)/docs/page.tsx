// PRISM MARKETING — DOCS SHELL (SHELL W6, S2)
//
// A documentation reading shell (sidebar + prose). Server-rendered, crawlable.
// v1 is a structured overview that links into the product; deep API reference
// lands with the public API. No client JS.

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Learn how Prism works — the graph model, the guided build, integrations, deploy, and export.',
  alternates: { canonical: '/docs' },
};

const SECTIONS = [
  { id: 'intro', label: 'Introduction' },
  { id: 'graph', label: 'The graph is the app' },
  { id: 'build', label: 'Guided build' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'deploy', label: 'Deploy & export' },
  { id: 'runtime', label: 'The runtime' },
];

export default function DocsPage() {
  return (
    <section className="mk-section mk-wrap">
      <div className="mk-doc">
        <aside className="mk-doc-aside" aria-label="Documentation sections">
          <p className="mk-doc-navtitle">Documentation</p>
          <ul className="mk-doc-nav">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} aria-current={i === 0 ? 'true' : undefined}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <div className="mk-prose">
          <h2 id="intro">Documentation</h2>
          <p>
            Prism is a prompt-to-app builder. You describe what you want, approve a
            plan, and an orchestrator authors your app as a live 3D knowledge graph that
            runs in a real WebGPU engine. This overview explains the core ideas; the
            deep reference ships with the public API.
          </p>

          <h2 id="graph">The graph is the app</h2>
          <p>
            Your application is not a folder of files — it is a single graph of nodes.
            Each node is self-contained and describes both what it looks like and how it
            behaves. The galaxy, the canvas, and the live preview are three views of that
            one continuous scene, never separate mockups.
          </p>
          <ul>
            <li>Nodes hold their own geometry, materials, and behavior.</li>
            <li>Edges wire the app together — navigation, data, and triggers.</li>
            <li>Every edit is scoped and additive: touch one node, the rest stay put.</li>
          </ul>

          <h2 id="build">Guided build</h2>
          <p>
            A build runs in phases — describe, decide, approve the brief, build, verify,
            ship. The Build Brief is an approval gate: nothing is generated until you sign
            off, and you can branch to try a different approach at any time.
          </p>

          <h2 id="integrations">Integrations</h2>
          <p>
            Connect virtually anything. A curated one-click catalog covers the popular
            services; when something is not on the list, the agent authors a connector
            for it. Credentials are delegated to the provider and never typed into Prism —
            your app holds a <code>capability reference</code>, and secrets are resolved
            server-side only.
          </p>

          <h2 id="deploy">Deploy &amp; export</h2>
          <p>
            Ship to Prism Cloud in a click, or bring your own host. Every project exports
            as a portable bundle — the graph, the assets, and the manifest — so you are
            never locked in. Each build carries a verified badge only after it passes
            behavioral, visual, and deploy checks.
          </p>

          <h2 id="runtime">The runtime</h2>
          <p>
            Every app you build runs in the Prism runtime — a single{' '}
            <code>three/webgpu</code> scene with an automatic WebGL2 fallback. Text is
            real signed-distance-field type, not baked images, and the whole scene is one
            renderer instance. The hero on our landing page runs on this same engine.
          </p>

          <p style={{ marginTop: 32 }}>
            <Link href="/app/build" className="mk-btn mk-btn-red">
              Start building
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
