// SHELL W0 — DL3 typography candidates (evidence-board wiring, 2026-07-04)
//
// Three neo-serif display + data-grade monospace pairings, all variable and
// all self-hosted from public/fonts/shell/** (OFL licenses alongside each
// file; zero remote font fetches). Grotesque faces (Inter/Helvetica/Arial
// class) are FORBIDDEN on shell surfaces (DL3) — none appear here, and the
// fallback chains are serif/mono only.
//
// The /shell-w0 route renders ALL THREE pairings on real shell comps for
// founder sign-off; the WINNER is wired for production shell use in
// src/components/shell/design/shell-fonts.ts (one import for W1+).

import localFont from 'next/font/local';

// ── Pairing A — Fraunces × JetBrains Mono ───────────────────────────────────
// Fraunces: wonky old-style neo-serif, 4 variable axes (opsz/wght/SOFT/WONK) —
// the expressive 2026 signature face. JetBrains Mono: the engine chrome's
// instrument mono, giving shell↔engine continuity.
export const fraunces = localFont({
  src: '../../../public/fonts/shell/Fraunces-Variable.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--pair-a-display',
  display: 'swap',
});
export const jetbrainsMono = localFont({
  src: '../../../public/fonts/ui/JetBrainsMono-Variable.woff2',
  weight: '100 800',
  style: 'normal',
  variable: '--pair-a-mono',
  display: 'swap',
});

// ── Pairing B — Playfair Display × Martian Mono ─────────────────────────────
// Playfair: high-contrast transitional display (already the watch app's
// editorial MSDF voice — brand-coherent). Martian Mono: wide, technical,
// unapologetically data-grade.
export const playfair = localFont({
  src: '../../../public/fonts/shell/PlayfairDisplay-Variable.woff2',
  weight: '400 900',
  style: 'normal',
  variable: '--pair-b-display',
  display: 'swap',
});
export const martianMono = localFont({
  src: '../../../public/fonts/shell/MartianMono-Variable.woff2',
  weight: '100 800',
  style: 'normal',
  variable: '--pair-b-mono',
  display: 'swap',
});

// ── Pairing C — Newsreader × Spline Sans Mono ───────────────────────────────
// Newsreader: optical-size editorial serif, calm and literary. Spline Sans
// Mono: rounded-terminal utilitarian mono, softer data voice.
export const newsreader = localFont({
  src: '../../../public/fonts/shell/Newsreader-Variable.woff2',
  weight: '200 800',
  style: 'normal',
  variable: '--pair-c-display',
  display: 'swap',
});
export const splineSansMono = localFont({
  src: '../../../public/fonts/shell/SplineSansMono-Variable.woff2',
  weight: '300 700',
  style: 'normal',
  variable: '--pair-c-mono',
  display: 'swap',
});
