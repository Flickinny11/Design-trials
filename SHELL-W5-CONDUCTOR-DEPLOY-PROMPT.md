# SHELL W-5 — CONDUCTOR + DEPLOY + THE VERIFY LOOP (prompt→app for real)

Branch `codex/prism-recovery-harness-20260630`. Additive. Evidence law.

## DECISION GATE (read first)
This wave requires founder decision **H — LOCKED** in
docs/prism/PRISM-SHELL-DECISIONS-2026-07-04.md. If H is not marked LOCKED
there, write the BLOCKED marker and stop. H (as proposed): v1 user
prompt-to-app engine = the **Conductor** — a single orchestrator session per
build that authors the graph EXCLUSIVELY through the certified node paths
(node-agent validated plans, additive schema, schema-completeness +
verify gates), generating nodes in small config-bounded parallel batches.
The swarm-dispatch harness (separate non-ratified spec) remains the scale
upgrade behind its bakeoff — Conductor's interfaces must not preclude it.

## Governing
Spec §8 (I7, I9, I10), §10(S7), §11 (ALL), §12(W5) · ENHANCEMENTS E1, E4,
E7 · DECISIONS (runtime law: user apps run in the Prism runtime — no
deviation) · canonical-3 (RUNTIME/NODE-EDITOR/CANVAS specs) · prompt-edit
contract (src/lib/prompt-edit/) · model-config (7.4) · V-STANDARD ·
NEAR-HUMAN-QA.

## Tasks
1. **Conductor service:** approved Brief (W2) → plan (hubs/nodes) → graph
   authored via node-agent plan path ONLY (never raw code injection; I10)
   → per-node verify → hydration events streamed over SSE to the builder
   (W1 chat tool-steps, E4: verification evidence visible live) →
   interruptible + resumable; checkpoints to E1 timeline at plan/build/
   verify boundaries. Model from config (7.4); API keys from env (absent →
   full dry-run mode against the stub orchestrator + seeded fixture build,
   prove the pipeline headlessly, list env vars; do NOT block).
2. §11 completion latch wired for USER builds: done = behavioral + visual
   (Direction-Board conformance, 11.3) + deploy verification + fresh-context
   advocate pass. Repair via contamination-aware loop (I2 of dispatch-era
   rules preserved in node-agent).
3. Deploy/publish (S7): target per established stack; env/secrets
   server-side; live URL returned; rollback (E1 restore + redeploy);
   custom-domain field (verification stub acceptable if DNS not testable).
4. E7 export: deployable runtime bundle (.prism + assets + manifest).
5. "Verified shippable" badge only after the full latch (I9).

## Gate (spec: a real app builds → verifies → deploys → live URL → advocate)
Fixture Brief → Conductor → built graph runs in the Prism runtime → verify
latch green → deployed (or dry-run deploy target proof if env-gated) →
advocate PASS. S7 checklist; DL sweep; tsc 0-new; full verify + tenancy ALL
GREEN. Dual judges 0 MUST-FIX.

## Process
Commits+frames; deviations BEFORE code; report notes/SHELL-W5-REPORT.md
(+env var list, Conductor→swarm upgrade notes).
Markers: `PRISM-SHELL-W5: RUN COMPLETE` / `PRISM-SHELL-W5: BLOCKED-NEEDS-FOUNDER`

---
## FOUNDER ADDENDUM — 2026-07-04 (binding): E14 preview URLs
Task 3 explicitly includes per-build PREVIEW deployment URLs (shareable,
Lovable-class) distinct from production ship; surfaced in the builder frame
header (open-in-new-tab targets the preview) and the E1 timeline. Dry-run
mode: local preview server URL + the deploy-target manifest as evidence.
Note: multi-host adapters, domains, and "Ship & Make Profitable" are W5B
scope (spec §14.1) — build W5's deploy seam on the DeployTarget interface
shape (E15) so W5B extends without rework.
