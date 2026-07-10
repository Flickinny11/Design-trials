# W-PCP D6 — before/after probe (method record)

**Question:** does the PCP (L1 v2: generated runtime surface + dependency
gate + design doctrine) move runtime-crash rate, design mean, and MUST-FIX
rate on the 20 frozen W-BAKE visual specs — per model, old L1 vs PCP?

## Arms (I-P3: differ ONLY in the prompt layers)

- `prompts/old/l1-system.txt` — the W-BAKE L1 (`SHARED_SYSTEM_PROMPT_V1`),
  **verified byte-identical** to the frozen corpus L1 by
  `scripts/pcp/emit-prompt-sets.mjs` (hard-fails otherwise). sha256 `957bd0f7…`.
- `prompts/pcp/l1-system.txt` — L1 v2 pulled from the LIVE compiler module
  (`src/lib/prism/codegen/prompts.ts` via esbuild bundle). sha256 `cf334e01…`.
- **L2 is byte-copied to BOTH arms** (the frozen corpus WORLD block) — a
  deliberate single-variable design: the measured delta is attributable to
  L1 v2 alone. L3 = the frozen per-case `l3` strings, untouched.

## Contestants + transport

- `claude-haiku-4.5` — claude CLI (founder-authenticated), `--effort low`,
  clean-room cwd `/tmp/wbake-clean` (the W-BAKE envelope discipline),
  subscription-equivalent costs from CLI `total_cost_usd`.
- `gpt-oss-120b` — **Fireworks** serverless, `max_tokens 12288`, metered.
  The wave prompt named Groq (the only funded route at authoring time,
  Fireworks then 412-suspended). At probe time Fireworks was UN-SUSPENDED
  (`probe-fireworks-gpt-oss.json`, HTTP 200) and serves BOTH arms identically
  without Groq's 8K-TPM/4096-completion truncation or the 200K TPD ceiling
  that cost W-BAKE five generations of coverage. Groq liveness also probed
  and committed (`probe-groq-gpt-oss.json`). Same route + same max_tokens for
  both arms preserves I-P3.

2 runs per case per arm per model = 160 generations.

## Discipline (verbatim from W-BAKE pass 2)

- Real runtime mount path: `/bakeoff-lab` executes esbuild-CJS'd modules
  against the app's own three/webgpu + tsl + gsap via `mountFromGraphSource`
  + `registerCodeRef`, under the frozen case camera/light rig.
- W-2D capture: WebGL2 fallback (navigator.gpu undefined initScript), FRESH
  page per capture, fixed 2500ms settle, blind frames.
- Deterministic dependency pre-gate before judging; unparseable/
  untransformable generations are unrenderable SCORED artifacts.
- Judge: Fable 5, comparative per-case batches — all 8 frames of a case (2
  arms × 2 models × 2 runs) in ONE call, W-BAKE pass-2 rubric + the same 2
  calibration exemplars. **Blinding upgrade over W-BAKE:** frames are
  pre-copied to anonymous hash-ordered paths (`judge/blind/…/F<k>.png`), so
  the judge's Read paths cannot leak arm or contestant (W-BAKE's judge
  prompt embedded contestant-named paths). The per-batch `mapping.json` is
  committed for audit; it never enters the judge prompt.
- Crash = frame meta `probe.moduleRuntimeError` present (module THREW at
  `createNode` in the real runtime) — the W-BAKE §4 definition.

## Budget

HARD CAP $30 (wave prompt #16), enforced as 4 × $7.50 per-lane caps
(per-lane ledgers `ledger-<arm>-<model>.json`; concurrent lanes would
clobber one file) + `ledger-judge.json`. Merged totals in `metrics.json`.

## Artifacts

- `runs/<arm>/<model>/<case>-r<n>.json` — raw generations + usage + cost
- `bundles-index.json` (bundles under
  `notes/bakeoff/renders/bundles/pcp-probe/` so the existing dev-only lab
  route serves them unchanged)
- `frames/<arm>--<model>/<case>-r<n>.{png,meta.json}`
- `judge/batch-*.json` (transcripts), `judge/blind/*/mapping.json`,
  `judge/scores.json`
- `metrics.json` — the delta tables, recomputed only from the artifacts above
