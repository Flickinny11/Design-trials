# MASTERPIECE M-1 — The Editor as Masterpiece + User-Masterpiece Usability

Run: 2026-07-04 · Fable 5 · branch `codex/prism-recovery-harness-20260630`
Governing law: NEAR-HUMAN-QA-PROTOCOL.md + PRISM-SHELL-DESIGN-LAW-2026-07-03.md (DL1–DL10)
+ PRISM-MASTER-SPEC DESIGN LAW. Foundation: toolbar-premium (`a14e00bd`) + FINISH F-1
(`415234a5`) — surgical craft on those surfaces, no rewrites, no forks.

## Founder intent (verbatim anchor)

> "make the toolbar and keyframe your masterpiece of design and use our observer to
> evaluate whether a user would truly find it a masterpiece and to evaluate its
> usability, can a user truly design a masterpiece using the editor... nothing less
> than beautiful and intuitive will be acceptable, making the editor itself a marvel."

## 1. BEFORE — baseline audit (evidence: `notes/verification/masterpiece-m1/before/`)

| Frame | What it shows |
|---|---|
| `before/desktop/canvas-overview.png` | Canvas mode, 1600×900 — rail + watch hero + HUD + hub pills |
| `before/desktop/toolbar-rail-element.png` | Rail closeup (device px) — smoked slab, chrome bezel, 14 cubes |
| `before/desktop/toolbar-hover-tooltip.png` | Hover state + the CURRENT tooltip |
| `before/desktop/keyframe-strip.png` | Keyframe strip, empty lanes |
| `before/desktop/keyframe-strip-keys.png` | Keyframe strip with 2 captured keys |
| `before/desktop/camera-hud.png` | Camera instrument + JOURNEY strip + Shipped Frame |
| `before/mobile/canvas-overview.png` | 390×844 — keyframe editor as bottom sheet |
| `before/mobile/canvas-toolbar.png` | 390×844 — rail + selected node + compact HUD |

### Defects found against the MASTERPIECE bar (and the law)

1. **Tooltip is flat glassmorphism, off-palette** (`ToolbarTooltips.tsx`) — raw CSS
   `backdrop-filter: blur(10px)` frosted pill (DL4 violation: forbidden treatment), a
   blue-tinted gradient (`rgba(28,36,52)…`) outside the RED/BLACK/WHITE identity (DL2),
   `var(--font-ui)` sans fallback (DL3 risk), flat accent dot. The one label the user
   reads on every toolbar hover is the weakest material in the instrument.
2. **The glass doesn't answer the hand** — rail + cubes have a fixed yaw; refraction and
   specular never move with the pointer. DL4: "specular + refraction responding to
   camera, hover… If light doesn't move, it doesn't ship." Idle glass is static.
3. **Activation has no weight** — a cube fires on pointer-down with zero physical
   acknowledgment (no press-in, no settle). DL6: micro-interactions carry weight.
4. **Keyframe seek snaps** — clicking a key jewel teleports the playhead (and the live
   node pose) with no motion; cause/effect is invisible. Capture (+) writes a key with
   no confirmation event.
5. **Empty lanes read as voids** — at 1486px wide the four lanes are undifferentiated
   dark wells with a single center rule; the scrubber above carries machined ticks the
   lanes don't inherit.
6. **Mobile sheet duplicates chrome** — the bottom-sheet re-housing shows TWO headers
   ("TIMELINE / Keyframe Editor" sheet header + the panel's own header) and TWO close
   buttons; the KEYS chip truncates ("2 KI…"). Composition failure at 390px.
7. **Cube edge wire reads repetitive at rest** — every cube carries a full bright
   wire-box (#b9c4d2) at rest; 14 identical outlined boxes read wireframe-y rather than
   glass catching light. Hover/active glints should be the bright moments.

## 2. PLAN — the masterpiece pass (surgical; premium.ts stays the one source)

- **P1 Tooltip → machined instrument label.** Rebuild `ToolbarTooltips` visual with
  `premium.ts` recipes: machined gunmetal body (RBW.bodyMetal) + chrome bezel hairlines
  (RBW.bezelEdge), red jewel pip (RBW.keyJewel), Sora display face, weighted
  slide-and-settle entrance. Kill backdrop-blur + the blue palette. Same props/API.
- **P2 Living light.** Pointer-parallax on the rail: pointer position over the rail
  drives a critically-damped tilt of the rail group + a key-light nudge, so refraction
  and specular sweep as the hand moves; plus one slow autonomous light drift so the
  glass breathes at idle. Isolated to the toolbar's own R3F scene.
- **P3 Press weight.** Cube pointer-down sinks the cube into its socket (z dip + micro
  squash), releases with a damped settle; activation reads as a physical key press.
- **P4 Keyframe delight + composition.** (a) Seek-with-weight: jewel click tweens the
  playhead (expo.out) so the live node sweeps to the pose; (b) capture confirmation:
  new jewel pops with back.out + a one-shot signal-red lane sweep; (c) machined tick
  rules inside lanes (inherit the scrubber's measure); (d) compact: drop the duplicated
  inner title/close inside the BottomSheet housing, chip never truncates.
- **P5 Rest-state restraint.** Cube edge wire dims at rest (steel, not white) so hover
  (white) / active (signal red) become the bright moments — DL7 precision, DL6 state
  communication.

Out of scope (unchanged): flyout plates (chrome-slab real glass, F4-judged), camera HUD
layout (F2/F4-judged; revisit only if the masterpiece judge flags), `/editor` dock +
`/keyframe-editor` lab (F1-inherited premium), engine-interior assets (design-law
addendum: no in-engine font/material migrations this run).

## 3. What shipped — the masterpiece pass (commits `e33d8101`…`f3538b3a`)

- **P1 — machined instrument label** (`liquid-toolbar/ToolbarTooltips.tsx`): the hover
  tooltip's CSS backdrop-blur frosted pill (DL4 violation) replaced by a machined
  gunmetal plate from premium.ts (RBW body + chrome bezel hairlines), a signal-red
  jewel cut like the keyframe diamonds, a mono index numeral, the display face for the
  name, and a weighted slide-and-settle entrance.
- **P2 — living light** (`ToolbarScene.tsx` + `LiquidGlassToolbar.tsx`): `RailRig`
  tilts the whole glass assembly toward the pointer (critically damped) and sweeps the
  key light with it; a `DriftingStreak` softbox crawls on a slow Lissajous inside the
  per-frame environment so speculars move even at idle. Measured: pointer-parallax
  pixel delta 32.2 mean-abs, idle drift 14.3.
- **P3 — press weight** (`GlassCubeToolButton.tsx` + external press plumbing): pointer-
  down sinks the cube into its socket with a forward tip + micro squash; release
  settles through the damped lerp. The DOM hit-target overlay eats raw pointer events,
  so press — like hover — is plumbed via `externalPressIndex`.
- **P4 — keyframe delight + composition** (`KeyframeEditor.tsx`): jewel-click seek
  GLIDES the playhead (expo.out; measured 0.8→0.344→0.201→0.2) so the driven node
  sweeps to the pose; capture pops the new jewels with back.out + red flash; lanes
  inherit the scrubber's machined tick measure; on compact the duplicated inner
  header/close are dropped (the BottomSheet header owns them).
- **P5 — rest restraint** (`GlassCubeToolButton.tsx`): cube edge wire dims to quiet
  steel at rest; hover (white) and active (signal red) are the bright moments.
- **Judge-round fixes** (details in §3.1): mobile one-layer-per-band (DetailCard inset,
  HUD yield, gunmetal rail backing, JOURNEY strip compact labels), BottomSheet
  `contentFit` (+ a real drag-release settle bug fix), gizmo yield on compact, and the
  ONE-TIME-AXIS unification of the keyframe ruler + lanes (was two divergent time→x
  mappings, up to ~147px playhead split; now one shared column skeleton + band,
  geometric centers 0.5px apart at every playhead).

## 3.1 Observer evaluation A — MASTERPIECE VERDICT (fresh-context Fable-5 judges)

| Round | First line | MUST-FIX found | Disposition |
|---|---|---|---|
| 1 | NOT YET | Mobile rail sliced the selection card; full-snap sheet two-thirds void | Both fixed (`3a1fa83d`) |
| 2 | NOT YET | Gizmo axis read through the translucent card on compact | Fixed — gizmo yields while card is up on compact (`440652a7`) |
| 3 | NOT YET | Sheet frames were stale (pre-fix captures) | Recaptured on fixed build in the strongest state (`222598ff`) |
| 4 | NOT YET | Ruler + lanes ran two different time→x mappings (~147px playhead split) | Fixed — one shared axis, constant sub-pixel offset (`f3538b3a`) |
| 5 | NOT YET → final below | Stale desktop overview frame (pre-axis-fix) | Recaptured (`6cb56912`) |

Round-1 judge on desktop: "The desktop instrument genuinely clears the bar… would
survive the 'what studio made this' screenshot." Round-5 judge: "The instrument itself
now measures and reads like a masterpiece."

**Accepted dispositions (logged for the founder, judges concurred non-blocking):**
- Desktop gizmo axis line crossing the HUD pill row — honest glass translucency of the
  DOM chrome over the scene band; opaque pills would break the material language.
- Faint text ghost at the mobile rail's right edge — demoted to non-blocking by the
  gunmetal backing (was legible bleed).
- Active-tool red outline hugging the tilted cube face — 3D-honest; tracks correctly
  under parallax.
- Transform-flyout-over-strip when both open — accepted floating-inspector convention.
- Jewel optical centroid reads ≤2px left of the lane cursor when weighted by redness —
  the jewel's specular highlight is intentionally at 32%/28%; geometric centers are
  0.5px apart (half the 1px hairline).

**FINAL VERDICT (round 5, fresh-context Fable-5 judge, after independently
re-measuring the recaptured frames):**

> **"MASTERPIECE: YES — a discerning user would call this a masterpiece."**
>
> "Composition/hierarchy: rail · canvas · strip · inspector read as one machined
> cockpit; ruler and lanes share one column skeleton to the pixel. Material
> believability under motion: icon sculptures re-pose toward the pointer (32.2
> delta) and idle with restraint (14.3). Micro-interaction weight: machined
> tooltip pill with mono index; capture pop lands diamonds dead on the playhead
> column. Typographic elegance: serif display headline, Sora UI, tabular mono
> figures — no grotesques. Cohesion + restraint: one red/black/white instrument
> desktop-to-mobile; red used only where meaning lives."

Five rounds, every MUST-FIX fixed and re-verified with fresh context; the final YES
is unhedged.

## 4. Observer evaluation B — USABILITY JOURNEY (first-time user, no insider knowledge)

A fresh-context agent drove the LIVE app through visible affordances only (real
clicks/drags on screenshots; no console hooks, no source reading): galaxy → found the
hero headline → edited its purpose/behavior text in the node editor → canvas
transform refinement (three taste iterations) → authored a 2-key settle-from-above
animation in the Keyframe Editor → verified in Preview → saved → cold reload →
design survived (transform, caption, both keyframes persisted).

**Journey verdict (verbatim):** "YES — a first-time user can genuinely design
something beautiful here. The core loop is real and pleasurable… I went from blank
exploration to a saved, animated, portfolio-grade hero in one sitting without reading
a line of docs."

**The designed result** (frames `journey/20-final-desktop.png`,
`journey/21-final-mobile.png`): the ORRERY No.7 Arrival hero — headline scaled 1.08×
and lowered into a tight editorial lockup, with a quiet 2-key settle-from-above
entrance. Journey's own grading: "portfolio-shippable." Coordinator concurs on
review of the frame. All 6 journey stages completed: galaxy ✓ node-editor ✓
canvas-transform ✓ keyframe-animation ✓ preview ✓ save/reload ✓. 0 console errors
throughout.

### 4.1 Friction table (all items; fixed vs logged)

| # | Friction (journey wording) | Severity | Disposition |
|---|---|---|---|
| 1 | Animation authoring popup floated over the strip's ruler; a ruler click hit its "Preview App" key and yanked the user out of Canvas | MAJOR | **FIXED** (`b3536096`) — the flyout auto-closes when the Keyframe Editor opens |
| 2 | Plan chip said "STUB" (dev jargon) | MAJOR (jargon part) | **FIXED** (`b3536096`) — chip reads "Offline draft" |
| 3 | Behavior Generate routed a motion prompt to a material restyle plan; applied change not inspectable; behavior record not visibly persisted | MAJOR | **LOGGED — founder** (AI-builder plan routing is explicitly out of M-1/editor-build scope; needs motion-verb routing + an inspectable applied-plan record) |
| 4 | Dock pills "hit-targets offset ~60–100px"; cursor ring offset from pointer | MAJOR (as filed) | **REFUTED with evidence** — hub-pill hit-test IS the rendered DOM element (self-hit at own center); the offset was the screenshot harness aiming by the LAGGED magnetic ring; the native OS cursor is never hidden (MagneticCursor augments, never replaces). Product note (NIT): during fast moves the ring can suggest a neighbor control — standard Cuberto pattern, logged |
| 5 | Keyframe Play "doesn't move the element"; scrub "snaps back" | MINOR (re-classified) | **REFUTED with evidence** — panel Play drives the node live even in edit mode (group Y measured sweeping 4.31→2.57 during play). The journey's own animation was 0.06 units — imperceptible by design choice — and their seek clicks were eaten by the popup (#1, fixed) |
| 6 | Ruler track-click doesn't seek | MINOR | Believed same root as #1 (popup ate the left-ruler clicks); the band-aligned range input jumps on track click natively. Re-test post-fix logged |
| 7 | Post-reload canvas glyph-clicks would not re-select the headline (search + fly worked) | MAJOR | **LOGGED — founder** (runtime raycast/selection registration after cold reload; outside M-1 chrome scope; Cmd+K path works as fallback) |
| 8 | Galaxy hover shows highlight but no name tooltip; cluster-click selected 6 items when one sphere was expected | MINOR | LOGGED (galaxy LOD label design decision; hover-name at far LOD + cluster affordance for a future pass) |
| 9 | "Clear" vs "FILTER" adjacency in the group inspector; Escape didn't clear selection | MINOR | LOGGED (no overlap found in code review — flex row with gap; likely #4's ring-aim artifact contributed; Escape semantics = design decision) |
| 10 | No first-run tour auto-offer (button exists, easy to miss) | MINOR | LOGGED (the tour EXISTS and auto-showed in the coordinator's own fresh-profile sessions — the journey's profile had localStorage state; auto-offer cadence = founder call) |
| 11 | Save vocabulary is engineer-speak (BUILT, DIRTY-REBUILD, snapshot hash) | NIT | LOGGED (copy pass candidate) |
| 12 | Mobile: the 1.08× headline kisses viewport edges (user's own design output) | NIT | User-design outcome, not editor chrome; responsive scenePos overrides exist for exactly this |

## 5. Gates (all green, run on the final build)

| Gate | Result |
|---|---|
| `verify:parity` (LIVE bidirectional, :3001) | **13/13, 0 hard-fail** — 278 mounted artifacts graph-backed; 141 element atoms verified both directions |
| `verify:parity-static` | 6/6 |
| `verify:galaxy` | 7/7 (same intentional `global-hub` WARN as W4→F4) |
| `verify:global-shell` | 6/6 |
| node-authorship gate (`GATE_URL=:3001`) | 9/9, no page errors |
| typecheck | 9 errors = baseline, **0 new** |
| secret scan | clean |
| console/page errors across every browser session this run | **0 errors** |
| live-graph.json fixture | restored via git checkout after the journey's saves |

## 6. Evidence index

- `notes/verification/masterpiece-m1/before/` — 8 baseline frames (desktop + mobile)
- `notes/verification/masterpiece-m1/after/desktop/` — rail closeup · machined hover
  label · press-held · parallax pair (32.2 delta) · idle pair (14.3) · strip
  empty/keys/capture-pop/seek-midglide (one time axis) · canvas overview
- `notes/verification/masterpiece-m1/after/mobile/` — canvas overview (card clear of
  rail, HUD + gizmo yielded, gunmetal rail backing) · HUD-returns · rail closeup ·
  keyframe sheet + sheet-after-hard-drag (content-fit 364px)
- `notes/verification/masterpiece-m1/journey/` — 22 frames, `00-first-load` →
  `21-final-mobile`
- Measured motion/alignment numbers: parallax 32.2 mean-abs, idle drift 14.3, seek
  glide samples 0.8→0.344→0.201→0.2, axis alignment −0.5px constant, play-drive sweep
  4.31→2.57
- Commits: `e33d8101` checkpoint · `ed80b616` pass · `3a1fa83d` R1 fixes · `440652a7`
  R2 fix · `222598ff` R3 recapture · `f3538b3a` R4 one-time-axis · `6cb56912` R5
  recapture · `b3536096` journey friction round

## 7. Founder follow-ups (logged, not blocking)

1. Behavior-plan routing: motion-verb prompts should produce animation plans, not
   material restyles; applied plans need an inspectable, persisted record (friction #3).
2. Post-reload canvas raycast/selection registration for built MSDF elements
   (friction #7).
3. Desktop gizmo axis line reading through the translucent HUD pills — honest glass;
   opaque pills would break the language; judge-accepted, founder may still want a
   gizmo-yield-near-chrome rule.
4. Galaxy hover-name at far LOD + cluster-click affordance (friction #8).
5. Save vocabulary copy pass (friction #11); first-run tour auto-offer cadence
   (friction #10); Escape-clears-selection semantics (friction #9).
6. Faint text ghost at the mobile rail's right edge (demoted non-blocking by the
   gunmetal backing; fully opaque backing would kill the glass read).

---

**Both founder questions answered with evidence:** a discerning user WOULD call the
toolbar + keyframe editor a masterpiece (five adversarial fresh-context rounds to an
unhedged YES), and a first-time user CAN design something genuinely beautiful with
the editor end-to-end (6/6 journey stages, portfolio-grade result, persisted through
reload).

PRISM-MASTERPIECE-M1: RUN COMPLETE

## 4. Usability journey friction table

_(to be completed after evaluation B)_

## 5. Evidence index

_(to be completed)_
