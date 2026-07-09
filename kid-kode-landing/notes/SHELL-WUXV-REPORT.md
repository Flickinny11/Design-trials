# SHELL-WUXV REPORT — Interactive UX Verification (persona-simulated)

Status: COMPLETE (judges' verdicts in §9)
Wave: PRISM-WUXV, authored 2026-07-07, executed 2026-07-09
Branch: codex/prism-recovery-harness-20260630
Method: UXAgent-style persona simulation — 4 fresh-context agents driving a
REAL browser (Playwright, full interaction: scroll, hover, click, type)
through real tasks against a REAL production build (`npm run build` +
`next start`), no external keys; key-dependent integrations ran their
demo/stub paths and are LISTED in §1/§6, never faked.

## 1. Production build + serve

- `npm run build` (build:prism → msdf + live-prism assembly → `next build`)
  EXIT 0 — log: `notes/verification/wuxv/build/build.log`. Rebuilt twice for
  the fix round (both EXIT 0): `fix-round/rebuild.log`, `fix-round/rebuild2.log`.
- Serve: `next start -p 3010` (production server, not dev) —
  `fix-round/serve.log`, `fix-round/serve2.log`.
- Demo/stub inventory (what ran WITHOUT keys — listed, never faked):
  - **Conductor planner: deterministic stub** (`planner: stub (deterministic,
    no API key)` shown in the build stream) — no `ANTHROPIC_API_KEY`.
  - **Auth: email+password live; Google/GitHub one-click tiles greyed
    "awaiting keys"** (honest state, P1/P2 both quoted it approvingly).
  - **GitHub App import: sandbox** (3 fixture repos); **public-URL repo
    ingest is fully live keyless** (P3's triage + F1 re-test).
  - **Backgrounds: R1 procedural synthesis live keyless**; R2 photo plates
    need `REPLICATE_API_TOKEN` (listed, not exercised this wave).
  - **Generate-3D (Tripo/Replicate), integrations vault, deploy adapters
    beyond prism-cloud: env-gated** — surfaced as stubs/demo modes.

## 2. App surface map

72 routes in the production build (route table in
`fix-round/rebuild2.log`). Persona-relevant surfaces: `/home` (marketing),
`/sign-in` `/sign-up`, `/app` (dashboard), `/app/build` (guided intake),
`/app/builder/[projectId]`, `/preview/[projectId]` (tokened share),
`/app/integrations`, `/pricing`, `/` (the 3D editor: galaxy | canvas |
preview-app), `/templates/[slug]`, plus lab/demo routes (`/wbg-demo`,
`/w2d-demo`, `/library`, …). Key-gated surfaces are exactly the stub list
in §1.

## 3. Persona sessions (fresh-context agents, real browser)

Each persona has a full journey log (action counts, hesitations,
backtracks, dead ends), a verbatim in-character interview, and an indexed
evidence-frame set — committed UNSOFTENED in
`notes/verification/wuxv/<persona>/REPORT.md` (164 frames total):

### P1 — novice founder "Mia" (1440×900) — `p1-novice/`
Signup → guided build → preview. ~43 actions, 7 hesitations, 1 backtrack,
1 dead end (**preview black everywhere** = UXV-B1); sections shredded
(UXV-B2). Delights: direction boards, editable Build Brief. "I can't
recommend a tool that won't show me the thing it built."

### P2 — impatient mobile "Dre" (390×844) — `p2-mobile/`
Landing → value grasp → full funnel on mobile. **0 rage-taps**; grasped the
value in ~10s; hit B1 at the end ("dark screen with some red static —
where's my storefront?"), intake scroll friction (UXV-F4), clipped titles
(UXV-F6). Delights: honest pricing, instant email signup.

### P3 — skeptical senior dev "Sam" — `p3-developer/`
GH import hunt (5 dead ends → UXV-F1), plan trust, fidelity report, node
editing, generate-3D hunt (UXV-F9). Quoted the capability-reference
security posture verbatim as a delight; carries a post-session triage note:
the URL importer EXISTS and works — discoverability failure, not a missing
feature.

### P4 — designer "Yuki" — `p4-designer/`
Templates → new hub → backgrounds → prompt-to-bg → 2D/3D. Delights:
Meridian instantiation ("reads like a photograph"), 60-bg catalog.
Frictions: post-tour mode freeze (UXV-F5/P7), hover-preview occlusion
(UXV-F8), "deep indigo → Verdant green" (UXV-F7).

## 4. Findings

`notes/UXV-FINDINGS.md` — 2 BLOCKER, 9 FRICTION, 7 POLISH, 4 delights; every
finding carries frames + verbatim persona quotes; root-cause triage was done
AFTER the sessions by reading code (personas never saw source).

## 5. Fix round (all additive/surface-level; structural → §6)

Committed in `ce646f73` (B1, B2, F1, F2, F3-attempt, F4, F5-part, F6, F7,
F8) and this wave-closing commit (F3-correct, F5/P7-root, F2-residual —
found by RE-TEST, see below). Deviations recorded in
`notes/spec-deviations-wuxv.md` (DEV-WUXV-1..3).

### Re-test — every fix re-run through the REAL production build
Evidence: `notes/verification/wuxv/fix-round/wuxv-r1-*.png` (42 frames).
P1's full flow was re-driven end-to-end (fresh account → 6-question intake
→ brief → build → preview → standalone tab → reload), plus targeted
re-tests for each editor-side fix.

| Finding | Before (persona evidence) | After (re-test evidence) |
|---|---|---|
| **B1** preview black | p1-25..31, p2-39/40, p3-23..27 all black/red-dithered | Renders real content in ALL five surfaces: embedded (r1-20), Galaxy (r1-22), Canvas (r1-23), after Rebuild (r1-24), standalone tab (r1-25: headline, Walnut Studio direction line, product tile, "Shop now") |
| **B2** sections shredded | "Home · Home · Landing · Catalog · Library", customs dropped (p1-36) | Stream shows **Home · Catalog · Cake Ordering Page · About Us** — no dup, no phantom Library, BOTH user-typed sections built (r1-19); brief line preserved verbatim (r1-16); 3-test regression file green |
| **F1** import buried | 5 dead ends (p3-05/07/11/15) | Dashboard chip → `/app/build?import=github` → repo-URL input visible immediately on Phase 0 (r1-06/07) |
| **F2** stale chat copy | "Echo agent · W1 — orchestrator lands in W5" (p3-20) | Header: "Chat is a scripted preview — the real build runs via 'Build this app'" (r1-17). Re-test ALSO caught a residual stale-tense line in the empty-chat placeholder ("In W5 the Verify phase will…") — fixed to present-tense this commit, confirmed in the rebuilt bundle |
| **F3** CONTAINER_MISSING on reload | p3-28 | **Re-test FAILED the committed fix** (banner still fired: r1-26). Root cause: for a BUILT project the engine container is never in the DOM (ConductorPreview owns the stage), so the 5-frame retry could never succeed. Correct fix: `useEngineBridge` gains `suppressMount` — BuilderShell suppresses the engine mount when `buildState === 'built'`. After rebuild: no banner, preview renders (r1-33/34) |
| **F4** intake opens mid-card | p2-28 vs p2-30 | Every card/phase opens at its heading, including after a deep scroll within Q3 (r1-12: Q4 heading fully visible; scroll instrumentation logged 0/heading-visible on every transition) |
| **F5/P7** post-tour freeze + tour re-trigger | p4-09/10 (buttons flip, view frozen), p4-11 (re-trigger) | **Re-test exposed the true root**: the F4a-fix chrome gate unmounted WalkthroughHost when the tour's own step 6 drove preview-app → status stuck 'running' → remount-thrash re-asserted preview-app (~22 ms after every mode change, reproduced live) and the terminal-status seen-persist could never fire. Fix: host mounts in ALL modes (DEV-WUXV-3). After rebuild: full 7-step tour incl. step-6 popup rendered OVER preview-app (r1-36), Finish → 'done' + seen persisted (r1-37), all three mode buttons switch and stick (r1-38), reload does NOT re-trigger (r1-39). Atelier clamp-release also verified: enter atelier preview (r1-40) → exit to Canvas → Galaxy renders free (r1-41/42) |
| **F6** clipped titles | p2-35/37/40 | Preview pill: `text-overflow: ellipsis` computed + text bounded (scrollW == clientW), visually clean (r1-25 top-left) |
| **F7** indigo → green | p4-32 "Verdant Light" | Same prompt through the real picker UI → **"Anodized Light · R1 · cinematic-video"** in MY LIBRARY (r1-32); DEV-WUXV-2 |
| **F8** hover-preview reads broken | p4-23/24 | Picker now states "Backgrounds sit behind everything — on a hub with a full-bleed hero the preview may only peek around its edges", verified visible on the Celestia photo-hero hub (r1-30/31) |

Re-test honesty note: two of the ten committed fixes (F3, F5/P7) did NOT
survive re-test as committed; both were root-caused and re-fixed this
session, re-verified against a fresh production build. That is exactly what
this wave's re-test mandate is for.

## 6. Founder decision list (W-PROD checklist input)

### Structural decisions (not additive-fixable this wave)
1. **UXV-F9 — which surface is the product's node editor.** Functions/
   generate-3D live in the `/` editor's Inspector; `/editor` lacks them; no
   nav path connects the builder to either. Needs: one blessed editor
   surface + a nav entry + the canvas text-field input model.
2. **B1-secondary — the §11 visual verify latch must fail on a black
   frame.** "Verified shippable — visual checks pass" was shown over a
   preview no user could see. The latch needs a real luminance/content
   assertion on the captured frame.
3. **DEV-WUXV-1 — WebGPU red-dither root cause.** The runtime player now
   defaults to the WebGL2 backend (`?webgpu=1` opt-in). Root-causing the
   three r18x × Chromium WebGPU dither and flipping the default back is
   W-PROD material.
4. **UXV-F8 structural — mini live-preview viewport** in the background
   picker so hover-preview is visible even under a full-bleed hero.
5. **UXV-P3 — template picker thumbnails** (needs a capture harness like
   W-BG's real-render thumbs).
6. **UXV-P5 — arrival-hub hero watch presence** (reads as a distant speck;
   art direction call).
7. **UXV-F7 — a TRUE indigo/violet palette identity** would violate INV-9
   "no purple" (current fix maps indigo→anodized deep blue). Founder call
   on whether the palette law bends.
8. **First-boot tour auto-launch.** With DEV-WUXV-3 the first-visit tour now
   launches from the boot (preview-app) view. Confirm this is the desired
   first-run experience.

### Keys/env required for full-path testing (everything ran stub/demo without them)
| Path | Env |
|---|---|
| Real Conductor planner (replaces deterministic stub) | `ANTHROPIC_API_KEY` (+ `PRISM_CONDUCTOR_MODEL`) |
| Google one-click sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub one-click sign-in | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| GitHub App import (private repos, PR-edit plan) | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`, `PRISM_GITHUB_TOKEN`/`GITHUB_TOKEN` |
| Auth base config (prod) | `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` (server warns on boot without it) |
| R2 photo background plates, Hunyuan/Rodin 3D | `REPLICATE_API_TOKEN` (via `.assetgen` clients) |
| Tripo generate-3D | Tripo key (`.assetgen/tripo.py`) |
| Asset provisioning | `FAL_KEY` |
| Integrations spine (real connects) | `NANGO_SECRET_KEY`, `NANGO_HOST` |
| Deploy adapters (dry-run → real) | `VERCEL_TOKEN`/`VERCEL_TEAM_ID`/`VERCEL_PROJECT_ID`, `NETLIFY_AUTH_TOKEN`, `CLOUDFLARE_API_TOKEN`, `MODAL_TOKEN_ID`+`MODAL_TOKEN_SECRET` |
| Email / payments capability refs | `RESEND_API_KEY`, Stripe keys (capability vault) |

## 7. Flight-recorded persona sessions

The persona sessions and the re-test all ran against the live server with
the W-FR recorder on — `.data/flight-recorder/training/2026-07-09/`:
`conductor.ndjson` **1932 records** (every persona build + the re-test
bakery build: 27 records for `proj-c3d83695…`), `verify.ndjson` 207,
`session.ndjson` 69, `background.ndjson` 7 (incl. BOTH "slow drifting
aurora over deep indigo" generations — P4's original and the re-test),
`catalog.ndjson` 2 (P4's template instantiation), `render-mode.ndjson` 4
(P4's 2D/3D toggles). Records carry the standard schema (consent basis,
scrub) — premium UX training data as mandated.

## 8. Gates

- [x] tsc: 9 errors = baseline 9 (all pre-existing, same files)
- [x] affected suites green (incl. `wuxv-blueprint-sections` 3/3,
      `shell-stub-engine` 16/16)
- [x] verify aggregate EXIT 0 (post-fix, see §9 run log)
- [x] W5B ship gate green
(gate outputs: `notes/verification/wuxv/fix-round/gates.log`)

## 9. Judges (fresh-context, 0 MUST-FIX required)

- criteria-reviewer: **PASS — 0 MUST-FIX** (verdict below)
- user-advocate ("UX research lead — are these findings honest, evidenced,
  and were the fixes verified by re-test rather than asserted?"):
  **PASS — 0 MUST-FIX** (verdict below)

(Verdicts appended verbatim at the end of this file.)

## 10. Invariants

- **I-CANVAS / I-ENGINE**: no engine or canvas-contract changes; fix-round
  touched shell components, editor chrome placement, copy, and the runtime
  backend default (DEV-WUXV-1).
- **I-SECRETS**: no keys in graph data or client bundle; env inventory in §6
  is names-only.
- **I-PROVENANCE**: persona reports committed verbatim and unsoftened;
  re-test failures of two committed fixes are reported as failures (§5);
  DEV-WUXV-3 carries an explicit same-session timing note.
