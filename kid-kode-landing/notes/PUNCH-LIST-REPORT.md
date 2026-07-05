# PUNCH-LIST REPORT — P5 of the Canvas completion run

**Branch:** `prism-editor-build` · **Date:** 2026-06-11 · **Advocate: PLEASED / PASS (round 4, mustFix [])**

## Catalog verification system (agent A)
- **Quiet-retry tier** built into `verify-catalog-parallel.mjs`: this-run fails re-run once, serially, on a fresh browser; both verdicts kept (`preRetry`); summary reports "(Y recovered on quiet retry)"; `--no-retry` opt-out. Isolation, never threshold-loosening.
- **All 6 documented failing tiles root-caused**: pointer tiles (hover-lift, pointer-attract-scale, pointer-press) never engaged — the rig's synthetic pointer orbited the ORIGIN in [-1,1] while primitives read 0..1 around (0.5,0.5); now a proper center-sweep + pinned engaged pointer for the controls compare. scroll-skew: linear scroll ramp = constant velocity = invisible shear; now a cosine sweep with velocity sign-flips + a baseline-stability-gated scroll-step stimulus for controls. dust-poof: genuinely broken shader (sin-of-1e8 hash collapse + reversed smoothstep) — fixed, visible puff eye-verified. lightning-bolt: 15% flash duty vs 3-instant sampling (~61% deterministic miss) — deterministic 48-point phase sweep via a new rig seek hook; controls re-freeze at a phase proven visible under current params.
- **Tile nits**: bevel-glass reworked honestly within the rig's no-transmission-RT limits (real alpha transparency + env chamfer glint + Beer-Lambert edge tint); aurora extremes energy-conserved + soft-contained; campfire rising ember sparks added; ghost-trail changed-flag false-negative fixed with a per-pixel second-opinion diff in the advocate capture tool.
- **Final fresh full catalog: 312/312 (0 recovered on quiet retry), deviceLost 0.**

## Editor ergonomics (agent B + advocate rounds)
Steppers 28px keys / ~36×32 effective; tiny-type sweep to ≥9px + mid contrast (3.67:1 → 7.5-8.5:1 measured); Lighting flyout scrolls at 460px height; mobile tap-to-close scrim; minimap brass/ice retint; honest "Interior · Full detail" zoom label; brass-prism `icon.svg` (favicon 404 dead); selection ring tracks live geometry bounds. Advocate rounds added three real catches, all fixed + measured: the zoom readout collided with the centered mode pill (now heads the right cluster, 13px clear); the mobile Inspector sat under the tool rail (now inset left-16); mobile fader values clipped to "0." (grid minWidth-zeroing; all six values render complete, 27px clear).

## Test debt + correctness (agent C)
- **All 21 legacy vitest failures re-pinned to canonical-3 reality** — every updated test still fails if the superseded behavior (legacy viewMode literals, PrismHost mounts, updateNode keyframe writes, MISSING_PRIMITIVES_LOOP, lit-parallax default) is reintroduced. Audit: none of the 21 revealed wrong code. Also killed 3 unhandled-rejection errors (test stubs now model renderer.compile()).
- **Full suite: 452 files / 2,536 tests / 0 failures.**
- Verdict-schema: the rubric's "INDIFFERENT + flags = PASS-WITH-FLAGS" row is now reachable; gate-matrix self-test (10/10) + 12 unit tests.
- Regen-verify accepts meshPrimitive as a mesh artifact.
- Orchestrator follow-ups: TSL-only line restored to the codegen system prompt (cage-free phrasing); env-IBL warm-up promise no longer floats.

## Carried (non-blocking, post-run / UI-FIDELITY-2 candidates)
Lightning-bolt art reads smooth-sine rather than forked (functions correctly); campfire base still ACES-blows to white; CODE tab pill at viewport edge; selection ring ~8% tight; catalog std-tier judges color on the webgl fallback; shared-rig cross-route rebind; 1024² mock-asset resolution ceiling (needs harness-side re-provisioning).

## Plain-language summary for Logan
The backlog is cleared. The six animation tiles that had "always been broken" are actually fixed — four of them were the test rig's fault (it never moved the pointer where the animations could feel it, and its scroll had no acceleration to react to), one had genuinely broken shader math, and lightning was being photographed between flashes. The whole 312-tile catalog now verifies green in one run, and when the machine is loaded the harness automatically re-checks stragglers in isolation instead of crying wolf. Every rough edge from the design-run list is fixed and measured — bigger tap targets, readable small type, panels that scroll instead of clipping, a phone scrim, the favicon. The advocate went four rounds with us and caught three more real paper-cuts (a collided label, a panel under the toolbar, clipped slider values) — all fixed. And the test suite is fully green for the first time this run: 2,536 tests, zero failures.
