# MASTERPIECE M-2 — Watch App Masterpiece on the Prism Runtime + Node-Editor Shippable Certification

**Run:** 2026-07-04 · Fable 5 · branch `codex/prism-recovery-harness-20260630`
**Governing:** NEAR-HUMAN-QA-PROTOCOL.md · PRISM-MASTER-SPEC DESIGN LAW · PRISM-SHELL-DESIGN-LAW-2026-07-03 · Forbidden Drift (PRISM-WORKSPACE-COMPLETION-SPEC)
**Plan + checkpoint:** `notes/verification/masterpiece-m2/PLAN.md` (committed `d5c24b7e` with the full BEFORE set before any change)

---

## 1 · Task 1 — the watch-app masterpiece pass (ALL polish through the graph)

Every change was authored as **data** by the deterministic, idempotent
`scripts/m2-masterpiece-polish.mjs` (F-3 idiom) against
`public/prism-mock/home/live-graph.json` — zero hardcoded visuals, so parity +
node-realization hold by construction. Evidence:
`notes/verification/masterpiece-m2/{before,after}/{desktop,mobile}/01..06-*.png`
(6 hubs × 2 viewports × before/after, 0 console errors) + `proofs/` iteration
frames.

| Slice | What shipped | Before → after evidence |
|---|---|---|
| **A · One machined-brass headline system** | The six hub headlines had THREE divergent treatments — glass extrude `transmission: 0.9` on s1/s6 (each glyph read as whatever drifted behind it), a blotchy `brass-macro.png` photo texture as glyph faces on s2/s3/s5, and flat solid on s4. Now ONE treatment: champagne→brass **gradient** PBR faces, size-proportional extrude depth + bevel + outline, bronze walls, warm emissive; s4 gains real depth. The render finally matches the nodes' own authored captions ("molten brass poured into real MSDF letterforms"). | before/desktop/01+05 vs after/desktop/01+05; proofs/iter2-s1, iter14-* |
| **A′ · ROOT-CAUSE engine fix: the four-run-old "gold glyph"** | The residual per-glyph incoherence (dark hollow `a`/`O`/`o`) survived every material change — forensics (proofs/testfill/testoutline/testshadow + in-page cap-area probe) isolated it to **broken front-cap triangulation for hole-bearing glyphs**: `ShapePath.toShapes(isCCW)` classifies solids/holes by winding, and Playfair 600's contours arrive with inconsistent winding per glyph — the 'a' had lost **~75 % of its cap area**, the 'O' triangulated ACROSS its counter. F-4 had logged this as the authored-data "gold glyph" (founder-call); it was an engine bug. `glyphToShapes` now assembles shapes by **containment depth** (winding-agnostic; solids CCW / holes CW normalized) — `contoursToShapes` + a 5-case vitest regression (`src/lib/prism/text/glyph-shapes.test.ts`, 5/5). | proofs/iter13-s5 (broken) vs iter14-s5-desktop-capfix (coherent); commit `415aeeb6` |
| **B · s3 Materia composition** | Desktop: title/subhead crowding cleared (title 2.62→2.80, sub → 2.04). Mobile: the title no longer collides with the gem card — the sapphire card is a 9-node CLUSTER (frame rim + bevel + plate + 4 lips + nameplate + label) and is now moved as ONE unit; card labels legible. | before/mobile/03 vs after/mobile/03 |
| **C · s6 Atelier mobile framing** | The configurator watch was an off-center washed crop; now centered, whole, on its pedestal. | before/mobile/06 vs after/mobile/06 |
| **D · s1 clearance + CTA contrast** | Mobile headline cleared from the header band; the RESERVE No.7 amber slab lifted `#6a4a15@0.50 → #8a6420@0.62` (the F-4-queued amber-contrast follow-up, closed). | before/mobile/01 vs after/mobile/01 |
| **E · Chapter folios I–VI** | One editorial wayfinding system Arrival→Atelier: numeral eyebrows (`I · ARRIVAL` … `VI · YOUR COMMISSION`) — 5 NEW fully self-describing text nodes + the existing s5 eyebrow joins in place (`V · EDITION OF ELEVEN`, champagne restyle). New nodes carry complete intent blocks (dogfoods Task 4). | after/*/01..06 (folios visible both viewports) |
| **F · Motion with weight** | Folios fade-track in; s2 spec strip + s5 receive rows slide-up on inview (kinetic-text, power3.out, staggered) — state-communicating, nothing linear, no confetti (DL6). | after frames; graph `cinematicPrimitives` |
| **A-fix · s4 orbit clearance** | The extrude anchor shift + the planetary orbit apogee both intersected the Celestia subhead (planets sliced the copy mid-word). Headline + subhead lifted above the orbit band. | proofs/iter3-s4 (sliced) vs iter4-s4 (clean) |

## 2 · Task 2 — TRUE-RUNTIME PROOF (no shortcuts) — 11/11 PASS

`scripts/_m2-runtime-proof.mjs` (real Chrome + GPU, 1600×900, 0 page errors,
0 console errors). Results `notes/verification/masterpiece-m2/runtime-proof.json`,
frames `proofs/runtime/`. Three diverse elements, each edited ONLY through the
editor's schema surfaces; **the graph/schema is the runtime**:

| Proof | Element | Schema field | Chain proven |
|---|---|---|---|
| P1 TEXT | `orr-acquire-incl-3` | `textSpec.content` (Text tool) | staged → Save → canvas + **preview navigated to Acquire, node mounted+visible, edited copy in frame `P1b`** → reload → **persists** → parity intact → reverted through the same tool |
| P2 MATERIAL | `orr-celestia-cta-f4bcta-slab` | `materialSpec.emissive` (Inspector Visual, FP-15 staged path) | same chain — **preview navigated to Celestia; the LIVE mesh emissive read off the mounted material equals the edit (`liveEmissive: #8c1f2a`)**; the slab glows signal-red in frame `P2b` |
| P3 BEHAVIOR | celestia CTA **pair** (slab + label) | `functionBinding` retarget s5→s6 (Function popup — the 2026-06-14 shared-schema surface) | persists AND **executes**: preview click navigates to Atelier (`P3b`, landed `s6-atelier`) → reverted |
| P4 CANVAS→SCHEMA | `orr-arrival-headline` | `scenePosition.x` via Transform steppers | canvas visual edit round-trips INTO the node schema (0 → 0.24 → reload persists → stepped back → 0), Save & Rebuild both ways |

Reverts: P1 and P3 were reverted through the SAME UI surfaces (Text tool /
Function popup); **P2's revert used the store-consistent staged path** (the
same `previewState.set` write the Inspector pickers issue, then Save) — the
forward edit was fully UI-driven. Selection audit (physical click vs store
fallback) is persisted per selection in `runtime-proof.json`.

Epilogue: the end graph state is **semantically equal to the start**; the
fixture bytes were then restored (F-4 idiom).

## 3 · Task 3 — NODE-EDITOR SHIPPABLE CERTIFICATION (capability matrix)

Legend: ✅ implemented + works end-to-end (proof cited) · 🟡 implemented as the
spec'd harness (deferral explicit in the spec itself) · ⏸ explicitly deferred
with rationale. Fresh proofs live in `notes/verification/masterpiece-m2/proofs/`;
committed evidence is cited by run + artifact.

### 3.1 PRISM-NODE-EDITOR-SPEC §10

| SC | Capability | Status | End-to-end proof | Schema round-trips |
|---|---|---|---|---|
| NE-SC-01 | Galaxy free-nav; click flies + locks | ✅ | F-4 sweep §B (82/82, `notes/verification/finish-f4/`) + fresh fly-to (`matrix-galaxy-deepzoom-node.png`) | n/a |
| NE-SC-02 | Hub click → Hub Editor (right); node click → Node Editor | ✅ | fresh `matrix-hub-editor.png` (selectHub → Materia panel; the planet's onClick calls the same action — GraphScene.tsx:1294); F-4 B07 node double-click → Inspector | n/a |
| NE-SC-03 | Deep zoom reaches any node | ✅ | fresh `matrix-galaxy-deepzoom-node.png` — ⌘K → Enter flies; the dormant sphere fills the frame, editor open | n/a |
| NE-SC-04 | Sphere size ∝ contents; label = artifact name; content icons; visual-type icon | ✅ | galaxy-nodes run `ac54c1ab` (labels) + `deriveContentType` glance icons + live verify:galaxy 7/7 + `matrix-galaxy-overview.png` | n/a |
| NE-SC-05 | Tethers: animated, translucent, reason-colored (EDGE_COLORS additive) | ✅ | overview frame; EDGE_COLORS untouched this run (diff) | n/a |
| NE-SC-06 | `global` hub; global-tethered renders on every page | ⏸ **partial** | the global-page SEMANTICS ships: 10 `globalSlot` header/footer nodes render on every hub with duplicate suppression (verify:global-shell 6/6 live; WS-W4) + 3 `isGlobalElement` overlay cards; the literal `global` HUB in galaxy is the WS-W4 founder-logged deferral | globalSlot round-trips (F-4 D01) |
| NE-SC-07 | Shift-multi-select group; filter overlay dims non-matching | ✅ | F-4 §C selection group + fresh `matrix-galaxy-filter.png` | n/a |
| NE-SC-08 | Purpose tabs edit w/o transform/topology mutation | ✅ | M-2 runtime-proof P1–P3: parity intact, end state semantically equal | ✅ (P1–P3 reload) |
| NE-SC-09 | Visual section read-only for artifacts; **no transform control in the node editor** | ✅ | Inspector Visual = preview + color pickers (staged via preview-state, FP-15); transform editing exists only in the canvas toolbar/gizmo (F-4 §C/E1) | ✅ |
| NE-SC-10 | Integrations/secrets = capability references ONLY | ✅ | W2 grep-proofs + fresh secret scan clean + fresh tile attach carries `providerId/actionId` reference only (`matrix-function-attach.png`) | ✅ |
| NE-SC-11 | Purpose edit → dirty → surgical rebuild (sibling refs stable) | ✅ | F-4 "Rebuild re-realizes; Add to System re-captions + clears dirty" + M-2 P4 Save & Rebuild; RT-SC-09 harness | ✅ |
| NE-SC-12 | Caption stored/displayed/editable, persists | ✅ | storage+display: DetailCard/Inspector; edit: `/editor` purpose panel GlassTextField (WS-W1 e2e 11/11, regen round-trip) + creation dialog + node-agent plan path (F-4 §C "make the caption slightly brighter") | ✅ (W1 regen) |
| NE-SC-13 | ONE edit→save→build→VERIFY→preview path; caption-driven repair; broken ≠ previewable | ✅ | `verify:repair-loop` gate green (in `npm run verify`); Inspector "Repaired" chip carries `repairStrategy`; unbuilt/broken absent from preview (live parity `live.unbuilt-hidden-in-preview`) | ✅ |
| NE-SC-14 | No second live edit path (legacy regen path retired) | ✅ | WS-W5 route audit + all M-2 proofs flow through the single save path | n/a |
| NE-SC-15 | Additive schema only | ✅ | all M-2 graph growth additive (folios, intent enrichment); typecheck-gate 0-new | ✅ |

### 3.2 PRISM-NODE-EDITOR-SPEC-V2 (harness/contract build — D5 scope)

| Criterion | Status | Proof |
|---|---|---|
| A1 Prompt Edit toolbar action, multi-select aware | ✅ | WS-W3 unified agent; F-4 §C node-agent checks |
| A2 freeform design/animation/function prompts | ✅ | W3 validated-plan engine (`lib/prompt-edit/node-agent.ts`) |
| A3 orchestration w/ DESIGN-REFERENCES + catalog injected | 🟡 spec'd harness | D2/D5: stub orchestrator returns VALID plans; UI honestly labeled "Offline draft" (M-1) — live model is a config swap on founder greenlight |
| A4 structured PLAN → additive schema; routes design→canvas, function→node-editor | ✅ | W3 `applyPlan`; F-4 accept/undo checks |
| A5 node editor's own prompt-edit (purpose-scoped) | ✅ | NodeAgentPanel with node selected (galaxy/canvas) |
| A6 production-readiness: contract + stub; live model = swap | ✅ by design | INV-NEV2/D5 — this IS the spec'd shape, not an accidental stub |
| A7 evidence | ✅ | W3 run + F-4 sweep §C + M-1 journey |
| B1 autocomplete search bar | ✅ fresh | `matrix-functions-tab.png` ("Search actions — stripe, slack, runpod…") |
| B2 branded action TILES | ✅ | W2 `editor-brand-tile.tsx` (real provider glyphs); fresh attach carries `brandKey: stripe` |
| B3 multiple per node, reorderable, attach/detach round-trip | ✅ | W2 e2e 15/15 + **fresh attach→detach round-trip** on `orr-acquire-eyebrow` (source `functionTiles` 0→1→0) |
| B4 validate on select; auto-fix in place; status surfaced | ✅ fresh | attach returned `validation.status: "fixed"`, `autoFixNote: "Filled amount, currency with safe sample values"` (sandbox per D5 harness) |
| B5 paste/save/NAME custom snippets (SnippetStore) | ✅ | W2 snippets suite + fresh "Name a reusable snippet…" field |
| B6 provider-agnostic CapabilityProvider; MCP reference adapter; stubs | ✅ | W2 `mcp-adapter.ts` + gated Nango adapter |
| B7 evidence chain | ✅ | W2 suites (tabs 7/catalog 11/auth 9/data 9) + fresh frames |
| C1 platform auto-fill search | ✅ fresh | "Search platforms — runpod, supabase, github…" |
| C2 one-click auth → capability REFERENCE only | ✅ | W2 auth 9/9 (grep-proven no raw token) |
| C3 authed → saved assets self-populate, draggable | ✅ | W2 |
| C4 runpod example end-to-end (mock approve) | ✅ | W2 |
| C5 integration surfaces as galaxy content icon | ✅ | `deriveContentType` integration lane + galaxy glance icons |
| C6 evidence | ✅ | W2 committed run |
| D1–D5 galaxy planets/world (photoreal, sized, icons, fast, frames) | ✅ | verify:galaxy 7/7 live + `matrix-galaxy-overview.png` + F-4 perf §P + mobile sweep |
| E1–E3 no-regression / additive / secret-leak | ✅ | this run's full board (§5) |

### 3.3 Canvas amendment 2026-06-14 (Function/nav in Canvas, shared schema)

✅ fresh — M-2 P3: Function popup binds navigate on the CTA pair; the node
editor READS the same schema (after Task 4's sync the Behavior tab renders
`click → navigate-to-hub:s6-atelier` — frame `schema-sync-behavior-tab.png`);
preview EXECUTES the binding (P3b). Overlay bindings: F-4 §A (reserve/enquire
overlay flow) + F-3 T9.

### 3.4 Explicit deferrals (with rationale — nothing shippable is a stub)

1. **`global` hub in galaxy** — WS-W4 founder-logged deferral. The user-facing
   semantics (chrome on every page, one backing node, dup-suppression,
   round-trip) ships via `globalSlot` + `isGlobalElement`; the galaxy
   representation of a literal `global` hub remains open. The schema gate
   encodes the exception explicitly (S1).
2. **Live AI orchestration + live aggregator vendor** — V2 D5/A6 define the
   prototype as UI + interfaces + MCP reference adapter + a stub orchestrator
   that returns VALID plans ("the live model is a swap"). The UI labels the
   stub honestly ("Offline draft"). Flipping live = config + key on founder
   greenlight (COGS decision).
3. **Caption auto-update / formal caption format** — Ruler §0/§9 future-engine
   work; the prototype ships storage + display + edit (NE-SC-12 ✅) by design
   (FP-NE-9 forbids defining the format now).
4. **Root-Inspector Behavior tab is read-only** — by design: behavior WRITING
   flows through the Function tool (shared schema, amendment) and the
   `/editor` purpose panel (ON·DO, W1); the tab now displays real derived
   interactions after Task 4's sync (was empty-rendering before M-2).

## 4 · Task 4 — schema comprehension readiness (the AI-builder contract)

**The gap:** all 331 nodes carried EMPTY `intent.behaviorSpec.interactions`
while 196 carried a live top-level `functionBinding` — a cold model reading one
node's intent block could not know the element navigates. 105 captions were
thin stubs ("Footer legal line.").

**Shipped:**
- `scripts/m2-schema-sync.mjs` — deterministic + **byte-idempotent** (md5
  proven). Derives INTO `intent`: 196 functionBinding interactions (canonical
  `event`/`effect` shape — the node editor's Behavior tab now renders them —
  plus `do`/`target`/`description` for machine comprehension), 82
  `animationSpec` motion mirrors, 123 `visualSpec.textContent` mirrors, 125
  caption enrichments (authored stub kept; factual derived tail appended).
- `scripts/schema-completeness-gate.mjs` — **8 rules** (identity, placement,
  caption richness ≥ 40 chars, behaviorSpec shape, behavior coherence
  [functionBinding ⇒ mirrored interaction], motion coherence, artifact
  coherence per renderMode, contracts), wired into `npm run verify` as
  `verify:schema`. **336/336 nodes PASS.** A regression (stub intent, an
  unmirrored binding, a contentless text node) now fails the build.

## 5 · Task 5 — full board (all fresh this run)

| Gate | Result |
|---|---|
| `npm run verify` (prism 15 + repair-loop + galaxy + global-shell + parity-static + **schema NEW**) | ALL GREEN |
| `verify:parity` LIVE bidirectional (GATE_URL=:3001) | **13/13** (146 content nodes, all BUILT) |
| node-authorship LIVE (`--` :3001) | **9/9** (162 node-authored artifacts, zero hardcoded, no page errors) |
| typecheck:gate | 0 new (baseline 9) |
| gate:no-dom-ui | PASS (44 files) |
| secret scan (graph + src/lib + src/components) | clean |
| focused tests (`glyph-shapes.test.ts`) | 5/5 |
| runtime proof harness | 11/11, 0 page/console errors |
| Both viewports | 6 hubs × desktop 1600×900 + mobile 390×844, before AND after |

## 6 · Judge verdicts (fresh-context Fable 5, masterpiece bar)

### Round 1 — both judges found real things (the M-1 pattern)

**prism-criteria-reviewer: FAIL, 1 MUST-FIX.** The P1b/P2b "visible in
preview" frames showed the boot hub (Arrival), not the edited element's hub,
and the pass assertions didn't cover preview visibility. **Fixed:** the
harness now navigates preview to the element's hub (the P3b idiom), asserts
`mode/hub/mounted/visible` — and for P2 reads the **live emissive off the
mounted mesh** (`#8c1f2a`, the render itself) — then frames. Re-run: 11/11,
new frames show the Acquire copy and the red-glowing Celestia slab.
Should-fixes taken: P2d revert wording made honest (§2), selection audit
persisted, 8→9-node comment corrected.

**user-advocate: NOT YET, 4 MUST-FIX (all on the new folio system) + 6
should-fixes.** All four fixed as graph data and every affected frame
recaptured fresh:
1. s4-mobile folio sliced by the gilt rule → headline 2.42→2.24, folio
   2.64→2.44 (`after/mobile/04`: folio clean below the rule).
2. s6-mobile folio inside the nav band → whole stack re-laid (folio 2.62,
   headline 2.28, sub 2.02) **and the 11-row swatch grid re-derived 0.12
   lower from desktop poses** so the subhead clears the top swatch row
   (`after/mobile/06`).
3. s3-desktop folio top-clipped → title 2.80→2.72, folio 3.30→3.16
   (`after/desktop/03`).
4. s3-mobile numeral washed out → ALL folios gained a dark outline
   (`#221a08` @ 0.14), weight 500→600, glow 0.10→0.16 (`after/mobile/03`;
   also cures the faint s1-desktop numeral).
Should-fixes taken: s4 "Own the complication" slab got the same amber lift
as s1 (`#6a4a15→#8a6420`); the s5 reserve CTA's bottom edge-lip (read as a
duplicate slab at 390px) hidden on mobile (the slab keeps the binding — tap
target unchanged); s4 subhead lifted 2.50→2.56 off the planet tangency;
s3 brass/meteorite labels bumped to 0.7/0.68. Deferred should-fix: the s6
amber fine-print line (summary panel micro-copy) — logged for the next data
pass.

### Round 2

**prism-criteria-reviewer: PASS, 0 MUST-FIX.** Verified the round-1 fix is
"closed for real, not cosmetically" (assertions + frames + timestamps), the
polish script is a byte-exact fixed point of the committed graph, gates
re-pass fresh, report honest. One should-fix — the glyph-winding regression
test wasn't collected by the default vitest glob — **taken**: the suite now
lives at `tests/text/glyph-shapes.test.ts` (5/5 under the default include);
the co-located src path re-imports it as a pointer.

**user-advocate: NOT YET — 3 of 4 round-1 regions confirmed fixed, 3 new
MUST-FIX** (evidence hygiene called "exemplary"): (1) a desktop-s4 orbit-ring
planet occluded the subhead copy; (2)+(3) the s1/s2 mobile folio numerals
washed out on the brightest sky bloom (luma-measured ~1.2:1). **All fixed as
graph data:**
1. The orrery hero rig scaled 1→0.88 (ring apogee now clears the copy band;
   mobile compensated ×0.545 so the approved 390px framing is unchanged) and
   the subhead + scrim stepped ahead of the ring plane (z 0.25→0.55/0.49).
   Verified across TWO orbit phases (`after/desktop/04` +
   `proofs/r2-s4-desktop-phase2.png`) — the copy reads in full in both.
2. `orr-arrival-folio-scrim` + `orr-movement-folio-scrim` — quiet dark scrim
   bands behind the two folios (a clone of the authored subhead-scrim idiom,
   complete self-describing nodes). The numerals now read over the bloom on
   both viewports (`after/mobile/01`, `after/mobile/02`).
Advocate should-fix taken: the s3 closing line ("Eleven years. One hand.")
lifted off the footer rule on mobile (−2.52→−2.42, `after/mobile/03`).
Logged, not taken: the s2 subhead's "one." tail fade is the authored F-3
emphasis device (consistent across viewports); the capture chrome pill over
the footer is harness framing, not product; the s5 receive-panel seam is
queued for the next data pass. Board re-run after the fixes: static chain
ALL GREEN, parity live 13/13, tsc 0-new, glyph suite 5/5 (now in the default
suite), schema gate 338/338 (the two scrim nodes are complete schemas).

### Round 3 — _appended below after re-judging._

## 7 · Founder follow-ups

1. **Live-model swap** for the node agent + capability validation (V2 D5
   greenlight): config + key; UI already honest about the stub.
2. **`global` hub in galaxy** (deferral #1) — decide whether the literal hub
   lands or `globalSlot` remains the permanent model (spec edit either way).
3. The **F-4 signoff sheet** (10 items) remains open where not closed here —
   amber CTA contrast is now CLOSED (slice D); the gold-glyph item is CLOSED
   at the root (engine fix `415aeeb6`).
4. Chapter-folio copy (`I · ARRIVAL` … `VI · YOUR COMMISSION`) is authored
   data — one command re-words all six if you want different chapter names.

## 8 · Evidence index

- BEFORE/AFTER: `notes/verification/masterpiece-m2/{before,after}/{desktop,mobile}/01..06-*.png`
- Masterpiece iterations + forensics: `notes/verification/masterpiece-m2/proofs/iter*.png`, `testfill/testoutline/testshadow-s5-desktop.png`
- Runtime proof: `proofs/runtime/P0..P4*.png` + `runtime-proof.json`
- Matrix frames: `proofs/matrix-*.png`, `proofs/schema-sync-behavior-tab.png`
- Scripts: `scripts/m2-masterpiece-polish.mjs`, `scripts/_m2-runtime-proof.mjs`, `scripts/m2-schema-sync.mjs`, `scripts/schema-completeness-gate.mjs`
- Engine fix: `src/lib/prism/text/text-object-3d.ts` (`contoursToShapes`) + `src/lib/prism/text/glyph-shapes.test.ts`
- Gate side-outputs: `notes/verification/finish-f2/galaxy-parity-gate.json`, `notes/verification/fix1/node-authorship-gate.json` (refreshed, per precedent)
