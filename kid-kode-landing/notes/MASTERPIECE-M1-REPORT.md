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

## 3. Verdicts

_(to be completed after the observer evaluations)_

## 4. Usability journey friction table

_(to be completed after evaluation B)_

## 5. Evidence index

_(to be completed)_
