'use client';

// GUIDED-TIPS — the high-tech popup (C5 controls / C8 premium type + composition
// / C10 focus + ARIA).
//
// A frosted-glass card: a transparent 3D-artifact window at the top (the single
// canvas renders the step's primitive artifact behind it — C7), then premium
// overlay type (kinetic title, brass kicker, body), then controls (Back, step
// dots, Next/Finish). Skip + Close sit in the window corner, always visible.
// role="dialog" aria-modal, focus-trapped, fully keyboard-driven; the host owns
// Esc/arrow keys. Publishes the artifact-window rect each frame so the scrim can
// cut a hole there and TipArtifactStage can camera-anchor the artifact to it.

import { useEffect, useRef } from 'react';
import type { WalkthroughStep, ArtifactFrameRect } from '@/lib/editor/walkthrough/types';

interface Props {
  step: WalkthroughStep;
  stepIndex: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  reducedMotion: boolean;
  style: React.CSSProperties;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onClose: () => void;
  onGoTo: (i: number) => void;
  onWindowRect: (rect: ArtifactFrameRect | null) => void;
}

export default function WalkthroughPopup({
  step,
  stepIndex,
  total,
  isFirst,
  isLast,
  reducedMotion,
  style,
  onNext,
  onBack,
  onSkip,
  onClose,
  onGoTo,
  onWindowRect,
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  // Focus the primary action on mount (C10) — entry into the focus trap.
  useEffect(() => {
    const t = window.setTimeout(() => primaryRef.current?.focus(), reducedMotion ? 0 : 120);
    return () => window.clearTimeout(t);
  }, [stepIndex, reducedMotion]);

  // Focus trap: keep Tab cycling inside the dialog.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Publish the artifact-window rect each frame so the scrim hole + the in-scene
  // artifact stay glued to it across entrance / reflow / resize.
  useEffect(() => {
    let raf = 0;
    let last = { x: 0, y: 0, w: 0, h: 0 };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = windowRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const next = { x: r.left, y: r.top, w: r.width, h: r.height };
      if (
        Math.abs(next.x - last.x) > 0.5 ||
        Math.abs(next.y - last.y) > 0.5 ||
        Math.abs(next.w - last.w) > 0.5 ||
        Math.abs(next.h - last.h) > 0.5
      ) {
        last = next;
        onWindowRect(next);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      onWindowRect(null);
    };
  }, [onWindowRect]);

  const words = step.title.split(' ');

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={step.a11yLabel}
      data-component="tip-popup"
      data-step-id={step.id}
      className={`tip-popup${reducedMotion ? '' : ' tip-popup--enter'}`}
      style={style}
      onKeyDown={onKeyDown}
    >
      {!reducedMotion && <div className="tip-popup__sheen" aria-hidden />}

      {/* 3D-artifact window — transparent; the single canvas renders here (C7). */}
      <div
        ref={windowRef}
        className={`tip-popup__window${reducedMotion ? '' : ' tip-glitch-in'}`}
        data-component="tip-artifact-window"
        aria-hidden
      >
        <div className="tip-popup__window-frame" />
        <div className="tip-popup__window-corner" style={{ top: 6, left: 6, borderRight: 0, borderBottom: 0 }} />
        <div className="tip-popup__window-corner" style={{ top: 6, right: 6, borderLeft: 0, borderBottom: 0 }} />
        <div className="tip-popup__window-corner" style={{ bottom: 6, left: 6, borderRight: 0, borderTop: 0 }} />
        <div className="tip-popup__window-corner" style={{ bottom: 6, right: 6, borderLeft: 0, borderTop: 0 }} />

        {/* Skip + Close — always visible (C5). */}
        <div className="tip-cornerbar">
          <button type="button" className="tip-skip" onClick={onSkip} aria-label="Skip the guided tour">
            SKIP
          </button>
          <button type="button" className="tip-close" onClick={onClose} aria-label="Close the guided tour">
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
              <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="tip-popup__body">
        <div className="tip-kicker">{step.kicker}</div>
        <h2 className="tip-title" aria-label={step.title}>
          {reducedMotion
            ? step.title
            : words.map((w, i) => (
                <span
                  key={i}
                  className="tip-title__word"
                  style={{ animationDelay: `${120 + i * 55}ms` }}
                  aria-hidden
                >
                  {w}
                </span>
              ))}
        </h2>
        <p className="tip-body">{step.body}</p>
      </div>

      <div className="tip-controls">
        <button
          type="button"
          className="tip-btn tip-btn--ghost"
          onClick={onBack}
          disabled={isFirst}
          aria-label="Previous step"
        >
          ‹ Back
        </button>

        <div className="tip-dots" role="tablist" aria-label="Tour progress">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === stepIndex}
              aria-label={`Go to step ${i + 1} of ${total}`}
              className={`tip-dot${i === stepIndex ? ' is-active' : ''}`}
              onClick={() => onGoTo(i)}
            />
          ))}
        </div>

        <button
          ref={primaryRef}
          type="button"
          className="tip-btn tip-btn--primary"
          onClick={onNext}
          aria-label={isLast ? 'Finish the guided tour' : 'Next step'}
        >
          {isLast ? 'Finish' : 'Next ›'}
        </button>
      </div>
    </div>
  );
}
