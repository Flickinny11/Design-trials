# PRISM FIX 3 — orrery complication (G2) + hub transition (G3) into the graph: finish the foundation, gate flags NOTHING

You are an autonomous senior build agent for **Prism** (WebGPU/Three.js graph-native 3D app-builder, ULTRACODE). Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials` (git root, branch `prism-editor-build`). App in `kid-kode-landing/`. Always `unset NODE_ENV`. Operator non-technical, pre-authorized (bypassPermissions), NOT watching — never ask. Commit + push every wave. Print the marker ONLY when done. Fire a macOS notification at each wave boundary + completion (see ALERTS).

## CONTEXT — the FINAL foundation-cleanup, GREENLIT
The FOUNDATION AUDIT found 3 hardcoded signature artifacts. FIX2 already brought the configurator watch into the graph as a node (template: node `orr-atelier-watch` mounted via `coderef-factory`/`buildPerNodeFactory`, JSX sibling removed, authorship gate cleared it). **Two remain, flagged by `node scripts/node-authorship-gate.mjs`:**
- **G2 — the orrery complication** is hardcoded in `OrreryComplicationRig.tsx` (hardcoded `PLANETS[]`), rendered as a JSX sibling at `GraphScene.tsx:4171`.
- **G3 — the hub transition** is hardcoded in `HubSceneTransition.tsx`, rendered at `GraphScene.tsx:4397`.
THE GOAL: wire BOTH through the node system the same proven way — do NOT re-skin the hardcoded versions. **At the end, the authorship gate must flag NOTHING as accidental drift — the foundation is 100% clean, every artifact a node (or an intentional, tagged, documented host).** Preserve ALL behavior + premium visuals EXACTLY. Governing spec: `kid-kode-landing/docs/prism/PRISM-MASTER-SPEC.md` Law 0.

## MODEL & ORCHESTRATION
MODEL **claude-opus-4-8** (confirm modelUsage; never opusplan). ULTRACODE parallel subagents within waves (reuse `kid-kode-landing/notes/catalog-finish-workflow.mjs` `parallel()`), each pinned to opus. READ FIRST: `notes/FIX2-REPORT.md` (the proven watch->node pattern), `AUDIT-INTEGRITY-REPORT.md` (C2/C3), `AUDIT-REMEDIATION-PLAN.md` (G2/G3), PRISM-MASTER-SPEC.md (Law 0), `OrreryComplicationRig.tsx` + `HubSceneTransition.tsx` + how `orr-atelier-watch` was mounted via `coderef-factory`, and how ArtifactNode tags artifacts (`userData.prismNodeId`).

## ALERTS
At START, each WAVE boundary, COMPLETION: `osascript -e 'display notification "<short status>" with title "PRISM FIX 3 (clean)" sound name "Glass"'`

## WAVE 1 — ORRERY BECOMES A NODE (G2)
- Author the orrery complication as a graph node (or cluster) in `kid-kode-landing/public/prism-mock/home/live-graph.json`, tethered to the hub where it actually renders (determine from the code — its current mount hub), with a real position, a populated `intent.caption`, and a `codeRef` routing `OrreryComplicationRig` through `coderef-factory`/`buildPerNodeFactory` so ArtifactNode mounts it as a node-authored artifact (tagged `userData.prismNodeId`) — exactly like `orr-atelier-watch`.
- REMOVE the hardcoded JSX sibling at `GraphScene.tsx:~4171`. The orrery reaches the scene ONLY via the node. PRESERVE the interactive solar-system EXACTLY: emissive sun + 4 PBR planets orbiting tilted 3D rings + the time controls (`setTime`/`setSpeed`/drag-to-scrub).
- VERIFY this wave: the authorship gate no longer flags the orrery (only the transition remains, until W2); the orrery renders + animates pixel-equivalent in preview-app; orrery is selectable/editable in canvas (capture proof, like the watch); tsc green. Commit `AUTO-CKPT: FIX3 wave1 (orrery is a node)` + push. Notify.

## WAVE 2 — HUB TRANSITION: NODE OR TAGGED+DOCUMENTED HOST (G3)
The transition is a special case — a cross-hub effect, not an artifact pinned to one hub. Choose the architecturally-correct path and apply it:
- PREFERRED: author it as a GLOBAL node (the way headers/footers occupy global node slots) with a `codeRef` to `HubSceneTransition`, tagged `userData.prismNodeId`, so it is genuinely node-authored.
- IF a transition-as-node is architecturally wrong (it is runtime behavior, not a hub artifact): give it a proper, explicit authorship host — tag its mounted group so the gate recognizes it as an INTENTIONAL runtime host (e.g. a stable `userData.prismRuntimeHost='hub-transition'` the gate treats as authored-and-intentional, NOT accidental drift, and NOT brittle name-matching) — AND write a short documented deviation in `docs/spec-deviations-prism.md` explaining WHY (cross-hub transition = runtime behavior). Update `node-authorship-gate.mjs` so it distinguishes "intentional tagged runtime host" from "accidental hardcoded artifact."
Either way: PRESERVE the cinematic transition EXACTLY (the through-page/morph between hubs on nav). VERIFY: the gate no longer flags the transition as ACCIDENTAL drift (it is either a node or an intentional tagged host); transitions still fire on every hub nav; 0 console errors; tsc green. Commit `AUTO-CKPT: FIX3 wave2 (transition node/tagged host)` + push. Notify.

## WAVE 3 — VERIFY (foundation 100% clean) + REPORT
`unset NODE_ENV`. Restart dev fresh: `cd kid-kode-landing && lsof -ti tcp:3000 | xargs kill -9 2>/dev/null; rm -rf .next; (unset NODE_ENV; nohup npm run dev > /tmp/dev.log 2>&1 &)`, wait `GET / 200`, then COLD-LOAD GATE via Chrome DevTools MCP — FAIL on any `_next` 404, pageerror, no `<canvas>`, or stuck loader. Then:
- **THE HEADLINE — authorship gate flags NOTHING as accidental drift:** `node scripts/node-authorship-gate.mjs --strict-orphans` → 0 accidental-hardcoded artifacts (watch + orrery are nodes; transition is a node or an intentional tagged host); all node-authored artifacts trace to the graph; 0 fresh drift; 0 hard-fail. Capture the output. The foundation is clean.
- **Orrery editable as a node** (capture proof, like the watch — selectable, Inspector, gizmo).
- **NO-REGRESSION (multi-frame t=0/0.3/0.6/1.0 where animated):** orrery sun+planets orbit + time-scrub work; hub transitions fire cinematically on nav (s1->s2->s4->s6); the watch (FIX2) + all hubs unaffected. Side-by-side vs the prior look.
- tsc gate green (`node scripts/typecheck-gate.mjs`, 0 new). `prism-criteria-reviewer` (node-authorship-aware) sign-off (MUST-FIX blocks done). `user-advocate` capstone — orrery still reads premium, transitions still cinematic, nothing regressed. Verdict needs cited frames.
DONE only when: orrery is a node + editable, transition is a node-or-intentional-tagged-host, **the gate flags 0 accidental drift**, all behavior intact (orrery + transitions + watch + hubs), clean cold load, tsc green, criteria-reviewer pass, advocate not annoyed. Frames -> `kid-kode-landing/notes/verification/fix3/`; resize before reading (`sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`).

## CONTRACT / ANTI-STUCK
Graph IS the app. TSL only. MSDF text only. Allowlist before any new import. Zero console errors. Keys in `.assetgen/`, never committed. PRESERVE premium look + all behavior — regression = MUST-FIX. Use the FIX2 watch->node path as the template for the orrery. Never downgrade deps; never paste broken code into a repair — delete + regenerate from the node's spec. After ~2 failed attempts on the orrery codeRef-mount, web-search + root-cause. For the transition, if neither global-node nor a clean tagged-host lands in one pass, prefer the tagged-host + documented deviation over leaving it as accidental drift.

## RESUME / REPORTING + MARKER
`git log --oneline -12`; `AUTO-CKPT: FIX3 <wave>` = done-pending-reverify. If `kid-kode-landing/notes/FIX3-REPORT.md` has the marker, re-print + stop. Check `notes/LOGAN-INBOX.md` before each wave. Append to `notes/MONITOR-FEED.md` + `notes/FIX3-PROGRESS.md`. Write `kid-kode-landing/notes/FIX3-REPORT.md` (orrery node + mount, transition resolution [node vs tagged host + why + any deviation], the gate-flags-nothing proof, orrery editable proof, full no-regression matrix w/ frames, all gate verdicts incl cold-load + authorship, honest flags). Append a "FOUNDATION CLEAN" note to `SESSION-HANDOFF-2026-06-22.md`. On FULL completion, fire the completion notification and write the EXACT marker line LAST:
PRISM-FIX3-CLEAN: RUN COMPLETE
