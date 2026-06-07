import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
const sans = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
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
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
