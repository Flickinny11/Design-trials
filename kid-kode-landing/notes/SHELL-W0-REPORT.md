# SHELL W0 — FOUNDATIONS & BOUNDARY — RUN REPORT (2026-07-04)

**Branch:** `codex/prism-recovery-harness-20260630` · **Commits:** `1c30943b` → `6dbfea37` → `f85192ea` → `57348a21` (+ final report/STEEL-token commit)
**Governing:** PRISM-FRONTEND-SHELL-SPEC.md v1.1 (§0/§7.4/§8/§9/§12 W0) · PRISM-SHELL-DESIGN-LAW-2026-07-03.md (DL1–DL10) · PRISM-SHELL-DECISIONS-2026-07-04.md (A–E) · VERIFICATION-STANDARD.md · NEAR-HUMAN-QA-PROTOCOL.md
**Verdict:** criteria reviewer **PASS 0 MUST-FIX** (round 2 full + round 3 delta) · user-advocate **PASS 0 MUST-FIX** (round 3)

`PRISM-SHELL-W0: RUN COMPLETE`

---

## 1. Tasks vs evidence

| # | Task | Delivered | Evidence |
|---|------|-----------|----------|
| 1 | Shell↔engine command/event contract | `packages/shared-interfaces/src/prism-shell.ts` — PrismShellCommand/PrismEngineEvent discriminated unions: mount/unmount, set-mode (engine-canonical `galaxy\|canvas\|preview-app`), focus-camera hub/node, set-selection ↔ selection-changed with `origin: 'user'\|'command'` echo (round-trip, both directions), node-verified/node-mounted/build-wave hydration, open-prompt-edit scope (node/hub/app), structured error surface. Versioned envelopes (`v: 1`) + Zod parse; pure serialize/parse helpers; zero transport. | `tests/unit/prism-shell-contract.test.ts` — **37/37** in the default vitest suite (every variant byte-round-trips; unknown type, foreign version v99, non-canonical `'split'` mode, kind-mismatch all rejected) |
| 2 | Prism Premium token layer | `src/components/shell/design/prism-premium.css` (+ `prism-premium-tokens.ts` typed mirror) — `--pp-*` namespace EXTENDING `premium.ts` (identity hexes imported/re-exported, never forked): true-black `#000000` base + GUNMETAL-family elevation e0–e5 (DL1/DL2), SIGNAL_RED/CHROME families, crisp 1px hairlines + machined-edge idiom (DL7), 4px machining grid, exact radii, weight-curve motion tokens — settle/gravity/sprung/hero, **nothing linear** (DL6). | `desktop/01-tokens.png`, `mobile/01-tokens.png`; criteria judge grep-confirmed every CSS hex byte-matches premium.ts |
| 3 | Typography (DL3) — 3 pairings, founder sign-off | 3 variable, self-hosted (woff2 + OFL licenses, `public/fonts/shell/`) neo-serif × data-mono pairings rendered on **real shell comps** (dashboard card / chat header / launchpad) with display-size specimen lines, desktop + 390px mobile, dark. **Winner wired: A — Fraunces × JetBrains Mono** (`src/components/shell/design/shell-fonts.ts`), pending founder sign-off. | Boards: `desktop/02-type-board-A.png`, `03-…-B.png`, `04-…-C.png` + `mobile/02/03/04` (§3 below) |
| 4 | Model-config source (spec 7.4) | `src/lib/shell/model-config.ts` — registry `{id,label,status: active\|gated\|hidden, default}`; **claude-fable-5 active default; claude-opus-4-8 active**. Model-id literals exist in this file ONLY; TypeBoard's chat header proves the config read path. | Grep: zero model strings outside the module; frames show "CLAUDE FABLE 5" rendered from config |
| 5 | Brand Profile schema | `packages/shared-interfaces/src/prism-brand.ts` — Zod: name, logo **reference** (never inline bytes), validated-hex palette, type prefs (classification + optional family), tone descriptors. Additive, versioned. | Contract test round-trips full profile; rejects malformed hex |
| 6 | CollabRoom contract TYPES only (decision E) | `packages/shared-interfaces/src/prism-collab.ts` — PresenceState (cursor/selection/camera ghost/editing badge), CollabOp per-property LWW `{nodeId, path, value, seq, actor, ts}` (seq room-assigned at commit), per-node soft locks, RoomEvent union + versioned envelope. **Zero transport: no WebSocket, no DO, no polling** — judge-grepped. | Contract tests; criteria judge round 1+2 verified shapes-only |
| 7 | `/shell-w0` foundations demo route | Dev-only (404s in production builds); tokens board, 3 type boards, **six custom 3D icons** (build/deploy/integrate/project/settings/chat — gunmetal/steel/chrome/signal-red jewels, one smoked-glass prism with chrome edge rails) in ONE lazy orthographic R3F island with **procedural RoomEnvironment IBL (zero remote assets)**, DL6 motion samples (sprung/settle/gravity) with live interaction proof. | `desktop/05-icons-3d.png`, `06-motion-idle.png`, `06b-motion-weight-hover.png`, `07-motion-interacted.png`; mobile set |

## 2. Verification gate (spec §12 W0)

| Gate | Result |
|------|--------|
| Contract round-trip tests | 37/37 green, default vitest suite |
| tsc | 9 total = 9 baseline, **0 new** (`typecheck-gate.mjs` PASS, re-run every fix round) |
| `npm run verify` full chain | **exit 0, ALL GREEN** — verify:prism, repair-loop, galaxy 7/7, global-shell 6/6, parity-static 6/6 (0 hard-fail), schema 338/338 |
| Prototype unbroken | `/` loads the full ORRERY watch app on real GPU, 0 console errors — `desktop/08-canvas-editor-unbroken.png` |
| Near-human QA frames | Real hardware GPU (Apple M4 Max, ANGLE Metal — no SwiftShader). Desktop 9 frames exact 1600×900; mobile 6 frames exact 390×844@2x (sips-audited). 0 console errors on `/shell-w0` and `/` across the whole run; **all network requests localhost-only** (17/17 — includes the lazy icon-set chunk, proving DL8 code-splitting) |
| DESIGN-LAW sweep | 7/7 grep classes clean over every new shell file: no icon packs, no emoji, no backdrop-filter, no grotesque faces, no model strings outside model-config, no secrets, no WebSocket |
| Full vitest suite | 9 failures — **all pre-existing** editor-build acceptance tests (EB-03-04/05/07, EB-08-04, EBR2-C-03, EBR2-D-02, EB-10-08). Proven by clean-worktree run at `118e10e2` (pre-W0): 11 failures there; W0 added **zero** |

## 3. Typeface boards — founder sign-off

All three render the same real comps (dashboard card · chat header · launchpad) + a display-size specimen line ("Quixotic glyphs & figures — Qg ff 0139"), desktop and 390px mobile, dark:

- **A — Fraunces × JetBrains Mono** (`desktop/02-type-board-A.png`, `mobile/02-type-board-A.png`) — **SELECTED & WIRED** (`shell-fonts.ts`). Fraunces: 4 variable axes (opsz 9–144, wght, SOFT, WONK) = kinetic-restraint headroom for heroes (DL3); chunky-warm authority at card size. JetBrains Mono doubles as the engine chrome's instrument voice → the DOM frame and in-engine chassis stay harmonious while remaining separate layers (spec §10 S4). Served from the already-hosted `public/fonts/ui/` file (OFL alongside).
- **B — Playfair Display × Martian Mono** (`03`/`mobile/03`) — high-contrast editorial elegance, old-style figures; brand-coherent with the watch app's Playfair MSDF voice. Advocate: "genuinely elegant at 390px." Runner-up.
- **C — Newsreader × Spline Sans Mono** (`04`/`mobile/04`) — calm literary voice; the least distinctive of the three at product-comp size.

Winner rationale: A carries the most expressive variable-axis range for DL3's "kinetic restraint on heroes," differentiates hardest from generic SaaS, and buys shell↔engine mono continuity for free. **B remains one line away** (`shell-fonts.ts`) if the founder prefers the Playfair story.

## 4. Judge protocol (verbatim verdict lines)

- **Round 1** — criteria: "VERDICT: PASS … MUST-FIX: (none)" + 2 should-fix (frame height 775; version-comment mismatch). Advocate: "VERDICT: **FAIL** (near-pass…)" — MF1 icon/label drift (~230px, perspective projection), MF2 unreadable swatch labels; 4 should-fix (dev orb, full-page.png, clipped pill, specimen line).
- **Fixes** (`f85192ea`): orthographic camera + viewport-derived grid (icons pixel-centered on labels), WCAG-luminance swatch inks, exact 1600×900 recapture, dev-overlay stripped, misleading frame dropped, specimen lines added, version comment corrected.
- **Round 2** — criteria: "VERDICT: **PASS** (0 MUST-FIX) … ROUND-1 FINDINGS — ALL CLOSED … MUST-FIX: None. SHOULD-FIX: None." Advocate: "VERDICT: FAIL (one narrow, objective MUST-FIX on mobile…)" — mobile swatch hex labels overflowing 6-across chips; 3 should-fix (hover evidence, PROJECT softness, INTEGRATE luminance center).
- **Fixes** (`57348a21`): mobile chips wrap 3-up (in-DOM overflow measurement: zero), real-CDP hover frame (`06b`, transform `matrix(1.04,…,-7)` asserted live), PROJECT chrome edge rails + larger core, INTEGRATE steel/chrome rebalance at ±0.24.
- **Round 3** — advocate: "**VERDICT: PASS** … MUST-FIX: *(none)* … Round-2 blocker re-measures (all three confirmed fixed) … BUILD ≈3px, DEPLOY ≈1px, INTEGRATE ≈7px, PROJECT ≈1px, SETTINGS ≈1px, CHAT ≈4px — all read as centered." Criteria delta-confirmation: "VERDICT: PASS … MUST-FIX: (none)" — one nit (promote the steel hex into the token module) **taken** in the final commit.

## 5. Deviations & notes (no formal spec deviations)

- **`packages/shared-interfaces` created fresh.** PRISM-ENGINE-SPEC-V3 §2.2 calls it "existing" in the full Kriptik monorepo; that monorepo is not this repo. The wave prompt says "new … prism-shell.ts"; the package README documents the graft path. Additive by construction — not logged as a deviation.
- **zod promoted to a direct dep** (`^3.25.76`, matches the vendored transitive version — no downgrade). Allowlist + rationale per hook protocol (`dependency-allowlist-check.py`, `notes/mockup-pipeline.md` §10 addendum). Mandated by spec I4 (contract-first Zod).
- **Winner mono served from `public/fonts/ui/`** (pre-existing JetBrains Mono asset, OFL alongside) rather than `fonts/shell/` — deliberate reuse for engine-continuity; noted by the criteria judge as acceptable.
- **Icon showpiece renders R3F/WebGL (MeshPhysicalMaterial + PMREM RoomEnvironment), not TSL/WebGPU** — follows the founder-approved isolated-R3F-canvas precedent (liquid-glass toolbar / toolbar chassis); both judges accepted; TSL-only law binds engine-interior shaders, which this is not.
- **Pre-existing vitest failures** (9, editor-build acceptance vs evolved GraphScene) predate W0 — see §2. Not touched: out of shell scope (FP7).
- **Contract version policy** is exact-match at v1 by design; the schema comment now states the W1 obligation to encode a real compatibility policy at the first bump.

## 6. W1 readiness notes (Builder Shell)

1. **Contract is wireable as-is:** `parseShellCommand`/`serializeEngineEvent` are transport-agnostic; W1's engine embed should speak ONLY these envelopes (spec §10 S4 "no internal reach"). First version bump must encode the compat policy in-schema (see §5).
2. **Selection round-trip semantics are pre-decided:** engine echoes `selection-changed` with `origin:'command'` for shell-initiated writes — the shell must ignore its own echoes to avoid loops.
3. **Tokens & fonts:** import `prism-premium.css` + `shellFontVariables` (`shell-fonts.ts`) at the W1 surface root; shell routes must own their scroll (root layout locks body overflow — see `.sw0-root` comment).
4. **DL12-class obligation (from advocate notes):** the CSS-styled DEPLOY sample button was legitimate as a motion-curve evidence stage, but W1 primary buttons/key controls must be premium-rendered 3D per DL4/DL10 — reuse `PremiumIconSet`'s material set (exported token STEEL included) and the ortho-island pattern.
5. **Icon system reuse:** the six icon builders live in one bounded island; W1 should mount per-surface instances via the same `next/dynamic` + `IconShowpiece` wrapper pattern (lazy behind first paint, DL8). CHAT is the least sculptural form (advocate taste note) — candidate for a pass when it becomes real product chrome.
6. **Advocate process note:** emit a `metrics.json` (console/network/FPS capture) alongside frames in future bundles so the evidence stands alone.
7. **Cortex-safety pattern held:** zero engine files touched across all commits (judge-verified per commit). Keep W1's engine embed against the contract stub until the engine session merges.

## 7. Evidence index

`notes/verification/shell-w0/desktop/`: 01-tokens · 02/03/04-type-boards-A/B/C · 05-icons-3d · 06-motion-idle · 06b-motion-weight-hover · 07-motion-interacted · 08-canvas-editor-unbroken (all 1600×900)
`notes/verification/shell-w0/mobile/`: 01-tokens · 02/03/04-type-boards · 05-icons-3d · 06-motion-interacted (all 390×844@2x)

---
PRISM-SHELL-W0: RUN COMPLETE
