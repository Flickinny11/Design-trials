# SHELL W-5B — SHIP ANYWHERE (hosts, domains, make-profitable, backend deploy)

Branch `codex/prism-recovery-harness-20260630`. Additive. Evidence law.
Runs AFTER the W1–W8 chain completes (queued by run-shell-chain-B.sh).

## Governing
Spec §10(S7), §11, §14.1 (W5B gate) · ENHANCEMENTS E15–E20 (verbatim founder
anchors at top of that section — read them) · DECISIONS (H Conductor;
runtime law; ship-anywhere record) · W5 report (DeployTarget seam) · DESIGN
LAW DL1–DL14 · V-STANDARD · NEAR-HUMAN-QA.

## Hard boundaries
Everything env-gated builds fully in dry-run/sandbox and lists exact env
vars — never block on missing keys, never fake a "live" claim (dry-run
evidence is labeled dry-run). No raw secrets client-side ever (I5). Canvas
`/` untouchable. User apps run in the Prism runtime — no deviation.

## Tasks
1. **E15 host adapters.** `DeployTarget` registry (typed, config-driven):
   frontend — Vercel, Netlify, Cloudflare; backend/GPU — Modal, RunPod,
   Vast (interface extensible; do not hardcode the set). Each adapter:
   requirements schema → Conductor generates host config for the user's app
   → deploy → **post-ship verification** runs §11.2 behavioral checks
   against the LIVE shipped URL/endpoint → status + evidence into chat (E4).
   Prove: Vercel path live-or-dryrun END TO END; one backend adapter
   deploys a small open-source model endpoint (dry-run acceptable) and the
   latch validates a real inference round-trip against it.
2. **E16 domains.** Entri Sell integration (availability check → in-UI
   purchase modal → Connect auto-DNS → Monitor webhook recorded to the
   project); adapter seam for Vercel Domains Registrar + Cloudflare
   Registrar as config alternates. Sandbox/dry-run proof + webhook fixture.
3. **E17 Ship & Make Profitable.** The SHIP entry (E13 nav + builder) runs
   the Conductor completeness scan (auth, db, storage, payments,
   subscriptions, email, analytics vs the app graph); missing capabilities
   render as one-click cards IN the streaming chat (W3 catalog); accepting
   a card has the Conductor add the nodes through certified paths; then the
   ship flow. Also invocable purely by natural-language prompt. Prove: a
   fixture app missing payments → scan → one-click card → nodes added →
   verify latch green → ship flow reached.
4. **E18 recommendations + pricing.** Ship flow recommends frontend AND
   (when backend/GPU nodes exist) backend hosts based on the graph, with
   CURRENT pricing fetched live at run time (cache ≤24h, source cited in
   UI); user one-clicks a pick.
5. **E19 backend nodes.** Ensure backend/GPU node classes flow through
   adapters with generated configs (e.g., open-source model workflow on
   the chosen target), then verified by the latch. Document the node→target
   mapping contract.
6. **E20 managed-care stub.** Enterprise/care tier gate + scheduled
   post-deploy check scaffolding (reuses node-agent self-heal seam) +
   pricing stub copy; live monitoring agents flagged post-testing-keys.
   Free path: user can always prompt fixes.

## Gate (spec §14.1)
Fixture app ships to ≥2 targets (≥1 backend) with post-ship verification
green; domain flow proven sandbox; completeness scan adds a capability
end-to-end; all frames both viewports; DL sweep; tsc 0-new; full verify +
tenancy ALL GREEN. Dual fresh-context judges 0 MUST-FIX.

## Process
Commits+frames; deviations BEFORE code; report notes/SHELL-W5B-REPORT.md
(+complete env-var list per adapter). Markers:
`PRISM-SHELL-W5B: RUN COMPLETE` / `PRISM-SHELL-W5B: BLOCKED-NEEDS-FOUNDER`
