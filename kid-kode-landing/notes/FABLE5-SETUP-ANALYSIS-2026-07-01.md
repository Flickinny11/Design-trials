# Fable 5 — Harness Setup, Codex Diagnosis, Spec Comparison & Readiness

**Author:** Claude Fable 5 (lead orchestrator, CLI session)
**Date:** 2026-07-01
**Branch:** `codex/prism-recovery-harness-20260630` @ `b9647169`
**Scope:** setup + diagnosis + recommendation only. No product features built.

---

## 0. TL;DR

- **Harness is launch-ready on Fable 5.** Proven, not asserted: `run-surface.sh`
  resolves `MODEL=claude-fable-5`; the model-guardrail now permits Opus **and**
  Fable; no agent pins a `model:` so verification subagents inherit Fable 5
  vision; and `prism-autonomy-preflight.mjs` returns **exit 0 / CLEAR** on the
  current tree.
- **Codex left the workspace at "verified complete, unmerged, unsigned."** On
  2026-06-30 Codex quarantined the 06-29 spec drift + the rejected vertical
  toolbar, hardened the preflight, released CHAIN-STOP on Logan's instruction,
  then ran W3→W4→W5 to a green finish. Nothing is broken or half-built.
- **Against the (guarded) spec, the 5 completion goals are met and verified**
  per `WS-W5-REPORT.md`. The remaining items are **decisions, not code**: founder
  signoff of the spec, and a branch/merge call.
- **Recommended first "go": a fresh whole-workspace RE-VERIFICATION on Fable 5**
  (verify-only, no rebuild) to re-establish the golden loop with Fable 5 vision
  and produce evidence dated today. Exact launch command in §4.

---

## 1. Harness status on Fable 5 (tested)

### 1.1 What the bridge changed (reviewed — kept)
| File | Change | Verdict |
|---|---|---|
| `run-surface.sh:17` | `MODEL="${HARNESS_MODEL:-claude-fable-5}"` (was `claude-opus-4-8`) | **Correct.** Default is Fable 5; `HARNESS_MODEL` env can still override per-run. |
| `.claude/hooks/model-guardrail.sh:55` | rule-3 regex `^claude-(opus\|fable)-` (was opus-only) | **Correct.** Permits Fable pins, still blocks Sonnet/Haiku. |

Both pass `bash -n`. Backups exist (`*.bak-20260701-091716`).

### 1.2 What I added this session
- **Synced the vestigial model pins.** `.claude/.harness-model` and
  `.claude/.ralph-model` still read `claude-opus-4-7`. They are **only** read by
  archived drivers (`kid-kode-landing/scripts/archive/{harness,ralph,kickoff-loop}.sh`)
  — the live sentinel does **not** read them — but I set both to
  `claude-fable-5` so a future operator isn't misled. Backups saved.
- **Cosmetic:** guardrail reject message now says "approved Opus/Fable variant".

### 1.3 Model wiring — end to end
- **Sentinel model:** `run-surface.sh` `launch()` and `session_open()` both call
  `--model "$MODEL"` → `claude-fable-5`. Verified resolution with no
  `HARNESS_MODEL` in env or shell profiles (`~/.zshrc`/`~/.zprofile`/`~/.bashrc`
  all clean).
- **Orchestrator:** `run-ws-chain.sh` calls `./run-surface.sh` with no
  `HARNESS_MODEL`, so the phase inherits the Fable-5 default. **`run-ws-chain.sh
  → run-surface.sh` will launch Fable 5.**
- **Subagent inheritance:** headless `claude -p … --model claude-fable-5` spawns
  `user-advocate` + `prism-criteria-reviewer` with the parent model **unless** an
  agent `.md` pins `model:`. Audited all 5 agent files in `.claude/agents/` — none
  pin a model. **The verification judges get Fable 5 vision.** The guardrail
  actively prevents re-introducing a `model:` pin.
- **CLI:** `claude` v2.1.185 at `/Users/loganbaird/.local/bin/claude`; Fable 5
  reachable (bridge probe `PROBE_OK`).

### 1.4 Sentinel integrity (unchanged, re-read & sound)
- **Circuit breaker:** `MAXRESUMES=10`, exit 3 on cap without a terminal marker.
- **v4 completion rule:** exit 0 requires **latched report/run-log marker AND
  `agents()==0`** (lines 65-68) — a report-rewrite race can't churn resumes.
- **Probe-before-resume:** `session_open()` gates each relaunch on a live
  `Say OK` probe; closed window → wait 900s.
- **Preflight-before-launch:** `launch()` runs `prism-autonomy-preflight.mjs`
  first; a block returns 99 and notifies (Basso).
- **Notifications:** `osascript` + optional `.notify-webhook` (absent → local
  Mac notifications only).

### 1.5 Launch-readiness — PROVEN
`node kid-kode-landing/scripts/prism-autonomy-preflight.mjs --prompt
PRISM-WS-W5-PROMPT.md --spec …/PRISM-WORKSPACE-COMPLETION-SPEC.md` → **exit 0,
"CLEAR: preflight passed."**

| Gate | Result |
|---|---|
| repo-root, chain-stop, guard-files (11) | PASS |
| real-editor-root (root `/` not wired to editor-shell) | **PASS** — protected editor intact |
| spec-intent (prompt + spec) | PASS |
| galaxy-semantics | 6/6 PASS (1 intentional `global-hub-missing` WARN) |
| global-shell | 6/6 PASS |
| rejected-toolbar (not wired) | PASS |
| remote-assets / worktree | WARN (non-blocking) |

`spec-intent-check.mjs` also passes standalone (exit 0).

---

## 2. Where Codex left off + what was wrong

### 2.1 Reconstructed 2026-06-30 timeline (from commit dates + quarantine notes)
| Time | Event |
|---|---|
| ~16:56 | Rejected vertical toolbar quarantined → `_QUARANTINE_DRIFT/rejected-toolbar-2026-06-30/` |
| ~17:17 | Contaminated 06-27 workspace spec quarantined; guarded replacement written at live path |
| 17:36 | `CODEX-RECOVERY-HANDOFF-2026-06-30.md` written — *"next step is NOT W-3; resolve dirty worktree; CHAIN-STOP remains active"* |
| 17:58 | **CHAIN-STOP released** on Logan's instruction ("keep the recovery moving while I'm away") |
| 18:44 | `67f78a86` WS-W3 — unified per-node agent (first slice) |
| 19:12 | `f228eb48` WS-W4 — galaxy semantics verify-and-finish |
| 19:44 | `a79d0b3b` WS-W5 — whole-workspace verification COMPLETE |
| 19:47 | `ddc36008` — recovery-harness bundle committed (handoff docs, quarantine, new hooks, re-authored W3/W4/W5 prompts) |
| 22:54 | `b9647169` — galaxy overview projection (reduce node clutter) |

### 2.2 What was wrong (the two failures Codex cleaned up)
1. **Planner/spec drift (2026-06-29).** The 06-27
   `PRISM-WORKSPACE-COMPLETION-SPEC.md` was contaminated with **Claude-authored,
   non-founder** ideas: (a) "retire the real `/` editor," (b) "click-to-edit from
   Preview," (c) "rebuild Galaxy as a directory," (d) per-node "capability
   glyphs." All four are explicitly listed as forbidden drift and quarantined at
   `_QUARANTINE_DRIFT/contaminated-workspace-spec-2026-06-30/`.
2. **Rejected vertical toolbar.** A prior Claude session wired
   `VerticalChassisToolbar` into `CanvasToolbar` (`src/components/editor/glass-toolbar/**`);
   the visible result (magenta buttons, wrong side) was rejected.

### 2.3 What Codex fixed
- Unwired the toolbar: `CanvasToolbar.tsx:90/832` now imports/renders
  `LiquidGlassToolbar` again. **Verified:** `VerticalChassisToolbar` has **0
  references in active `src/`**; the rejected files live only in quarantine.
- Quarantined the contaminated spec; wrote a **guarded replacement** grounded to
  the real editor (self-declares "does not carry founder signoff").
- Added the **autonomy preflight** + hooks (`completion-gate`,
  `destructive-action-guard`, `intent-lock-gate`, `no-remote-asset-gate`) and
  `.claude/INTENT-LOCK.md` / `HARNESS-DRIFT-PREVENTION.md`.
- Then ran W3→W4→W5 green after CHAIN-STOP release.

### 2.4 Is the branch clean & mergeable?
- **Committed state:** clean and self-consistent; preflight passes; protected
  editor intact; rejected toolbar quarantined.
- **Uncommitted worktree (attributed):**
  - `run-surface.sh`, `model-guardrail.sh` (+ my pin/message edits) — **today's
    Fable-5 setup**; should be committed to make the pin durable.
  - `.mcp.json` (kv server removed) + `.kripverify.json` (deleted) — dated
    **2026-06-29**, and the kv binary at
    `/Users/loganbaird/Code/kripverify/mcp-server/dist/index.js` is **MISSING**,
    so this is **correct KripVerify decommissioning cleanup**, not a regression.
    (The live golden loop uses `chrome-devtools` MCP + Playwright + node gate
    scripts — kv is not required.)
  - `.vite/vitest/results.json`, `notes/MONITOR-FEED.md`, `notes/SENTINEL-LIVE.md`,
    `notes/verification/fix1/*` — sentinel/test runtime artifacts.
- **No stale stop files block a launch:** `EDITOR-EXP-STOP` (06-18) and
  `PHASE3-STOP` (06-22) are legacy phase markers the sentinel/preflight do **not**
  consult; **no `CHAIN-STOP`** exists. Recommend clearing the two stale STOP files
  for hygiene (optional; not a blocker).
- **Not merged to `prism-main`.** All recovery + W-work sits on
  `codex/prism-recovery-harness-20260630`. Merge is a founder decision.

---

## 3. Spec vs current verified state

Guarded spec: `kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`.
Verified state: `kid-kode-landing/notes/WS-W5-REPORT.md` (PASS, 2026-06-30) +
today's preflight.

| Spec goal | Status | Evidence |
|---|---|---|
| **1. Preserve & verify existing editor** | **DONE/verified** | WS-W5 proofs: galaxy nav, canvas surgical edit, save/reload, watch app runs from `.prism`; root editor surface (toolbar, keyframe, inspector tabs, library, gizmo, node agent) confirmed present. `real-editor-root` gate PASS. |
| **2. Finish Galaxy semantics** | **DONE/verified** | 148 overview nodes, 179 collapsed (107 shell + 72 hit-target); backgrounds hub-owned; 6/6 hubs have overview content; `b9647169` added component-atom projection (56 first-level from 148). galaxy 6/6 PASS. |
| **3. Root editor capability surfaces** | **DONE/verified** | W1/W2 Functions/Integrations/Data + purpose surfaces live in the **root** editor Inspector (WS-W5 resolves the open question). Reference-only auth; secret-grep clean. |
| **4. Unified per-node agent** | **First slice DONE** | W3: prompt-edit ≡ self-heal share one validated-plan engine (`lib/prompt-edit/node-agent.ts`) → `applyPlan`; Node Agent panel, accept/reject + per-node undo, trust signal. **Not yet covered:** media-generation requests, integration/data attachment *via the agent*, multi-select, clarifying questions. |
| **5. Generic app loading** | **DONE/verified** | WS-W5 proof #6: a distinct Prism graph loaded via `graphSource.load(json)` (renamed app + hubs), 0 errors. |

**Forbidden-drift list — all honored:** no smaller editor shell; no authoring
from Preview; no Galaxy rewrite; no status-badge system; no stock-icon toolbar;
no remote editor-chrome assets; no hardcoded watch artifacts outside graph data;
no full rebuild for a surgical edit; no raw secrets; no launch from unchecked
prompts. Preflight + hooks enforce these at launch time.

**Is the spec correct & ready for signoff?** The guarded spec is well-grounded to
the real code and its goals match what shipped. Two caveats for the founder:
1. It **self-declares no founder signoff** — that is the gating decision.
2. It is a **pre-run snapshot**: its "Next Safe Phase: W3" section is now stale
   (W3–W5 already completed). Goals 1-3 & 5 are done; Goal 4 is a first slice with
   a clear remainder. On signoff, either mark it "goals met, verify-only" or amend
   Goal 4 to scope the agent's remaining surface.

---

## 4. Readiness + recommended first "go"

### 4.1 Are we ready to resume on Fable 5? **Yes** — with two founder decisions.
The harness is proven launch-ready on Fable 5 and the workspace is verified
complete. Nothing is broken. What's open is governance, not engineering.

### 4.2 Blockers for Logan/founder (not code)
1. **Spec signoff.** The spec has none. Verification can run without it; a **new
   feature build** (deepening Goal 4, or Goal 5 hardening) should wait for signoff
   to avoid re-drift.
2. **Branch/merge decision.** Keep building on
   `codex/prism-recovery-harness-20260630`, or merge to `prism-main` first?
   (Merge/force-push to main is in the narrow-set — needs Logan's explicit yes.)
3. **Minor hygiene (optional):** two dev servers are live (`:3000` + `:3001`,
   PIDs 12044/65688) — pick one; clear stale `EDITOR-EXP-STOP` / `PHASE3-STOP`.

### 4.3 Recommended first "go" — Fable-5 whole-workspace RE-VERIFICATION (verify-only)
**Why this, not a feature build:** WS-W5 verified the workspace on the
**claude-opus-4-8 substitute** while Fable was down. The single highest-value,
lowest-risk first move is to re-run the same whole-workspace verification **on
Fable 5**, so (a) the golden loop is re-established with Fable 5 vision in the
`user-advocate` + `prism-criteria-reviewer` judges, (b) we get evidence dated
today that the mock app runs correctly on the Prism runtime under the model Logan
wants, and (c) a green pass is the natural trigger for spec signoff + the merge
call. It matches WS-W5's own instruction ("re-verify only on revisit — do not
rebuild") and touches **no source**.

**At "go" time, author** `PRISM-WS-VF-PROMPT.md` (verify-only brief: run
`prism:recovery-gate` on the chosen port, `typecheck:gate`, live node-authorship,
and the 7 real-Chrome/WebGPU proofs from WS-W5; capture frames under
`notes/verification/ws-vf/`; end with the completion marker), then launch:

```bash
cd /Users/loganbaird/Prototype_Prism/Design-trials
HARNESS_MODEL=claude-fable-5 ./run-surface.sh \
  WS-VF \
  "$PWD/PRISM-WS-VF-PROMPT.md" \
  "$PWD/kid-kode-landing/notes/WS-VF-REPORT.md" \
  "PRISM-WS-VF: RUN COMPLETE" \
  "PRISM-WS-VF: BLOCKED-NEEDS-FOUNDER"
```

(`HARNESS_MODEL` is explicit for the record; the default is already
`claude-fable-5`. The sentinel runs preflight first, launches one headless Fable-5
build, does its liveness/heartbeat watch, and exits 0 on marker-AND-agents==0.)

**Required evidence for a valid PASS (mirrors WS-W5):**
- `prism:recovery-gate` ALL PASS (verify:prism + repair-loop + galaxy +
  global-shell) and `typecheck:gate` **0-new**;
- live node-authorship **9/9** on the chosen port, 0 page errors;
- 7 real-Chrome/WebGPU proofs (galaxy nav; canvas surgical edit; node-editor↔canvas
  sync via `textSpec.content`; preview-app boots ORRERY No.7; save→reload
  preserves; generic `graphSource.load()`; **0 console errors**), frames under
  `notes/verification/ws-vf/`;
- `user-advocate` + `prism-criteria-reviewer` fresh-context judges PASS on Fable 5.

### 4.4 If Logan wants NEW capability instead (after signoff)
First real build slice = **deepen the unified per-node agent (Goal 4)**: the
remaining surface the W3 first slice did not cover — media-generation requests,
integration/data attachment *through the agent*, multi-select scope, and
clarifying-question flow — all through the existing validated-plan engine
(`applyPlan`), accept/reject + per-node undo preserved. Same sentinel command
shape with a `WS-*` phase name and a spec-cited prompt that passes preflight.

---

## 5. Cost note (Fable 5)
Fable 5 is ~2× cost and burns fast. The golden contract already minimizes spend:
one headless run per "go," sentinel watches cheaply (30s polls, no model calls
except the tiny `Say OK` resume probe), and the orchestrator hands off rather than
babysitting. Keep it that way — don't hand-build or sit watching a run.
