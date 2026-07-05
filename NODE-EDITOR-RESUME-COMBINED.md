# RESUME MODE — prior session interrupted. Read notes/verification/NODE-EDITOR-PROGRESS.md + git log FIRST. Verify cheaply,
# don't redo verified phases, continue from first incomplete. Confirm modelUsage==claude-opus-4-8 (Fable down → silent opus
# fallback). Check notes/LOGAN-INBOX.md. Token-efficient. Bar is WOW + production-ready contract.
# NODE EDITOR — build the hardened harness: prompt-to-edit + Functions tab + Integrations tab + galaxy planets. (Claude Code, ultracode)
# Bar is WOW + production-ready CONTRACT. Logan judges frames; monitor is hard pre-judge. Interactive + visual verification.

## MODEL & MODE
MODEL: claude-opus-4-8 (Fable-5 DOWN, silent opus fallback; confirm modelUsage==claude-opus-4-8 at start AND after any
resume; record in ledger; never trust the label). 1M context. ULTRACODE: Dynamic Workflows, PARALLEL subagents in verified
waves, CONTRACT-FIRST per phase. Branch prism-editor-build, from git root. AUTO-CKPT at every VERIFIED phase (standard
exclusions; worktrees==0). LOGAN-INBOX polling at phase boundaries. ANTI-STUCK: web-search CURRENT (June 2026) after ~2
fails; never downgrade a dep; NEVER fake/assert — evidence (frames + interaction). ENV: NODE_ENV unset; kill browsers/dev
servers at each phase end. Resumable: notes/verification/NODE-EDITOR-PROGRESS.md.

## READ FIRST (authoritative)
- docs/prism/PRISM-NODE-EDITOR-SPEC-V2.md — THIS RUN IMPLEMENTS IT (DECISIONS D1-D5, INV-NEV2, FORBIDDEN, criteria A-E).
- docs/prism/PRISM-NODE-EDITOR-SPEC.md — base spec (galaxy rig §3, hub editor §4, purpose tabs §5.1, captions §7, the
  edit→build→verify→preview path §9, boundary §1.2/§5.3, INV-NE-1 frozen topology).
- docs/prism/PRISM-CANVAS-EDITOR-SPEC.md AMENDMENT 2026-06-14 (Function/nav in Canvas synced via the node's additive schema
  — the prompt-edit "function" output writes that SAME shared schema).
- docs/prism/DESIGN-REFERENCES.md (premium toolkit, injected into prompt-edit). The Observatory-Brass design system.
- notes/NODE-EDITOR-HARDENING.md (the analysis + current-tooling research this is built on).

## RE-VERIFY CURRENT (training stale ~1yr) — do at start
Probe NEWEST Opus model id. Re-pull current versions (npm registry): @modelcontextprotocol/sdk, @pipedream/sdk,
@composio/core, nango, @supabase/supabase-js, ai (Vercel AI SDK), @anthropic-ai/sdk; and any NEWER one-click-auth standard.
Use newest stable. Record in ledger.

## PHASES (each: contract → parallel waves → verify → AUTO-CKPT; advocate WOW + production-ready, DPR-2, desktop+mobile+constrained)
P1 PROMPT-TO-EDIT HARNESS (criteria A): canvas "Prompt Edit" toolbar action (multi-select aware) + node-editor prompt-edit;
   orchestration endpoint (Vercel AI SDK v6 + @anthropic-ai/sdk, newest Opus) behind a CONTRACT with a STUB returning a
   valid sample PLAN; DESIGN-REFERENCES + ~406 primitive catalog + 36-element library INJECTED (premium-first; optional
   @tag); structured PLAN → node additive schema (design+anim→canvas, function→node tabs). Production-ready = live model is a swap.
P2 FUNCTIONS TAB (criteria B): smart auto-complete search → branded action TILES (REAL provider logos via the adapter),
   drag onto node, MULTIPLE + REORDERABLE; validate-on-select (live test via adapter/MCP sandbox; Opus auto-fix if broken);
   paste/save/NAME custom snippets → SnippetStore (Supabase adapter + stub) per-user. CapabilityProvider interface + MCP
   reference adapter + Pipedream/Composio/Nango stubs.
P3 INTEGRATIONS TAB (criteria C): auto-fill platform search + branded logos; one-click auth (OAuth 2.1 + MCP + API token +
   CLI) via the adapter's managed auth, storing a capability REFERENCE only (INV-R13); once authed → self-populate the
   user's saved assets → drag-drop into nodes; each integration = a content icon on the node in galaxy. Prove the runpod flow (mock auth).
P4 GALAXY PLANET / <app>_world (criteria D): hubs as PHOTOREAL planets (brass/bone/ice, lit, glow) orbiting a central
   "<app_name>_world" body; each hub SIZED by total artifact size; node-state spheres + per-integration content icons;
   lightning-fast, tier-gated, mobile+constrained.
P5 INTERACTIVE VERIFICATION + SIGN-OFF (criteria E + all evidence): advocate DRIVES it as a person — prompt-edit a request
   (incl. "make these two collide"), search+drag+reorder function tiles, validate-on-select, save/reload a snippet, connect
   an integration (mock) + drag an asset, navigate the galaxy planets — DESKTOP + MOBILE + CONSTRAINED. Bar = WOW +
   production-ready or MUST-FIX; iterate → 0 MUST-FIX. No-regression (canvas/preview/406/36/suite/tsc 0-new).

## GUARDRAILS
INV-NEV2-1..7 + base INV-NE-1. Graph topology FROZEN; additive-only schema; round-trips. Capability references ONLY for
secrets (INV-R13) — never raw tokens in schema/UI/logs. Prompt-edit emits a VALIDATED plan, never executes raw model code.
Provider-agnostic — no UI coupling to one aggregator SDK. No visual-editor mode in the node editor. One renderer
(Three.js/TSL/WebGPU); photoreal planets; NO PURPLE; design-tokens only; no stock icons or fake brand logos (real provider
assets via adapter); no diffusion text; no dep downgrades; never surface "fal"; never print FAL_KEY/any secret; secret-leak
check before every checkpoint; assertion-based verification FORBIDDEN. fal budget: same $50 account, cumulative ledger.

## OUTPUT
notes/NODE-EDITOR-REPORT.md: per-criterion (A-E) evidence with frames + interaction; the CapabilityProvider/adapter
architecture + which SDKs/versions wired; the prompt-edit contract + sample plan; functions-tab tiles + validate-on-select +
Supabase snippets; integrations one-click-auth (capability-ref proof, no raw secret) + asset drag; galaxy planet/world
before/after; no-regression + perf; secret-leak result; honest flags + what's stub vs live; AUTO-CKPT hashes. Frames under
kid-kode-landing/notes/verification/node-editor/. Plain-language summary + WOW/production-ready verdict. STOP.
