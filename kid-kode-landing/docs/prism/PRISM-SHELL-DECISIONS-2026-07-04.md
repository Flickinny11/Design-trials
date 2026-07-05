# PRISM SHELL — FOUNDER DECISIONS RECORD — 2026-07-04

> Ratification record. Logan answered the shell open-decision block in writing
> on 2026-07-04 (project session). These bind the frontend shell spec on its
> recovery to disk. E is a proposal pending Logan's one-word lock.

- **A — LOCKED (recommendation accepted).** Materiality discipline: worn-metal
  / refraction showpieces on hero moments and key controls only; working
  surfaces (forms, lists, settings) clean-but-premium. Governed by
  PRISM-SHELL-DESIGN-LAW-2026-07-03.md (DL10).
- **B — LOCKED.** Nango SOLO as the integration spine v1. No Composio/Arcade
  layer in v1.
- **C — LOCKED (recommendation accepted, with founder rider).** Curated
  one-click catalog for the head + agent-authored Nango connectors for the
  long tail. RIDER (binding UX requirement): users must plainly SEE that they
  can integrate with anything — the integrations surface and marketing lead
  with a "connect anything" affordance (search-any-platform input that, on a
  miss, flows directly into the agent-authored-connector request path, in the
  primary catalog UI, never buried). Copy may promise "integrate with
  virtually anything, one click" because the long-tail path makes it true.
- **D — LOCKED (recommendation accepted).** Next.js marketing surface for the
  public landing (SSR/SEO), alongside the Vite app. Affects W6.
- **E — LOCKED (founder written lock, 2026-07-04 10:38 CDT).** True live
  multiplayer, additive:
  1. SSE-only law receives ONE scoped amendment: SSE remains the sole
     transport for engine/build/server-push events; collaboration gets its
     own additive channel — one `CollabRoom` Durable Object per project via
     Cloudflare's hibernatable WebSocket API (GA 2026; idle rooms hibernate
     at near-zero cost; stack-native — DOs already run BuildSession + ledger).
  2. Presence layer v1: live cursors, selections, camera ghosts,
     who's-editing-which-node badges. Ephemeral, throttled, never persisted,
     zero data-model changes.
  3. Co-editing = the Figma model, NOT CRDT-everything: graph mutations keep
     flowing through the existing additive-schema path; in shared sessions
     the room DO sequences ops (per-property last-writer-wins, server as
     ordering authority), broadcasts committed ops; clients apply
     optimistically. Per-node soft locks reduce conflicts socially. Undo is
     per-user. Character-level CRDT (Yjs/Loro) reserved ONLY for
     simultaneous typing inside one text field — deferred past v1.
  Rejected after 2026-07-04 research: adopting a sync engine (Zero /
  LiveStore / Electric / Jazz) — Zero is the production leader but is a
  data-sync store that explicitly excludes presence and would relocate the
  graph's source of truth (the fundamental change the founder forbade);
  Electric long-polling panned in production reports; Triplit team absorbed
  by Supabase. Presence-vs-data-sync separation matches 2026 best practice.

---
*Recorded 2026-07-04 by the working session under founder written direction.
On E's lock, this file's E section merges into the shell spec §13 and W7.*

---
## Founder scope clarifications — 2026-07-04 (verbatim intent, recorded same day)

**Multi-tenant is the product; multiplayer is a tier feature.** The default
posture is thousands of INDEPENDENT users, each with their own account,
subscription, projects, storage, and builds — hard per-tenant isolation (no
user's data or builds ever visible to another). Auth: Better Auth (I2) with
**Google and GitHub one-click OAuth** explicitly required on S1. Decision E's
CollabRoom multiplayer is scoped as an ENTERPRISE-tier capability: multiple
seats under one org account, a shared org dashboard, collective work on the
same build. The two concepts are distinct and both in scope; E's lock stands
with this scoping. Tenant-isolation is to be encoded as an explicit invariant
in the next spec amendment pass.

**Runtime law reaffirmed:** every app built by the AI builder and edited in
the canvas/node editors runs in the Prism runtime. No deviation.

---
## Founder locks — 2026-07-04 (afternoon, written: "lock H and 'font A'")

- **H — LOCKED.** v1 user prompt-to-app engine = the **Conductor**: one
  orchestrator session per user build that authors the graph EXCLUSIVELY
  through the certified node paths (node-agent validated plans, additive
  schema, schema-completeness + verify gates), generating nodes in small
  config-bounded parallel batches, streaming hydration + verification
  evidence over SSE, checkpointing to the E1 timeline, interruptible and
  resumable. The swarm-dispatch harness (separate, non-ratified spec)
  remains the scale upgrade behind its model bakeoff; Conductor interfaces
  MUST NOT preclude that upgrade. W5's decision gate is hereby cleared.
- **Typeface — LOCKED: Board A.** Fraunces (neo-serif display) ×
  JetBrains Mono (data-grade utility), exactly as wired in W0. This
  satisfies DL3's founder sign-off requirement; boards B and C remain
  archived in the W0 report for reference.

- **Ship-anywhere scope — founder direction 2026-07-04 (afternoon).**
  Recorded verbatim in PRISM-SHELL-ENHANCEMENTS-2026-07-04 §E13–E20; binding
  on W4 (E13), W5 (E14), and W5B (E15–E20). No new founder decisions opened:
  host/domain vendor picks are config (Entri Sell + Vercel/CF registrar
  adapters recommended); managed-care pricing deferred to testing phase.
