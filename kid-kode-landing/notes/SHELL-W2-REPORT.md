# SHELL W2 — Guided Build / Intake — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630`
**Date:** 2026-07-04
**Commits:** `b6013b16` (Task 0), `d6b56cad` (W2 intake), `fb2889b2` (round-1 should-fixes) — plus this report.
**Status:** `PRISM-SHELL-W2: RUN COMPLETE` — dual judges PASS **0 MUST-FIX (round 1)**.

Additive only. Evidence law. Governed by spec §3/§8/§10(S5)/§12(W2), DECISIONS
(C rider), ENHANCEMENTS E3, DESIGN LAW DL1–DL16, and the two FOUNDER ADDENDA
(Task 0 real-engine mount + frame anatomy; DL15/16).

---

## 0. Task 0 (MANDATORY, done FIRST) — real prototype in the preview frame

The founder's frame correction (SHELL-W1-BUILDER-SHELL-PROMPT.md 2026-07-04
13:40, re-issued as W2 Task 0) is fully executed and committed as `b6013b16`:

1. **Real engine mounts.** `PreviewRegion` hosts the ACTUAL certified prototype —
   the same ORRERY runtime `/` mounts, with galaxy/canvas/preview-app as its
   internal mode states — via an iframe onto a new shell route `/app/engine-frame`
   that composes the **UNMODIFIED** `@/app/page` plus a shell-owned
   `EngineFrameBridge`. The bridge speaks ONLY serialized `prism-shell.ts`
   envelopes over postMessage and drives the prototype through its own published
   `window.__PRISM_EDITOR_SET_VIEW_MODE__` / `__PRISM_DEBUG_STORES__` hooks. **Zero
   engine-interior files modified** (the diff touches only shell/server/docs/schema
   paths — confirmed by the criteria reviewer's `git diff --name-only` + grep).
   `StubEngineCore` demoted to a dev fixture behind `NEXT_PUBLIC_PRISM_ENGINE=stub`
   (default OFF; warns loudly). Deviation **W2-D1**.
2. **Frame anatomy.** Bordered preview frame with its OWN header: app/project label
   left; the premium.ts 3D mode switch (relocated from the W1 top bar) + refresh/
   rebuild, device-size, fullscreen, open-in-new-tab as machined objects on ONE
   shared ortho canvas (`FrameControls3D`, DL8 rider). Refresh = contract
   `unmount`+`mount`.
3. **No mode UI elsewhere.** `TopBar` keeps project name, model selector, share —
   the mode island is gone. Nothing mode-related above or inside the chat column.
4. **Mobile:** the frame header travels with the preview pane (E12 scroll-snap).
5. **Evidence:** `desktop/06-builder-plan-pending.png` — the REAL "Time, machined."
   watch scene rendering inside the framed pane; both judges verified Task 0
   explicitly (no stub/black pane, no top-bar mode island).

---

## 1. Tasks vs. evidence (W2 intake)

| # | Task | Where | Evidence |
|---|------|-------|----------|
| 1 | Phase 0 prompt capture + attach (screenshot/logo/URL) → seeds Brand Profile; standalone route | `src/app/app/build/page.tsx`, `components/shell/intake/PromptCapture.tsx`, `lib/shell/intake/image-seed.ts`, `server/trpc/routers/intake.ts` (`seedFromUrl`, W2-D3) | `desktop/01-phase0-prompt.png`, `desktop/01b-phase0-url-seed.png` (live "Seeded Next.js by Vercel" chip) |
| 2 | Phase 1 Decision Cards — 2 interleaved streams (design ⇄ capability); visual options + free-text escape hatch (I6) + Skip on every card; "skip questions — just build" fast path | `components/shell/intake/{DecisionDeck,DecisionCard,CardOptions3D,OptionGlyph}.tsx`, `lib/shell/intake/{intake-model,intake-store}.ts` | `desktop/02-card-archetype.png`, `desktop/02b-card-backend-capability.png`, `desktop/07-escape-hatch-and-glyphs.png` |
| 3 | Direction Boards — **5** live 3D boards, distinct material/type/motion; selection seeds the Brief | `components/shell/intake/DirectionBoards3D.tsx` (baked PBR: carrara-marble, brushed-copper, walnut-grain) | `desktop/03-direction-boards.png`; **persistence proof** in metrics.json (Carrara → palette/tone/type on disk) |
| — | Integration TILES (DL15 brand marks) + "connect anything" (decision C rider) + GitHub import stub + deploy target | `components/shell/intake/{BrandTiles3D,BrandMark3D}.tsx` | `desktop/04-connect-brandmarks.png` |
| 4 | Phase 2 Build Brief — every line + title editable; approve gate BLOCKS (I7); "try a different approach" branches; approved Brief persists (W1A schema, additive `buildState`) → builder plan-pending | `components/shell/intake/BuildBrief.tsx`, `server/trpc/routers/intake.ts` (`finalize`), `server/tenancy/tenant-store.ts` (`saveBrief`), `components/shell/builder/PreviewRegion.tsx` (banner) | `desktop/05-build-brief.png`, `desktop/06-builder-plan-pending.png` |
| 5 | Mobile parity (390px) for the whole flow | mobile CSS in `intake.css` | `mobile/01-phase0.png`, `mobile/02-card-archetype.png`, `mobile/03-direction-boards.png`, `mobile/04-build-brief.png` |

Contract-first (I4): `packages/shared-interfaces/src/prism-intake.ts` +
`prism-tenancy.ts` (`buildState`); validated at both tRPC edges
(`intake-client.ts` re-parses every response).

---

## 2. Gate table

| Gate item | Result |
|---|---|
| End-to-end intake, behavioral (prompt → cards w/ escape-hatch-on-one + skip-on-one → boards → brief edit → **branch** → fast path → approve → builder plan-pending) | ✅ Driven live in real Chrome; see §3 |
| Frames at each phase, both viewports | ✅ 9 desktop + 4 mobile frames under `notes/verification/shell-w2/` |
| 0 console errors | ✅ 0 (preserved across the full flow + handoff + engine mount) |
| S5 checklist green | ✅ all 6 items (§4) |
| DL sweep incl DL15/16 | ✅ no icon packs / emoji / html-to-image / backdrop-filter glassmorphism / grotesque display fonts / new deps; DL15 colored 3D brand marks; DL16 material-rich, not void |
| tsc 0-new | ✅ **9 = baseline**, 0 new |
| Full verify ALL GREEN | ✅ `npm run verify` exit 0 (verify:prism 6/6, verify:schema 338/338, verify:tenancy 26/26 I11 GREEN, + repair-loop/galaxy/global-shell/parity-static) |
| Unit tests | 3504 pass / 9 fail / 8 skip — **all 9 failures pre-existing editor-build (GraphScene) tests; W2 touches zero editor-build/GraphScene files; 0 new failures in intake/shell/tenancy scope** |
| Perf | Direction Boards **60fps, 1 shared canvas** (5 material scenes, DL8 rider), 96MB heap; Phase 0 1 canvas, 65MB; browser network localhost-only |
| Dual judges 0 MUST-FIX | ✅ both PASS round 1 (§5) |

---

## 3. Behavioral run (headless, real Chrome, Metal GPU)

Prompt "A booking app for a boutique watch atelier…" → **URL seed** `nextjs.org`
(server-side metadata read; "Seeded Next.js by Vercel" chip) → Card 1 archetype
(SaaS) → Card 2 backend (Accounts & auth + Database) → **Direction Boards** (chose
Carrara) → Card 4 connect (Stripe + Supabase + "Notion" long-tail request + Prism
Cloud deploy) → Card 5 sections **SKIPPED** → Card 6 tone **free-text escape hatch
used** → Build Brief (assembled from every source; Carrara seeded the brand chip
"editorial · refined · timeless" + palette) → **edited a line** → **"try a
different approach" branched** (answers preserved, "attempt 2") → **fast path**
back to brief → **Approve** → project created, brief persisted, `buildState`
`plan-pending`, builder shows the plan-pending ribbon over the REAL prototype.

**Persistence proof (on disk):** `proj-eaf0e91a…/brief.json` →
`chosenDirectionId:"carrara"`, palette `#efe9df/#b08d4c/#7d0f18`, tone
`[editorial,refined,timeless]`, type `serif/humanist`, integrations
`[stripe,supabase]` (references only, I5). `projects.json` → `buildState:"plan-pending"`.
This is hard evidence the chosen board seeds the build (S5).

---

## 4. S5 per-surface checklist

- [x] ≤ ~6 cards common case; never an interrogation; fully-specified prompts skip to Plan (fast path) — 6 interleaved cards, visual-first, all skippable.
- [x] Direction Boards are real 3D mini-scenes, distinct, and the chosen one demonstrably seeds the build — 5 boards (machined metal / Carrara marble / brushed copper+stone / glass+sapphire / walnut+brass); seed asserted on disk.
- [x] Every card has visual options AND a free-text escape hatch AND Skip.
- [x] Integration tiles connect one-click via in-brand UI; no secret touches the shell — brand-mark tiles + "connect anything" long-tail; references only (real Nango connect lands W3).
- [x] Plan (Phase 2) blocks until approved; every line editable; "try a different approach" branches.
- [x] "Skip questions — just build" path works end-to-end.

---

## 5. Judge verdicts (both round 1)

**prism-criteria-reviewer — PASS, 0 MUST-FIX.** Verified Task 0 (real host default;
zero engine-interior edits; frame anatomy; no top-bar island; real scene in
`06-…png`), I0/I3/I4/I5/I6/I7/I11, DL8/DL12/DL14/DL15/DL16, additive discipline,
and zero forbidden patterns. Non-blocking should-fixes: (1) SSRF hardening on
`seedFromUrl`, (2) `camera-focused` settle-timed (W2-D2, documented), (3) shared
demo graph across tenants (W2-D5, scoped to W5).

**user-advocate — PLEASED, 0 MUST-FIX.** All six named judgments PASS: never an
interrogation; **5 genuinely distinct boards** (named each material); Task 0 real
prototype + frame anatomy + no top-bar island (verified via full-res crops);
DL15 colored 3D brand marks + DL16 rich-not-void; premium craft (DL1–DL14);
mobile parity. Should-fixes: three mobile polish items.

---

## 6. Should-fix ledger

| Should-fix | Source | Action |
|---|---|---|
| SSRF hardening on `seedFromUrl` | criteria | **TAKEN** (`fb2889b2`) — loopback/link-local/RFC-1918/CGNAT + localhost/.local/.internal denylist before fetch |
| Mobile Phase 0 CTA glyph overlaps label | advocate | **TAKEN** — phone CTA taller + sublabel dropped |
| Mobile board cells crowd title vs object | advocate | **TAKEN** — board cell height 158→190px on phone |
| Mobile brief headline clamps mid-word | advocate | **TAKEN** — smaller title font on phone (recaptured `mobile/04`) |
| `camera-focused` settle-timed (not arrival) | criteria | W2-D2 — engine-session work (deferred) |
| Embedded engine uses shared demo graph | criteria | W2-D5 — Conductor binds tenant graphs in W5 (deferred, stated on-screen) |

---

## 7. Deviations (logged BEFORE code — docs/spec-deviations-prism.md)

W2-D1 real-engine adapter shell-side via iframe/bridge · W2-D2 `camera-focused`
settle-timed · W2-D3 URL seed = server-side metadata read (SSRF-guarded) · W2-D4
`buildState` additive project-row field · W2-D5 embedded engine operates the
certified demo scene (tenant-graph binding is W5).

---

## 8. Readiness

- **W3 (Integrations + GitHub)** inherits the intake's integration-tile contract
  (`intakeIntegrationRef`, provider references) + the "connect anything" long-tail
  path; W3 supplies the real Nango white-label Connect UI + catalog and hardens
  server-side fetch (DNS-rebind) beyond the W2 denylist.
- **W5 (Conductor/Deploy)** consumes the persisted Build Brief + `buildState`
  `plan-pending` to author the real plan/build; binds per-tenant graphs into the
  embedded engine (resolves W2-D5).

`PRISM-SHELL-W2: RUN COMPLETE`
