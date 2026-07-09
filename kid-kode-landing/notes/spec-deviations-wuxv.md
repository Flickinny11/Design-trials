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

## DEV-WUXV-3 — WalkthroughHost mounts in ALL view modes (including
  preview-app)
- Timing note (honest provenance): unlike DEV-WUXV-1/2 this entry is written
  in the SAME session as the change, immediately after the fix-round RE-TEST
  exposed the regression and before anything was committed — the record and
  the code land in the same commit.
- Prior posture: the F4a-fix rule "editor/authoring chrome is hidden in the
  shipped-app (preview-app) view" gated the entire guided-tips cluster —
  lightbulb AND WalkthroughHost — behind `!isPreviewApp` in src/app/page.tsx.
- Deviation: `<WalkthroughHost />` moves OUTSIDE that gate and mounts in every
  view mode (it renders nothing while idle). The lightbulb chrome stays
  hidden in preview-app.
- Why (re-test evidence): the tour's own step 6 drives `preview-app`, which
  unmounted the host mid-run — popup gone, store status stuck 'running', no
  terminal status ever reached. Consequences measured live: (a) the UXV-F5/P7
  seen-flag persist (which fires on terminal status) could never fire, so the
  tour re-triggered on every reload (wuxv-p4-11); (b) every attempt to leave
  preview-app remounted the host, whose per-step orchestration effect
  instantly re-asserted the stuck step's `preview-app` — a remount-thrash
  loop that mode-locked the whole editor (P4's wuxv-p4-09/10 "buttons flip,
  view frozen"; reproduced live pre-fix: store viewMode reverts 22ms after
  every setViewMode call, fix-round re-test log).
- Consequence accepted: the first-visit tour now auto-launches from the boot
  (preview-app) view instead of waiting for the first mode switch, and the
  step-6 popup renders over the shipped-app view (that step's entire point).
  Whether first-boot auto-launch is the desired first-run is on the founder
  decision list.
- Proof after fix: full 7-step run incl. step-6 popup over preview-app
  (wuxv-r1-36), Finish → status 'done' + seen persisted (wuxv-r1-37), all
  three mode buttons switch and stick post-tour (wuxv-r1-38), reload does NOT
  re-trigger (wuxv-r1-39).
