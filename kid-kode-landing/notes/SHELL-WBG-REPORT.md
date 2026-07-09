# SHELL W-BG — 3D Background Library + Prompt-to-Background — RUN REPORT

Status: COMPLETE — BOTH JUDGES PASS, 0 MUST-FIX
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
- [x] D10 evidence pack (`763713a1`) — live picker drive (catalog/search/
      hover-triptych/apply/2D-gate/R1+R2 generation through the real UI/
      library), 18 T2 renders across all 8 categories, 60/60 pixel-verified
      real-render thumbs, anti-repetition rotation (3 distinct families for
      one neutral prompt), runtime proofs in the REAL ConductorRuntime
      (catalog preset + the newest generated stack), live flight-recorder
      NDJSON + tenant library + generated R2 assets archived, perf control
      analysis. verify EXIT 0 post-capture; live-graph.json restored.
- [x] D11 judges — BOTH PASS, 0 MUST-FIX (see §5).

## 3. Spend ledger

| Provider | Budget | Spent | Notes |
|---|---|---|---|
| Replicate | $8.00 | ~$0.70 | 9 plates ($0.63, ledgered w/ prediction ids) + 1 live R2 evidence generation (~$0.07) |
| Tripo | 60 cr | 0 cr | DEV-6: splats not a generation target |

## 4. Evidence index

notes/verification/shell-wbg/
- editor/00..12 + generation-evidence.json + runtime-evidence.json — the
  full live drive (picker, hover triptych, 2D gate, R1+R2 generation,
  library, runtime proofs)
- flight-recorder-background-events.ndjson — 5 live background_event records
  (incl. the R2 generation + the 3-generation rotation)
- library-background-presets.json — the tenant library after the drive
- generated-assets/ — the live R2 plate + depth (archived; runtime copies
  under public/three-d-bg/generated/ are gitignored)
- plates-ledger.json — D4 provenance (prediction ids per stage)
- renders/ — 18 representative full-frame renders across all 8 categories
- editor/ — live picker drive: catalog, search, hover-live-preview
  before/during/after, apply, W-2D flat gate, R1 + R2 generation through the
  real UI, MY LIBRARY, anti-repetition rotation JSON, runtime proofs
- perf.json — T2 frame times for the heaviest stacks
- (public/three-d-bg/thumbs/ — all 60 baked real-render thumbs, committed)

## 5. Judge verdicts

**criteria-reviewer (fresh context): PASS — 0 MUST-FIX.** All 7 criteria
graded PASS with self-executed evidence: independent registry audit (60
entries / 0 duplicate ids / 0 missing axes / 0 ungrounded grammar families /
60 thumbs present), plate prompts confirmed authored originals with ledgered
provenance, hover-preview proven transient (persistedLayerIds unchanged
during hover), route planner + baked-public-URL + secrets greps clean,
anti-repetition + 11th record type re-tested (14/14), 18 renders counted,
perf control analysis accepted as an honest treatment of the documented
environment cap, `npm run verify` EXIT 0 re-executed, tsc 9 = baseline, W5B
11/11, I-ADDITIVE diff-verified, spend ~$0.70 of $8. One nit (TSL `TNode =
any` typing seam — documented, not a violation). No Law-0 drift.

**user-advocate (fresh context, "user who hates default-looking sites"):
PLEASED — gate PASS, 0 MUST-FIX.** Verdict validated (`valid: true`,
`computedGate: PASS`). Judged from all 18 renders + broad thumb sampling +
the full editor drive + measured JSON. Findings: the 60 "span real hue
families and real structures (rain streaks, aurora, caustics, chrome swirl,
starfields, concentric rings, and genuinely photographic R2 plates), not
recolors of one effect"; the R2 ask "misty pine forest at dawn" produced "an
actual photoreal forest plate with a correct depth pass, palette=verdant";
the identical neutral prompt 3x produced three different families/names;
hover previews without writing the graph; the 2D gate self-explains; and the
generated background "runs behind my real app" (frames 11/12). Three
non-blocking taste FLAGS recorded as founder-visible follow-ups:
1. Four neutral-NAMED entries read off-name (ashfall renders red, noir-wash
   red glow, slate navy+cyan, linen near-black) — thumbnail-first browsing
   makes it harmless; a palette/naming pass is a cheap future polish.
2. Fine speckle grain on some flat shader washes (paper/slate/stage-light) —
   organic, subtle; a smoothing knob is a taste follow-up.
3. Provenance note: runtime frames captured on the WebGL2 fallback per the
   documented W2D dither law (colors render true).

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

PRISM-WBG: RUN COMPLETE
