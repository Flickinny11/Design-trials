# SHELL W-BG — 3D Background Library + Prompt-to-Background — RUN REPORT

Status: EVIDENCE CAPTURE IN PROGRESS
Branch: codex/prism-recovery-harness-20260630
Mission: SHELL-WBG-PROMPT.md (authored 2026-07-07)
Deviations of record: notes/spec-deviations-wbg.md (authored first)

## 1. Mission recap

1. Expand background primitives to 50-60 ORIGINAL grammar-derived entries
   across distinct families; each entry: real-render thumb, palette tokens,
   motion tag, 2d/3d renderMode tags, perf tier.
2. Picker: categorized + searchable; live preview on hover; respects hub
   renderMode (W-2D).
3. Prompt-to-background in the picker: context-aware (hub elements, palette,
   mood) → grammar-family-driven generation → route planner R1/R2/R3 →
   baked assets (DL13) → runs in the prism runtime → saved to user library.
4. Anti-repetition + flight-recorder family logging per generation.
5. Evidence: picker frames, 12+ representative renders, one full
   prompt-to-background sequence on a populated hub, 60fps desktop perf.

## 2. Deliverables

- [x] D0 spec-deviations + report skeleton (`a6b7e227`)
- [x] D1 catalog schema + new layer kinds, additive (`f9d57bf3`) —
      BackgroundLayerKind +gradient-volume/+fluid-overlay; preset catalog
      axes (category / motion / renderModes W-2D honesty / perfTier /
      grammarFamily / keywords / thumbUrl); 7 new DS-token palettes
      (arc, anodized, ember, verdant, garnet, mercury, noir — zero purple).
- [x] D2 new TSL renderers (`64b8156f`) — GradientVolumeLayer (6 variants:
      wash/beams/aurora/horizon/rings/spot; no raymarch, T0-capable, the
      2d-hub workhorse) + FluidOverlayLayer (5 variants: silk/ink/caustic/
      smoke/plasma; domain-warped fbm advection); ParticleFieldLayer gains
      snow/rain/fireflies/dust/ash with continuous fract-wrapped fall.
- [x] D3 60-entry library (`8b96ca8d`) — nebulae 8 / particles 10 /
      deep-space 6 / gradient-light 9 / fluid 8 / plates 10 / captured 1 /
      minimal 8; 31 entries affirmatively 2d-tagged; every entry cites its
      design-grammar family; one deterministic id-stable makePreset factory.
- [x] D4 9 generated cinematic plates (`8b96ca8d`) — ORIGINAL FLUX-2-pro
      scene briefs → depth-anything-v2 → deterministic sharp filmic grade →
      webp baked to public/three-d-bg/plates (DL13). Prediction ids in
      notes/verification/shell-wbg/plates-ledger.json (I-PROVENANCE).
- [x] D5 picker upgrade (`3df3df37`) — search + category chips; HOVER =
      LIVE PREVIEW via transient useBackgroundPreviewStore (source writes
      stay updateHub-only); W-2D flat-hub gate + count note; real-render
      thumbs with CSS-swatch fallback; motion/tier/2D-OK badges.
- [x] D6 prompt-to-background (`a7b16ce9`) — pure generate-core (brief from
      prompt + hub elements/palette/identity; family anti-repetition with
      usage rotation + cluster diversity + explicit-ask override; R1
      synthesis per family vocabulary) + /api/prism/background-generate
      (REAL W-PHOTO planner decides R1/R2/R3; R2/R3 spawn the committed
      .assetgen clients + grade; honest R1 downgrade when keys absent);
      per-tenant library (shared-interfaces schema + tenant-store
      collection, I11).
- [x] D7 flight recorder (`a7b16ce9`) — background_event 11th record type +
      recordBackgroundEvent (grammar family + cluster + route + palette +
      renderMode + downgraded per generation; consent + scrub server-side;
      fail-open) + `background` touchpoint.
- [x] D8 runtime + thumbs (`9e3c20ad`) — the 4 procedural material builders
      extracted to src/lib/editor/backgrounds/render-core/ (ONE shader
      source); NEW mountProceduralBackground renders hub.background in the
      standalone runtime; ConductorRuntime (E14 /preview) mounts the landing
      hub's background + __PRISM_RUNTIME_BG__ handle; /wbg-demo lab route
      proves it (catalog preset + newest generated stack); bg-lab ?thumb=1 +
      capture-bg-thumbs.ts bake real-render thumbs for all 60 entries.
- [x] D9 tests + gates (`677e5725`) — 29 new W-BG tests green (registry
      integrity, grammar grounding, deterministic builds, asset honesty,
      W-2D gate, search, render-core + runtime mounter, generate-core
      brief/family/synthesis, flight-recorder round-trip + PII scrub +
      I-CONSENT). W5B ship gate + all flight-recorder + W2D + W-TPL suites:
      84 passed / 1 skipped. tsc 9 = baseline throughout.
- [ ] D10 evidence pack (in progress)
- [ ] D11 judges (criteria-reviewer + user-advocate, 0 MUST-FIX) + marker

## 3. Spend ledger

| Provider | Budget | Spent | Notes |
|---|---|---|---|
| Replicate | $8.00 | ~$0.63 + live-evidence gens | 9 plates (flux-2-pro ~$0.06 ea + depth ~$0.01 ea, ledgered); evidence R2 generation adds ~$0.07 per run |
| Tripo | 60 cr | 0 cr | DEV-6: splats not a generation target |

## 4. Evidence index

notes/verification/shell-wbg/
- plates-ledger.json — D4 provenance (prediction ids per stage)
- renders/ — 18 representative full-frame renders across all 8 categories
- editor/ — live picker drive: catalog, search, hover-live-preview
  before/during/after, apply, W-2D flat gate, R1 + R2 generation through the
  real UI, MY LIBRARY, anti-repetition rotation JSON, runtime proofs
- perf.json — T2 frame times for the heaviest stacks
- (public/three-d-bg/thumbs/ — all 60 baked real-render thumbs, committed)

## 5. Judge verdicts

(filled at D11)

## 6. Gotchas / learnings

- Playwright HEADLESS screenshots of a WebGPU canvas come out BLANK WHITE
  while the scene renders fine (probe fires, body bg correct) — the W2D
  capture blind spot in a new costume. HEADED capture on the real GPU works;
  the WebGL2-fallback initScript (navigator.gpu undefined) also works.
- One WebGPU page reused across many navigations degrades the GPU process
  (mass probe timeouts + cross-page navigation interruptions). One capture
  process per preset is the robust shape.
- `uniform(0)` from three/tsl types `.value` as unknown — hosts that write
  numeric uniforms per frame need a typed view (BgNumericUniform).
- Substring keyword matching false-positives ("something nICE" hits 'ice');
  brief derivation must use word-boundary matching.
- The W-PHOTO route planner defaults element realism='high' → R3 for
  everything; backgrounds must derive planner INPUTS from the brief
  (stylized+responsive → R1; photoreal → R2) — live camera-responsiveness is
  the honest motion classification for procedural backgrounds.
