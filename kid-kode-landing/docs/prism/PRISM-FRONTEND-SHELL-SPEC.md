# PRISM-FRONTEND-SHELL-SPEC.md — v1.1 (recovered + decisions ratified)

> **STATUS: ACTIVE FOR BUILD under founder written authorization (2026-07-03
> "build out the rest of the UI entirely" + 2026-07-04 decision locks A–E).**
> Not yet registered in SPEC-INDEX.md — index registration is a separate
> founder act; this session does not edit the index.

> **PROVENANCE:** v1.0 authored 2026-06-26 (session "AI app builder frontend
> specification and design"), delivered to that session's outputs, never
> placed on this Mac. Recovered 2026-07-04. VERBATIM-recovered: §6.9, §7
> (7.1–7.4), §8 (I0–I10), §10 checklists (S2–S7 + Global), §11 (11.1–11.6),
> §12 (W0–W7), §13 (A–G). RECONSTRUCTED from the session record (faithful,
> not verbatim): §0–§5 framing, §9. v1.1 deltas are dated founder
> ratifications, marked inline. On any doubt, the founder's dated decisions
> in PRISM-SHELL-DECISIONS-2026-07-04.md and PRISM-SHELL-DESIGN-LAW-
> 2026-07-03.md control.

---

## 0. The Prime Boundary (reconstructed; law verbatim in I0)

The **shell** (landing, dashboard, chat panel, intake, settings, the frame
around the preview) is React/DOM. The **preview pane interior** is the no-DOM
Three.js/WebGPU engine (the prototype). They communicate ONLY through a typed
command/event surface (authored in W0 as `prism-shell.ts` in
shared-interfaces, additive). The two most likely agent violations — building
shell surfaces in Three.js, or building canvas chrome in DOM — are both
forbidden (§9).

## 1. Surfaces (nine)

S1 Auth (Better Auth) · S2 Landing/Marketing · S3 Dashboard · S4 Builder
Shell (three regions: streaming chat left, engine preview right, right tabs)
· S5 Guided Build / Intake (Claude-Design-style Decision Cards + 3D Direction
Boards, Phases 0–6) · S6 Integrations (Nango spine per decision B/C) ·
S7 Deploy/Publish · S8 Settings · S9 Collaboration/Sharing.

## 2. Design language

Prism Premium — the elevation of the existing token stack — is now governed
by **PRISM-SHELL-DESIGN-LAW-2026-07-03.md (DL1–DL10)**, which supersedes
glass-era surface treatments on shell surfaces (founder-directed 2026-07-03:
no flat glassmorphism, no grotesque display faces, no icon packs, custom
red/black/white 3D geometric icons from the prototype's `premium.ts` system,
real refraction, dark-first, mobile parity). Decision A (LOCKED): materiality
on showpieces + key controls; working surfaces clean-but-premium.

## 3. Guided Build / Intake (reconstructed skeleton; MUST-FIX list in §10 S5)

Phase 0 prompt capture (from landing or launchpad) → Phase 1 Decision Cards —
two interleaved streams: design/product (archetype → 3D Direction Boards →
key hubs → tone) and capability/integration (backend needs → one-click
integration tiles → GitHub → deploy target); every card: visual options +
free-text escape hatch + Skip; ≤ ~6 cards common case; "skip questions —
just build" fast path → Phase 2 Build Brief (BLOCKS until approved; every
line editable; "try a different approach" branches) → Phase 3 Plan → Phase 4
Build (live, interruptible, engine materializes waves) → Phase 5 Verify
(§11 — behavioral + visual + deploy) → Phase 6 Ship (live URL) → Refine.

## 6.9 Collaboration / Sharing (S9) — verbatim v1.0, E-amendment marked

6.9.1 **Org-scoped sharing** (Claude-Design model): private · view · comment
· edit. Edit grants a teammate the ability to modify the project *and* chat
with the builder in the same session.
6.9.2 **Live multiplayer in the builder:** collaborator presence, shared
selection, group chat with the agent. ~~Presence/cursors via SSE~~
**[AMENDED per decision E, LOCKED 2026-07-04: presence/cursors/co-editing
via the CollabRoom Durable Object channel (hibernatable WebSocket, one room
per project); SSE remains the sole transport for engine/build/server-push.
Co-editing = per-property last-writer-wins with the room as ordering
authority through the existing additive-schema mutation path; per-node soft
locks; per-user undo; character-level CRDT deferred past v1.]**
6.9.3 Share a built app via internal org URL or its live deploy URL;
export/handoff bundle where relevant.

## 7. Model & Orchestration — verbatim v1.0, dated reality note

7.1 The **user-facing model selector** controls the model that drives intake,
planning, and build orchestration. **Opus 4.8** is the current default and
only active option. **Fable 5** appears in the selector as **"available when
access resumes"** — selectable-but-disabled with a clear state, *never*
presented as available when it isn't.
   **[REALITY NOTE 2026-07-04: Fable 5 access has resumed (it runs this
   harness). Per 7.2/7.4 this is a config flip: current config = Fable 5
   active default, Opus 4.8 active. §13.F thereby resolves.]**
7.2 The selector is architected so enabling Fable 5 (or future Mythos-tier
models) is a config flip — no UI rework. Per-project override allowed;
default set in Settings.
7.3 **Build-time subagent routing is separate.** The CONSTELLATION rig is a
*harness deployment mode*, invisible to and independent of the user's model
choice. The frontend never exposes or depends on subagent routing.
7.4 The shell must not hardcode model strings in components; model
identity/availability comes from a single config source (so "whichever is
newest" is a data change, not a code change).

## 8. Invariants (NEVER violate) — verbatim v1.0, E-amendment marked

I0. **The Prime Boundary (§0).** Shell = DOM; engine interior = no-DOM
Three.js/WebGPU. Communicate only via the command/event surface.
I1. **SSE only.** No WebSockets, no Socket.IO, no polling loops.
   **[AMENDED per decision E, LOCKED 2026-07-04: SSE remains the sole
   transport for engine/build/server-push events. ONE scoped exception: the
   S9 CollabRoom channel (hibernatable WebSocket DO, presence + co-editing
   ops only). Any other WebSocket/polling remains forbidden.]**
I2. **Better Auth only.** `sameSite:'lax'` cookies. No second auth system.
I3. **Zustand only** for shared state; one store per concern.
I4. **Contract-first** (tRPC + Zod) before client/server code.
I5. **Secrets never reach the client.** No raw tokens/keys in DOM, state,
logs, URLs, or the graph — only capability references. Credential entry is
delegated (provider/Nango/GitHub App), never typed into shell fields.
I6. **The free-text escape hatch is universal (C6).** Every option set has a
"describe your own."
I7. **Approval gates block.** The Build Brief (Phase 2) blocks until
approved; integrations require explicit allow; production-app edits go via
PR with per-action confirmation for anything irreversible.
I8. **Engine-aware, Cortex-safe.** Shared chrome must not break Cortex;
default unknown engine types to the safe path.
I9. **"Shippable" means verified (§11),** not "build finished."
I10. **Graph mutation discipline.** Visual Edit and chat edits produce
scoped, additive graph mutations through the established mutation path
(single-node edits leave neighbors untouched).

## 9. Forbidden Patterns (reconstructed; each = MUST-FIX)

FP1. Building any shell surface inside Three.js/the engine, or any canvas/
engine chrome in DOM (I0 violations, both directions).
FP2. Any WebSocket, Socket.IO, or polling outside the single E-scoped
CollabRoom channel.
FP3. Raw secrets/tokens anywhere client-side; credential fields in shell UI.
FP4. Hardcoded model strings in components (7.4).
FP5. Icon packs, emoji, flat glassmorphism, grotesque display faces on shell
surfaces (DESIGN LAW DL3/DL4/DL5/DL9).
FP6. A second auth system, a second state library, or client/server code
before contracts (I2/I3/I4).
FP7. Touching the canvas editor at `/` or engine interior files from shell
waves. The prototype is out of scope for shell work.
FP8. Treating "build finished" as done without §11 verification (I9).

## 10. Per-surface MUST-FIX defect checklists — verbatim v1.0

**S2 Landing**
- [ ] Landing prompt CTA actually enters Phase 0 — no dead-end.
- [ ] Reduced-motion + low-GPU fallbacks present; no layout shift; LCP not
      blocked by the showpiece.
- [ ] Renders correctly at 380px; mobile hero fallback defined.
- [ ] Output looks bespoke (Prism Premium), not a generic landing template.
      *(MUST-FIX — DESIGN LAW)*

**S3 Dashboard**
- [ ] Project cards show real live/last-frame 3D thumbnails (not
      placeholders) and signature jewel.
- [ ] Prompt launchpad is the visual focal point; submitting starts the
      Guided flow.
- [ ] Slide-out nav animates without jank, is keyboard-operable,
      focus-trapped while open.
- [ ] New-build options (template, integrations, GitHub import, model)
      reachable via progressive disclosure, not a wall.
- [ ] First-run empty state is a guided invitation, not a void.

**S4 Builder Shell**
- [ ] Engine embed communicates *only* via the command/event surface (no
      internal reach).
- [ ] Outer preview frame (DOM) and in-engine chassis toolbar are visually
      harmonious but correctly separate layers.
- [ ] Chat agentic loop streams with collapsible tool steps; interruptible
      at all times.
- [ ] Visual Edit selection round-trips and produces a single-node graph
      mutation (neighbors untouched).
- [ ] Cortex projects render the iframe preview + agent feed in the *same*
      chrome.

**S5 Guided Build / Intake**
- [ ] ≤ ~6 cards in the common case; never an interrogation; fully-specified
      prompts can skip to Plan.
- [ ] Direction Boards are real 3D mini-scenes, distinct from each other,
      and the chosen one demonstrably seeds the build.
- [ ] Every card has visual options *and* a free-text escape hatch *and* Skip.
- [ ] Integration tiles connect one-click via in-brand Nango UI; no secret
      ever touches the shell.
- [ ] Plan (Phase 2) blocks until approved; every plan line is editable;
      "try a different approach" branches.
- [ ] "Skip questions — just build" path works end-to-end.

**S6 Integrations**
- [ ] Connect UI is white-labeled in the Prism design system (authorizes
      against Prism brand).
- [ ] Only capability references stored; re-auth, revoke, scope-review
      present.
- [ ] GitHub production-app edits go via branch + PR; no force-push;
      irreversible actions confirmed per-action.
- [ ] On-demand connector request path exists for catalog misses.
      **[Decision C RIDER, 2026-07-04: the "connect anything" affordance
      LEADS the integrations surface — search-any-platform input; a catalog
      miss flows directly into the agent-authored-connector request path,
      never buried.]**

**S7 Deploy**
- [ ] Env/secrets server-side only; live URL returned; rollback works.
- [ ] "Done" only after deployed app passes behavioral + visual verification.

**Global**
- [ ] ~~No WebSockets/polling anywhere; all liveness via SSE.~~
      **[E-amended: all liveness via SSE except the single CollabRoom
      channel; no other WebSockets/polling anywhere.]**
- [ ] WCAG 2.2 AA across the shell (keyboard, focus, contrast,
      reduced-motion, labels).
- [ ] No hardcoded model strings; model availability from config (7.4).

## 11. Behavioral Verification Standard — verbatim v1.0

Per `VERIFICATION-STANDARD.md` and the project's "verification must be
behavioral, not structural" principle. Checking that code was written ≠
checking that intent was fulfilled.

11.1 **Headless, always.** All verification runs headless (Playwright
`headless: true`) — no browser windows painting on Logan's monitor.
11.2 **Behavioral, interactive.** Verification *uses* the product: navigates
the landing, runs the Guided flow end-to-end (including picking a Direction
Board and connecting a test integration via a sandbox/mock), starts a build,
drives Visual Edit, triggers a deploy, then opens the **deployed** app and
exercises its real flows (clicks, inputs, navigation) — confirming the app
*works*, not that files exist.
11.3 **Visual verification against the chosen direction.** The deployed app
and the canvas are checked to match the selected Direction Board's
material/type/motion intent. Generic output that ignores the direction is a
MUST-FIX failure.
11.4 **Fresh-context user-advocate subagent.** A subagent with no build
context plays the user and judges whether the *intent* was fulfilled across
each surface. Its failure **blocks completion** — it is not advisory.
11.5 **The completion latch (Sentinel v4).** "Done" requires **both** the
report exists **and** agents==0 **and** behavioral + visual + deploy
verification pass. A skeleton report never reads as done.
11.6 **Repair, then re-verify.** Failures route through the
contamination-aware repair loop (regenerate from spec, never show broken
code to the repair model) and re-verify. The loop does not exit on "enough"
— *enough = not enough*.

## 12. Build Plan — Harness Deployment — verbatim v1.0, status annotated

This frontend is too large to one-shot. **Wave it**, each wave behaviorally
verified before the next. Deploy via the same sentinel harness.

- **W0 — Foundations & boundary.** Prism Premium design tokens/components
  (elevating the Glass system — now under DESIGN LAW 2026-07-03), the
  shell↔engine command/event surface (§6.4.4) as a typed contract,
  model-config source (§7.4), Brand Profile schema. *Gate: contract + tokens
  verified, Cortex unbroken.* **[STATUS: LAUNCHED 2026-07-04 under founder
  authorization; adds CollabRoom contract TYPES (E) and DL3 typeface
  evidence for founder sign-off.]**
- **W1 — Builder Shell.** The three-region shell, top bar, preview frame,
  right tabs, chat agentic loop, engine embed (against a stub if the engine
  session isn't merged yet). *Gate: embed contract + interruptible chat
  verified.*
- **W2 — Guided Build / Intake.** Decision Cards, Direction Boards, Build
  Brief + approval gate, Plan/Build split, "skip to build." *Gate:
  end-to-end intake incl. escape hatch + branch, behaviorally verified.*
- **W3 — Integrations + GitHub.** Nango white-label Connect UI, catalog,
  connected-account mgmt, GitHub App installations/repo selection, approval
  gate, on-demand connector request. *Gate: one-click connect (sandbox) +
  PR-based prod edit verified; zero secret leakage.*
- **W4 — Dashboard.** Project gallery w/ live thumbnails, launchpad,
  slide-out nav + panels, empty state. *Gate: nav animation +
  launchpad→intake verified.*
- **W5 — Deploy/Publish + Verify loop.** Targets, custom domain, env, logs,
  rollback, and the full behavioral+visual+deploy verification harness (§11)
  wired as the completion gate. *Gate: a real app builds → verifies →
  deploys → live URL → passes fresh-context advocate.*
- **W6 — Landing/Marketing + sub-pages.** Hero showpiece, gallery,
  how-it-works, pricing, docs/changelog/legal, SEO. *Gate: live hero +
  landing-prompt→build + a11y + perf verified.* **[Decision D: Next.js
  marketing surface.]**
- **W7 — Collaboration/Sharing + Settings polish.** Org sharing, live
  multiplayer **[now fully spec'd per E lock — CollabRoom DO, presence,
  LWW co-editing]**, settings depth. *Gate: share/permission matrix
  verified.*

## 13. Open Decisions — RESOLVED

A–E: **LOCKED** per PRISM-SHELL-DECISIONS-2026-07-04.md (founder written
acts, 2026-07-04). F: **resolved by reality + §7.4** — Fable 5 access
resumed; selector ships config-driven with Fable 5 active. G: **placement
executed 2026-07-04** (this file, docs/prism/); SPEC-INDEX registration
remains a founder act, not performed by this session.

---
*v1.0 authored 2026-06-26. v1.1 recovered to disk + decisions merged
2026-07-04. Deviations follow CLAUDE.md protocol →
spec-deviations-prism.md.*


---

## 14. 2026-07-04 Plan Addendum (founder-directed, same-day written direction)

Two waves added to §12 by founder instruction ("we need things like login,
auth (google and GH one click auth)... db and storage and accounts" + the
competitive/SR mandate). Enhancements doc PRISM-SHELL-ENHANCEMENTS-2026-07-04
is binding on waves that cite its E-IDs.

- **W1A — Accounts & Tenancy** (runs after W1, before W2). Better Auth with
  Google + GitHub one-click OAuth (I2); user/org/project schema (tRPC+Zod,
  contract-first); per-tenant project storage (graphs to R2/Supabase per
  established stack); TENANT ISOLATION INVARIANT (new I11): no user's
  projects, graphs, assets, or builds are ever readable by another tenant —
  enforced at the data layer and CI-tested with a two-user isolation probe;
  plan-tier field stubs (E6; billing integration deferred to testing phase).
  *Gate: signup→dashboard on both providers verified headless; isolation
  probe green; Cortex unbroken.*
- **W8 — SR Benchmark + Competitive Polish** (final wave). E8 scroll-scrub
  driver, E9 cursor-reactive driver, E10 transition presets, E11 three
  SR-flagship recreations as .prism templates with side-by-side evidence,
  E2 gallery seeding. *Gate: three templates pass behavioral+visual verify;
  side-by-sides judged ≥ SR originals by fresh-context advocate.*

**I11 — Tenant isolation** is hereby added to §8 invariants with the wording
above. Revised wave order: W0 ✓ → W1 → W1A → W2 → W3 → W4 → W5 → W6 → W7 →
W8. Decision H (v1 user-build engine) gates W5 and is recorded in
PRISM-SHELL-DECISIONS-2026-07-04.md when locked.

### §14.1 — 2026-07-04 (afternoon) — W5B added by founder written direction

- **W5B — Ship Anywhere** (queued after the W1–W8 chain). E13–E20 per
  PRISM-SHELL-ENHANCEMENTS-2026-07-04: host adapter layer (front + backend/
  GPU targets) with generated per-host config and post-ship verification
  against the live host; Entri Sell domains in-platform (+ Vercel/Cloudflare
  registrar adapters); "Ship & Make Profitable" completeness scan with
  one-click capability cards in chat; host recommendations with live
  pricing; backend nodes deployable + validated; managed-care tier stub.
  *Gate: fixture app ships to ≥2 real-or-dryrun targets incl. one backend
  target, post-ship verification green, domain flow proven (sandbox ok),
  completeness scan adds a missing capability end-to-end.*
