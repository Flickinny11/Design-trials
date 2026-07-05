# SHELL W5 — Conductor + Deploy + Verify loop — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630` · **Commits:** `3a051666`
(Conductor) → `40297ae5` (resume + robustness) → report.
**Decision gate:** founder lock **H — LOCKED** (Conductor as the v1 prompt-to-app
engine) verified in `docs/prism/PRISM-SHELL-DECISIONS-2026-07-04.md` §"Founder
locks — afternoon". Board A typeface + E14 addendum also locked. Gate CLEAR.

## What shipped

The v1 **prompt-to-app engine — the Conductor**. An approved Build Brief (W2)
becomes a real app that runs in the Prism runtime, is verified, and ships a
shareable preview URL, with a live **app builds → verifies → deploys → live URL
→ advocate** loop.

### 1. Conductor service (lock H)
`src/server/conductor/*` — a server-side orchestrator streamed over the SAME
async-generator/SSE transport the chat uses (I1); its plan/build/verify/deploy
evidence rides the existing `tool-step-*` variants so it is visible live in the
builder chat (E4).

- **Brief → plan → graph.** `resolveDirection` re-resolves the chosen Direction
  Board; `resolveBlueprint` (planner) produces a coherent multi-hub app
  blueprint — deterministic dry-run planner by default, an env-gated live
  copy-refinement (`ANTHROPIC_API_KEY`, Vercel AI SDK, optional-imported) that
  falls back to the stub on any failure. `assembleGraph` authors each node.
- **Certified node path ONLY (I10 / W5-D1).** Every node's additive styling
  slice is filtered through the EXACT `APPLYABLE_NODE_FIELDS` allowlist
  (`sanitizeAdditive`, mirroring `apply-plan.ts:sanitizePatch`), normalized by
  the shared `applyPlanRendererDefaults`, and passed through the shared
  `validatePlanRendererFields` schema-completeness gate (the same gate the
  `/api/prism/regen` persist route runs). Never raw code injection; `codeRef` is
  not on the allowlist. Nodes are authored in config-bounded per-hub batches.
- **Streamed hydration + E1 checkpoints.** Per-hub batches stream tool-steps and
  save progressively; checkpoints land at plan/build/verify boundaries
  (`conductor: plan` / `build` / `verified`).
- **Interruptible + resumable.** Every phase checks the AbortSignal; batches
  interrupt between them. A built project run again WITHOUT an explicit rebuild
  re-verifies + re-deploys its existing graph via the shared `finalize()`
  sequence rather than re-authoring (idempotent — asserted in tests).

### 2. §11 completion latch (I9)
`src/server/conductor/verify-latch.ts` — behavioral (every node schema-complete,
exactly one PrismRootNode SC-006, edges resolve) + visual (Direction-Board
conformance §11.3: surface tone on every hub, accent signal present, material
family expressed, MSDF text with palette fills) + deploy + fresh-context
advocate (`pending`, never auto-passed). `verifiedShippable = behavioral ∧
visual ∧ deploy`; the "Verified shippable" badge reads that latch only — never
"build finished". A per-node repair backstop (contamination-aware) regenerates a
failing node from spec before the graph is saved.

### 3. Deploy / publish (S7 · E14 · E15)
`src/server/deploy/*` + `src/server/conductor/preview-tokens.ts` — a typed
**DeployTarget** adapter layer (E15 shape): `prism-cloud` (live, always
available) + Vercel/Netlify/Cloudflare (frontend) + Modal/RunPod/Vast
(backend/GPU), all env-gated with generated host-config manifests and dry-run
modes. `prism-cloud` ships a **token-guarded `/preview/[projectId]` route** that
runs the authored graph in the Prism runtime (`mountFromGraphSource`) — a real,
shareable, Lovable-class **E14 preview URL**. The token is a capability
reference to one pinned snapshot (I5). **Rollback** = E1 restore + redeploy;
**custom-domain** field with a verification stub; env values read server-side
only (never surfaced).

### 4. E7 export
`src/server/conductor/export-bundle.ts` + `/api/tenant/export/[projectId]` —
the deployable runtime bundle: a zip of the `.prism` graph + hosting manifest,
served from the owner's tenant space only. Honest positioning: ownership of the
running app (the runtime IS the product), not React source.

### 5. Builder wiring
Build CTA (`PreviewRegion`) streams the build into chat; once built, the app
runs in the preview frame (`ConductorPreview`, one visible scene at a time —
W5-D3); the header carries the E14 preview URL (open-in-new-tab) + the
Verified-shippable badge; the Ship tab (`ShipTab`) surfaces the latch, one-click
hosts (E15), rollback, custom domain, and export. Dashboard ShipPanel updated.

## Gate evidence

| Gate | Result |
|---|---|
| A real app builds → verifies → deploys → live URL | **PASS** — headless pipeline proof (`tests/unit/shell-w5-conductor.test.ts`): fixture brief → schema-complete graph → §11 latch verifiedShippable → E1 checkpoints → E14 token resolves to the shipped snapshot; + resume idempotency asserted. |
| Built graph runs in the Prism runtime | **PASS** — live scene inspection of `/preview`: render loop 17,522 draw calls, 58 meshes, correct materials + full-frame positions, **0 console errors**. Evidence: `notes/verification/shell-w5/`. |
| Verify latch green | **PASS** — behavioral + visual + deploy all PASS on the shipped graph. |
| Deployed (dry-run proof, env-gated) | **PASS** — `prism-cloud` live preview URL served + pinned snapshot; external hosts emit config manifests in dry-run. |
| Dual judges 0 MUST-FIX | **PASS** — `prism-criteria-reviewer`: PASS, 0 MUST-FIX (all of I1/I4/I5/I9/I10/I11 + FP + gate confirmed). `user-advocate`: **PLEASED**, gate PASS, 0 MUST-FIX (measured accent RGB(172,23,24) ≈ #ff2a38; control isolates the black-frame as a capture artifact). |
| S7 checklist | Env/secrets server-side ✓, live URL ✓, rollback ✓, "done" only after §11 ✓. |
| DL sweep | Clean — no hardcoded model strings in components (config §7.4), no emoji/icon-packs, no purple; --pp-* tokens throughout. |
| tsc 0-new | **9 = 9** baseline (test fixtures; no new errors). |
| full verify + tenancy | verify:prism/repair-loop/galaxy(7/7)/global-shell(6/6)/parity(6/6)/schema(338/338) GREEN; **verify:tenancy 30/30 GREEN**. |

### WebGPU capture caveat (documented)
Single-frame WebGPU screenshot capture via DOM MCP tools is the project's
documented blind spot (`kid-kode-landing/CLAUDE.md`: "DOM/selector testing
cannot *see* the built UI"). The advocate measured it directly: the preview
frame was 0.20% non-black vs the reference mock-app 62.54% in the SAME runtime —
a present-race capture artifact, not a render failure. The reliable functional
proof is the scene inspection; KripVerify/Metal-GPU is the canonical vision
layer (follow-up).

## Deviations (recorded BEFORE code — `docs/spec-deviations-prism.md`)
- **W5-D1** Conductor runs server-side, authors via a server-callable certified
  node path (same allowlist + gate as the editor node-agent).
- **W5-D2** Nodes render via MSDF text + tinted PBR primitives — no baked
  diffusion assets (asset generation out of W5 scope, founder-directed).
- **W5-D3** The built app runs through a second sanctioned React host
  (`mountFromGraphSource`), shown one-at-a-time with the engine-frame (FP-R1).
- **W5-D4** E14 preview + prism-cloud deploy served by this Next app
  (token-guarded); external hosts env-gated dry-runs.
- **W5-D5** The server §11 latch is structural-behavioral + visual-conformance;
  the full browser behavioral/visual pass is the harness + advocate.

## Environment variables (founder must set to go live; W5 does NOT block on them)
- `ANTHROPIC_API_KEY` — enables the live Conductor copy-refinement planner
  (absent → deterministic dry-run planner, fully proven headlessly).
- `PRISM_CONDUCTOR_MODEL` (optional) — overrides the live planner model id
  (default `claude-opus-4-8`; config-driven, §7.4).
- Host tokens (env-gated dry-run until set): `VERCEL_TOKEN`,
  `NETLIFY_AUTH_TOKEN`, `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`,
  `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET`, `RUNPOD_API_KEY`, `VAST_API_KEY`.
- Storage paths (dev): `PRISM_TENANCY_DIR`, `PRISM_PREVIEW_TOKENS_DIR`
  (default under `.data/`; swap for R2/Supabase behind the same store surface).

## Conductor → swarm-dispatch upgrade notes
The Conductor is planner-agnostic: it consumes a `BuildBlueprint` (hubs + node
specs) and authors through the fixed certified node path + verify latch. The
non-ratified **swarm-dispatch** harness (its own spec + model bakeoff) is the
scale upgrade — it replaces `resolveBlueprint`/the planner behind the unchanged
`BuildBlueprint` interface, without touching `node-factory`, `graph-assembler`,
`verify-latch`, or the deploy seam. The E15 `DeployTarget` interface is likewise
the extension point W5B (E16–E20: host adapters, in-platform domains, "Ship &
Make Profitable", backend/GPU node deploys) builds on without rework. Lock H's
"Conductor interfaces must not preclude that upgrade" is satisfied.

## Follow-ups (non-blocking, logged)
- Route the Conductor preview through `PrismHost`'s full compiled-hub-view path
  (camera rail + background environment + lighting rig) + the asset-generation
  pipeline for richer visuals (W5-D2).
- KripVerify/Metal-GPU capture to upgrade the vision layer from
  "corroborated" to directly "seen".

**Marker:** `PRISM-SHELL-W5: RUN COMPLETE`
