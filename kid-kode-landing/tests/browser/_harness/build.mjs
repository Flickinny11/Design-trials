// esbuild step for the T07 Playwright harness.
//
// Compiles `main.ts` (which imports the implementation modules from
// `@/lib/prism-graph/visual-spec-sliders` and `@/components/editor/panels/
// visual-preview/regen-api`) into a single ESM bundle that the harness HTML
// loads. The bundle is browser-targeted, includes no React/three (the
// harness uses raw DOM + canvas + WebGPU/WebGL2 contexts to keep the
// browser-side surface minimal), so the implementation logic under test is
// the pure-TS contract surface — slider definitions and Save & Verify
// payload — that the editor's React VisualPreview component sits on top of.
//
// Run independently: `node tests/browser/_harness/build.mjs`
// Or via `serve.mjs` which calls this on each startup.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

export async function buildHarness() {
  await build({
    entryPoints: [resolve(here, 'main.ts')],
    bundle: true,
    format: 'esm',
    outfile: resolve(here, 'main.js'),
    platform: 'browser',
    target: 'es2022',
    sourcemap: 'inline',
    logLevel: 'info',
    alias: {
      '@': resolve(repoRoot, 'src'),
    },
    external: [],
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildHarness().catch((err) => {
    console.error('[T07 harness build] failed:', err);
    process.exit(1);
  });
}
