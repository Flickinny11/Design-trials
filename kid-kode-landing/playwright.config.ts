// Playwright config — first introduced for T07 (Editor Visual tab live preview).
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L477 (Visual tab) + §17 L538
// ("editor Visual tab live preview updates in <100ms on slider input").
//
// Browser tests under `tests/browser/` are excluded from vitest (see
// `vitest.config.mjs`) and run here. Each task's spec file is named
// `tests/browser/T<NN>.<scenario>.spec.ts`. The webServer entry below
// boots a tiny Node http server that:
//   1. Builds `tests/browser/_harness/main.ts` → `_harness/main.js` via
//      esbuild (no Next.js / Vite involvement; we just want the
//      implementation TS modules bundled for the browser).
//   2. Serves the `_harness/` directory at `http://localhost:4567`.
//
// This keeps the editor-Visual-tab smoke test self-contained: no Next.js
// dev server needed, no CDN imports, deterministic across machines.

import { defineConfig, devices } from 'playwright/test';

const HARNESS_PORT = process.env.PRISM_T07_HARNESS_PORT
  ? Number(process.env.PRISM_T07_HARNESS_PORT)
  : 4567;

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${HARNESS_PORT}`,
    trace: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // §13 L477: live R3F sub-canvas; spec §3 L65 says editor uses async
        // gl factory for WebGPU init. Headless Chromium needs both flags
        // for WebGPU. WebGL2 is the documented fallback (§3 + §17 L535).
        launchOptions: {
          args: [
            '--enable-unsafe-webgpu',
            '--enable-features=Vulkan',
            '--use-vulkan=swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
  ],
  webServer: {
    command: `node tests/browser/_harness/serve.mjs`,
    url: `http://localhost:${HARNESS_PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60_000,
    env: { PRISM_T07_HARNESS_PORT: String(HARNESS_PORT) },
  },
});
