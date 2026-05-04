// Vitest config for the Prism Renderer Migration test suite.
//
// Per tests/README.md:
//   - tests/unit       — pure logic, node env
//   - tests/integration — scene-tree shape tests, node env (no WebGPU)
//   - tests/shaders    — TSL-output regression, node env (offscreen / hashes)
//
// Browser tests (tests/browser) use Playwright, not vitest, and are excluded.

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/{unit,integration,shaders}/**/*.test.{ts,tsx,mjs}'],
    exclude: ['tests/browser/**', 'node_modules/**', '.next/**'],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': here('./src'),
      // three-msdf-text-webgpu's package.json only declares "module" + "types"
      // (no "main" / "exports" map), which Vite's resolver can't pick up.
      // Point directly at the built ESM entry.
      'three-msdf-text-webgpu': here(
        './node_modules/three-msdf-text-webgpu/dist/index.js',
      ),
    },
  },
});
