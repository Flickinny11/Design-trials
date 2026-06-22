# FIX2 — configurator watch into the graph (G1 + G4) — progress

## Wave 1 (G1) — watch becomes a node — COMPLETE (pending Wave-3 reverify)
- Built `src/lib/prism/atelier/watch-node-factory.ts` — headless `createNode(config,ctx)`
  port of AtelierWatchRig (GLB case/bezel/crown + tourbillon, dial stack, hands,
  crystal, strap, godray; turntable/explode/night/parallax/press/settle driven by
  `getSharedDriverHub().frame.add`; live finishes via `useConfiguratorStore.subscribe`).
  Interactivity gated on `ctx.drivers` → exactly one interactive instance.
- Added bundled codeRef registry `runtime/factories/coderef-registry.ts`
  ('builtin:atelier-watch' → createWatchNode); `resolveCodeRef` consults it before
  the dynamic URL import (the Next bundle can't `import(literalKey)`).
- Added `orr-atelier-watch` node to live-graph.json (parentHubId s6-atelier,
  scenePosition (0,0.15,0.42), intent.caption, codeRef 'builtin:atelier-watch').
- Built slim `AtelierInputController.tsx` (editor-shell) — owns the canvas pointer
  drag + catalog-skip raycast, forwards to the node via window.__ATELIER_RIG__.
- GraphScene: removed AtelierWatchRig import + the `prismHardcodedArtifact:'configurator-watch'`
  JSX sibling; mounts AtelierInputController instead. Retired AtelierWatchRig.tsx → .bak.
- Dropped 'configurator-watch' from EXPECTED_HARDCODED_ARTIFACTS (node-authorship.ts)
  + EXPECTED_HARDCODED (gate script).

### Wave-1 verification (all GREEN)
- tsc gate: 0 new (9 baseline).
- node-authorship-gate.mjs: configurator-watch NO LONGER flagged (only orrery +
  hub-transition remain, expected); 177 node-authored artifacts all in graph; watch
  renders content (not orphan); 0 page errors. 10/11 ok · 0 hard-fail.
- Live in preview-app s6: watch in __PRISM_EDITOR_NODE_GROUPS__ with 42 renderables,
  __ATELIER_RIG__ handle installed, head-on render = premium hero (frames:
  w1-s6-watch-{default,headon,swap}.png). Live finish swap (case→black-dlc,
  dial→aventurine) re-materials the node + price/summary update (CHF 80,000→75,800),
  0 errors.

## Wave 2 (G4) — node-driven behavior + dead refs — NEXT
## Wave 3 — full no-regression verify + report — PENDING

## Wave 2 (G4) — node-driven behavior + dead refs — COMPLETE (pending Wave-3 reverify)
- config.ts: re-pointed all 7 material layers' dead part-ids
  (orr-atelier-watch-{case,bezel,dial,crown,lug-*,mk-*,hand-*,strap-*}) → the real
  composite node id ['orr-atelier-watch']. 30 dead refs → 0.
- applier.ts: documented that the watch node SELF-APPLIES finishes via its factory
  store-subscription (node-driven); the material scene-walk is a graceful no-op
  fallback that now addresses the real node id (text/price appliers unchanged).
- AtelierDragController.tsx: updated stale comments (watch is now a graph node;
  __ATELIER_RIG__.pivot is the documented transitional inspect bridge).
- Remaining bridge: window.__ATELIER_RIG__ — written BY the node factory, consumed
  by actions.ts (flip/explode/loupe/save), AtelierDragController (.pivot hit-test),
  AtelierInputController (drag input). Transitional input/inspect plumbing; the
  artifacts + finish behavior are real-node-driven. Justified in FIX2-REPORT.

### Wave-2 verification (all GREEN, 0 console errors)
- 0 dead refs (grep: only a documentation comment names the removed ids); tsc 0-new.
- Live in preview-app s6 (frames w2-*.png):
  - explode → staggered tier separation (case/bezel/dial/indices fan/crystal). ✅
  - flip → caseback reveals the tourbillon movement. ✅
  - night → markers ignite (blue lume), scene IBL dims, price +300 → CHF 80,300;
    night-off restores environmentIntensity (~1.0). ✅
  - finish swap → re-material + price/summary update (CHF 80k→75.8k). ✅
  - save → localStorage; reset→restore round-trip restores the saved dial. ✅
  - drag turntable (AtelierInputController → node.dragBy) → yaw 0→2.88. ✅
