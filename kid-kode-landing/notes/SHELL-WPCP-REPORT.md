# SHELL W-PCP — Prism Crash-Course Package Report

**Wave:** PRISM-WPCP · **Authority:** `docs/prism/RATIFICATION-2026-07-09.md` + the W-PCP wave prompt · **Date:** 2026-07-10
**Nature:** instruction-layer wave. Additive only (I-P1): no routing, no config, no cascade changes — `PrismDispatchConfig` untouched (verified by diff, §7). The PCP changes WHAT models are told, never WHICH model runs. Evidence basis: SHELL-WBAKE-REPORT §6 (~57% of visual-corpus runtime crashes from the undocumented ctx API surface) + §4 (design starvation: best one-shot mean 16/100, 100% MUST-FIX).

---

## 1. D1 — Runtime surface: generated, drift-proof, embedded in L1 v2

**Generator:** `scripts/pcp/extract-runtime-surface.mjs` parses the ACTUAL runtime declarations with the repo's TypeScript compiler API — `NodeContext` (adapter.ts), `LoaderCacheHandle` (loaders.ts), `FontAtlasHandle`/`TextOpts` (text.ts), primitive call shapes + per-primitive params extracted from the real `params.*` reads in each implementation, `NodeDrivers`, `mountFromGraphSource`/`MountGraphOpts`, and the codeRef contracts (`registerCodeRef`/`resolveCodeRef`/`buildPerNodeFactory`). Two outputs:

- `docs/prism/pcp/RUNTIME-SURFACE.md` — the complete callable surface + mount contracts + the config-shape reality (config IS the PrismNode; text at `config.intent.visualSpec.textContent`; the verifier-compatible bridging idiom).
- `src/lib/prism/codegen/runtime-surface.generated.ts` — the compact `RUNTIME_SURFACE_L1_BLOCK` (one-line signature + micro-example per call) that L1 v2 embeds. Signature strings are interpolated from the SAME AST extraction — never hand-typed (I-P2).

**Regeneration proof (I-P2):** run twice → byte-identical (sha256 `2a3535ee…` for the doc, `28038a29…` for the block, identical across runs; recorded in the D1 commit). `--check` mode regenerates in memory and diffs against the committed files; it is wired as a CI-style vitest (`tests/unit/wpcp-runtime-surface.test.ts`) so any runtime-surface edit that isn't regenerated fails the suite.

**Instrument alignment (disclosed companion fix):** the shipped verifier's `MISSING_GLB_LOADER` rule accepted ONLY `ctx.glbLoader.load(` — the exact spelling that CRASHES at runtime (the real surface is `loadGLB`; `.load(` guesses were the largest W-BAKE crash cluster). The regex was widened to accept both spellings — additive (strictly more correct programs pass; everything that passed before still passes), 3 new tests, the full 53-test verifier+prompt suite green.

## 2. D2 — Design playbook (contents map + token counts)

`docs/prism/pcp/DESIGN-PLAYBOOK.md` (~12.4 KB) — the full doctrine; `DESIGN_DOCTRINE_L1_BLOCK` (`src/lib/prism/codegen/pcp-blocks.ts`) is the always-on distillation riding L1 v2.

| Playbook section | What it operationalizes |
|---|---|
| §1 three-question gate | run / match-the-spec / be-alive — the judged reality |
| §2 DL1–DL16 table | per-node directive + WHY + the exact MUST-FIX trigger each law fires |
| §3 numeric doctrine | W-DG1 distillation: palette (stage band `#0b0b10→#16161d`, one accent ≤10% of frame, contrast ≥4.5:1), type (bimodal scale 0.62/0.34/0.20/0.13/0.09 em, ASCII-only), spacing (0.25-unit rhythm, hub frame x∈[-3.5,3.5] y∈[-3,2.5] @ fov50 z10, subject 55–70% frame), lighting (3-point, node-local rim ≤1.5, emissive cap 2.3, metal-needs-reflection), materials (card caps roughness≥0.5/metalness≤0.55/clearcoat≤0.25; glass transmission+ior+back-rim recipe), motion (weighted-settle 1.04→1.0/0.9s/power4.out, press 0.97/120ms, hover ≤6°, NOTHING LINEAR) — every rule carries a WHY and a number |
| §4 anti-slop | the 11 MUST-FIX defects in the judge's verbatim vocabulary, each with its fix |
| §5 exemplars | 6 committed code+frame pairs (below) |
| §6 per-class directives | hero-3d / editorial-type / card-panel / gallery / nav-cta / empty-state |

**Worked exemplars (all halves committed):** W9A watch atelier hero (`src/lib/prism/atelier/watch-node-factory.ts` + `notes/verification/shell-w9a/w9a-desktop-01-hero.png`); W-TPL meridian / cascade / ledgerline / folio (`src/lib/templates/catalog/*.ts` + `notes/verification/shell-wtpl/hero-*.png`); and the CONTRAST pair — sonnet's v-03 glass prism r1 (58/100, the W-BAKE corpus best, still 4 MUST-FIX) beside its own r2 sibling (5/100, crashed on hallucinated `createTextMesh`) — the one-shot ceiling and the crash cluster in a single case.

## 3. D3 + D4 — Dependency catalog, asset services, skill registry + seed guides

- `docs/prism/pcp/DEPENDENCY-CATALOG.md` — the deterministic pre-gate's human-readable truth: the 5-source allowlist with exact import forms, versions in force (`three` ^0.184.0, `gsap` ^3.15.0, `three-msdf-text-webgpu` ^2.1.0 — never imported directly), hard denials (each observed as a real generation failure), and class-conditional notes per renderMode.
- `docs/prism/pcp/ASSET-SERVICES.md` — exact call recipes: the shipped W-BG FLUX pipeline (composition → depth-anything-v2 → filmic grade → baked plates, with the proven negative-prompt/Replicate-transport/PBR-derivation gotchas), the W-PHOTO R2 composite path, Tripo3D text/image→3D (version-suffix + no-face_limit + optimize-glb), and the generate-vs-primitives decision rule.
- `docs/prism/pcp/skills/` + `src/lib/prism/codegen/skill-registry.ts` — Amendment-A Subsystem-E skeleton: E1 entry shape (id/name/affordance/signature/nodeClasses/family/bodyPath/version; `SKILL_REGISTRY_VERSION` as a worldHash input), class-keyed retrieval hook (`classifyNode` → `selectSkillsForNode`, E6 one-per-family), E2 two-stage disclosure (`buildSkillIndexBlock` for L2 — names+affordances+signatures only; `hydrateSkillBodies` for L3 under the E4 800-token budget with LOGGED truncation). Three seed deep guides, each teaching usage inside the Prism runtime with allowlist-correct snippets: `tsl-layer-renderers.md`, `postprocessing-chain.md`, `gsap-motion-doctrine.md`. Amendment A remains DRAFT — the L2 skill-index section is OFF by default so the ratified five-class WORLD rule stays intact; seeding was explicitly authorized by the wave prompt.

## 4. D5 — Wiring + byte-stability + token report

**Live path.** `src/lib/prism/codegen/prompts.ts::SHARED_SYSTEM_PROMPT` (the constant `buildCodegenPrompt` ships on every codegen call — regen route, editor regen, conductor authoring) is now **L1 v2**: the V1 constraint body byte-preserved (frozen as `SHARED_SYSTEM_PROMPT_V1`; the probe verified it byte-identical to the W-BAKE corpus L1) + the generated runtime surface + the dependency gate + the design doctrine, OUTPUT contract restated last. `buildWorldBlock(input)` is the L2 WORLD template — **it reproduces the W-BAKE frozen corpus L2 byte-for-byte from the Nova Atelier input** (test-proven), so the live template IS the ratified five-class shape.

**Byte-stability (OD7, wave prompt #12).** L1+L2 hashed across 100 simulated node calls in one build context (nodes varying subtype/renderMode/copy): **1 distinct sha256** — `a19dc809b7a50c1e8c2b32b1c1dbc3299a19ed8245cdc84f3063f6a393097ea2`. Evidence: `notes/verification/wpcp/byte-stability.json` (written by the test itself); independently recomputable via `npx vitest run tests/unit/wpcp-prompt-compiler.test.ts`.

**Token report (wave prompt #13).**

| Layer | Bytes | est. tokens (bytes/4) | provider-tokenizer ground truth |
|---|---|---|---|
| L1 v1 (old) | 1,367 | ~342 | old-arm full prompt (L1+L2+L3) mean **2,220 tokens** (Fireworks usage, n=40) |
| **L1 v2 (live)** | **7,625** | **~1,906** | pcp-arm full prompt mean **3,926 tokens** (n=40) → **L1 v2 costs +1,706 tokens over V1** |
| L2 WORLD (Nova) | 3,366 | ~842 | within the ratified 2–3K typical / 5K hard cap |

L1 v2 lands at **~2.0K provider tokens — 17% of the ≤12K target**; nothing was trimmed to fit.

## 5. D6 — Before/after probe: method + deltas

**Method** (full record: `notes/pcp-probe/README.md`): the 20 frozen W-BAKE visual specs, 2 runs per case per arm per model = 160 generations. Arms differ ONLY in L1 (I-P3): `old` = `SHARED_SYSTEM_PROMPT_V1` (verified byte-identical to the frozen corpus L1 by `emit-prompt-sets.mjs`, which hard-fails on drift); `pcp` = L1 v2 pulled from the LIVE compiler module via esbuild bundle. **L2 byte-copied to both arms** — single-variable design; the delta is attributable to L1 v2 alone. L3 = the frozen per-case strings. Same mount path (`/bakeoff-lab` → `mountFromGraphSource` + `registerCodeRef` against the app's own dependency instances), W-2D capture discipline (WebGL2-fallback initScript, fresh page, 2500 ms settle), deterministic dep pre-gate, blind Fable-5 judge with the W-BAKE pass-2 rubric + the same 2 calibration exemplars, all 8 frames of a case in ONE comparative call.

**Two disclosed deviations from the letter of the wave prompt (both honesty-positive):**
1. **gpt-oss route = Fireworks, not Groq.** The prompt named Groq because Fireworks was 412-suspended at authoring time. At probe time Fireworks was UN-SUSPENDED (probe committed: `notes/pcp-probe/probe-fireworks-gpt-oss.json`, HTTP 200; Groq's liveness probe also committed). Fireworks serves BOTH arms identically at `max_tokens 12288` — no Groq 8K-TPM/4096-completion truncation and no 200K-TPD ceiling (which cost W-BAKE 5 generations of coverage). Result: 80/80 gpt-oss generations, zero transport errors.
2. **Judge blinding upgraded.** The W-BAKE judge's prompt embedded contestant-named frame paths; in this probe a path would leak the ARM (the treatment). Frames are pre-copied to anonymous hash-ordered paths — identical 800px JPEGs per the W-BAKE golden-set discipline (also what keeps 20 8-frame vision batches inside the $30 cap; the full-res v-01 smoke batch measured $1.57 and is archived: `judge/batch-v-01-…-fullres-archived.json`). Per-batch `mapping.json` committed for audit; never enters the judge prompt.

### Delta tables (recomputed from committed artifacts by `scripts/pcp/probe-metrics.mjs`)

<!-- WPCP-DELTA-TABLES -->

### API-surface usage scan (deterministic grep over raw generations, `notes/pcp-probe/api-usage.json`)

<!-- WPCP-API-SCAN -->

## 6. Cost ledger

<!-- WPCP-LEDGER -->

## 7. Honest anomalies

<!-- WPCP-ANOMALIES -->

## 8. Judge verdicts (verbatim)

<!-- WPCP-JUDGES -->

## 9. What W-BAKE-B inherits from this wave

<!-- WPCP-INHERIT -->
