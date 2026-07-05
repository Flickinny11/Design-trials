'use client';

// PRISM MARKETING — LANDING PROMPT BAR (SHELL W6, S2 / spec §3 Phase 0)
//
// The single most important control on the marketing surface: one prompt that
// hands off INTO the app's guided intake (Phase 0) with the text preserved.
// There is NO dead-end (S2 MUST-FIX). The handoff is auth-aware WITHOUT this
// component knowing the session: it navigates to /app/build?prompt=…, and the
// /app/* edge guard redirects a signed-out visitor to /sign-in?next=… then back
// to the same intake URL after auth (middleware.ts + safeNextPath) — the prompt
// rides through sign-in untouched. The Build control is a real 3D object
// (CtaButton3D) with its label in DOM for legibility (DL10/DL12).

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

const CtaButton3D = dynamic(() => import('./CtaButton3D'), {
  ssr: false,
  loading: () => (
    <div className="mk-cta3d" aria-hidden>
      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--mk-font-mono)', fontSize: 12, color: 'var(--pp-text-mid)' }}>
        Build
      </span>
    </div>
  ),
});

const STARTERS = [
  'A booking site for my barbershop',
  'A SaaS landing page with pricing and a waitlist',
  'A 3D product configurator for a furniture brand',
  'A portfolio that opens each project into its own world',
];

/** Build the intake handoff URL. Prompt is length-capped to match the intake
 *  reader (/app/build slices to 8000). Empty prompt still enters Phase 0 —
 *  never a dead-end. */
export function buildIntakeHref(prompt: string): string {
  const trimmed = prompt.trim().slice(0, 8000);
  return trimmed ? `/app/build?prompt=${encodeURIComponent(trimmed)}` : '/app/build';
}

export default function HeroPrompt() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [going, setGoing] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const go = () => {
    setGoing(true);
    router.push(buildIntakeHref(value));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      go();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const useStarter = (s: string) => {
    setValue(s);
    const el = areaRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() => autoGrow(el));
    }
  };

  return (
    <div className="mk-prompt-shell">
      <div className="mk-prompt">
        <div className="mk-prompt-row">
          <div className="mk-prompt-field">
            <label className="mk-prompt-label" htmlFor="mk-hero-prompt">
              Describe your app
            </label>
            <textarea
              id="mk-hero-prompt"
              ref={areaRef}
              className="mk-prompt-input"
              rows={1}
              placeholder="Build me a…"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                autoGrow(e.target);
              }}
              onKeyDown={onKeyDown}
              aria-label="Describe the app you want to build"
              spellCheck={false}
            />
          </div>
          <div className="mk-prompt-cta">
            <CtaButton3D
              label="Build"
              sublabel="start free"
              pending={going}
              onClick={go}
              ariaLabel="Start building — open the guided builder with your prompt"
            />
          </div>
        </div>
      </div>
      <div className="mk-prompt-hint">
        <span className="mk-prompt-hint-label">Try</span>
        {STARTERS.map((s) => (
          <button key={s} type="button" className="mk-chip" onClick={() => useStarter(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
