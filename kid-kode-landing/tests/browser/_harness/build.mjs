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

const ENTRYPOINTS = [
  // T07 — Visual tab harness (existing).
  { input: 'main.ts', output: 'main.js' },
  // T08 — Animation tab harness.
  { input: 'animation-main.ts', output: 'animation-main.js' },
  // T08 — Image-edit tools harness.
  { input: 'image-edit-main.ts', output: 'image-edit-main.js' },
  // HL10 — editor-artifacts (ArtifactNode + GlassNode delegation) harness.
  { input: 'editor-artifacts-main.ts', output: 'editor-artifacts-main.js' },
  // HL13 — Add Node UI harness (React + ReactDOM bundled).
  { input: 'add-node-main.tsx', output: 'add-node-main.js' },
];

export async function buildHarness() {
  for (const e of ENTRYPOINTS) {
    await build({
      entryPoints: [resolve(here, e.input)],
      bundle: true,
      format: 'esm',
      outfile: resolve(here, e.output),
      platform: 'browser',
      target: 'es2022',
      sourcemap: 'inline',
      logLevel: 'info',
      jsx: 'automatic',
      loader: { '.json': 'json' },
      alias: {
        '@': resolve(repoRoot, 'src'),
      },
      external: [],
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildHarness().catch((err) => {
    console.error('[T07 harness build] failed:', err);
    process.exit(1);
  });
}
