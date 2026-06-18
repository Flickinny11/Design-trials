import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import '@/components/editor/design-system/tokens.css';
import '@/components/editor/design-system/materials.css';
import '@/components/editor/walkthrough/walkthrough.css';
import '@/components/editor/icons/icons.css';
import { DS_TIER_BOOT_SCRIPT } from '@/components/editor/design-system/tier';

// ── EDITOR-EXPERIENCE P3 (C16) type system — self-hosted variable fonts ─────────
// A DISPLAY-WITH-CHARACTER + NEUTRAL-WORKHORSE split (the 2026 premium pattern:
// Linear/Vercel = display-with-character + neutral UI). Switzer is RETIRED — it
// read as a generic grotesque (Logan's veto). Replaced by:
//   DISPLAY = Bricolage Grotesque (Atelier Triay, OFL-1.1) — the SIGNATURE voice:
//   titles, the Prism wordmark, numerals, kickers. Real character (ink traps,
//   organic single-story a/g, opsz 12→96 + wght 200→800 axes) so the brand reads
//   distinctive, not templated. Display headings request high optical size.
//   UI/BODY = Inter (the repo's Inter-Variable) — the neutral workhorse for
//   labels/controls/body. Character lives in the DISPLAY face; the body stays
//   clean and legible (Bricolage is too distracting for long runs).
//   MONO = JetBrains Mono (OFL 1.1) — SPICE only: numeric readouts, kickers.
// Separate next/font calls → each gets its own generated family (cascade-safe).
const display = localFont({
  src: '../../public/fonts/ui/Bricolage-Variable.woff2',
  weight: '200 800',
  style: 'normal',
  variable: '--font-display',
  display: 'swap',
});
const ui = localFont({
  src: '../../public/fonts/Inter-Variable.ttf',
  weight: '100 900',
  style: 'normal',
  variable: '--font-ui',
  display: 'swap',
});
const mono = localFont({
  src: '../../public/fonts/ui/JetBrainsMono-Variable.woff2',
  weight: '100 800',
  style: 'normal',
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Prism Editor — Kriptik',
  description: 'The 3D knowledge-graph editor for diffusion-native applications.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // APP-REALITY P4 — edge-to-edge on mobile: let the scene's full-bleed
  // background extend under the notch / home-indicator (no letterbox bars).
  viewportFit: 'cover',
};

// RT-SC-02 / INV-R1 — there is exactly ONE `three` instance for the whole app:
// the one webpack bundles from node_modules. The previous CDN import-map
// (three / three/webgpu / three/tsl / three/addons/ / gsap from jsDelivr) is
// REMOVED. It only ever served native `import(url)` codeRef modules, and it
// caused those modules' bare `three` specifiers to resolve to a SECOND `three`
// from the CDN — the multiple-instances "Cannot read properties of undefined
// (reading 'replace')" per-frame crash. codeRef modules now read THREE from
// `ctx.THREE` (see runtime/shared/adapter.ts NodeContext) instead of importing
// it, so no import-map is needed and only the bundled instance ever loads.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${mono.variable}`}
      // data-ds-tier is stamped pre-hydration by the boot script below.
      suppressHydrationWarning
    >
      <head>
        {/* Chrome capability tier (INV-9) stamped pre-paint so tier-gated
            glass/refraction never flashes from the wrong tier. */}
        <script dangerouslySetInnerHTML={{ __html: DS_TIER_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
