// Vitest config for the Prism Renderer Migration test suite.
//
// Per tests/README.md:
//   - tests/unit       — pure logic, node env
//   - tests/integration — scene-tree shape tests, node env (no WebGPU)
//   - tests/shaders    — TSL-output regression, node env (offscreen / hashes)
//
// Browser tests (tests/browser) use Playwright, not vitest, and are excluded.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/{unit,integration,shaders}/**/*.test.{ts,tsx,mjs}'],
    exclude: ['tests/browser/**', 'node_modules/**', '.next/**'],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
