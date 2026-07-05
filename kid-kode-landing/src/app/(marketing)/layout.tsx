// PRISM MARKETING — PUBLIC SURFACE LAYOUT (SHELL W6, S2 / decision D)
//
// The shared shell for every public marketing route (landing + sub-pages).
// Server-rendered (SSR/SEO, decision D). Applies the shell type system
// (Fraunces × JetBrains Mono, DL3) and the --pp-* token layer, then frames the
// page with the public header + footer. It is PUBLIC — it lives OUTSIDE the
// /app/* session boundary, so no auth guard runs here (middleware matches only
// /app/*). It re-enables pinch-zoom for this subtree (the root layout disables
// it for the full-bleed engine canvas) so the marketing surface meets WCAG 2.2
// AA 1.4.4 / 1.4.10.

import type { Metadata, Viewport } from 'next';
import '@/components/shell/design/prism-premium.css';
import '@/components/marketing/marketing.css';
import { shellFontVariables } from '@/components/shell/design/shell-fonts';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prism.build';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Prism — Describe it. Watch it build. Ship it.',
    template: '%s — Prism',
  },
  description:
    'Prism turns a sentence into a real, running application — authored as a live 3D world, verified before it ships, and yours to deploy anywhere.',
  applicationName: 'Prism',
  keywords: [
    'AI app builder',
    'prompt to app',
    'WebGPU',
    '3D web',
    'no-code',
    'app generator',
    'design to code',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Prism',
    title: 'Prism — Describe it. Watch it build. Ship it.',
    description:
      'Turn a sentence into a real, running application — authored as a live 3D world, verified before it ships.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prism — Describe it. Watch it build. Ship it.',
    description:
      'Turn a sentence into a real, running application — authored as a live 3D world, verified before it ships.',
  },
  robots: { index: true, follow: true },
};

// WCAG 2.2 AA — restore zoom for the marketing subtree (root disables it for
// the engine canvas). initialScale 1, up to 5× zoom, user-scalable.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mk ${shellFontVariables}`}>
      <a className="mk-skip" href="#mk-main">
        Skip to content
      </a>
      <MarketingHeader />
      <main id="mk-main" className="mk-shell-main">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
