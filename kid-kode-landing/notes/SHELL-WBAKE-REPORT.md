# SHELL W-BAKE — Three-Axis Model Bakeoff Report

**Wave:** PRISM-WBAKE (spec §11 + OD12) · **Authority:** `docs/prism/RATIFICATION-2026-07-09.md` · **Dates:** 2026-07-09 → 2026-07-10
**Nature:** measurement wave. Every number below traces to a committed artifact under `kid-kode-landing/notes/bakeoff/` (I-B3). No production config was touched (I-B1).

---

## 1. D0 — Spec v0.2 amendment (first commit of the chain)

Commit **`2499651b`** (`shell-wbake D0`):

- `docs/prism/PRISM-SWARM-DISPATCH-SPEC.md` footer/status → **"v0.2 — RATIFIED 2026-07-09 per RATIFICATION-2026-07-09.md"**; OD1–OD7 dispositions applied inline in §12 (one line each, marked RATIFIED). Spec body otherwise untouched.
- `docs/prism/PRISM-SWARM-DISPATCH-AMENDMENT-B.md` created — OD8–OD13 verbatim from the ratification record, marked RATIFIED 2026-07-09.
- `docs/prism/SPEC-INDEX.md` — swarm-dispatch status line updated, citing the record (founder sign-off for this edit = the record itself).

The ratification record and the WBAKE chain prompt were committed in the same commit as chain authority.

## 2. D1 — Corpus construction + freeze proof

Commit **`359d1eca`** (`shell-wbake D1`), authored ONCE before any contestant call (I-B2):

- **Functional corpus** (`notes/bakeoff/corpus/functional/`): 50 node specs from the Nova Atelier reference plan — 33 derived via the certified `authorNode` path + 17 disclosed extras; stratified **30 simple / 15 moderate / 5 complex**, 9 integration-bearing (≥8 required). Prompts: `L1 = SHARED_SYSTEM_PROMPT` verbatim, ONE compiled L2 WORLD block (content-hashed `worldHash`), per-case frozen L3 strings.
- **Visual corpus** (`notes/bakeoff/corpus/visual/`): 20 hero/visual node specs, **8 genuinely 3D** (camera, lighting, materials, motion; ≥6 required). Full visualSpecs authored once by the Fable 5 design-director pass with concrete values (hex ramps, type scale, spacing rhythm, camera+light params, material refs, cubic-bezier curves, contrast minimums); $3.91 ledgered, transcripts committed.
- **Freeze proof:** sha256 freeze manifests committed with the corpus. `git diff 359d1eca..HEAD -- notes/bakeoff/corpus/` = **0 lines**, working tree clean — zero post-freeze edits, so no runs were invalidated. The corpus regenerator reproduces the frozen corpus byte-identically (commit `aac8835b`).

## 3. D2 — Axis 1: functional first-pass verification (spec §11)

Commit **`6113ded4`** (`AXIS 1 CLOSED`). 10 ratified contestants; identical L1+L2+L3 per node; 3 runs per node, temperature per model card default; verification through the **shipped** `src/lib/prism/codegen/verifier.ts::verifyNodeModule`, NO repair in the primary pass. Raw generations, verifier logs and metrics: `notes/bakeoff/runs/axis1/` (`verify-metrics.json` is the graded rollup).

### Reachability (proof committed per model)

| Contestant | Route | Status |
|---|---|---|
| Claude Haiku 4.5 | claude CLI (founder-authenticated) | RAN (150/150) |
| Claude Sonnet 5 | claude CLI | RAN (150/150) |
| GLM-5.2 | Fireworks | RAN (150 attempted, 42 transport errors → 108 graded) |
| DeepSeek V4-Flash | Fireworks | RAN (150 attempted, 35 transport errors → 115 graded) |
| Kimi K2.7 Code | Fireworks | **TRUNCATED at 7 graded** — Fireworks account suspended mid-lane (HTTP 412) |
| gpt-oss-120b (open control) | Fireworks → **Groq** (dual-homed mid-wave) | RAN (150 attempted, 13 transport errors → 137 graded) |
| Gemini 3.5 Flash | DeepInfra | **BLOCKED-402** (unfunded; reprobed, proof in `runs/axis1/gemini-3.5-flash-BLOCKED.json`) |
| MAI-Code-1-Flash | none found | **UNREACHABLE** (proof committed) |
| GPT-5-nano | none found | **UNREACHABLE** (proof committed) |
| Mercury 2 | none found | **UNREACHABLE** (proof committed) |

No OpenRouter key exists on this machine (`.constellation/` absent — checked again 2026-07-10); no Anthropic API key, Google, OpenAI, Azure, or Inception credentials. Cerebras + DeepInfra keys exist but return 402 (founder console actions D-01/D-02 from W-PROD still pending).

### Axis 1 metrics (first-pass rate = primary; graded through the shipped verifier)

| Model | Graded | First-pass | By run (spread) | Simple | Moderate | Complex | Parse raw / fence-strip | p50 / p95 wall | Cost per node | Top violations |
|---|---|---|---|---|---|---|---|---|---|---|
| **claude-haiku-4.5** | 150 | **88.0%** | .90/.84/.90 (0.06) | 94.4% (n=90) | 80.0% (n=45) | 73.3% (n=15) | 0.02 / 1.00 | 77.5s / 115.6s | $0.0489¹ | GLB_LOADER 9, TEXT_CONTENT 5 |
| **kimi-k2.7-code** | **7 ⚠** | 85.7%-of-7 | .67/1/1 (0.33) | 85.7% (n=7) | — (n=0) | — (n=0) | 0.43 / 1.00 | 46.8s / 62.4s | $0.0284 | CLEANUP 1 |
| **glm-5.2** | 108 | **76.9%** | (0.083) | 78.2% (n=78) | 76.0% (n=25) | 60.0% (n=5) | 0.14 / 0.95 | 90.2s / 103.9s | $0.0367 | TEXT 9, GLB 7, PARSE 5 |
| **gpt-oss-120b** | 137 | **72.3%** | (0.052) | 75.3% (n=85) | 73.7% (n=38) | 50.0% (n=14) | 1.00 / 1.00 | 17.9s / 68.1s | **$0.0016** | TEXT 17, GLB 13, CLEANUP 9 |
| **claude-sonnet-5** | 150 | **60.0%** | .62/.56/.62 (0.06) | 45.6% (n=90) | **82.2%** (n=45) | **80.0%** (n=15) | 0.32 / 1.00 | **14.0s / 21.6s** | $0.0499¹ | TEXT_CONTENT 55 |
| **deepseek-v4-flash** | 115 | **59.1%** | .49/.60/.71 (0.22) | 62.0% (n=71) | 51.5% (n=33) | 63.6% (n=11) | 0.00 / 0.99 | 19.5s / 45.0s | $0.0038 | TEXT 27, GLB 10, WINDOW 6 |

¹ Claude-lane costs are **subscription-equivalent** (computed from CLI-reported usage at published API rates) — the CLI bills against the founder's subscription, not metered dollars. Claude-lane wall times include a small constant CLI harness envelope (~2K tokens), disclosed; p50 wall for haiku includes CLI startup and is not transport-comparable with raw-API lanes.

**Reading the table honestly:**
- **haiku-4.5 is the first-pass leader at full coverage (88.0%)** with the lowest complex-tier drop.
- **sonnet-5's 60.0% is dominated by a single simple-tier failure cluster**: 55 MISSING_TEXT_CONTENT hits. Inspection of the raw generations (e.g. `runs/axis1/claude-sonnet-5/f-01-simple-r1.json`) shows sonnet **does** render real MSDF text via `ctx.fontAtlas` — but it **hardcodes the copy inline** instead of iterating `config.textContent`, which the shipped verifier (and spec §10.C L385) correctly rejects: node copy must stay data-driven or regeneration breaks. A real, narrow, highly repair-able habit (see repair table) — moderate 82.2% and complex 80.0% are the strongest of any model.
- **kimi-k2.7-code's 85.7% is 7 nodes** — the Fireworks suspension killed the lane (HTTP 412, mid-run). Not comparable; reported as truncated, never extrapolated.
- **gpt-oss-120b is 30× cheaper than the Claude lanes** at 72.3% and the only model with 100% raw parse (no fences ever).

### Repair-loop depth (separate single-repair-allowed pass on first-pass failures)

| Model | Attempted | Fixed at depth 1 | Still failing | Transport-blocked |
|---|---|---|---|---|
| claude-haiku-4.5 | 5² | 5 | 0 | 0 |
| claude-sonnet-5 | 19² | 19 | 0 | 0 |
| gpt-oss-120b | 0 | 0 | 0 | **14** (Fireworks suspension hit the repair pass; relabeled honestly) |
| glm-5.2 / deepseek / kimi | — | — | — | repair pass blocked by the same suspension |

² Repair targets = **run-1 verification failures** (one repair call per failing node from run 1, frozen repair prompt identical across contestants; `run-axis1.mjs --repair`), not all 3 runs' failures — coverage disclosed.

---

## 4. D3 — Axis 2: design quality (OD12a)

**Method.** Every reachable contestant executed the SAME 20 frozen visualSpecs, 2 runs per node, identical L1+L2+L3 (the shipped system prompt verbatim). Renders go through the **real runtime mount path** — `/bakeoff-lab` executes each esbuild-CJS module against the app's own `three/webgpu` / `three/tsl` / `gsap` instances via `mountFromGraphSource` + `registerCodeRef`, under the frozen case's camera/light rig. Frames are captured blind (contestant names never reach the judge), fresh page per capture, WebGL2 fallback (W-2D capture discipline), fixed 2500ms settle. A deterministic dependency pre-gate (import scan vs the allowlist) records violations as automatic MUST-FIX before judging; unparseable/untransformable generations are unrenderable **scored artifacts** (their fallback/blank frames are judged as-is — the honesty gate; nothing retouched).

**Contestant coverage note.** Only 3 of the 6 Axis-1-reachable contestants could run Axis 2: the Fireworks suspension (anomaly 1) removed glm-5.2, deepseek-v4-flash, and kimi-k2.7-code before their visual lanes started. gpt-oss-120b ran on Groq with a 4096-token completion cap (anomaly 3). The Axis-2 table is therefore **claude-haiku-4.5 · claude-sonnet-5 · gpt-oss-120b**, and the §6.2 design-quality evidence for the three Fireworks-hosted models is declared MISSING, not guessed.

**Judge.** Fable 5 (vision), blind comparative per-case batches (all contestants' frames for one case ride one call), few-shot region-anchored rubric built from Design Law DL1–DL16 + two committed grammar-harvest exemplars as calibration anchors, 0–100 score + enumerated MUST-FIX defects (flat voids, all-black buttons, default-blue drift, dead lighting, broken spatial composition, blank renders). Deterministic merges on top: dep-gate violations and recorded `moduleRuntimeError`s.

**Pass 2 (authoritative).** Pass-1 scoring was invalidated for text by the WebGL2 text blackout (anomaly 5 — instrument blind spot, proven by probe). After the lab-side fix, **all frames were re-captured and fully re-judged**; the numbers below are pass 2. Pass-1 artifacts are archived (`frames-pass1-textblind/`, `judge/axis2-pass1-textblind/`) and remain part of the evidence trail.

**[AXIS-2 TABLE + 3D/2D SPLIT — FILLED FROM aggregate.json]**

## 5. D4 — Axis 3: critic agreement (OD12b)

**Method.** Golden set = 30 renders spanning the quality range: 24 sampled evenly across the pass-2 D3 score distribution (contestant + case diversity caps) + the 6 seeded known-bad renders (deliberate DL violations, proven end-to-end through the runtime). Every golden frame is downscaled once to an identical 800px JPEG so ground truth and every critic judge the **same pixels** through their differing transports (CLI `Read` vs base64 data URLs) — disclosed. Ground truth = Fable 5, TWO independent passes, same rubric module as the D3 judge (one rubric everywhere); per-render final = mean of pass scores + union of MUST-FIX; **pass disagreement measured and disclosed, never smoothed**. Critics run the per-node micro-loop shape (one frame per call — production-realistic; clean per-critique cost + latency).

**Candidate pool at run time (anomaly 8):** Claude Sonnet 5 (claude CLI) ran; Gemini 3.5 Flash (DeepInfra 402) and Qwen3.7-Plus (Fireworks 412) were transport-blocked with committed reprobe records. The selection rule (cheapest candidate with Spearman ≥ 0.85 AND MUST-FIX detection ≥ 90%) is therefore evaluated over a **one-candidate pool** — whatever the outcome, the founder should read it as conditional until the two blocked candidates can be measured on funded routes.

**[AXIS-3 TABLE + SELECTION OUTCOME — FILLED FROM aggregate.json]**

## 6. §6.2 winner-per-tier proposal

**[FILLED AFTER AXES 2–3 CLOSE]**

## 7. Cost ledger totals

**[FILLED FROM ledger-merged.json]**

## 8. Disclosed anomalies

Chronological; none softened (I-B4).

1. **Fireworks account SUSPENDED mid-wave (HTTP 412, monthly spend cap)** — killed the kimi-k2.7-code Axis-1 lane at 7/150 graded, blocked all Fireworks gap-fills and the non-Claude repair passes, removed Qwen3.7-Plus (vision) from the Axis-3 candidate pool, and forced gpt-oss-120b's Axis-2 lane onto Groq (same open weights, dual-homed; disclosed per-run). Founder notified during the wave (commit `6b5e735c`).
2. **claude CLI cwd contamination (fixed before scoring)** — spawning the CLI from the repo cwd injected ~28–30K tokens of project context into every Claude-lane contestant call (prompt purity + ~10× cost). ALL Claude lanes were redone from a clean-room cwd at effort=low (≈ API default, no extended thinking); the contaminated pilot is quarantined under `runs/pilot-dirty-envelope/` and was never scored.
3. **Groq TPD ceiling** — the on_demand tier's 200K tokens/day cap (verbatim 429 body committed: "Limit 200000, Used 198589") blocked the last 7 gpt-oss Axis-2 generations on 2026-07-09 night; a paced retry loop back-filled them when the window freed. Additionally the 8K-TPM tier forced `max_tokens: 4096` for the whole gpt-oss Axis-2 lane (Claude lanes ran at the CLI default) — **7 of 40 gpt-oss generations truncated at the 4096 ceiling**, an acknowledged comparability handicap for that lane.
4. **Session cut mid-judging (2026-07-09 23:18)** — the founder-subscription model window closed while D3 batch-015 was in flight; the judge's error path auto-scored 2 gpt-oss v-15 blank-frame renders NO_RENDER=0 although frames existed. On resume the entries were removed (backup committed) and the case re-judged as a full comparative batch. Superseded by the pass-2 re-judge (anomaly 5) but disclosed as part of the pass-1 history.
5. **THE BIG ONE — WebGL2 text blackout in the capture instrument (found + fixed + re-measured 2026-07-10).** The product's `createText()` deliberately returns an **invisible placeholder Group** on WebGL2 canvases (`three-msdf-text-webgpu`'s NodeMaterial only compiles on WebGPU — `src/lib/prism/runtime/shared/text.ts`), and the capture rig must run the WebGL2 fallback (headless WebGPU screenshots are blank/dithered — W-2D). Net effect: **every contestant's text — including correct `ctx.fontAtlas.createText(content, opts)` calls — was structurally invisible to the design judge in pass 1.** Proven with a hand-authored harness probe through the real lab path (`notes/bakeoff/probes/text-probe/`): correct-signature calls rendered zero glyphs before the fix and crisp glyphs after. Fix: the lab (dev-only route) injects a WebGL2-compatible TSL median-of-RGB MSDF factory via the existing `createFontAtlas({ msdfTextFactory })` seam — same BMFont atlas, same call contract, zero production-path changes (`src/app/bakeoff-lab/webgl2-msdf-text.ts`). All contestant frames were **re-captured and fully re-judged (pass 2)**; pass-1 frames and judge artifacts are archived untouched under `renders/frames-pass1-textblind/` and `judge/axis2-pass1-textblind/` (I-B3). Fidelity caveat: the lab factory's AA is a smoothstep band, so very small glyphs read slightly softer than the true WebGPU renderer; presence, content, scale, color, and placement are faithful. **Product finding that outlives the bakeoff:** any real user on a WebGL2-fallback device gets NO flat-MSDF text from this factory path today — same family as the W8 "extruded-text" workaround; belongs on the founder decision list.
6. **The shipped L1 prompt under-specifies the text API** — it says "render text content from config.textContent via ctx.fontAtlas" but never documents the callable surface (`createText(content: string, opts)`). Contestants guessed: object-first arg shapes, hallucinated `createTextMesh` imports from `@/text`, `ctx.fontAtlas(...)` called as a function. These are real failures under the shipped contract (the same prompt production uses), but a one-line signature in L1 would likely lift every model's text success — cheap prompt fix, big effect; recommended for the dispatch wave.
7. **Blocked/unreachable coverage (Axis 1 §3 table):** Gemini 3.5 Flash BLOCKED-402 (DeepInfra unfunded, reprobed live at critic time too), MAI-Code-1-Flash / GPT-5-nano / Mercury 2 UNREACHABLE on every available route (proof files committed). No OpenRouter key exists on this machine (`.constellation/` absent), so the ratified "else OpenRouter" fallback was unavailable — disclosed rather than substituted.
8. **Axis-3 candidate pool degenerate** — of the three ratified critic candidates, Gemini 3.5 Flash (DeepInfra 402) and Qwen3.7-Plus (Fireworks 412) were transport-blocked at run time; only Claude Sonnet 5 could be measured. The selection is therefore conditional (see §5) and the two blocked candidates carry honest BLOCKED records with reprobe timestamps.

## 9. Judge verdicts (verbatim)

**[APPENDED AFTER BOTH JUDGES RUN]**

## 10. Founder sign-off gate

This table is a **PROPOSAL**. Nothing routes until Logan signs. Per spec §11.5 and the ratification addendum, W-DISPATCH fires only after the founder signs the completed §6.2 evidence table; `PrismDispatchConfig`, cascade order, provider wiring, and runtime model selection are untouched by this wave (I-B1).
