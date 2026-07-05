# SHELL W-4 — DASHBOARD (gallery, launchpad, slide-out nav, versions, usage)

Branch `codex/prism-recovery-harness-20260630`. Additive. Evidence law.

## Governing
Spec §10(S3), §12(W4) · ENHANCEMENTS E1, E2, E6 · DECISIONS (multi-tenant) ·
DESIGN LAW DL1–DL14 · V-STANDARD · NEAR-HUMAN-QA · W1A schema.

## Hard boundaries
Canvas `/` untouchable. Real 3D thumbnails (last-frame captures or live
minis) — placeholder cards are a MUST-FIX per S3 checklist. Progressive
disclosure, not option walls. Tenant-scoped queries only (I11).

## Tasks
1. Project gallery: cards with real live/last-frame 3D thumbnails +
   signature jewel; open → builder (W1); rename/duplicate/delete (confirm).
2. Prompt launchpad as the visual focal point (premium.ts hero control,
   DL12); submit → intake Phase 0 (W2). GitHub-import and template entry
   points via progressive disclosure.
3. Slide-out nav: jank-free animation (weighted, DL6), keyboard-operable,
   focus-trapped; panels: Projects, Templates (E2 gallery shell — seeded
   fully in W8), Integrations (→W3), Settings, Usage.
4. E1 version timeline: per-project checkpoints list (graph snapshots via
   W1A projectVersion), one-click restore with confirm + re-verify hook.
5. E6 usage meter: per-tenant usage display + plan tier badge (stub data
   source behind config; billing deferred).
6. First-run empty state: guided invitation (premium, not a void).
7. Mobile parity (390px) for gallery, nav, launchpad.

## Gate (spec: nav animation + launchpad→intake verified)
Headless: launchpad → intake; nav open/close keyboard-only; version restore
round-trip on a seeded project (restore → graph state asserted). S3 checklist
green; DL sweep; tsc 0-new; full verify + tenancy ALL GREEN. Dual judges
0 MUST-FIX (advocate judges first-impression premium explicitly).

## Process
Commits+frames; deviations BEFORE code; report notes/SHELL-W4-REPORT.md.
Markers: `PRISM-SHELL-W4: RUN COMPLETE` / `PRISM-SHELL-W4: BLOCKED-NEEDS-FOUNDER`

---
## FOUNDER ADDENDUM — 2026-07-04 (binding): E13 3D slide-out nav
The slide-out nav (Task 3) is upgraded per founder direction + ENHANCEMENTS
E13: a premium 3D object (premium.ts system) revealed by HOVER at the far-
LEFT screen edge on desktop and TAP at the upper-left on mobile; weighted
slide animation (DL6, nothing linear); contents: navigation, integrations,
settings, SHIP entry; keyboard-operable + focus-trapped as spec'd; mounted
as a GLOBAL shell affordance (dashboard AND builder), engine pane unaffected.
Judges verify the hover-edge reveal + mobile tap explicitly, both viewports.
