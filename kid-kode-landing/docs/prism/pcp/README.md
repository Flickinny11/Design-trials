# Prism Crash-Course Package (PCP) — index

The always-on instruction layer that closes the gap W-BAKE proved: ~57% of
runtime crashes traced to the undocumented ctx API surface, and one-shot
design starved at a 16/100 best mean under the thin L1. Authority:
`docs/prism/RATIFICATION-2026-07-09.md` + the W-PCP wave prompt. Additive
only (I-P1): the PCP changes WHAT models are told, never WHICH model runs.

## What rides where

| Layer | Content | Source file |
|---|---|---|
| **L1 v2** (every codegen call) | V1 constraints + generated runtime surface + dependency gate + design doctrine core | `src/lib/prism/codegen/prompts.ts` (`SHARED_SYSTEM_PROMPT`), composing `runtime-surface.generated.ts` + `pcp-blocks.ts` |
| **L2** (once per build) | WORLD block — 5 ratified classes; template `buildWorldBlock()` reproduces the W-BAKE corpus L2 byte-for-byte | `src/lib/prism/codegen/prompts.ts` |
| **L3** (per node) | node spec + optional hydrated skill bodies (≤800 tokens) | `buildPerNodePrompt` + `skill-registry.ts` |

## Documents

- `RUNTIME-SURFACE.md` — **GENERATED** from the runtime source
  (`scripts/pcp/extract-runtime-surface.mjs`; verify with `--check`). The
  complete callable ctx surface + mount contracts. Never hand-edit.
- `DESIGN-PLAYBOOK.md` — DL1–DL16 operationalized, W-DG1 numeric doctrine
  (WHY + number per rule), anti-slop MUST-FIX triggers, 6 committed
  code+frame exemplars.
- `DEPENDENCY-CATALOG.md` — allow/deny per node class; the pre-gate's
  human-readable source of truth.
- `ASSET-SERVICES.md` — FLUX / Tripo3D call recipes (the shipped W-BG /
  W9A paths); generate-vs-primitives decision rule.
- `skills/` — Amendment-A deep guides, retrieved per node class
  (`src/lib/prism/codegen/skill-registry.ts`): `tsl-layer-renderers`,
  `postprocessing-chain`, `gsap-motion-doctrine`.

## Proofs

- Regeneration: run the extractor twice → byte-identical (I-P2); CI check
  is a vitest (`tests/unit/wpcp-runtime-surface.test.ts`).
- OD7 byte-stability: L1+L2 hashed across 100 simulated node calls → one
  hash (`tests/unit/wpcp-prompt-compiler.test.ts`,
  `notes/verification/wpcp/byte-stability.json`).
- Value: the D6 before/after probe (`notes/pcp-probe/`) — old L1 vs PCP on
  the 20 frozen W-BAKE visual specs, per-model deltas in
  `notes/SHELL-WPCP-REPORT.md`.
