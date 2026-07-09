# Spec deviations — PRISM-WUXV (recorded BEFORE the code change, per wave law)

## DEV-WUXV-1 — Runtime player defaults to the WebGL2 backend of three/webgpu
- Spec posture: "Runtime renderer is `three/webgpu` with automatic WebGL2
  fallback" (INV-R9 lineage) — WebGPU-first, fallback only when
  `navigator.gpu` is absent.
- Deviation: the runtime PLAYER (ConductorRuntime → mountFromGraphSource →
  createSceneRoot default renderer factory) now constructs
  `WebGPURenderer({ forceWebGL: true })` by default, with an explicit
  `?webgpu=1` opt-in restoring the WebGPU backend. The renderer CLASS is
  unchanged (`three/webgpu` WebGPURenderer, TSL intact) — only the backend
  selection default changes, and only on the runtime-player path. The editor
  at `/` keeps its own WebGPU-first init (separate `createUnifiedRenderer`).
- Why: WUXV persona verification proved the WebGPU backend of the runtime
  player renders CORRUPTED in current Chromium (red-dithered MSDF/emissive,
  missing background layers) — the W2D-era "red dither" regression, which
  earlier waves worked around at CAPTURE time only. Users hit it live: all 4
  personas saw a black/red-dithered preview of their built app (UXV-B1, the
  wave's #1 blocker). The WebGL2 backend of the same renderer renders
  production-quality (proof frames:
  notes/verification/wuxv/build/wuxv-triage-wbgdemo-webgpu.png vs
  wuxv-triage-wbgdemo-webgl2.png).
- Scope: src/lib/prism/runtime/shared/scene-root.ts (factory accepts a
  forceWebGL option), src/lib/prism/runtime/mount-graph.ts (opts plumb),
  src/components/prism-player/ConductorRuntime.tsx (reads `?webgpu=1`,
  window read stays in the DOM host per the runtime `window.*` rule).
- Revert path: single default flip once the upstream Chromium/three WebGPU
  dither is fixed; `?webgpu=1` keeps the WebGPU path exercisable meanwhile.
- Founder note: this is a mitigation, not a cure — root-causing the WebGPU
  dither (three r18x + Chromium version matrix) is on the founder decision
  list for W-PROD.

## DEV-WUXV-2 — "indigo/violet" prompt words map to the anodized (deep blue)
  palette identity
- Spec posture: palettes.ts INV-9 "no purple" — the sanctioned identities
  contain no indigo/violet palette.
- Deviation: rather than adding a purple-family palette (which would violate
  INV-9), the prompt lexicon (generate-core.ts PALETTE_HINTS) gains an
  indigo/violet/amethyst/aubergine word cluster mapped to `anodized` (the
  nearest sanctioned deep-blue identity), and explicit color words are
  scored above mood words (so "deep indigo" beats "aurora"). A user asking
  for indigo gets deep blue, not green. A TRUE indigo identity remains a
  founder decision (INV-9 exception).
