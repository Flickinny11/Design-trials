// P1 TEXT SYSTEM (A2) — GET /api/prism/fonts
//
// Serves the committed Google Fonts library manifest as
// { fonts: FontManifestEntry[] } (contract.ts "Server atlas bake API").
// The manifest is baked into the server bundle at build time
// (scripts/fetch-google-fonts-manifest.mjs regenerates it); `core: true`
// entries resolve to pre-baked atlases under public/prism-assets/fonts/,
// everything else goes through the on-demand bake route (criterion 27).

import manifestJson from '@/lib/prism/text/google-fonts-manifest.json';
import type { FontManifestEntry } from '@/lib/prism/text/contract';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const fonts = manifestJson as FontManifestEntry[];
  return new Response(JSON.stringify({ fonts }), {
    headers: {
      'Content-Type': 'application/json',
      // The manifest only changes when the fetch script re-runs and the app
      // redeploys — safe to let clients hold it for an hour.
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
