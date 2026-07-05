# SHELL W-7 — COLLABORATION + SETTINGS (org sharing, CollabRoom multiplayer)

Branch `codex/prism-recovery-harness-20260630`. Additive. Evidence law.

## Governing
Spec §6.9 (E-amended), §8 (I1-amended, I11), §10 Global, §12(W7), §14 ·
DECISIONS E (LOCKED, enterprise-tier scope) + multi-tenant clarification ·
shared-interfaces prism-collab.ts (W0 types) · DESIGN LAW · V-STANDARD ·
NEAR-HUMAN-QA.

## Hard boundaries
The CollabRoom Durable Object channel is the ONE WebSocket exception (I1
amendment) — presence + collab ops only; SSE stays sole transport for engine/
build/server events. Multiplayer is ENTERPRISE-tier gated (decision scope).
Per-property LWW through the EXISTING additive mutation path only — never a
parallel write path (I10). Character-level CRDT is out of scope (deferred).

## Tasks
1. CollabRoom DO: one room per project; hibernatable WebSocket server;
   presence fan-out (cursors, selections, camera ghosts, editing-node
   badges — ephemeral, throttled, never persisted); op sequencing:
   per-property LWW with room-issued seq, ops applied via the established
   mutation path; per-user undo (own ops only).
2. Org sharing (S9): private · view · comment · edit; edit grants project
   modify + chat-with-builder in the same session; share via org URL or
   live deploy URL; permission matrix enforced server-side (I11-consistent:
   org membership is the ONLY cross-user visibility, explicit and audited).
3. Enterprise org dashboard: shared org view of collective builds (founder
   scope note) — seats under one org, member management stubs.
4. Settings depth: profile, org, model preference (7.4 config), usage (E6),
   danger zone (delete w/ confirm), notification prefs.
5. Presence UI in the builder (W1) behind the enterprise gate; two headless
   clients prove live cursor + LWW convergence (same property raced →
   deterministic winner, both clients converge; frames + op logs).

## Gate (spec: share/permission matrix verified)
Matrix test: each role's allowed/denied actions asserted server-side; race
convergence proof; non-enterprise tenants see no multiplayer surface; SSE
paths untouched (grep proof). Checklists green; DL sweep; tsc 0-new; full
verify + tenancy ALL GREEN. Dual judges 0 MUST-FIX.

## Process
Commits+frames; deviations BEFORE code; report notes/SHELL-W7-REPORT.md.
Markers: `PRISM-SHELL-W7: RUN COMPLETE` / `PRISM-SHELL-W7: BLOCKED-NEEDS-FOUNDER`
