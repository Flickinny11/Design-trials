# PRISM FIX 1 — node-authorship verification gate (S3d) + the 7 orphan nodes (G5)

You are an autonomous senior build agent for **Prism** (WebGPU/Three.js graph-native 3D app-builder, ULTRACODE). Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials` (git root, branch `prism-editor-build`). App in `kid-kode-landing/`. Always `unset NODE_ENV`. Operator non-technical, pre-authorized (bypassPermissions), NOT watching — never ask. Commit + push every wave. Print the marker ONLY when done. Fire a macOS notification at each wave boundary + completion (see ALERTS).

## CONTEXT
The FOUNDATION AUDIT (see `kid-kode-landing/notes/AUDIT-MASTER-REPORT.md`, `AUDIT-INTEGRITY-REPORT.md`, `AUDIT-REMEDIATION-PLAN.md`) found the runtime substrate SOUND (331 nodes, all tethered + captioned via `intent`) but 3 signature artifacts hardcoded + 7 orphan nodes. This session does the FIRST two remediation items — the safest, highest-leverage ones — per `AUDIT-REMEDIATION-PLAN.md`:
- **S3d** — upgrade the verification gate to assert NODE AUTHORSHIP (cheap, prevents regressions). Do this FIRST so it guards the rest.
- **G5** — fix the 7 orphan nodes that render nothing/wrong (smallest real content fix).
Governing spec: `kid-kode-landing/docs/prism/PRISM-MASTER-SPEC.md` — **Law 0 "every artifact is a node"** + its verification corollary. This session does NOT touch the 3 hardcoded artifacts (the watch/orrery/transition) — those are separate NEEDS-GREENLIGHT sessions.

## MODEL & ORCHESTRATION
MODEL **claude-opus-4-8** (confirm modelUsage; never opusplan). ULTRACODE parallel subagents within waves (reuse `kid-kode-landing/notes/catalog-finish-workflow.mjs` `parallel()`), each pinned to opus. Read AUDIT-INTEGRITY-REPORT.md + AUDIT-REMEDIATION-PLAN.md + PRISM-MASTER-SPEC.md FIRST.

## ALERTS
At START, each WAVE boundary, and COMPLETION run:
  `osascript -e 'display notification "<short status>" with title "PRISM FIX 1" sound name "Glass"'`

## WAVE 1 — S3d: NODE-AUTHORSHIP VERIFICATION GATE
The drift happened because verification asserted that an OBJECT (by name) appeared in the scene, not that it was AUTHORED BY A NODE. Fix the gate so it catches hardcoded artifacts:
- Add a runtime, queryable map of "rendered signature artifacts -> the graph node id that authored them" — e.g. each node-authored artifact tags its Object3D (userData.prismNodeId) when ArtifactNode mounts it; expose a debug accessor like `window.__PRISM_NODE_AUTHORSHIP__()` returning every top-level scene artifact with its authoring nodeId (or null if hardcoded).
- Add a verification assertion (wire into `/prism-verify` and a small script under `kid-kode-landing/scripts/`, e.g. `node-authorship-gate.mjs`) that walks the scene via `evaluate_script`, lists artifacts whose authoring nodeId is null (hardcoded), and FAILS / reports them. It MUST currently FLAG the 3 known hardcoded artifacts (configurator watch, orrery complication, hub transition) as proof the gate works — record that in the report (those 3 are expected-known until their greenlight sessions).
- Update the `prism-criteria-reviewer` agent guidance (or the verify command) so future criteria PASS only when the artifact they describe is node-authored.
Commit `AUTO-CKPT: FIX1 wave1 (S3d node-authorship gate)` + push. Notify.

## WAVE 2 — G5: FIX THE 7 ORPHAN NODES
Per AUDIT-INTEGRITY-REPORT.md C4, these 7 nodes are tethered + captioned but render nothing/wrong (renderMode `plane` with no `sourceAsset`/`meshPrimitive`/`codeRef` -> wrong-shape glass sphere in canvas, NOTHING in preview-app; or empty text):
- 6 ambience planes: `orr-arrival-dust`, `orr-movement-rings`, `orr-celestia-starfield`, `orr-celestia-galaxy`, `orr-celestia-orbits`, `orr-acquire-sweep`
- 1 empty text node: `orr-atelier-reason` (`textSpec.content=""`)
For EACH, decide and apply (per the remediation plan: "real artifact OR remove if redundant with hub `background[]`"):
- If the ambience it implies is ALREADY covered by that hub's `background[]` hub-data -> REMOVE the orphan node cleanly (and confirm nothing referenced it).
- Otherwise -> give it a REAL renderable artifact so it renders as intended ambience in BOTH canvas AND preview-app: a proper plane/mesh with a real material/texture (generate a texture via Replicate FLUX.2 if a map is needed; keys in `.assetgen/`), honoring the DESIGN LAW (photoreal, nothing flat, on-theme per hub). NO wrong-shape glass-sphere fallback.
- For `orr-atelier-reason`: populate `textSpec.content` with real on-brand atelier copy (MSDF text) OR remove if redundant.
Each fixed/removed node must (a) be a proper graph node still (if kept), (b) render correctly in preview-app, (c) carry an accurate `intent.caption`. Commit `AUTO-CKPT: FIX1 wave2 (G5 orphan nodes)` + push. Notify.

## WAVE 3 — VERIFY + REPORT
`unset NODE_ENV`. Restart dev fresh: `cd kid-kode-landing && lsof -ti tcp:3000 | xargs kill -9 2>/dev/null; rm -rf .next; (unset NODE_ENV; nohup npm run dev > /tmp/dev.log 2>&1 &)`, wait `GET / 200`, then COLD-LOAD GATE via Chrome DevTools MCP — FAIL if any `_next` 404s, pageerror, no `<canvas>`, or stuck on "INITIALIZING PRISM RUNTIME". Then:
- Run the new `node-authorship-gate.mjs` — confirm it works (flags the 3 known-hardcoded, and confirms the 7 former-orphans are now either gone or node-authored-and-rendering).
- For each kept former-orphan: navigate its hub, screenshot, JUDGE it renders correct on-theme ambience (not a glass sphere, not empty). Multi-frame if animated.
- tsc gate clean (`node scripts/typecheck-gate.mjs`, 0 new). 
- Hand to `prism-criteria-reviewer` (node-authorship-aware) for sign-off; then `user-advocate` capstone (do the hubs look right / is anything missing or broken — node-authored ambience reads premium?). Verdict needs cited frames.
DONE only when: S3d gate exists + works, all 7 orphans fixed/removed + verified rendering, clean cold load, tsc green, criteria-reviewer pass, advocate not annoyed. Frames -> `kid-kode-landing/notes/verification/fix1/`; resize before reading (`sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`).

## CONTRACT / ANTI-STUCK
Graph IS the app — `kid-kode-landing/public/prism-mock/home/live-graph.json`. TSL only. MSDF text only. Allowlist before any new import. Zero console errors. Keys in `.assetgen/`, never committed. Do NOT touch the 3 hardcoded signature artifacts this session. Never downgrade deps; never paste broken code into a repair.

## RESUME / REPORTING + MARKER
`git log --oneline -12`; `AUTO-CKPT: FIX1 <wave>` = done-pending-reverify. If `kid-kode-landing/notes/FIX1-REPORT.md` has the marker, re-print + stop. Check `notes/LOGAN-INBOX.md` before each wave. Append to `notes/MONITOR-FEED.md` + `notes/FIX1-PROGRESS.md`. Write `kid-kode-landing/notes/FIX1-REPORT.md` (what the gate does + its current flags, per-orphan decision [kept+artifact / removed] + before/after frames, all gate verdicts incl cold-load, console-error counts, honest flags). On FULL completion, fire the completion notification and write the EXACT marker line LAST:
PRISM-FIX1: RUN COMPLETE
