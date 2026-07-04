// PRISM SHELL — PRODUCTION TYPE WIRING (SHELL W0 winner, DL3, 2026-07-04)
//
// The selected shell pairing: FRAUNCES (expressive neo-serif display,
// variable opsz/wght/SOFT/WONK) × JETBRAINS MONO (data-grade utility mono,
// shared with the engine chrome's instrument voice so the outer frame and
// the in-engine chassis stay harmonious while remaining separate layers).
// Chosen at W0 from three rendered evidence boards (see /shell-w0 §2 and
// notes/SHELL-W0-REPORT.md) — founder sign-off per DL3.
//
// Shell surfaces (W1+) import THESE consts and apply the variable classes at
// their root; the tokens layer exposes them as --pp-font-display /
// --pp-font-mono. Self-hosted, variable, zero remote fetches. Grotesques
// remain forbidden on shell surfaces (DL3).

import localFont from 'next/font/local';

/** Display voice — headlines, wordmark, hero copy, decision-card titles. */
export const shellDisplay = localFont({
  src: '../../../../public/fonts/shell/Fraunces-Variable.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--pp-font-display',
  display: 'swap',
});

/** Utility voice — metadata, numerals, buttons, kickers, readouts. */
export const shellMono = localFont({
  src: '../../../../public/fonts/ui/JetBrainsMono-Variable.woff2',
  weight: '100 800',
  style: 'normal',
  variable: '--pp-font-mono',
  display: 'swap',
});

/** Compose at a shell surface's root:
 *  <div className={`${shellFontVariables} ...`}> */
export const shellFontVariables = `${shellDisplay.variable} ${shellMono.variable}`;
