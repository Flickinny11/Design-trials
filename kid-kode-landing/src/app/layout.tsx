import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import '@/components/editor/design-system/tokens.css';
import '@/components/editor/design-system/materials.css';
import '@/components/editor/walkthrough/walkthrough.css';
import '@/components/editor/icons/icons.css';
import { DS_TIER_BOOT_SCRIPT } from '@/components/editor/design-system/tier';

// ── PRISM PORT F0 (de-brass 2026-06-19) type system — self-hosted variable fonts
// The LOCKED type system: Sora (geometric, non-grotesque) for display/wordmark/
// buttons/UI + JetBrains Mono for labels/kickers/readouts. ALL grotesque faces
// (Switzer, Bricolage, generic-grotesque) are CONDEMNED and removed from the UI
// wiring. Sora backs BOTH --font-display and --font-ui (one geometric family
// carries the chrome); JetBrains Mono is the instrument/label voice.
//   DISPLAY = Sora @600-760 → the SIGNATURE voice: titles, Prism wordmark,
//             buttons, hero numerals. Geometric, precise, non-grotesque.
//   UI/BODY = Sora @400-600 → labels/controls/body, cohesive with display.
//   MONO    = JetBrains Mono → labels, all-caps kickers, tabular readouts.
// Separate next/font calls → each gets its own generated family (cascade-safe).
const display = localFont({
  src: '../../public/fonts/ui/Sora-Variable.ttf',
  weight: '100 800',
  style: 'normal',
  variable: '--font-display',
  display: 'swap',
});
const ui = localFont({
  src: '../../public/fonts/ui/Sora-Variable.ttf',
  weight: '100 800',
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
