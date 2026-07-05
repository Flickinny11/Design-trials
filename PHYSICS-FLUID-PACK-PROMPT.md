# PHYSICS / FLUID CAPABILITY PACK — simulation-driven primitives. (Claude Code, ultracode, post-expansion)

## MODEL & MODE
claude-opus-4-8 (confirm line 1). ULTRACODE parallel waves on the FROZEN Animatable+Driver contract (additive catalog
entries only). Branch prism-editor-build, git root. AUTO-CKPT at verified wave boundaries (standard exclusions).
LOGAN-INBOX polling at wave boundaries. ANTI-STUCK: web-search CURRENT (2026) approaches after ~2 fails.

## RESEARCH FIRST (mandatory — do NOT assume training-era tools)
Logan's standing rule: liquidfun is the *concept* reference, not the tool — it is Box2D-era 2D. Web-research the
CURRENT (June 2026) best-in-class for browser/WebGPU: rigid-body (Rapier vs Jolt-wasm vs alternatives — wasm size,
determinism, perf), soft-body/cloth, and REAL-TIME FLUIDS (WebGPU compute SPH/FLIP/stable-fluids, TSL compute in
current three). Write a 1-page decision doc (notes/PHYSICS-STACK-DECISION.md) BEFORE building: chosen stack + why +
bundle/perf cost + tier plan. New deps must pass the dependency-allowlist guard.

## SCOPE — simulation primitives (~30-50), same contract, applicable to any element
- GRAVITY/RIGID: drop-and-bounce, tumble-settle, domino/knock, orbit (n-body feel), magnet-snap, weightless-drift.
- SPRINGS/SOFT: spring-arrive, jelly-collide, cloth-drape/flag-wave, rope/chain dangle, squash-impact.
- FLUIDS: liquid-fill (real sim upgrade of the shader fake), pour/splash, ripple-interact (pointer), buoyancy-float,
  molten-flow, smoke-plume (sim-driven upgrade where it beats the shader version — keep both, sim tier-gated).
- FORCE FIELDS: wind-gust over elements, vortex, explosion-scatter+reassemble, attract/repel swarms.
- Each: full ControlSchema (mass/stiffness/viscosity/etc.), Drivers (pointer/scroll/state/event as force inputs —
  e.g. scroll velocity = wind), deterministic-or-seeded playback for Preview consistency, INV-9 tier-gated (sim on
  T1+/capability-detected; graceful non-sim fallback on T0), picker integration, tests.

## VERIFICATION — full loop
Parallel harness + art reviewer + USER-ADVOCATE (photoreal bar; sim must read PHYSICAL — weight, momentum, splash —
cite frames + motion deltas); real-GPU for fluids; full-catalog no-regression (312+expansion count); tsc 0-new;
vitest green. Honest flags over faked physics, always.

## RESUMABILITY + LEDGER
notes/verification/PHYSICS-FLUID-PROGRESS.md continuously; sentinel auto-relaunch ready; LOGAN-INBOX at boundaries.

## OUTPUT
notes/PHYSICS-FLUID-REPORT.md: stack decision recap, per-category galleries (motion strips), advocate verdicts,
perf/tier table, no-regression, honest flags. AUTO-CKPTs. Plain-language summary. STOP.
