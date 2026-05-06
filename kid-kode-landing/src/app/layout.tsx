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

// Spec §11 L431-L443 — importmap so codeRef modules can `import` directly
// from the spec's ALLOWED_IMPORT_SOURCES (three, three/webgpu, three/tsl,
// three/addons/, gsap) without bundling. Three-msdf-text-webgpu is bundled.
const PRISM_IMPORT_MAP = {
  imports: {
    three: 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js',
    'three/webgpu': 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.webgpu.js',
    'three/tsl': 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.tsl.js',
    'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/',
    gsap: 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <script
          type="importmap"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(PRISM_IMPORT_MAP) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
