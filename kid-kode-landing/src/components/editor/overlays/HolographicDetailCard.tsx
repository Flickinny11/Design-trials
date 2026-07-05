'use client';

// HolographicDetailCard — APP-REALITY P7 payoff overlay.
// ─────────────────────────────────────────────────────────────────────────────
// The "global element overlay" opened OVER the running preview-app when a
// Function-bound element (the ORRERY watch) is clicked. A photoreal holographic
// product detail-card built in pure DOM/CSS from the premium toolkit catalogued
// in docs/prism/DESIGN-REFERENCES.md — GLITCH / chromatic-aberration RGB-split,
// scanlines, holographic sheen, transparency flicker — all rendered in the
// Chrome-Arc design-system language (brass + ice, NO purple).
//
// Contract (frozen — do not deviate):
//   props.spec   : OverlaySpec (title / tagline / specs[] / imageUrl / accent)
//   props.onClose: () => void   (close button calls this)
//   props.style  : positioning/size from the host — SPREAD onto the root.
//
// The host wraps + positions this; the root just spreads `style` and fills it.
// All @keyframes are SCOPED in the <style jsx> block below — this component must
// NOT touch materials.css / tokens.css (another process owns global CSS).
// Heavy motion is disabled under prefers-reduced-motion.

import { useId } from 'react';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import type { OverlaySpec } from '@/lib/prism-graph/types';

export default function HolographicDetailCard(props: {
  spec: OverlaySpec;
  onClose: () => void;
  style?: React.CSSProperties;
}): React.ReactElement {
  const { spec, onClose, style } = props;

  // C11/glass-kill — the panel body is a real chrome-layer glass slab (live
  // scene-sampling refraction + lit glass body) instead of CSS backdrop-filter
  // glassmorphism. Radius matches the card's --ds-r-lg (18). The card carries a
  // brass keyline edge → accent 1. At t2 the slab draws the surface and
  // materials.css suppresses the CSS background/keyline; below t2 the v1 CSS
  // (gradient + ::before keyline + box-shadow) stands untouched (INV-9).
  const slab = useChromeSlab({ material: 'glass', radius: 18, frost: 0.55, accent: 1 });

  // Default accent = the brass-200 specular. spec.accent may be any hex.
  const accent = spec.accent || 'var(--ds-metal-200)';
  // Ice cyan companion for the RGB-split (the cold informational counter-hue).
  const iceRgb = 'var(--ds-ice-300-rgb, 169, 194, 209)';

  const title = spec.title || 'Detail';
  const tagline = spec.tagline;
  const specs = spec.specs || [];
  const hasImage = Boolean(spec.imageUrl);

  // Scope id keeps styled-jsx selectors collision-free if two cards mount.
  const scope = useId().replace(/[^a-zA-Z0-9]/g, '');
  const rootCls = `holo-card holo-${scope}`;

  return (
    <div
      ref={slab.ref}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={rootCls}
      style={style}
    >
      {/* ── Holographic ambience: gridlines + scanline sweep + chromatic veil ── */}
      <div className="holo-grid" aria-hidden="true" />
      <div className="holo-aberration" aria-hidden="true" />
      <div className="holo-scan" aria-hidden="true" />
      <div className="holo-vignette" aria-hidden="true" />

      {/* ── Close button (top-right) ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="holo-close"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <path
            d="M2 2L11 11M11 2L2 11"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* ── Header — glitch / RGB-split title + mono tagline ─────────────────── */}
      <header className="holo-head">
        <div className="holo-kicker">
          <span className="holo-kicker-dot" aria-hidden="true" />
          HOLOGRAPHIC&nbsp;·&nbsp;LIVE
        </div>
        <h2 className="holo-title" data-text={title}>
          <span className="holo-title-base">{title}</span>
          <span className="holo-title-r" aria-hidden="true">{title}</span>
          <span className="holo-title-c" aria-hidden="true">{title}</span>
        </h2>
        {tagline ? <p className="holo-tagline">{tagline}</p> : null}
      </header>

      {/* ── Holographic visual stage ─────────────────────────────────────────── */}
      <div className="holo-stage">
        <div className="holo-frame">
          <span className="holo-corner holo-corner--tl" aria-hidden="true" />
          <span className="holo-corner holo-corner--tr" aria-hidden="true" />
          <span className="holo-corner holo-corner--bl" aria-hidden="true" />
          <span className="holo-corner holo-corner--br" aria-hidden="true" />
          <div className="holo-sheen" aria-hidden="true" />
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="holo-img" src={spec.imageUrl} alt={title} draggable={false} />
          ) : (
            <HolographicEmblem accent={accent} iceRgb={iceRgb} />
          )}
          <div className="holo-stage-scan" aria-hidden="true" />
          <div className="holo-flicker" aria-hidden="true" />
        </div>
      </div>

      {/* ── Spec rows — holographic data ledger ──────────────────────────────── */}
      {specs.length > 0 ? (
        <dl className="holo-specs">
          {specs.map((row, i) => (
            <div
              className="holo-row"
              key={`${row.label}-${i}`}
              style={{ ['--row-i' as string]: String(i) }}
            >
              <dt className="holo-row-label">{row.label}</dt>
              <span className="holo-row-rule" aria-hidden="true" />
              <dd className="holo-row-value">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* ── Footer telemetry strip ───────────────────────────────────────────── */}
      <footer className="holo-foot">
        <span className="holo-foot-tag">SIG·LOCK</span>
        <span className="holo-foot-bars" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </span>
        <span className="holo-foot-tag holo-foot-tag--live">PROJECTING</span>
      </footer>

      {/* ─────────────────────────────────────────────────────────────────────
          SCOPED STYLE — all @keyframes + visuals live here. styled-jsx scopes
          the class names; the design-system custom properties (--ds-*) cascade
          in from tokens.css. Nothing here writes to global CSS.
          ───────────────────────────────────────────────────────────────────── */}
      <style jsx>{`
        .holo-card {
          /* Glassmorphic dark holographic panel (ds-glass ds-edge--metal base). */
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: var(--ds-r-lg, 18px);
          background:
            linear-gradient(
              168deg,
              rgba(var(--ds-metal-200-rgb), 0.06) 0%,
              rgba(18, 21, 29, 0.86) 26%,
              rgba(7, 8, 13, 0.93) 100%
            );
          color: var(--ds-text, #dfdcd2);
          /* C11/glass-kill: panel-surface backdrop-filter removed — the chrome-
             layer glass slab provides real live-scene refraction at t2; the
             gradient + box-shadow below remain the t0/t1 fallback (INV-9). */
          box-shadow:
            inset 0 1px 0 rgba(var(--ds-metal-200-rgb), 0.22),
            inset 0 0 0 1px rgba(var(--ds-metal-400-rgb), 0.16),
            inset 0 -1px 0 rgba(0, 0, 0, 0.5),
            0 8px 18px rgba(0, 0, 0, 0.6),
            0 36px 90px rgba(0, 0, 0, 0.66),
            0 0 50px rgba(var(--ds-metal-400-rgb), 0.16);
          font-family: var(--ds-font-ui, ui-sans-serif, system-ui, sans-serif);
          isolation: isolate;
          will-change: opacity;
          animation:
            holo-card-in 460ms cubic-bezier(0.22, 1, 0.36, 1) both,
            holo-breathe 4.6s ease-in-out 460ms infinite;
        }
        /* Brass keyline edge (ds-edge--metal equivalent, scoped). */
        .holo-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(
            165deg,
            rgba(var(--ds-metal-200-rgb), 0.85) 0%,
            rgba(var(--ds-metal-400-rgb), 0.34) 38%,
            rgba(${iceRgb}, 0.18) 62%,
            rgba(0, 0, 0, 0.32) 100%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          pointer-events: none;
          z-index: 6;
        }

        /* ── Ambience layers ─────────────────────────────────────────────── */
        .holo-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.5;
          background-image: repeating-linear-gradient(
            0deg,
            rgba(${iceRgb}, 0.05) 0px,
            rgba(${iceRgb}, 0.05) 1px,
            transparent 1px,
            transparent 26px
          );
          -webkit-mask-image: linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent);
          mask-image: linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent);
        }
        .holo-aberration {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          mix-blend-mode: screen;
          opacity: 0.55;
          background:
            radial-gradient(120% 80% at 8% 0%, rgba(${iceRgb}, 0.1), transparent 52%),
            radial-gradient(120% 80% at 92% 100%, rgba(var(--ds-metal-300-rgb), 0.12), transparent 52%);
          animation: holo-aberration 5.2s ease-in-out infinite;
        }
        .holo-scan {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 42%;
          pointer-events: none;
          z-index: 4;
          mix-blend-mode: screen;
          opacity: 0.7;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(var(--ds-metal-200-rgb), 0.04) 42%,
            rgba(var(--ds-metal-100, #eef0f3), 0.16) 50%,
            rgba(var(--ds-metal-200-rgb), 0.04) 58%,
            transparent 100%
          );
          animation: holo-scan-sweep 3.4s linear infinite;
        }
        .holo-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 3;
          background: radial-gradient(130% 120% at 50% 18%, transparent 52%, rgba(0, 0, 0, 0.5) 100%);
        }

        /* Content sits above ambience. */
        .holo-head,
        .holo-stage,
        .holo-specs,
        .holo-foot {
          position: relative;
          z-index: 5;
        }

        /* ── Close ───────────────────────────────────────────────────────── */
        .holo-close {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 7;
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: none;
          border-radius: 999px;
          color: var(--ds-text-mid, #a8a79e);
          background: radial-gradient(circle at 32% 28%, rgba(40, 46, 60, 0.9), rgba(10, 12, 18, 0.9));
          box-shadow:
            inset 0 1px 0 rgba(255, 252, 242, 0.12),
            inset 0 0 0 1px rgba(var(--ds-metal-400-rgb), 0.22),
            0 1px 3px rgba(0, 0, 0, 0.6);
          cursor: pointer;
          transition: transform 120ms cubic-bezier(0.22, 1, 0.36, 1),
            color 160ms ease, box-shadow 200ms ease, filter 160ms ease;
        }
        .holo-close:hover {
          color: var(--ds-metal-200, #ecd49d);
          filter: brightness(1.12);
          box-shadow:
            inset 0 1px 0 rgba(255, 252, 242, 0.16),
            inset 0 0 0 1px rgba(var(--ds-metal-400-rgb), 0.42),
            0 0 16px rgba(var(--ds-metal-400-rgb), 0.34);
        }
        .holo-close:active { transform: scale(0.92); }
        .holo-close:focus-visible {
          outline: none;
          box-shadow:
            0 0 0 1px rgba(var(--ds-metal-300-rgb), 0.7),
            0 0 0 4px rgba(var(--ds-metal-400-rgb), 0.2);
        }

        /* ── Header ──────────────────────────────────────────────────────── */
        .holo-head {
          padding: 20px 22px 14px;
        }
        .holo-kicker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--ds-font-mono, ui-monospace, monospace);
          font-size: 9.5px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(${iceRgb}, 0.85);
        }
        .holo-kicker-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--ds-metal-200, #ecd49d);
          box-shadow: 0 0 9px rgba(var(--ds-metal-300-rgb), 0.9);
          animation: holo-pulse-dot 1.8s ease-in-out infinite;
        }
        .holo-title {
          position: relative;
          margin: 8px 0 0;
          font-family: var(--ds-font-display, ui-sans-serif, system-ui, sans-serif);
          font-size: 30px;
          font-weight: 600;
          line-height: 1.04;
          letter-spacing: -0.012em;
          color: var(--ds-text-hi, #f3f1ea);
          /* Reserve the stacking context for the RGB-split twins. */
        }
        .holo-title-base,
        .holo-title-r,
        .holo-title-c {
          display: block;
        }
        .holo-title-base {
          position: relative;
          background: linear-gradient(170deg, var(--ds-metal-100, #eef0f3), var(--ds-metal-300, #c6c9cd) 55%, var(--ds-metal-500, #898c92));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          z-index: 2;
        }
        /* RGB-split twins — brass-right + ice-cyan-left chromatic aberration. */
        .holo-title-r,
        .holo-title-c {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1;
          pointer-events: none;
          mix-blend-mode: screen;
        }
        .holo-title-r {
          color: rgba(var(--ds-metal-300-rgb), 0.85);
          animation: holo-glitch-r 3.6s steps(1, end) infinite;
        }
        .holo-title-c {
          color: rgba(${iceRgb}, 0.85);
          animation: holo-glitch-c 3.6s steps(1, end) infinite;
        }
        .holo-tagline {
          margin: 8px 0 0;
          font-family: var(--ds-font-mono, ui-monospace, monospace);
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--ds-text-mid, #a8a79e);
        }

        /* ── Visual stage ────────────────────────────────────────────────── */
        .holo-stage {
          padding: 4px 22px 6px;
        }
        .holo-frame {
          position: relative;
          aspect-ratio: 16 / 10;
          width: 100%;
          border-radius: var(--ds-r-md, 13px);
          overflow: hidden;
          background:
            radial-gradient(120% 120% at 50% 30%, rgba(var(--ds-metal-200-rgb), 0.08), transparent 60%),
            linear-gradient(180deg, rgba(10, 13, 20, 0.92), rgba(5, 6, 10, 0.96));
          box-shadow:
            inset 0 2px 8px rgba(0, 0, 0, 0.6),
            inset 0 0 0 1px rgba(var(--ds-metal-400-rgb), 0.2),
            inset 0 0 40px rgba(${iceRgb}, 0.06);
        }
        .holo-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.08) contrast(1.04) brightness(1.02);
          mix-blend-mode: luminosity;
          opacity: 0.96;
          z-index: 1;
        }
        /* Rotating brass conic sheen over the stage. */
        .holo-sheen {
          position: absolute;
          inset: -40%;
          z-index: 2;
          pointer-events: none;
          mix-blend-mode: screen;
          opacity: 0.5;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            rgba(var(--ds-metal-200-rgb), 0.18) 36deg,
            transparent 96deg,
            rgba(${iceRgb}, 0.14) 180deg,
            transparent 240deg,
            rgba(var(--ds-metal-300-rgb), 0.16) 312deg,
            transparent 360deg
          );
          animation: holo-sheen-spin 11s linear infinite;
        }
        .holo-stage-scan {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          opacity: 0.45;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0) 0px,
            rgba(0, 0, 0, 0) 2px,
            rgba(0, 0, 0, 0.32) 2px,
            rgba(0, 0, 0, 0.32) 3px
          );
          mix-blend-mode: multiply;
        }
        .holo-flicker {
          position: absolute;
          inset: 0;
          z-index: 4;
          pointer-events: none;
          mix-blend-mode: screen;
          background: linear-gradient(180deg, rgba(${iceRgb}, 0.05), rgba(var(--ds-metal-200-rgb), 0.03));
          animation: holo-flicker 2.7s steps(1, end) infinite;
        }
        /* Frame corner ticks — instrument bracket. */
        .holo-corner {
          position: absolute;
          width: 16px;
          height: 16px;
          z-index: 5;
          border: 1.5px solid rgba(var(--ds-metal-200-rgb), 0.7);
          pointer-events: none;
        }
        .holo-corner--tl { top: 7px; left: 7px; border-right: none; border-bottom: none; }
        .holo-corner--tr { top: 7px; right: 7px; border-left: none; border-bottom: none; }
        .holo-corner--bl { bottom: 7px; left: 7px; border-right: none; border-top: none; }
        .holo-corner--br { bottom: 7px; right: 7px; border-left: none; border-top: none; }

        /* ── Spec ledger ─────────────────────────────────────────────────── */
        .holo-specs {
          margin: 6px 0 0;
          padding: 8px 22px 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .holo-row {
          display: flex;
          align-items: baseline;
          gap: 10px;
          padding: 7px 0;
          border-bottom: 1px solid rgba(var(--ds-metal-400-rgb), 0.08);
          opacity: 0;
          animation: holo-row-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(360ms + var(--row-i, 0) * 90ms);
        }
        .holo-row:last-child { border-bottom: none; }
        .holo-row-label {
          flex: 0 0 auto;
          font-family: var(--ds-font-mono, ui-monospace, monospace);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ds-text-low, #6e7077);
          white-space: nowrap;
        }
        .holo-row-rule {
          flex: 1 1 auto;
          height: 1px;
          margin-bottom: 3px;
          background: repeating-linear-gradient(
            90deg,
            rgba(var(--ds-metal-400-rgb), 0.22) 0 2px,
            transparent 2px 6px
          );
        }
        .holo-row-value {
          /* FINISH-F3 (advocate residual MUST-FIX) — long values used to
             hard-clip at the card edge on the clamped 340px phone card
             ("…Rue du Rhône," lost "Geneva"). Let the value take up to ~62%
             of the row and WRAP; the dotted leader flexes to fill whatever
             remains. Desktop rows are short enough to stay single-line. */
          flex: 0 1 auto;
          max-width: 62%;
          margin: 0;
          font-family: var(--ds-font-mono, ui-monospace, monospace);
          font-variant-numeric: tabular-nums;
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.01em;
          color: var(--ds-metal-200, #ecd49d);
          text-align: right;
          white-space: normal;
          overflow-wrap: anywhere;
          text-shadow: 0 0 12px rgba(var(--ds-metal-400-rgb), 0.4);
        }

        /* ── Footer telemetry ────────────────────────────────────────────── */
        .holo-foot {
          margin-top: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 22px 16px;
          box-shadow: inset 0 1px 0 rgba(255, 252, 242, 0.06);
        }
        .holo-foot-tag {
          font-family: var(--ds-font-mono, ui-monospace, monospace);
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--ds-text-low, #6e7077);
        }
        .holo-foot-tag--live {
          margin-left: auto;
          color: rgba(${iceRgb}, 0.9);
        }
        .holo-foot-bars {
          display: inline-flex;
          align-items: flex-end;
          gap: 3px;
          height: 12px;
        }
        .holo-foot-bars :global(i) {
          display: block;
          width: 3px;
          height: 40%;
          border-radius: 1px;
          background: var(--ds-metal-300, #c6c9cd);
          box-shadow: 0 0 6px rgba(var(--ds-metal-400-rgb), 0.5);
          animation: holo-eq 1.1s ease-in-out infinite;
        }
        .holo-foot-bars :global(i:nth-child(2)) { animation-delay: 0.14s; }
        .holo-foot-bars :global(i:nth-child(3)) { animation-delay: 0.28s; }
        .holo-foot-bars :global(i:nth-child(4)) { animation-delay: 0.42s; }
        .holo-foot-bars :global(i:nth-child(5)) { animation-delay: 0.56s; }

        /* ── Keyframes (SCOPED) ──────────────────────────────────────────── */
        @keyframes holo-card-in {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes holo-breathe {
          0%, 100% { opacity: 0.92; }
          50% { opacity: 1; }
        }
        @keyframes holo-scan-sweep {
          0% { transform: translateY(-110%); }
          100% { transform: translateY(330%); }
        }
        @keyframes holo-aberration {
          0%, 100% { transform: translate(0, 0); opacity: 0.5; }
          50% { transform: translate(1px, -1px); opacity: 0.62; }
        }
        @keyframes holo-sheen-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes holo-pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 9px rgba(var(--ds-metal-300-rgb), 0.9); }
          50% { opacity: 0.45; box-shadow: 0 0 4px rgba(var(--ds-metal-300-rgb), 0.45); }
        }
        @keyframes holo-eq {
          0%, 100% { height: 35%; }
          50% { height: 100%; }
        }
        @keyframes holo-row-in {
          from { opacity: 0; transform: translateX(14px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes holo-flicker {
          0%, 96%, 100% { opacity: 0.08; }
          97% { opacity: 0.42; }
          98% { opacity: 0.04; }
          99% { opacity: 0.5; }
        }
        /* GLITCH / RGB-split — the brass twin jitters right, the ice twin left. */
        @keyframes holo-glitch-r {
          0%, 92%, 100% { transform: translate(0, 0); opacity: 0; }
          93% { transform: translate(2px, -1px); opacity: 0.9; }
          95% { transform: translate(3px, 1px); opacity: 0.7; }
          97% { transform: translate(1px, 0); opacity: 0.9; }
        }
        @keyframes holo-glitch-c {
          0%, 92%, 100% { transform: translate(0, 0); opacity: 0; }
          93% { transform: translate(-2px, 1px); opacity: 0.9; }
          95% { transform: translate(-3px, -1px); opacity: 0.7; }
          97% { transform: translate(-1px, 0); opacity: 0.9; }
        }

        /* ── Reduced-motion: kill the heavy motion, keep a static premium look ─ */
        @media (prefers-reduced-motion: reduce) {
          .holo-card,
          .holo-scan,
          .holo-aberration,
          .holo-sheen,
          .holo-kicker-dot,
          .holo-foot-bars :global(i),
          .holo-flicker,
          .holo-title-r,
          .holo-title-c,
          .holo-row {
            animation: none !important;
          }
          .holo-title-r,
          .holo-title-c { opacity: 0; }
          .holo-scan { display: none; }
          .holo-row { opacity: 1; }
          .holo-card { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HolographicEmblem — code-drawn fallback when spec.imageUrl is absent.
// Concentric rings + a rotating reticle + scanlines, in brass/ice. Premium SVG
// geometry — never a stock icon.
// ─────────────────────────────────────────────────────────────────────────────
function HolographicEmblem({ accent, iceRgb }: { accent: string; iceRgb: string }) {
  return (
    <div className="holo-emblem" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="holo-emblem-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="holo-core" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="var(--ds-metal-100, #eef0f3)" stopOpacity="0.55" />
            <stop offset="55%" stopColor={accent} stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--ds-void, #04050a)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft holographic core glow */}
        <circle cx="100" cy="100" r="84" fill="url(#holo-core)" />

        {/* Concentric rings */}
        <circle cx="100" cy="100" r="70" className="holo-ring holo-ring--1" />
        <circle cx="100" cy="100" r="54" className="holo-ring holo-ring--2" />
        <circle cx="100" cy="100" r="38" className="holo-ring holo-ring--3" />

        {/* Rotating reticle group */}
        <g className="holo-reticle">
          <circle cx="100" cy="100" r="62" className="holo-reticle-track" />
          {/* tick marks around the track */}
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const r0 = i % 6 === 0 ? 54 : 58;
            const r1 = 62;
            return (
              <line
                key={i}
                x1={100 + Math.cos(a) * r0}
                y1={100 + Math.sin(a) * r0}
                x2={100 + Math.cos(a) * r1}
                y2={100 + Math.sin(a) * r1}
                className="holo-tick"
              />
            );
          })}
          {/* crosshair */}
          <line x1="100" y1="24" x2="100" y2="48" className="holo-cross" />
          <line x1="100" y1="152" x2="100" y2="176" className="holo-cross" />
          <line x1="24" y1="100" x2="48" y2="100" className="holo-cross" />
          <line x1="152" y1="100" x2="176" y2="100" className="holo-cross" />
        </g>

        {/* counter-rotating inner reticle */}
        <g className="holo-reticle holo-reticle--rev">
          <polygon points="100,72 124,114 76,114" className="holo-tri" />
          <circle cx="100" cy="100" r="6" className="holo-pip" />
        </g>
      </svg>

      <style jsx>{`
        .holo-emblem {
          position: absolute;
          inset: 0;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .holo-emblem-svg {
          width: 78%;
          height: 78%;
          overflow: visible;
        }
        .holo-emblem-svg :global(.holo-ring) {
          fill: none;
          stroke: rgba(var(--ds-metal-300-rgb), 0.42);
          stroke-width: 1;
        }
        .holo-emblem-svg :global(.holo-ring--1) {
          stroke: rgba(var(--ds-metal-200-rgb), 0.55);
          stroke-dasharray: 3 7;
          animation: holo-ring-spin 26s linear infinite;
          transform-origin: 100px 100px;
        }
        .holo-emblem-svg :global(.holo-ring--2) {
          stroke: rgba(${iceRgb}, 0.4);
          stroke-dasharray: 1 9;
          animation: holo-ring-spin 18s linear reverse infinite;
          transform-origin: 100px 100px;
        }
        .holo-emblem-svg :global(.holo-ring--3) {
          stroke: rgba(var(--ds-metal-300-rgb), 0.5);
        }
        .holo-emblem-svg :global(.holo-reticle) {
          transform-origin: 100px 100px;
          animation: holo-ring-spin 22s linear infinite;
        }
        .holo-emblem-svg :global(.holo-reticle--rev) {
          animation: holo-ring-spin 14s linear reverse infinite;
        }
        .holo-emblem-svg :global(.holo-reticle-track) {
          fill: none;
          stroke: rgba(var(--ds-metal-400-rgb), 0.2);
          stroke-width: 1;
        }
        .holo-emblem-svg :global(.holo-tick) {
          stroke: rgba(var(--ds-metal-200-rgb), 0.6);
          stroke-width: 1;
        }
        .holo-emblem-svg :global(.holo-cross) {
          stroke: rgba(${iceRgb}, 0.55);
          stroke-width: 1.2;
        }
        .holo-emblem-svg :global(.holo-tri) {
          fill: none;
          stroke: rgba(var(--ds-metal-200-rgb), 0.7);
          stroke-width: 1.4;
          stroke-linejoin: round;
        }
        .holo-emblem-svg :global(.holo-pip) {
          fill: var(--ds-metal-100, #eef0f3);
          filter: drop-shadow(0 0 6px rgba(var(--ds-metal-300-rgb), 0.9));
        }
        @keyframes holo-ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .holo-emblem-svg :global(.holo-ring--1),
          .holo-emblem-svg :global(.holo-ring--2),
          .holo-emblem-svg :global(.holo-reticle),
          .holo-emblem-svg :global(.holo-reticle--rev) {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
