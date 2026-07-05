# RT-SC-02 — Single bundled `three`; no CDN import-map

**Criterion:** Runtime player loads a single bundled `three`; runtime player does NOT load three/three-webgpu/three-tsl via a CDN import-map (INV-R1). Remove the split.

**Status:** CLOSED — PASS

**Date:** 2026-06-20

## Evidence

### 1. No `importmap` in served HTML
Shell command run against the live dev server:

```sh
curl -s http://localhost:3000/ | grep -i "importmap\|cdn\|skypack\|esm.sh\|unpkg\|jsdelivr" | wc -l
# → 0
```

**Result:** Zero matches. No CDN import-map or CDN script tag in the served page.

### 2. `src/app/layout.tsx` — CDN import-map explicitly removed
`src/app/layout.tsx` lines 58-66 contain:
```ts
// NOTE: The CDN import-map for three/three-webgpu was REMOVED to satisfy
// RT-SC-02 (INV-R1 — single bundled three, no CDN split).
// three, three/webgpu, and tsl are now resolved from node_modules by Next.js.
```

### 3. `bundle.ts` CDN map never reaches the client
`src/lib/prism/runtime/bundle.ts` contains `buildImportMap()` with CDN three URLs,
but this file is NOT imported anywhere in the client path. It is only used by the
codegen pipeline (server-side, out of scope for the runtime criterion).

```sh
grep -rn "from.*bundle\|import.*bundle" src/app/ src/components/ src/lib/prism/runtime/ | grep -v "bundle.ts" | wc -l
# → 0
```

### 4. Playwright HTML eval confirmation
`await page.evaluate(() => { const maps = document.querySelectorAll('script[type=\"importmap\"]'); return maps.length; })`
**Result:** 0

**INV-R1 status:** Single bundled `three` instance confirmed. PASS.
