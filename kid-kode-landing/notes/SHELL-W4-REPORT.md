# SHELL W-4 — Dashboard (gallery · launchpad · E13 3D nav · E1 versions · E6 usage) — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630` · **Additive.** · Evidence law.
**Governing:** spec §10(S3), §12(W4) · E1/E2/E6/E13 · DECISIONS (multi-tenant, A) ·
DESIGN LAW DL1–DL16 · W1A schema. Marker: `PRISM-SHELL-W4: RUN COMPLETE`.

Real S3 dashboard replacing the W1A placeholder: launchpad focal point, project
gallery with **real 3D thumbnails**, the founder-addendum **E13 global 3D slide-out
nav** (dashboard AND builder), **E1** version timeline with verified restore, and the
**E6** usage meter. Everything additive; canvas `/` untouched.

## Commits (this wave)
- `addfb210` tenancy foundation — `project.duplicate`/`project.delete`, E1
  `version.restore` (snapshot→graph round-trip), E6 `usage.get` (real per-tenant
  counts vs config quotas, stub-labeled); client fns; isolation sweep +4 cases.
- `d4d6ed4b` E13 global 3D slide-out nav (hover-reveal pull / mobile tap; weighted
  drawer; keyboard + focus-trap; SHIP entry; renders null inside engine iframe).
- `be9f4aec` **fix**: `restoreVersion` re-entrant-lock deadlock (see Deviations).
- `a754d783` dashboard S3 (launchpad, gallery + 3D thumbnails, card actions, E1
  timeline, Usage/Settings/Templates/Ship panels, empty state).
- `ff1c9768` launch-composition polish + verification evidence bundle + metrics.

## Tasks → evidence
1. **Project gallery** — `ProjectGallery` + `GalleryThumbs3D`: cards with REAL
   3D thumbnails on ONE shared canvas (per-project signature form + jewel from
   `project-signature.ts`), open→builder, rename (inline) / duplicate / delete
   (confirm). *desktop/01, mobile/03.*
2. **Prompt launchpad = focal point** — `LaunchpadHero3D` showpiece + prompt +
   the 3D **Build** object (`PrimaryButton3D`, DL12) → `/app/build?prompt=…`;
   progressive disclosure ("More ways to start" → template / GitHub import /
   integrations / model, config-driven). *desktop/01; launchpad→intake proven below.*
3. **E13 slide-out nav** — `ShellNav3D` + `NavHandle3D` (3D machined pull) +
   `NavEmblem3D`: far-left **hover-reveal** desktop / **tap** upper-left mobile;
   weighted sprung-open / gravity-close (DL6); keyboard-operable + **focus-trapped**
   + Escape; Projects/Templates/Integrations/Usage/Settings + **SHIP**. Mounted in
   `/app/layout` (global; dashboard AND builder); **null inside the engine iframe**
   so the engine pane is unaffected. *desktop/02, mobile/02.*
4. **E1 version timeline** — `VersionTimelineModal`: per-project checkpoints,
   save checkpoint, one-click **restore + confirm + re-verify hook** (client re-reads
   the live graph and asserts byte-equality → "Restored · verified"). *desktop/04.*
5. **E6 usage meter** — `UsagePanel` + `usage-config.ts`: real per-tenant counts
   (projects / verified builds / checkpoints=credits / seats) vs tier quotas +
   plan-tier badge; honestly labeled `stub` (billing deferred). *desktop/03.*
6. **First-run empty state** — guided invitation (headline + prompt + "start a
   guided build"), never a void.
7. **Mobile parity (390px)** — launchpad stacks (hero on top), gallery → 1 column
   with aligned 3D thumbnails, nav → upper-left tap chip. *mobile/01–03.*

## Gate results — ALL GREEN
- **Headless launchpad → intake:** Build routed to
  `/app/build?prompt=A+booking+app+for+a+barbershop+with+payments+and+SMS+reminders`
  (title "Guided build — Prism"; prompt seeded).
- **Nav open/close keyboard-only:** hover-edge opens; focus moves into drawer
  (first item), Tab cycles within, **Escape closes**; leave-region + re-hover
  reopens; **mobile 56×56 upper-left tap** opens (touch, no hover).
- **Version restore round-trip on a seeded project:** `edited`(v2-EDITED) → restore
  "First cut" → **live graph == snapshot** (`checkpoint-1`/`v1`), asserted via an
  independent `graph.get`; UI badge "Restored · verified" (`data-ok=true`).
- **S3 checklist:** green (below).
- **`npm run verify` EXIT 0** — verify:prism PASS, galaxy PASS, global-shell PASS,
  parity-static PASS, schema PASS, **verify:tenancy 30/30 GREEN** (26 + 4 new
  cross-tenant cases: duplicate/delete/version.restore/usage all NOT_FOUND for the
  other tenant; usage meter counts only the caller's projects). repair-loop is a
  pre-existing non-blocking soft-warn.
- **tsc:** 9 = 9 baseline (**0 new**). **0 console errors.** Canvas `/` untouched.

## S3 per-surface checklist (§10)
- [x] Project cards show real live 3D thumbnails (not placeholders) + signature jewel.
- [x] Prompt launchpad is the visual focal point; submitting starts the Guided flow.
- [x] Slide-out nav animates without jank, keyboard-operable, focus-trapped while open.
- [x] New-build options (template, integrations, GitHub import, model) via progressive
      disclosure, not a wall.
- [x] First-run empty state is a guided invitation, not a void.

## DESIGN LAW sweep
- **DL11/DL12** — the premium look is RENDERED, not CSS: launchpad hero, gallery
  thumbnails, the nav pull + emblem, and the Build button are real three.js objects
  off the shared premium-materials canon. DOM is layout plumbing only.
- **DL8 rider** — ONE GL context per affordance: the gallery is a single shared
  canvas over the whole card grid; the nav costs one context (edge handle) at rest
  and a second only while the drawer is open. No live context per card/control.
- **DL6** — weighted motion: drawer sprung-open (`--pp-ease-weight`) / gravity-close;
  handle lift/glow eased in `useFrame`; nothing linear on hero/launch moments.
- **DL16** — rich, never void: graded elevation + red identity + champagne accents +
  the 3D showpieces; no flat-black slab, no `backdrop-filter` glass fakes.
- **DL5/DL14** — no icon packs, no emoji (code-swept). 7.4 — no hardcoded model
  string outside `model-config.ts` (swept).

## Deviations
- **W4-D1 (bug fix, in-wave):** `restoreVersion` called `updateProject` — which itself
  takes the per-tenant `serialized()` lock — from INSIDE its own `serialized()` block.
  Re-entering the lock on the same tenant deadlocks the promise chain and poisons ALL
  subsequent writes for that tenant (in-memory `tenantChains`). Symptom: the graph
  write landed (data looked correct) but the client hung on "Working…" forever. Fixed
  by taking the lock only for the graph write and running the `graphRef` patch as its
  own op after. Verified: a direct restore went from a 60s+ hang to **17ms**. This is
  a latent re-entrancy hazard for any future store fn that both wraps `serialized` and
  calls `updateProject`/another serialized fn — noted for W5+.
- No other deviations. Assets are NOT copied on `duplicate` (v1) — the copy carries the
  graph, brief, and capability bindings (the meaningful build state); assets are
  content-addressed and regenerable. Noted, not a defect.

## Founder action — none required
E6 billing is deferred by design (`PRISM_BILLING_SOURCE=billing` + a provider flips
`usage.get` from `stub` to live entitlements with no wire change). E13 SHIP is an
honest stub for W5/W5B (host adapters, domains, "make profitable").

## Should-fix ledger (non-blocking)
- Gallery uses live 3D minis; at large project counts add virtualization / a
  last-frame capture cache (the shared canvas covers the full grid today — fine at
  demo scale). *W6/W8.*
- The launchpad Build object's label sits close to the small 3D form; acceptable and
  consistent with the certified intake button, could get a dedicated larger host. *W6.*

## Dual judges — both PASS
- **prism-criteria-reviewer — PASS (0 MUST-FIX).** All criteria MET with file:line
  (S3-1..5, E1, E6, E13, I11, DL, BOUNDARY). Confirmed Law-0 node-authorship is out of
  scope (shell app-frame, renders null inside the engine iframe — no graph-scene
  collision), tsc 0-new, canvas `/` untouched, isolation sweep 30/30. Nits non-blocking.
- **user-advocate — round 1: 1 MUST-FIX** (primary "Build" CTA label/sublabel
  overlaid on the bright red 3D gem → letters collided with facets at low contrast,
  sublabel bisected). Fixed same round (commit `03a05064`): fixed 236×112 host, label +
  sublabel composited BELOW the jewel on the dark pedestal with contrast plates.
  **Re-verify — PLEASED, gate CLEAR** (desktop/08 closeup + desktop/01 + mobile/01;
  "no facet collision, no bisected sublabel", both viewports). One non-blocking taste
  flag (Next.js dev `N` overlay grazes a link on the mobile full-page capture — a
  dev-only indicator, absent in production).

## Marker
`PRISM-SHELL-W4: RUN COMPLETE`

## W5 readiness
`buildState` + the E1 timeline are the Conductor's checkpoint substrate (Founder lock
H); Ship panel is the W5/W5B entry; usage source flag is the billing seam; the nav's
SHIP item deep-links the ship flow once the builder ships a verified app.
