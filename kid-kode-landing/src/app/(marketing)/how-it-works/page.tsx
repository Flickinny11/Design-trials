// PRISM MARKETING — HOW IT WORKS (SHELL W6, S2 / spec §3 Phases 0–6)
//
// The guided path, told in full. Server-rendered. Each phase is anchored to a
// shipped shell wave so the story is truthful (no promised-but-unbuilt surface).

import type { Metadata } from 'next';
import Link from 'next/link';
import { FeatureIcon } from '@/components/marketing/islands';
import { FAQ } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'From one prompt to a verified, shippable app: describe it, approve the brief, watch the Conductor build it live, and ship it to a real URL.',
  alternates: { canonical: '/how-it-works' },
};

const PHASES: { n: string; title: string; body: string; icon: 'chat' | 'build' | 'integrate' | 'deploy' | 'project' | 'settings' }[] = [
  {
    n: 'Phase 0',
    title: 'Describe your app',
    icon: 'chat',
    body: 'It starts with a sentence — from the landing prompt or the dashboard launchpad. Your words carry straight into the guided intake with nothing lost.',
  },
  {
    n: 'Phase 1',
    title: 'A few visual questions',
    icon: 'settings',
    body: 'Interleaved decision cards — archetype and direction on one track, the capabilities and integrations it needs on the other. Every card offers visual options, a "describe your own" escape hatch, and Skip. Know exactly what you want? Take the "just build" fast path.',
  },
  {
    n: 'Phase 2',
    title: 'Approve the Build Brief',
    icon: 'project',
    body: 'Before a single line is generated, you review the plan in plain language. Every line is editable, and "try a different approach" branches it. Nothing runs until you approve — this gate blocks.',
  },
  {
    n: 'Phase 3 – 4',
    title: 'The Conductor builds it, live',
    icon: 'build',
    body: 'One orchestrator authors your app as a real 3D knowledge graph, generating nodes in small verified batches and streaming each wave into the engine as it lands. It is interruptible and resumable, and every step checkpoints to your version timeline.',
  },
  {
    n: 'Phase 5',
    title: 'Verified before it ships',
    icon: 'integrate',
    body: 'Every build is checked three ways — it behaves, it looks right, and it deploys — before it earns the word "shippable". A build that fails verification is never presented as done.',
  },
  {
    n: 'Phase 6',
    title: 'Ship it, and keep refining',
    icon: 'deploy',
    body: 'Your app goes live at a real URL on Prism Cloud, or exports as a portable bundle you host yourself. Then keep refining by conversation or on the canvas — every change is scoped and reversible.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="mk-section mk-wrap" aria-labelledby="mk-hiw-title">
        <p className="mk-kicker">How it works</p>
        <h1 className="mk-h2" id="mk-hiw-title" style={{ fontSize: 'clamp(34px, 5.4vw, 58px)', maxWidth: '20ch' }}>
          One prompt in. A verified, running app out.
        </h1>
        <p className="mk-lead">
          Prism is a guided path with real gates — you stay in control from the first
          sentence to the live URL. Here is every step.
        </p>
      </section>

      <section className="mk-section mk-wrap" aria-label="The guided path">
        <div className="mk-features">
          {PHASES.map((p) => (
            <article className="mk-feature" key={p.n}>
              <div className="mk-feature-icon">
                <FeatureIcon icon={p.icon} />
              </div>
              <div className="mk-step-kicker">{p.n}</div>
              <h2 className="mk-feature-title" style={{ marginTop: 4 }}>
                {p.title}
              </h2>
              <p className="mk-feature-body">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-section mk-wrap" aria-labelledby="mk-hiw-faq">
        <p className="mk-kicker">Good to know</p>
        <h2 className="mk-h2" id="mk-hiw-faq">
          Common questions
        </h2>
        <div className="mk-faq">
          {FAQ.map((item) => (
            <div className="mk-faq-item" key={item.q}>
              <h3 className="mk-faq-q">{item.q}</h3>
              <p className="mk-faq-a">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-cta-band" aria-labelledby="mk-hiw-cta">
        <div className="mk-wrap">
          <h2 className="mk-cta-h" id="mk-hiw-cta">
            Ready when you are.
          </h2>
          <p className="mk-cta-sub">Describe your app and watch the path run for real.</p>
          <div className="mk-cta-actions">
            <Link href="/app/build" className="mk-btn mk-btn-red">
              Start building — free
            </Link>
            <Link href="/gallery" className="mk-btn mk-btn-ghost">
              Browse templates
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
