# PRISM / ORRERY — SESSION HANDOFF (2026-06-22)

Read top to bottom before doing anything. Single source of truth for continuing this work. The FOUNDATION AUDIT session appends its findings at the very bottom.

## 0. WHO / HOW WE WORK
- Logan = non-coding founder of Prism/Kriptik. Directs ALL technical work through Claude; never writes code himself. Wants: decisive action, honest pushback (not validation), direct ownership of reversals, non-defensive accountability, and CURRENT info (training data ~1yr stale -> web-search/verify before asserting versions/tools/models).
- Claude in build sessions = MONITOR/ORCHESTRATOR ONLY. Deploy headless Claude Code "ultracode" agents via the sentinel harness, monitor a few minutes (agent alive on Opus, sentinel armed, producing commits, didn't die), then HAND BACK ("say check whenever"). Do NOT do build work from the chat (burns context). Logan drives with "go" / "check" / "continue" and gets macOS alerts as runs progress.

## 1. THE MISSION (critical framing)
The prototype is ONE SLICE of an AI app builder: the CANVAS EDITOR (Prism's replacement for the file-editor in other AI app builders) + the GALAXY view + the runtime infrastructure. It must be SHIPPABLE on its own BEFORE the separate prompt-to-build system (prompt -> image -> segment -> nodes -> built app) is integrated. Demo vehicle = ORRERY No.7, a mock luxury watch-manufacturer site built AS a 3D app running ON the Prism runtime, to show off the canvas editor (building + editing in 3D space). 6 hubs: s1-arrival, s2-movement, s3-materia, s4-celestia, s5-acquire, s6-atelier.

## 2. THE PRISM RUNTIME MODEL (memorize; hardened spec confirms it)
- The graph IS the app; the knowledge graph persists as the runtime, never compiled away.
- GALAXY = UNBUILT state of nodes. Planets = nodes = hubs (pages). Each hub's elements are ALSO nodes (smaller), tethered to that hub via parentHubId.
- PREVIEW/CANVAS = the BUILT artifacts: each node rendered as a built element in its 3D-space position; all of a hub's elements arranged = the shippable app for that page.
- BUILD IS PER-NODE (a key Prism benefit). Edit a node in canvas + save does NOT update preview until that node is REBUILT (build takes the edits/code and rebuilds that one node).
- Adding a node/element in canvas MUST add a node around that hub in galaxy. You CANNOT have an element in canvas/preview without a corresponding node in the galaxy.
- A node (unbuilt) holds: schema/caption, optional media (image/3D/video) or none or just code, 3D position, animations, integrations, functions.
- Headers/footers have their own GLOBAL node slots. 3D backgrounds are artifacts that are part of the hub's data.
- INVARIANTS (hardened spec): "Images are elements; code is behavior - code does NOT create UI elements." Nodes are self-contained (identity + caption + code + metadata, independently buildable). Bipartite DAG, not hub-and-spoke. Contamination-aware repair (delete broken code before regen; never feed broken code to repair). Contract-first.
- SCHEMA CURRENCY: every node's schema/caption MUST auto-update every time the node is modified (a small captioner). Perfect captions + always-current schemas are what let a COLD model jump into any node and know everything to fix/edit it. Core to the spec.
- Hardened spec doc: project file PRISM_ENGINE_BROWSER_BASED_SPEC ("Kriptik Diffusion Engine Production Build Spec v2.0", codename Prism, 2026-04-14). It describes the FULL prompt-to-build engine; the prototype is only the canvas-editor + galaxy + runtime SLICE.

## 3. THE ENHANCED HARNESS (CRITICAL - keep intact; this is what makes autonomous runs work)
NOT plain browser MCP, NOT KripVerify. Near-human computer/browser use driven by Opus 4.8 (1M ctx).
- ULTRACODE sessions: headless Claude Code, --model claude-opus-4-8 --permission-mode bypassPermissions, running INTERNAL parallel verified waves (reuse the parallel() pattern in kid-kode-landing/notes/catalog-finish-workflow.mjs); maximize ultracode, each subagent pinned to opus.
- SENTINEL (v4) = auto-resume + completion watchdog. Completion = MARKER STRING present in report AND agents==0 (v3 completed on bare file existence - fixed). Counter = pgrep -f '\.local/bin/claude -p' (old ps-grep read 0 on truncated arg lists -> endless relaunch - fixed). Confirmed-dead recheck before resume. Opus session probe. Cap 10. AUTO-RESUMES past the 5-hour subscription window (waits, resumes when it reopens). Persist-past-shell launch idiom: ( nohup "$CLAUDE" -p "$(cat PROMPT)" --model claude-opus-4-8 --permission-mode bypassPermissions --output-format text < /dev/null > RUNLOG 2>&1 & ). Each run = a sed-CLONE of run-sentinel-fidelity.sh (swap PROMPT/REPORT/STATUS/RUNLOG/MARKER/STOP names).
- OBSERVER = the sentinel's monitoring + MONITOR-FEED.md / ledger appends per wave; writes "Tell Claude: check" on completion.
- VERIFICATION LOOP (/prism-verify, .claude/commands/): driven by Chrome DevTools MCP computer-use (navigate_page, evaluate_script, list_console_messages, take_screenshot) - NOT Playwright, NOT KripVerify. (a) FUNCTIONAL: zero console errors + scene-graph assertions via evaluate_script. (b) VISION: screenshots judged vs criteria + DESIGN LAW. Plus tsc gate (scripts/typecheck-gate.mjs, 0 new vs baseline), art-fidelity reviewer (scripts/art-fidelity-review.mjs + vision), a fresh-context prism-criteria-reviewer subagent (MUST-FIX blocks done), and the COLD-LOAD GATE (restart dev fresh + FAIL if a pure cold load 404s its chunks / never clears the loader - added after a stale next-dev 404'd every chunk and looked like broken code; essential).
- TRANSIENT CAPTURE: time-based effects (transitions/explosions) need multi-frame capture (t=0/0.3/0.6/1.0); a single screenshot misses the peak.
- USER-ADVOCATE CAPSTONE (.claude/agents/user-advocate.md): judges AS A NON-TECHNICAL FIRST-TIMER from real frames - broken/misaligned/flat/laggy/does-not-read-as-claimed = MUST-FIX; "is this premium / does it beat Slider Revolution / would a first-timer find these animations intuitive and useful?"; pleased/indifferent/annoyed + WHY; verdict w/o cited evidence is INVALID. (Intended evolution: uses computer-use to actually USE + EDIT the prototype WITH the canvas editor, makes style judgments comparing to Claude Design, consults Claude Design + open code, uses the design_references.md + primitives styleguide.)
- ALERTS: runs fire macOS notifications (osascript -e 'display notification ... with title "..." sound name "Glass"') at wave boundaries + completion.
- FILES: .claude/commands/prism-verify.md; .claude/agents/{prism-criteria-reviewer,user-advocate,spec-reviewer,spec-researcher}.md; gate scripts kid-kode-landing/scripts/{typecheck-gate.mjs,art-fidelity-review.mjs,verify-catalog-parallel.mjs}; kid-kode-landing/notes/catalog-finish-workflow.mjs (parallel()); kid-kode-landing/notes/realagents.sh (corrected counter); .mcp.json (chrome-devtools + kv). Sentinel clones at repo root: run-sentinel-fidelity.sh (TEMPLATE), run-sentinel-phase{1,2,3}.sh, run-sentinel-audit.sh.

## 4. TRIGGERS / LAUNCH MODES
- "go" = default Opus-subscription mode (Opus-only, all quality hooks). UNTOUCHED.
- "go CONSTELLATION" = metered OpenRouter mixed-model rig (run-sentinel-constellation.sh; routing via .constellation/constellation-settings.json; orchestrator Opus, subagents Qwen3.x multimodal, small-fast DeepSeek; removes the weekly wall). Doc: CONSTELLATION-LAUNCH-MODES.md.
- "check"/"status" = report only, NEVER launch.
- Launch persists via ( nohup ./script < /dev/null > log 2>&1 & ) from a Desktop Commander start_process. Near-empty run.log is NORMAL (text-mode silent during tool use); progress = git commits + MONITOR-FEED.md + the per-run ledger. Agent launches ~3-4 min after arm (probe cadence).

## 5. THE DESIGN LAW (ONE direction - being consolidated into docs/prism/PRISM-MASTER-SPEC.md by the audit)
DOGFOODING: any technique good enough to offer customers must appear in Prism's own chrome. "Enough = not enough." Nothing flat, EVER. Tailwind-style = MUST-FIX. No stock icon libraries EVER. Evidence over assertion. TWO SURFACES:
- EDITOR CHROME (Prism's own UI - React, legitimately): toolbar = photoreal 3D LIQUID GLASS object that warps/bends with movement (NOT iOS liquid glass, NOT glassmorphism; shader/generated via design_references), volumetric depth + transparency + ambient refraction; buttons = photoreal 3D objects "sunk" into the glass, hover spins them 3-4 full end-over-end turns on the horizontal axis (accelerate on click, smooth decel), MOSTLY no text (tooltips on hover), a FEW as photoreal animated ENGRAVING; ICONS = ALL custom, 3D, colored, animated, gradients + shadows, tooltips - NEVER emoji, NEVER Lucide/line-icons/lightning-bolts/boxes; node editor = same liquid-glass base, tabs/sections as their own photoreal 3D objects, premium animated icons + tooltips, tab hover animations, volumetric depth + shadow + ambient light; keyframe editor = finish the started materials; integrate open-design experiments (soap-scum, bioluminescent material); NO grotesque fonts.
- APP CONTENT (the watch prototype - must be NODES): photoreal 3D objects generated via Tripo v3.1/Hunyuan (procedural only where unavoidable + documented), authored AS NODES; nothing flat; bar = beat the best Slider Revolution templates (morphing through-page 3D transitions, living interactive photoreal 3D backgrounds).
STYLEGUIDE (binding, OVER-use): docs/prism/DESIGN-REFERENCES.md (1066 lines, Awwwards toolkit) + docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md.
SOURCING unique materials: Claude Design + computer-use into Logan's local open-design app (enter prompts) + the 3D generators + the primitives.

## 6. ASSET GENERATION
Keys in .assetgen/ (gitignored, chmod 600): replicate.key ($REPLICATE_API_TOKEN, funded), tripo.key ($TRIPO_API_KEY, funded ~2320 credits). Best-model-PER-object, ALWAYS latest version (web-search slug if unsure):
- Tripo official API (api.tripo3d.ai/v2/openapi, Bearer): v3.1/P1, PBR + auto-rig + animation + part SEGMENTATION (swappable case/dial/bezel/hands/crown/movement). text_to_model + image_to_model. MULTI-VIEW input (front/side/top) for clean hard-surface (single-image -> depth hallucination + procedural fallback).
- Replicate (api.replicate.com/v1/predictions, Bearer): FLUX.2 textures/HDRIs, Hunyuan3D 3.0 Pro / TRELLIS 2 for 3D, video models for motion plates.
NEVER commit keys.

## 7. WINS (don't redo)
- Jun 10-12: basic Prism runtime + 3D space stood up FAST using Fable 5 (review those sessions for the runtime foundation).
- Phase 1 (Atelier): 8/8 criteria (drag-assemble, photoreal material swaps, orbit+loupe, caseback-flip, exploded, live price/save).
- Phase 2 (full photoreal scene): REAL Tripo v3.1 GLB watch parts (case/bezel/crown) - closed the procedural gap; living volumetric nebula across all 6 hubs; godray; Rapier physics (chip tumble); magnetic cursor (52 bindings); interactive 3D orrery complication (sun + 4 PBR planets on tilted rings + time-scrub); cold-load gate working; user-advocate PLEASED.
- Phase 3 (cinematic motion): completed - cinematic hub transitions, dramatic exploded view, day/night lume reveal, micro-response, cinematic camera language. CARRIED FLAG: the curtain transition shipped in Phase 2 as a DOM overlay (not a true in-WebGPU morph); Phase 3 was meant to fix it - verify it did.

## 8. FAILURES TO LEARN FROM
- Harness DRIFT kills agents: manual shell orchestration / ad-hoc loops caused dead-agent problems the established pattern didn't have. Verify harness integrity first; don't hand-roll loops.
- STALE next-dev: a desynced .next 404s every _next chunk; app sits on "INITIALIZING PRISM RUNTIME" with NO uncaught errors - looks broken but isn't. Fix: lsof -ti tcp:3000 | xargs kill -9; rm -rf .next; npm run dev. (Hence the cold-load gate.)
- MCP servers go unresponsive (Desktop Commander, chrome-devtools, the Chrome extension dropped at points) -> restart (quit/reopen Claude Desktop). When DC is down, Claude can still read /mnt/project/ via the view tool but cannot run commands / write Mac files / deploy.
- TOOTHLESS spec language produces slop. Specs need concrete per-surface checklists + a strict aesthetic-defect list that triggers MUST-FIX in the gates.
- THE BIG ONE (discovered 2026-06-22): polishing app content as React/Three SCENE COMPONENTS instead of authoring NODES drifts from the runtime - and leaves the canvas editor nothing to edit (can't test the editor). Quick signals: live-graph.json has ZERO schema fields; AtelierWatchRig/OrreryComplicationRig/VolumetricNebula/HubMorphTransition referenced 0x in the graph (likely hardcoded). The FOUNDATION AUDIT is scoping the full picture + fix.
- Claude's create_file/view/str_replace write to Claude's SANDBOX, NOT the Mac - use Desktop Commander write_file / start_process (or heredoc cat > file << 'EOF') for any Mac file.
- v3 sentinel bug (done on file existence) + ps-based counter bug (always 0 -> endless relaunch): both fixed in v4; propagate v4 to all future sentinels.
- MCP tools bind at session start; installing one mid-session has no effect - only a fresh session loads it.

## 9. THE PLAN TO GET UNSTUCK (foundation-first - current strategy)
We were stuck doing the LAST step (design polish) without the first ones. Correct order:
0. STOP adding app content as scene code - every app element goes through the node system (node + schema + tether + media/codeRef + caption).
1. FOUNDATION AUDIT (running now): every rendered element - node or hardcoded? schema/caption present (what field)? headers/footers nodes? backgrounds hub-data? schema-auto-update mechanism present? -> violations + severity. (Read-only.)
2. SPEC CONSOLIDATION (in the audit): inventory the 11 specs, kill the duplicate node-editor spec, merge design direction into ONE PRISM-MASTER-SPEC.md reconciled with the runtime model; archive the rest.
3. FIX: safe mechanical fixes applied now; the structural scene->node re-architecture written up as a REMEDIATION PLAN with "NEEDS GREENLIGHT" items for Logan (don't auto-refactor the foundation blindly).
4. THEN BUILD + TEST: redesign editor chrome (liquid-glass toolbar etc.) + finish the prototype's node-backed content, against a verified foundation + one spec - and finally TEST the canvas editor.

## 10. CURRENT STATE (2026-06-22 ~15:07)
- Phases 1, 2, 3 complete (git head: PHASE3: RUN COMPLETE).
- FOUNDATION AUDIT session DEPLOYED + running (run-sentinel-audit.sh, marker "PRISM-AUDIT: RUN COMPLETE", stop: touch AUDIT-STOP). Writes AUDIT-INTEGRITY-REPORT.md, AUDIT-SPEC-REPORT.md, AUDIT-REMEDIATION-PLAN.md, AUDIT-MASTER-REPORT.md, the consolidated docs/prism/PRISM-MASTER-SPEC.md, and appends findings to THIS handoff.
- NEXT after audit: review AUDIT-MASTER-REPORT headline (SOUND / MOSTLY-SOUND-WITH-FIXES / NEEDS-GREENLIGHT-REFACTOR) + remediation plan with Logan; greenlight + execute the structural fix if needed; THEN editor-chrome redesign + prototype finish.

## 11. KEY PATHS
- Repo/git root: /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App: kid-kode-landing/.
- App graph (the prototype): kid-kode-landing/public/prism-mock/home/live-graph.json (flat nodes[], each parentHubId).
- Specs: kid-kode-landing/docs/prism/ (consolidating to PRISM-MASTER-SPEC.md). Styleguide: DESIGN-REFERENCES.md + CINEMATIC-PRIMITIVES-LIBRARY.md. Deviations: docs/spec-deviations-prism.md.
- Hardened full-engine spec: project file PRISM_ENGINE_BROWSER_BASED_SPEC (Diffusion Engine v2.0).
- Loop state: kid-kode-landing/notes/ralph-state.json. Feed: kid-kode-landing/notes/MONITOR-FEED.md. Mid-run directive channel (agent reads before each wave): kid-kode-landing/notes/LOGAN-INBOX.md.
- Screenshots: resize before reading - sips -s format jpeg -s formatOptions 72 -Z 1300 <in.png> --out /tmp/x.jpg.
- Future: extract the Prism runtime from the prototype into a shared private package consumed by both the prototype and the production Kriptik repo.

## 12. THE RHYTHM
Claude deploys the ultracode session, monitors a few minutes as the monitor (agent alive on Opus + sentinel armed + commits + didn't die), then tells Logan to check in - does NOT keep running in the chat (wastes credits). Logan gets macOS alerts through the phases, says "check", Claude pulls status. Spec-first, gate-on-Logan's-word; the DESIGN LAW is enforced law.

--- (FOUNDATION AUDIT appends its findings below) ---

---

## FOUNDATION AUDIT FINDINGS (2026-06-22, Opus 4.8)

**Verdict: MOSTLY-SOUND-WITH-FIXES** — runtime substrate sound (331 nodes, all tethered + captioned, graph-driven render path; headers/footers/nav/static-hero-watches are nodes; 3D backgrounds correctly hub-data). Spec corpus already hardened + coherent (no spec contradicts the runtime model).

**3 CRITICAL hardcoded-artifact violations** render scene content OUTSIDE the graph (no node, no codeRef), violating Ruler §1 / RUNTIME INV-R5 / CANVAS §1.2:
- **The configurator watch** (`AtelierWatchRig.tsx` → `GraphScene.tsx:4169`) — the literal hero of the app, NOT a node.
- **The orrery complication** (`OrreryComplicationRig.tsx` → `:4171`).
- **The hub transition** (`HubSceneTransition.tsx` → `:4397`).
- Plus 7 orphan nodes that render nothing in preview-app; HIGH: hero-watch behavior in hardcoded controllers + dead node refs in `src/lib/prism/atelier/config.ts`.

**Safely fixed (docs-only):** wrote `docs/prism/PRISM-MASTER-SPEC.md` (capstone front-door + **Law 0 "every artifact is a node"** + a verification corollary that closes the name-only SC gap); updated `SPEC-INDEX.md`. Did NOT archive the canonical-3 (capstone, not destructive replacement — see `notes/AUDIT-SPEC-REPORT.md` §4). No risky app change; clean cold load + tsc-0-new confirmed.

**Needs greenlight (structural):** watch/orrery/transition → graph nodes via the existing-but-unused `coderef-factory` path; 7 orphan nodes → real artifact or remove. Full plan + recommended order in `notes/AUDIT-REMEDIATION-PLAN.md`. Summary: `notes/AUDIT-MASTER-REPORT.md`.
