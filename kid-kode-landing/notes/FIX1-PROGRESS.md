# PRISM FIX 1 — progress log

One line per checkpoint. Newest at the bottom.

## WAVE 1 — S3d node-authorship verification gate
- Built the runtime half: `src/lib/prism/runtime/node-authorship.ts` — pure, DOM-free `computeSceneAuthorship(scene, nodeGroups, camera)` (FP-05: no window in runtime/). Classifies every content artifact as node-authored (carries authoring nodeId / is in `__PRISM_EDITOR_NODE_GROUPS__`) or hardcoded (mounted outside the node map → nodeId null). EXPECTED_HARDCODED_ARTIFACTS = {configurator-watch, orrery-complication, hub-transition}.
- Wired the live accessor `window.__PRISM_NODE_AUTHORSHIP__()` in GraphScene (dev-gated, beside `__PRISM_SCENE__`). Self-tagged node-authored roots with `userData.prismNodeId` at the node-group ref callback. Tagged the 2 declarative rigs (watch/orrery) at their GraphScene MOUNT HOST via a neutral `<group userData={{prismHardcodedArtifact}}>` — the rig component files are NOT touched (G1/G2 are separate greenlight sessions); the transition curtain is recognised by its existing name `hub-scene-transition`.
- Built `scripts/node-authorship-gate.mjs` (Playwright; navigates s4/s6 in preview-app to mount the watch+orrery, unions authorship). FAILS on unsanctioned hardcoded drift; the 3 known are expected-hardcoded (warn, pending greenlight). Cross-checks node-authored ids against the graph + reports the 7 former orphans (`--strict-orphans` makes those fatal in WAVE 3).
- Updated `/prism-verify` (structural-assert step + new mandatory gate) and the `prism-criteria-reviewer` agent (Law-0 node-authorship MUST-FIX section).
- VALIDATED against a fresh dev server: gate flags ALL 3 known hardcoded (hub-transition, configurator-watch, orrery-complication), 0 fresh drift, 176 node-authored artifacts all in-graph, 0 page errors, 0 hard-fail (exit 0). tsc gate green (0 new). Proof the gate works.
