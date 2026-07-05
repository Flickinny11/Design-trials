# Prism / KripTik — Session Handoff (2026-06-07): "Unstuck → building → entering ultracode"

## HOW TO USE THIS DOC
Paste this whole file into a **NEW chat IN THE SAME PROJECT** (the Prism / diffusion-app
project) to continue seamlessly. The new session will have: the project knowledge (specs),
Desktop Commander access to EVERYTHING on disk, very likely claude-mem of this work
(project-scoped), and this doc as the map. **First action for the new session:** check the
running ultracode pilot (see STATE), independently re-verify, show Logan the gallery, gate on
his GO/NO-GO for the full 300. Then continue the pattern below.

## WHO / HOW WE WORK
- Logan = non-coding founder building Prism. He DIRECTS; he does NOT code. ALL coding/work is
  done by Claude (via Desktop Commander on his Mac) + Claude Code (Opus 4.8). Never hand Logan
  code or jargon; he reviews via SCREENSHOTS and plain-language summaries.
- THE PATTERN (do not break it): write a self-contained Claude Code prompt → launch it headless
  on Logan's Mac → monitor the log/files → INDEPENDENTLY re-verify (read the report AND view the
  screenshots yourself) → report to Logan in plain language with screenshots → gate on his
  approval → checkpoint (git commit) → next step. Logan checks in with "check"/"status"; you pull
  status. One gated step at a time. Honest pushback welcome. Keep momentum.

## EXECUTION MECHANICS (critical)
- Claude Code CLI: `/Users/loganbaird/.local/bin/claude` (v2.1.159).
- Launch (headless, background) — exact pattern that works:
  `cd /Users/loganbaird/Prototype_Prism/Design-trials && unset NODE_ENV && nohup /Users/loganbaird/.local/bin/claude -p "$(cat ./PROMPT.md)" --model claude-opus-4-8 --permission-mode bypassPermissions --output-format text > ./run.log 2>&1 & echo "LAUNCHED_PID=$!"`
- ALWAYS pin `--model claude-opus-4-8` (NEVER opusplan → silent Sonnet fallback). ALWAYS
  `unset NODE_ENV` (a stray NODE_ENV=production breaks `next dev`; also guarded in ~/.zshrc).
- Monitor: `ps -p <PID> -o stat,etime`; report file appears when done; text output flushes to
  the log only at the very end. Don't run TWO browser-driving sessions at once (Chrome/dev-server
  contention) — sequence them.
- View screenshots: Desktop Commander read_file caps at 1MB → resize first:
  `sips -s format jpeg -s formatOptions 75 -Z 1100 <png> --out /tmp/x.jpg` then read /tmp/x.jpg.
- Checkpoint commits: `git add -A; git reset -q -- <exclusions>; git commit --no-verify -m "..."`.
  ALWAYS EXCLUDE: kid-kode-landing/public/prism-assets/mock-app.prism,
  kid-kode-landing/notes/ralph-state.json (+ its backups),
  kid-kode-landing/notes/live-graph.json.*backup*, kid-kode-landing/notes/verification/**/backups,
  and .claude/worktrees (embedded repos; the "embedded git repository" warnings are HARMLESS —
  the reset keeps them out of the commit; verify with `git ls-files | grep worktrees` = empty).

## THE VERIFICATION LOOP (/prism-verify) — already built; USE it every step
Loads the app in REAL Chrome → (1) functional: console/DevTools (chrome-devtools MCP) +
structural assertions; (2) vision + interaction: screenshot, JUDGE the look, CLICK/DRAG/type/
build like a user, confirm behavior not just paint (KripVerify `kv_*` + Claude in Chrome).
EVIDENCE-BASED done (never "I added it"). FIX-DON'T-SKIP. ANTI-STUCK: after ~2 fails on a
criterion, web-search the CURRENT correct approach, root-cause, retry; NEVER downgrade a
dependency or take the easy/old path. Fresh-context `prism-criteria-reviewer` subagent signs
off; MUST-FIX blocks done. Guard = PreToolUse dependency-allowlist + forbidden patterns (NO
stock icon libs, NO PixiJS/2nd renderer, NO diffusion-drawn text, NO dependency downgrades,
NO global-fps) + modern spec-criteria Stop hook (feedback, not looping). Ralph loops are
RETIRED (archived).

## THE PLAN / ARC
Hardened specs (anchor + canonical-3) → drift-prevention + verification system (replaced Ralph)
→ FOCUSED steps to build the prototype's core → ULTRACODE for the breadth (the 300-primitive
catalog first, then other big spec pieces) → eventually the engine/harness. We complete the
canvas spec using ultracode + the verification loop, gating each move with Logan.

## STATE (branch prism-editor-build) — checkpoints in git log, newest last:
876d603 specs+safety · 611daa3 step4 foundation · d1486ca step5 edit-path · 63cafd5 step6
faithful-build · f9020db step7 drivers · 30ab792 step8+8.5 toolbar+icons+full-width-keyframe ·
8c3654a step8.6 icons-3D.
DONE: renders clean (one `three`, crash killed) · 3 modes (galaxy=spheres / canvas+preview-app=
built from cache; states of ONE scene, no rebuild on toggle) · edit→save→rebuild→verify works
(per-node, caption-driven repair) · faithful build (artifacts at their NODE'S OWN schema
position — never external layout) · drivers (scroll/pointer/state/event motion plays) · premium
Canvas toolbar (Transform/Selection/Build WIRED; Add/Image/3D/Text/Animation-picker/Lighting =
designed placeholders awaiting their subsystems; keyframe editor slides out FULL-WIDTH) · custom
3D-premium icons everywhere (no stock libs; guarded).
RUNNING NOW: the ULTRACODE PILOT — claude PID 78754 · log ./ultracode-pilot-run.log · report →
kid-kode-landing/notes/ULTRACODE-PILOT-REPORT.md · shots → kid-kode-landing/notes/verification/
ultracode-pilot/. Builds ~24 animation primitives in parallel against the Animatable+Driver
contract, each verified, ending in a GO/NO-GO for the full 300.

## THE CONCEPT (full version in PRISM-INTENT-ANCHOR.md + project knowledge)
Prism = 3D node-based app builder; this prototype is ONLY the preview pane of the future builder.
Nodes ARE UI elements in dormant form (spheres in galaxy) containing artifact+code+animations+
schema+position. Hubs = pages; the `global` hub = shared elements. Three modes are STATES of one
cached scene. **LOAD-BEARING RULE:** a built artifact's position/behavior/animation come ENTIRELY
from the node's OWN schema/code — the build only REALIZES the node; nothing is placed or laid out
from outside (moving an element in Canvas = the user AUTHORING that node's scenePosition). Node
editor = purpose/backend/functions (image/video/3D show in its "visual" section; code-based only
when built); VISUAL editing is in Canvas. NO stock icons ever (custom, 3D, premium). Toolbar =
the comprehensive suite per PRISM-CANVAS-EDITOR-SPEC.md.

## KEY ARTIFACTS ON DISK (under /Users/loganbaird/Prototype_Prism/Design-trials/)
- PRISM-INTENT-ANCHOR.md (the ruler).
- kid-kode-landing/docs/prism/: PRISM-RUNTIME-SPEC.md, PRISM-NODE-EDITOR-SPEC.md,
  PRISM-CANVAS-EDITOR-SPEC.md (canonical-3), SPEC-INDEX.md, archive/ (superseded specs).
- Step prompts (STEP4..STEP8_6, ULTRACODE-PILOT) + reports (kid-kode-landing/notes/STEP*-REPORT,
  ULTRACODE-PILOT-REPORT). AUDIT_REPORT.md. This handoff.

## IMMEDIATE NEXT ACTION (new session, start here)
1. Check the ultracode pilot (PID 78754 / log / report). When done: read the report + VIEW the
   gallery screenshots (resize→jpeg); independently confirm the primitives render + play.
2. Report to Logan in plain language WITH the gallery; give your honest read on the GO/NO-GO.
3. Gate: Logan GO → checkpoint the pilot → build the full 300 via ultracode IN BATCHES, same
   verification. NO-GO → fix what the pilot exposed first. ultracode is now APPROVED for the
   catalog; keep the verification loop on it. After the catalog: Text System, material/lighting,
   media pipeline, and wiring the deferred toolbar groups — ultracode or focused as fits, Logan
   approves each.

## REASSURANCE (for Logan)
The real state lives ON DISK (git checkpoints + specs + reports + the whole verification system)
and is re-readable via Desktop Commander — almost nothing critical lives only in chat context.
Project knowledge holds the specs; claude-mem (project-scoped) likely holds this work; this doc is
the map. Continuity is safe. A new session in THIS project picks up exactly here.

---

## UPDATE — 2026-06-08 (LATEST — this supersedes the "STATE" + "IMMEDIATE NEXT ACTION" above)

### Catalog build is COMPLETE: 312 / 300 primitives
pilot 24 + batch1 66 + batch2 63 + finish-run 159. Every build wave first-try, 960 unit tests
green, tsc baseline held (0 new). Git checkpoints exist through `66f2cd3` (=153/300). The
finish-run's 159 are STAGED, NOT yet committed.

### A finish-run is STILL RUNNING (serial verify — the slow tail)
claude PID 38827 · log ./catalog-finish-run.log · verify log
kid-kode-landing/notes/verification/catalog-finish-verify.log · final report →
kid-kode-landing/notes/CATALOG-FINISH-REPORT.md (not written yet). It is in the FINAL BROWSER
verification pass, rendering/playing each of the 312 in ONE headless Chrome, SERIALLY (~40/312
as of this update, ~1–2/min → multi-hour tail). Resumable (writes CATALOG-PROGRESS.md + the
verify log + stages files); not stuck.

### ON ULTRACODE — answered honestly (Logan asked, correctly, whether we're really using it)
- BUILD: YES, real ultracode. `kid-kode-landing/notes/catalog-batch-workflow.mjs` runs
  `parallel(...)` with ONE Opus subagent PER primitive, ~20 concurrent per wave. That concurrency
  is real and is why the build was fast.
- VERIFY: NO — it's a serial single-browser script. THIS is the bottleneck. The verification was
  never parallelized.
- **DIRECTIVE for the new session:** parallelize the VERIFICATION — multiple concurrent browser
  contexts / verify subagents (same `parallel()` pattern as the build) so browser/art/glass
  checks are also ultracode-speed. This is the top process fix.

### IMMEDIATE NEXT ACTION (new session — start here)
1. Check the finish-run (PID 38827 / verify log / report). RECOMMENDED: don't wait hours on the
   serial verify — stop it, checkpoint the BUILT 312 (src is stable; only a few flagged
   primitives get verify-fixes, e.g. one fade variant play=false), then RE-RUN verification in
   PARALLEL (concurrent browser contexts) — far faster and is the ultracode fix Logan wants.
   (If you prefer, let the serial run finish — it's resumable — but parallel is the better path.)
2. When verification is complete + clean: independent re-verify (gallery + fresh glass real-GPU
   frames; resize PNG→jpeg via sips to view), then CHECKPOINT the complete 300+ catalog.
3. Build the PARALLEL verification harness as a focused step (the ultracode-for-verify upgrade).
4. Then the next big pieces, ultracode-for-breadth / focused-for-depth, Logan approving each:
   bind real MSDF text into the text animations · material + lighting systems · wire the toolbar's
   deferred groups (Image/3D/Text/Animation-picker/Lighting) · art-polish pass (clear-glass needs a
   backdrop in preview tiles + the ~5 minor nits from batch reports).

### Cleanup note
There may be orphaned `claude --output-format` processes from earlier runs (e.g. PIDs 21043 /
21730) — safe to `kill` if idle. Also the usual: a leftover `next dev` server may linger after a
run; tidy it.

### Pattern (unchanged — keep following it)
write self-contained prompt → launch headless `claude -p --model claude-opus-4-8`
(`--permission-mode bypassPermissions`, `unset NODE_ENV`, run from git root) → monitor log/PID →
INDEPENDENTLY re-verify (read report AND view screenshots) → report to Logan in plain language
with screenshots → gate on his approval → checkpoint (git commit, with the standard exclusions) →
next. Logan checks in with "check". Use ultracode (concurrent agents via the workflow `parallel()`)
for BUILD breadth AND — now — for VERIFY.
