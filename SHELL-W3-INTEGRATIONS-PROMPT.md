# SHELL W-3 — INTEGRATIONS + GITHUB (Nango spine, connect-anything)

Branch `codex/prism-recovery-harness-20260630`. Additive. Evidence law.

## Governing
Spec §8 (I5, I7), §10(S6 + C-rider), §12(W3) · DECISIONS B (Nango SOLO) +
C rider (connect-anything LEADS) · ENHANCEMENTS E5 · DESIGN LAW · V-STANDARD ·
NEAR-HUMAN-QA · integration-bridge.md (existing project doc).

## Hard boundaries
Nango is the ONLY spine (decision B). Capability references only — no raw
token ever client-side, in state, logs, URLs, or graphs (I5). GitHub prod
edits via branch+PR, no force-push, per-action confirm (I7). If Nango/GitHub
App credentials absent from env: build the full white-label UI + server
adapters against Nango's sandbox/mock mode, prove flows headlessly, list
exact env vars for founder (do NOT block).

## Tasks
1. Integrations surface: **"Connect anything" search LEADS the page** (C
   rider) — search any platform; catalog hits show one-click tiles; MISSES
   flow directly into the agent-authored-connector request path (request UI
   + server queue record; the authoring agent itself is W5+ scope — queue
   contract now).
2. White-labeled Nango Connect UI in the Prism design system (authorizes
   against Prism brand); connected-account management: re-auth, revoke,
   scope review.
3. Curated head catalog: seed ~12 tiles across payments/comms/data/social
   (config-driven list), sandbox-connect one of them end-to-end headlessly.
4. GitHub App: installation/repo selection UI + import-repo entry (wired to
   intake's GitHub card); PR-based edit path contract for production apps.
5. E5: per-app env/capability panel (server-side vault refs; scope review).
6. Intake tiles (W2) now bind to this catalog contract.

## Gate (spec: one-click connect sandbox + PR path verified; zero leakage)
Headless: search hit → one-click sandbox connect → capability ref appears in
project; search MISS → request path recorded. Secret-scan greps prove zero
leakage (report evidence). S6 checklist green; DL sweep; tsc 0-new; full
verify + tenancy probe ALL GREEN. Dual judges 0 MUST-FIX.

## Process
Commits+frames; deviations BEFORE code; report notes/SHELL-W3-REPORT.md
(+env var list). Markers: `PRISM-SHELL-W3: RUN COMPLETE` /
`PRISM-SHELL-W3: BLOCKED-NEEDS-FOUNDER`
