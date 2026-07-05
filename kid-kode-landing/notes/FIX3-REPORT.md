# FIX3 — orrery complication + hub transition into the graph (G2 + G3)

**Run:** 2026-06-22 · branch `prism-editor-build` · model claude-opus-4-8 · ULTRACODE
**Commits:** `bbbfc551` (W1 orrery→node) · `9aca8301` (W2 transition→runtime host) · this report (W3)
**Verdict:** ✅ **RUN COMPLETE — THE FOUNDATION IS 100% CLEAN. The node-authorship gate flags ZERO accidental drift.** Every signature artifact is now a node (watch, orrery) or an intentional, tagged, documented runtime host (transition). Zero regression.

---

## 0. The headline — the gate flags NOTHING as accidental drift

`node scripts/node-authorship-gate.mjs --strict-orphans` on a fresh cold load:

```
gate.classifier-live        PASS  synthetic hardcoded→flagged, runtime-host→sanctioned, node→authored
gate.no-accidental-drift    PASS  ZERO accidental hardcoded artifacts (foundation clean — Law 0)
runtime-host.hub-transition PASS  hub transition classified as an intentional runtime host (not drift)
authored.in-graph           PASS  178 node-authored artifacts, all in graph
authored.renders            PASS  all non-text node-authored artifacts render content
orphans.planes-removed      PASS  6 ambience planes removed (FIX1 G5 holds)
orphans.reason-filled       PASS  orr-atelier-reason carries real text (FIX1 G5 holds)
runtime.no-pageerrors       PASS  clean
                            9/10 checks ok · 0 hard-fail
```

`hardcoded: []` · `runtimeHostLabels: ['hub-transition']` · `classifierSelfTest: {live, hardcoded, runtimeHost, node} all true` · `unexpectedHardcoded: []`. JSON: `notes/verification/fix3/node-authorship-gate-strict.json`.

The one non-PASS (`authored.text-warm`) is a **soft WARN** (warn=true → not a hard-fail): atelier MSDF text glyphs warm async and aren't all mounted at the gate's capture instant. This is the identical pre-existing timing artifact FIX1/FIX2 saw; it is not introduced by FIX3.

This is the audit closed out. The FOUNDATION AUDIT (`AUDIT-INTEGRITY-REPORT.md`) found 3 hardcoded signature artifacts. FIX2 fixed the watch (G1). FIX3 fixes the last two:
- **G2** — the orrery complication → graph node.
- **G3** — the hub transition → intentional tagged runtime host.

---

## 1. WAVE 1 — the orrery is a node (G2)

### The node
`public/prism-mock/home/live-graph.json` gains **one composite node** (327 nodes total):
```
orr-celestia-orrery · parentHubId s4-celestia · codeRef 'builtin:orrery-complication'
  · renderMode mesh · subtype stage-3d · scenePosition {0, 0.35, 0.4}
  · intent.caption "ORRERY No.7 — the Celestia orrery complication…"
```

### The factory (the headless port)
`src/lib/prism/celestia/orrery-node-factory.ts` (191 lines) — a faithful, **headless**
`createNode(config, ctx): THREE.Object3D` port of the former React/R3F `OrreryComplicationRig`.
**`PLANETS[]`, all geometry, all materials, and all motion are byte-identical to the rig**
(verified by the criteria reviewer against `OrreryComplicationRig.tsx.bak-fix3`): emissive
gold sun (`emissiveIntensity 2.4`) + additive `BackSide` glow shell, 4 PBR planets
(brass / marble / ice-world / obsidian) on tilted `TorusGeometry` brass rings, `TILT=-0.5`,
same per-frame orbit/spin math. React-coupling resolved (mirrors the FIX2 watch template):

| React dep (old rig) | Headless replacement (node factory) |
|---|---|
| `useFrame` | `getSharedDriverHub().frame.add` — `SceneDriverHost` ticks it; only when `ctx.drivers` exists (the built-state surface) |
| `useThree().gl` / `useThree().camera` | **eliminated** — the orrery never used the camera; drag reads `clientX` off `window` pointer events gated on `getSharedDriverHub().pointer.active` (the "over the built view" hover flag), a faithful (arguably more-correct) equivalent of the rig's canvas listener |
| `useGraphEditorStore` (activeHubId gate) | **eliminated** — the node only mounts when s4-celestia is the active hub (per-hub node filtering); interactivity is gated on `ctx.drivers` so exactly ONE interactive orrery exists |

The TILT lives on a **child** group inside the factory, because `buildPerNodeFactory`'s placeholder owns the node's `scenePosition` and `graftAs` resets the returned root to identity.

### The registry + mount path
`coderef-registry.ts` registers `'builtin:orrery-complication' → createOrreryNode` (the 2nd live codeRef after the watch). `hasArtifactData` true → `AssembledSceneNode` mounts `<ArtifactNode>` → `buildPerNodeFactory` → `resolveCodeRef` (registry hit) → `createOrreryNode`. The mounted root carries `userData.prismNodeId`/`nodeId`, so the authorship probe counts it node-authored (10 renderables: sun + glow + 4 rings + 4 planets).

### Removed
The `<OrreryComplicationRig>` JSX sibling + its `prismHardcodedArtifact:'orrery-complication'` tag are gone from `GraphScene` (import removed); `OrreryComplicationRig.tsx` retired to `.bak-fix3`. `'orrery-complication'` dropped from `EXPECTED_HARDCODED` (node-authorship.ts + gate).

### The payoff — the orrery is a selectable, editable node
`w1-PAYOFF-orrery-selected-editable.png` / `w3-PAYOFF-orrery-editable.png` (canvas): the orrery is **selected** (`selectedNodeId === 'orr-celestia-orrery'`, `editorMode 'edit'`) with a transform gizmo + selection box; the **Inspector** is open titled "Orr Celestia Orrery" with its full caption + VISUAL/MATERIAL/BEHAVIOR/FUNCTIONS/INTEGRATIONS tabs + a BUILT/Clone/Edit panel; the **Transform** panel reads **Position X/Y/Z = 0.00 / 0.35 / 0.40** (exactly its scenePosition); minimap **327 NODES**. The orrery that previously rendered only in preview-app is now first-class editable.

---

## 2. WAVE 2 — the hub transition is an intentional tagged runtime host (G3)

The transition is **not a hub artifact** — it is cross-hub **runtime behaviour**: a camera-parented, screen-space TSL brass curtain that closes → gates the heavy `activeHubId` swap to peak cover → opens, orchestrating *navigation between hubs*. It has no `scenePosition`, no `parentHubId`, no inspectable content, and a hard dependency on the camera + nav state machine. Forcing it into a fake "global-hub node" would be architecturally dishonest. So it gets a **proper, explicit authorship host** instead of a node:

- **`HubSceneTransition.tsx`**: the mounted curtain group is tagged `userData.prismRuntimeHost = 'hub-transition'`.
- **`node-authorship.ts`**: a third artifact kind `'runtime-host'` (sanctioned infra, **distinct from accidental `hardcoded` drift**), detected from `prismRuntimeHost` **before** the hardcoded path. The brittle `NAMED_HARDCODED['hub-scene-transition']` name-match is removed (recognition is now by explicit tag, not coincidental name). `EXPECTED_HARDCODED_ARTIFACTS` is now `[]`.
- **`GraphScene.tsx`**: `__PRISM_NODE_AUTHORSHIP_SELFTEST__` — a synthetic-scene probe that proves the classifier still discriminates hardcoded (drift) vs runtime-host (sanctioned) vs node-authored. **So a future accidental hardcoded artifact WOULD still fail the gate even though the real scene is clean** — the runtime-host path is not a loophole.
- **`docs/spec-deviations-prism.md`**: a full documented deviation (why the transition is runtime behaviour not a hub artifact; why this is not a loophole).
- **`node-authorship-gate.mjs`**: reworked — `gate.classifier-live` (self-test), `gate.no-accidental-drift` (0 hardcoded), `runtime-host.hub-transition` (the transition is a recognised intentional host).

The cinematic transition is **byte-for-byte unchanged** (same TSL curtain, same close→gated-swap→open timing); only the authorship classification changed.

---

## 3. No-regression matrix (every behavior, with frames)

| Behavior | Mechanism | Result | Frame(s) |
|---|---|---|---|
| Orrery render (preview-app, s4-celestia) | codeRef factory → 10 renderables | premium solar system: gold sun + 4 PBR planets on tilted brass rings, real depth, nebula backdrop | `w1-orrery-preview-celestia.png` |
| Orrery orbit (animated) | `getSharedDriverHub().frame.add` | planets at distinct orbital positions at t=0/2.5/5.0/7.5 | `w3-orrery-t0/t03/t06/t10.png` |
| Orrery time controls | `window.__ORRERY__` | `setTime`/`setSpeed`/`scrub` all work; drag-to-scrub via pointer | (verified via evaluate: t0/t3/t6 positions distinct) |
| Orrery editable | node-authored → canvas | selectable, Inspector, gizmo, Position 0/0.35/0.40 | `w3-PAYOFF-orrery-editable.png` |
| Hub transition fires on nav | `useHubTransitionStore` state machine | s4→s6 + s6→s1 both ran `closing→holding→opening→idle`, cover→1.0, hub swapped | `w2-transition-curtain-held.png` (curtain mid-close, brass pleats + gold seam) |
| Watch (FIX2) unaffected | `orr-atelier-watch` node | 42 renderables, full configurator (chips, CHF 80,000, SAVE/RESET, CASEBACK/EXPLODE) | `w3-watch-atelier-unaffected.png` |
| Arrival hub unaffected | graph nodes | "Time, machined.", hero watch, ENTER THE ATELIER / RESERVE No.7 | `w3-arrival-hub-unaffected.png` |

All driven with **0 console/page errors**.

---

## 4. Gate verdicts (all GREEN)

- **Cold-load gate** (fresh `rm -rf .next` restart, Chrome DevTools MCP): canvas present (1440×809), 0 console errors, 0 `_next` 4xx/5xx (12 `_next` resources all OK, 36 total), no stuck loader. **PASS.**
- **node-authorship-gate.mjs --strict-orphans**: 9/10 ok · **0 hard-fail**. `hardcoded: []`, `runtimeHostLabels: ['hub-transition']`, classifier self-test all true, 178 node-authored all in graph, orphans hold, no page errors. The 1 soft WARN is pre-existing async MSDF text-warming. JSON: `notes/verification/fix3/node-authorship-gate-strict.json`.
- **tsc gate**: 9 total / baseline 10 / **0 new**. PASS.
- **prism-criteria-reviewer** (node-authorship-aware, fresh context): **PASS — all 7 criteria MEET, 0 MUST-FIX.** Orrery genuinely node-authored (not a re-skin); runtime-host principled not a loophole (explicit tag + documented + self-test still catches drift); FP-05 compliant (`celestia/` outside the window-forbid scope, like `atelier/`); createNode/cleanup contract satisfied (sync, disposes + kills frame loop + removes listeners, exactly one interactive instance via `ctx.drivers`); additive/non-destructive; TSL-only/no new deps; behaviour byte-identical. Two non-blocking nits (trailing newline + a both-tags foot-gun comment) — **both addressed in this wave.**
- **user-advocate** (judges as a user, from frames): **PLEASED · gate PASS.** All 3 claims PLEASED with cited frames — orrery premium + visibly orbits, transition cinematic brass curtain, watch + hubs intact; bonus: editable payoff real (327 NODES, Inspector). 0 MUST-FIX, 0 FLAG.

---

## 5. Honest flags

1. **[pre-existing, non-blocking] MSDF text-warm WARN** in the authorship gate — atelier text nodes warm glyphs async, so some read 0 renderables at the capture instant. Identical to FIX1/FIX2; not introduced by FIX3; the gate marks it warn/non-fatal.
2. **[transitional, justified — inherited from FIX2] `window.__ATELIER_RIG__` / `window.__ORRERY__` handles** remain for imperative inspect/input/control verbs. These live OUTSIDE the FP-05 runtime scope (`atelier/`, `celestia/`); the artifacts + their behavior are node-driven, and the handles carry only control verbs + the verification control surface — consistent with the driver model.
3. **[documented deviation] the hub transition is a runtime host, not a node** — by design (§2 + `docs/spec-deviations-prism.md`). This is the architecturally-correct resolution for cross-hub runtime behaviour, explicitly tagged + documented + self-test-guarded, NOT accidental drift.
4. **The orrery now renders in canvas too** (previously preview-app only). This is the intended upgrade — it is now a selectable/editable node, exactly like the watch.

---

PRISM-FIX3-CLEAN: RUN COMPLETE
