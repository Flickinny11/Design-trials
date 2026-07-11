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

All 160 generations completed with **zero transport errors** and all 160 bundles were renderable (no unrenderable artifacts — the Fireworks 12288 budget removed the truncation failure mode entirely). Old-arm haiku replicates W-BAKE's measured 80% crash rate exactly — a strong validity signal for the harness.

**Per-lane metrics** (n=40 renders each; design 0–100 vs the frozen visualSpecs, blind Fable-5):

| Lane | Design mean ± sd | Runtime-crash rate | MUST-FIX rate | Mean MUST-FIX/render | Top defects |
|---|---|---|---|---|---|
| old / claude-haiku-4.5 | 10.6 ± 10.1 | **80.0%** (32/40) | 100% | 4.5 | MISSING_SPEC 38, FLAT_VOID 33, RUNTIME_ERROR 32, BLANK 25 |
| **pcp / claude-haiku-4.5** | **15.9 ± 13.2** | **30.0%** (12/40) | 100% | 4.5 | MISSING_SPEC 38, FLAT_VOID 30, BROKEN_COMP 27, DEAD_LIGHTING 21 |
| old / gpt-oss-120b | 7.3 ± 4.0 | **100%** (40/40) | 100% | 4.5 | RUNTIME_ERROR 40, MISSING_SPEC 36, FLAT_VOID 34, BLANK 32 |
| **pcp / gpt-oss-120b** | **9.3 ± 7.8** | **85.0%** (34/40) | 100% | 4.7 | MISSING_SPEC 37, FLAT_VOID 35, RUNTIME_ERROR 34, BLANK 28 |

**Deltas (pcp − old):**

| Model | Design mean | Crash rate | MUST-FIX rate | 3D subset mean | 2D subset mean |
|---|---|---|---|---|---|
| claude-haiku-4.5 | **+5.3** (10.6→15.9, +50% rel.) | **−50 pts** (80%→30%) | 0 (100%→100%) | 14.8→19.0 | 7.9→**13.8** (+75% rel.) |
| gpt-oss-120b | **+2.0** (7.3→9.3) | **−15 pts** (100%→85%) | 0 | 9.8→13.7 | 5.6→6.4 |

**Reading it honestly:**
- **The crash-cluster kill is real and total where it was aimed.** The W-BAKE §6 cluster (~57% of crashes = ctx API-surface guesses) is **eliminated in the PCP arm for both models**: wrong loader spellings 11→0, `createTextMesh` hallucinations 25→0 across both models (scan table below). Haiku's crash rate drops 80%→30% — survival past `createNode` went from 8 renders to 28.
- **Design moves but does not one-shot.** MUST-FIX stays 100% (as it did for every W-BAKE contestant, including sonnet). The gain is composition-shaped: PCP frames build stages, plinths, contact shadows, and depth planes where old frames were tiny-subject-in-void; haiku's 2D-layout subset jumps 75% relative. **5 of the probe's 6 best renders are PCP-arm.** New failure modes surfaced by survival: exposure control (blown-white key lights), BROKEN_COMPOSITION from more ambitious scenes — the doctrine's next iteration targets.
- **gpt-oss is instruction-limited, not information-limited.** Its PCP arm uses every documented call correctly (39/40 `createText`, 0 hallucinations) yet still crashes 85%: the residual clusters are gsap default-import interop under the lab shim (14) and NodeMaterial-import confusion the L1 explicitly warns against (12) — it reads the surface but ignores the import discipline. The PCP lifts what instruction can lift; the OD11 vision micro-loop + repair remains load-bearing for this model class (consistent with W-BAKE's conclusion).
- Old-arm gpt-oss crashed 40/40 here vs W-BAKE's 71%: W-BAKE's Groq lane truncated 8/35 generations into unrenderable artifacts (scored ≤4 without executing) and its 9 unrenderables never reached `createNode`; on Fireworks@12288 every module parses, executes, and crashes honestly. Same model, instrument with fewer masks.
- Survivor-quality cut: haiku non-crashed renders average 22.0 (n=8, old) vs 20.2 (n=28, pcp) — per-survivor quality held while the survivor pool tripled; the mean gain is real capability recovered, not judge drift.

### API-surface usage scan (deterministic grep over raw generations, `notes/pcp-probe/api-usage.json`)

| Marker (of 40 gens/lane) | old/haiku | pcp/haiku | old/gpt-oss | pcp/gpt-oss |
|---|---|---|---|---|
| `ctx.textureLoader.loadTexture(` (real) | 0 | **7** | 0 | **7** |
| `ctx.textureLoader.load(` (crash) | 8 | **0** | 5 | **0** |
| `ctx.glbLoader.loadGLB(` (real) | 0 | **3** | 0 | **4** |
| `ctx.glbLoader.load(` (crash) | 3 | **0** | 0 | **0** |
| `ctx.fontAtlas.createText(` (real) | 15 | **36** | 10 | **39** |
| `createTextMesh` (hallucination) | 9 | **0** | 16 | **0** |
| `config.textContent` (data-driven copy) | 4 | 4 | 13 | **25** |

Every crash-cluster spelling goes to ZERO in the PCP arm, for both models. Runtime-crash clusters (from per-frame `moduleRuntimeError`, deterministic): old-arm = the W-BAKE taxonomy verbatim (`.load is not a function` ×15, `createTextMesh is not a function` ×5, `fontAtlas.render` guesses, TSL-import confusion ×12); pcp-arm residuals = gsap default-import interop under the lab CJS shim (20 across models — see anomaly 3), NodeMaterials reached via `ctx.THREE`/`three/tsl` against the explicit L1 warning (15, dominated by gpt-oss), config-shape edge guesses (rest).

## 6. Cost ledger

Per-call ledgers committed under `notes/pcp-probe/` (per-lane files — concurrent lanes would clobber one file; merged by `probe-metrics.mjs`). HARD CAP $30 enforced in-process: generation lanes at $7.50/lane; the judge enforces the MERGED total with a $0.50 stop margin.

| Ledger | USD | Billing |
|---|---|---|
| old / claude-haiku-4.5 (40 gens) | $3.57 | subscription-equivalent (CLI `total_cost_usd`) |
| pcp / claude-haiku-4.5 (40 gens) | $4.31 | subscription-equivalent |
| old / gpt-oss-120b (40 gens) | $0.13 | metered (Fireworks, published rates) |
| pcp / gpt-oss-120b (40 gens) | $0.13 | metered |
| Fable-5 judge (21 batches: 20 blind + the archived full-res v-01 smoke at $1.57) | $15.92 | subscription-equivalent |
| **Total** | **$24.06** | **of the $30 hard cap — never breached** |

D2 exemplar and doc authoring used zero metered spend (all sources committed). The only other wave cost is the D5 token ground truth, which rode the probe's own generation calls.

## 7. Honest anomalies

1. **gpt-oss route ≠ the wave prompt's "(Groq)".** Disclosed in §5: Fireworks un-suspended by probe time (probe records committed for BOTH routes); running both arms on Fireworks@12288 removed the truncation/TPD confounds Groq imposed on W-BAKE. Both arms identical transport → I-P3 intact.
2. **The v-01 full-res judge smoke batch ($1.57) was archived and the case re-judged** under the uniform 800px-JPEG blind discipline, so all 20 cases are scored under identical pixels. The archived transcript (`judge/batch-v-01-…-fullres-archived.json`) stays in evidence; its spend stays in the ledger.
3. **gsap default-import interop is a lab-harness limitation, surfaced by survival.** `import gsap from 'gsap'` compiles (esbuild CJS) to a `.default` read that is undefined under the lab's require-shim (the shim serves the gsap object; the named form `import { gsap } from 'gsap'` works). This crash cluster (20 pcp-arm renders across models) exists in BOTH arms' harness — old-arm modules mostly died earlier on API-name errors, so it surfaces in the arm that survives past them. Production's native-import path has different interop; the honest statements are (a) arm-vs-arm comparison is unaffected (same shim), (b) the measured PCP crash reduction is therefore a LOWER bound (some pcp "crashes" are harness interop, not model error), (c) the L1's next iteration should pin the named import form — recorded in §9, deliberately NOT patched post-probe so the committed L1 v2 bytes remain exactly what the probe measured.
4. **`ctx.THREE` NodeMaterial reads.** The L1 v2 example (`const { Group, Mesh } = ctx.THREE`) was extrapolated by models to NodeMaterials, which live in `three/webgpu`, not the plain `three` namespace `ctx.THREE` exposes — 15 pcp-arm crashes. Same §9 next-iteration note; same no-post-probe-patch discipline.
5. **Haiku lanes were restarted once at higher concurrency** (3→5) ~25 minutes in, purely a wall-clock decision; records are skip-if-exists so no generation was redone or lost, and per-gen transport settings were unchanged. The killed processes' in-flight calls were regenerated.
6. **Claude-lane prompt-token ground truth is not observable via the CLI** (`usage.input_tokens` reports ~10 non-cached tokens; the real prompt rides cache-creation fields). The provider-tokenizer ground truth in §4 therefore comes from the Fireworks lanes; Claude-lane costs are per-call `total_cost_usd`, authoritative.
7. **Amendment A is still DRAFT** — the registry skeleton + guides were seeded under explicit wave-prompt authorization; the L2 skill-index section defaults OFF so the ratified five-class WORLD shape is unchanged (byte-proven by the corpus-reproduction test).
8. **W-BAKE's judge blindness had a path leak** (contestant-named directories inside the judge's Read paths — visible in its committed transcripts). It did not invalidate W-BAKE's spec-anchored scoring, but this probe's arm comparison required real blinding, so the probe pre-copies frames to anonymous paths. Flagged here so W-BAKE-B inherits the fix.

## 8. Judge verdicts (verbatim)

<!-- WPCP-JUDGES -->

## 9. What W-BAKE-B inherits from this wave

- **The instrument, aligned.** W-BAKE-B contestants generate under L1 v2 on the live compiler — the ~57% ctx-API crash cluster is no longer part of what the bakeoff measures, so axis-2 scores measure DESIGN, not API-spelling luck. The widened `MISSING_GLB_LOADER` verifier rule scores the real surface.
- **A drift-proof surface.** Any runtime-surface change regenerates into L1 automatically (`extract-runtime-surface.mjs --check` in the test suite) — W-BAKE-B never re-litigates "what does ctx expose".
- **Judge blinding.** The pre-blinded anonymous-path + uniform-JPEG discipline (probe-judge.mjs) replaces the path-leaking pattern for any future comparative judging.
- **Two measured L1 v2.1 refinements, ready to land as the first W-BAKE-B commit** (kept out of this wave so the probed bytes stay canonical): pin `import { gsap } from 'gsap'` (named form), and mark `ctx.THREE` as NodeMaterial-free (import NodeMaterials from `'three/webgpu'`). Both are one-liners in `pcp-blocks.ts`/the generator templates; both carry committed crash evidence.
- **The per-model reading for §6.2.** haiku-4.5 under PCP: 30% crash / 15.9 design mean — instruction-responsive, the moderate-tier pick strengthens. gpt-oss under PCP: correct API usage but 85% crash on import discipline — cheap-tier routing MUST assume the OD11 micro-loop + repair, and W-BAKE-B's simple-tier evaluation should weight repairability over first-pass polish.
- **The skill registry seam.** When Amendment A ratifies, `buildSkillIndexBlock` drops into the L2 template's optional section and `hydrateSkillBodies` rides L3 — no new wiring needed.
