# SHELL W-0 — FOUNDATIONS & BOUNDARY (Prism Frontend Shell)

You are the W0 build agent for the Prism frontend shell. Repo:
`kid-kode-landing/` on branch `codex/prism-recovery-harness-20260630`.
Work additively. Evidence or it didn't happen.

## Governing documents (read ALL before any code)
1. docs/prism/PRISM-FRONTEND-SHELL-SPEC.md — v1.1, esp. §0, §7.4, §8, §9,
   §10 Global, §12 W0
2. docs/prism/PRISM-SHELL-DESIGN-LAW-2026-07-03.md — DL1–DL10 (binding)
3. docs/prism/PRISM-SHELL-DECISIONS-2026-07-04.md — A–E LOCKED
4. docs/prism/VERIFICATION-STANDARD.md + NEAR-HUMAN-QA-PROTOCOL.md
5. CLAUDE.md (repo root) — deviation protocol, commit exclusions
6. src/lib/prism/animatable/ + the shared premium.ts material/icon system
   (canonical for DL2/DL5)

## Hard boundaries (violations = MUST-FIX, judges will check)
- The canvas editor at `/` and ALL engine-interior files are UNTOUCHABLE.
  Shell work lives in new routes/components only.
- Shell = React/DOM. Never build shell surfaces in Three.js EXCEPT icon/
  material showpieces rendered via the premium.ts system where DESIGN LAW
  demands real 3D (DL4/DL5) — those mount as bounded, lazy showpiece
  components inside DOM surfaces.
- shared-interfaces: ADDITIVE only, `prism-` prefixed, re-exported.
- No secrets client-side. No hardcoded model strings (spec 7.4).
- No icon packs, no emoji, no flat glassmorphism, no grotesque display
  faces (DL3/DL5/DL9). No new WebSockets (CollabRoom is TYPES ONLY in W0).

## Tasks
1. **Shell↔engine command/event contract** — new
   `packages/shared-interfaces/src/prism-shell.ts`: typed
   PrismShellCommand / PrismEngineEvent unions covering: mount/unmount,
   mode switch (galaxy|canvas|preview), camera focus (hub/node), selection
   round-trip (engine→shell select events; shell→engine focus commands),
   build-wave hydration events (node verified/mounted), prompt-edit open
   scope, error surface. Zod schemas + version field. Unit-test the
   round-trip serialization.
2. **Prism Premium token layer** — extend the existing token stack (do not
   fork it): dark-first palette per DL1/DL2 (true-black base, red/black/
   white identity, grey elevation steps), spacing/radius/hairline (DL7),
   motion tokens with weight curves (DL6, nothing linear on heroes).
   Deliver as CSS vars + typed TS export.
3. **Typography (DL3)** — select and wire the neo-serif display +
   data-grade monospace utility pairing (variable fonts, self-hosted).
   Produce a rendered evidence board: 3 candidate pairings on real shell
   comps (dashboard card, chat header, launchpad), desktop + 390px mobile,
   dark theme. Pick the strongest, wire it, and present all three boards in
   the report for founder sign-off. Inter/grotesques forbidden on shell.
4. **Model-config source (spec 7.4)** — single typed config module
   (`src/lib/shell/model-config.ts`): model registry {id, label, status:
   active|gated|hidden, default}. Current data: claude-fable-5 active
   default; claude-opus-4-8 active. Components read config only.
5. **Brand Profile schema** — Zod: name, logo ref, palette, type prefs,
   tone descriptors; used later by intake Phase 1. Additive.
6. **CollabRoom contract TYPES only (decision E)** — `prism-collab.ts`:
   PresenceState, CollabOp (per-property LWW: {nodeId, path, value, seq,
   actor, ts}), RoomEvent unions + Zod. NO transport code, NO DO, NO
   WebSocket in W0.
7. **Foundations demo route** — `/shell-w0` (dev-only): renders tokens,
   type pairing, one premium.ts-rendered 3D icon set (min 6 icons: build,
   deploy, integrate, project, settings, chat — geometric red/black/white
   with true shading), motion samples. This is the evidence surface.

## Verification gate (spec §12 W0: "contract + tokens verified, Cortex unbroken")
- Contract round-trip unit tests green; tsc 0 new errors; full existing
  `npm run verify` chain stays ALL GREEN (Cortex + parity + schema gates
  untouched and passing — proves the prototype is unbroken).
- Near-human QA: headless frames of /shell-w0 (desktop 1600×900 + mobile
  390×844, dark theme) — icons render as true 3D with shading; hairlines
  crisp; type pairing evidence boards captured; zero console errors.
- DESIGN-LAW sweep on all new shell files: no icon-pack imports, no emoji,
  no backdrop-blur glass cards, no grotesque display faces, no hardcoded
  model strings, no secrets. Grep evidence in the report.
- Judge protocol: TWO fresh-context Fable-5 judges — (a) criteria reviewer
  vs this prompt + spec §12 W0 + DL1–DL10, (b) user-advocate judging the
  /shell-w0 evidence as a first impression of a premium product. BOTH must
  PASS with 0 MUST-FIX. Fix and re-judge until they do.

## Process law
- Commit in coherent steps with evidence frames committed alongside.
- Respect commit exclusions (mock-app.prism, ralph-state.json*,
  live-graph backups, .claude/worktrees).
- Any criterion you cannot satisfy: log to spec-deviations-prism.md BEFORE
  code, per CLAUDE.md. Founder-decision-needed → write the BLOCKED marker,
  stop.
- Report: kid-kode-landing/notes/SHELL-W0-REPORT.md — tasks vs evidence
  table, typeface boards, judge verdicts verbatim, deviations, and exact
  next-wave readiness notes for W1.

## Markers
- Complete: `PRISM-SHELL-W0: RUN COMPLETE`
- Blocked:  `PRISM-SHELL-W0: BLOCKED-NEEDS-FOUNDER`


---
## FOUNDER ADDENDUM — 2026-07-04 11:45 CDT (binding on this run; judges enforce)

The design law was amended mid-run by founder written direction:
**DL11–DL14 now govern** (read the amended
docs/prism/PRISM-SHELL-DESIGN-LAW-2026-07-03.md before continuing).

What changes for W0:
1. Task 2's token layer stays (CSS vars for LAYOUT plumbing are fine), but
   the premium LOOK of everything in Task 7's demo — the 6-icon set, any
   button samples, headline treatments — must be RENDERED 3D (three.js/
   premium.ts; Theatre for motion), never CSS/Tailwind-styled. No CSS
   gradients-as-materials, shadow-fakes, or backdrop filters anywhere.
2. Add to Task 7: TWO primary-button specimens as true 3D objects with
   visible depth + edges, photorealistic texture (one stone/marble family,
   one metal family), ambient refraction, weighted press (DL12). Texture
   them via the product's own prompt-to-texture pipeline
   (src/app/api/material-gen/route.ts + Replicate capability adapters) and
   BAKE the results to committed assets (DL13) — if the API needs a key at
   runtime, generate once now if env allows; if env lacks the key, build
   the full bake pipeline against a stub, use premium.ts procedural
   textures as stand-ins, and note the one-command re-bake in the report
   (do NOT block on this).
3. Icons: black & white with RED accents/shading (DL14 refinement).
4. Judges must verify DL11–DL14 explicitly, including the performance
   rider: repeated controls via shared renderer or baked-from-3D textures;
   no per-control GL contexts; /shell-w0 stays instant-feeling on the
   mobile viewport.
