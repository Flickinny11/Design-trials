# PRISM — FINISH F-1 — Keyframe Editor Premium — Fable 5 — 2026-07-01

Branch: `codex/prism-recovery-harness-20260630` · Dev server: `http://localhost:3000`
(serves this worktree). Verification frames: `notes/verification/finish-f1/`.
Protocol: `docs/prism/NEAR-HUMAN-QA-PROTOCOL.md` (read first, graded against).

---

## 1. Interpretation of the founder's intent

"**Same for the keyframe editor**" — the keyframe editor inherits, verbatim, the premium
design language locked in the toolbar run (`notes/TOOLBAR-PREMIUM-REPORT.md` §1/§8):

- **RED / BLACK / WHITE photoreal system** — machined black metal, brushed chrome/white,
  `SIGNAL_RED #ff2a38` (+ `RED_DEEP #7d0f18`, `RED_HOT #ff5a55`) as the ONE accent family,
  real refracting smoked glass. Photorealistic materials/textures, ambient light
  refraction, **visible depth and real edges**. Nothing flat, no icon-set look.
- **Typography fashionable, elegant, NO grotesque fonts** — Sora (`--font-display`, the
  codebase-sanctioned geometric non-grotesque) for name/label text; tiny technical
  readouts may stay mono (toolbar-run reviewer precedent: the mandate targets labels).
- **Custom 3D geometric icons/handles**, gradients + shading, some animated.
- **Fast + responsive, desktop AND mobile**, verified interactively.
- **Function preserved**: record, scrub, play, edit keys, and the JOURNEY/REC camera
  controls in the canvas must all keep working (protocol §1 full interaction sweep +
  edit round-trip with persistence).

## 2. The real surfaces (no forks) and their current state vs the bar

Assessed on the live app (real Chrome, this worktree), desktop 1600×809 + mobile 390×844.

| Surface | Where it lives | Today | Gap vs the bar |
|---|---|---|---|
| **A. Keyframe panel** (PRIMARY) `overlays/KeyframeEditor.tsx` | Root editor `/`, canvas mode → toolbar Animation tool → "Keyframe Editor"; bottom strip (desktop) / bottom sheet (mobile) | Near-black flat charcoal strip; hairline lane wells; 10px CSS diamonds in grey/ice; **arc-cyan accents** (`DS_ACCENT`); JetBrains Mono everywhere; brass/ice smoke reveal | Palette ✗ (cyan+ice, zero red), materials ✗ (flat hairlines, no machined read, no visible edges), keys ✗ (tiny flat diamonds), type ✗ (mono-only), **camera HUD overlaps the open panel** (frames 00/01 — JOURNEY strip sits on the lanes); scrub/play moves only the panel UI, the canvas node does NOT animate |
| **B. JOURNEY/REC camera strip** `overlays/CanvasCameraHud.tsx` | Root editor `/`, canvas mode, bottom-center | Chrome glass pills, REC dot `#e0594e` (off-palette dusty red), functions work | Small: REC affordance → `SIGNAL_RED` family; must be lifted clear of the open keyframe panel |
| **C. Keyframe dock** `editor-shell/EditorKeyframeDock.tsx` | `/editor` shell, canvas view, bottom dock | Worn-metal faders working (TIME + RISE/SCALE/SPIN/FADE), **brass** playhead bar `#caa06a`, **ice-blue** fader tint `#9fb6d6`, **green** PLAY `#7fd6a0`, dusty CLEAR `#c98a8a` | Palette ✗ — brass/ice/green off the red/black/white mandate |
| **D. Keyframe lab** `editor/keyframe/*` + `app/keyframe-editor/` | `/keyframe-editor` route | Milled glass timeline pane (real ExtrudeGeometry channels ✓), worn-alloy knobs — but **jewel-tone rainbow** (sapphire/emerald/bronze/oxblood), clear blue-ish glass, blue-grey engraved Inter labels, lavender rim light `#e6c9ff`, blue subject cube | Palette ✗ (4-color rainbow), glass ✗ (clear/bright, not smoked premium), type ✗ (Inter = grotesque; repo has `fonts/ui/Sora-Variable.ttf`), lighting ✗ (purple) |

**Verdict** (same shape as the toolbar run): the geometry + interaction foundations are
strong — milled channels, worn-alloy PBR, real drag/scrub engines, chrome-slab GPU
surfaces behind the DOM panel. The elevation is a **material + palette + type job plus two
honest functional fixes**: (1) the open panel and the camera HUD collide; (2) the panel's
scrub/play must actually animate the selected node in the canvas (the `/editor` dock
already proves the driver pattern — the root panel gets the same).

## 3. Build plan (surgical, additive, behavior-preserving)

1. **ONE design system** — new `design-system/premium.ts`: the founder's red/black/white
   photoreal tokens (SIGNAL_RED/RED_DEEP/RED_HOT + gunmetal blacks + chrome whites + the
   smoked-glass recipe constants). `liquid-toolbar/config.ts` re-exports its reds from it
   (API unchanged); every keyframe surface imports from it. Toolbar + keyframe editor now
   reference one module.
2. **Panel (A)** — machined black instrument: brushed gunmetal body + chrome bezel edges +
   red hairline; header title/lane names → Sora display; scrubber → recessed well, red
   progress glow, chrome+red playhead jewel; keys → red jewel diamonds (radial red core,
   chrome rim, glow, hover-grow); transport/snap buttons → machined keycaps, red when
   active; smoke reveal retinted red/chrome. All handlers/stores untouched.
3. **Panel scrub-preview driver (A, function)** — while the panel is open, a rAF driver
   applies the interpolated keyframe pose (`params` translate/rotate/scale/opacity,
   normalized `t`) to the selected node's registered group (`__PRISM_EDITOR_NODE_GROUPS__`)
   on top of its base `scenePosition ⊕ canvasTransform`; base pose restored on close.
   Pure evaluator in `lib/prism-graph/keyframe-scrub.ts` (+ vitest). Same pattern as the
   committed `/editor` KeyframeDriver — scrub/play now visibly animates the node in canvas.
4. **HUD de-collision (A+B)** — additive `keyframePanelOpen` UI flag on
   `useGraphEditorStore` (same idiom as `editInPreview`); CanvasToolbar drives it; the
   camera HUD lifts above the open strip (desktop) with a smooth transition. REC dot +
   record affordance → SIGNAL_RED.
5. **/editor dock (C)** — retint through `premium.ts`: playhead bar + track faders + PLAY
   → signal red; TIME fader + CLEAR → chrome. Wiring, probes, FaderRow untouched.
6. **Lab (D)** — pane → smoked dark glass (the toolbar rail's proven recipe:
   `attenuationColor #141922`, high env intensity) + chrome accents; knobs → oxblood worn
   alloy w/ red tint (playhead knob stays chrome); pips → red jewels; engraved labels →
   Sora (`fonts/ui/Sora-Variable.ttf`) in chrome/red fills; lavender/blue rim lights →
   neutral white + red rim; backdrop → black w/ deep-red bloom; subject cube → oxblood.
7. **Verify per NEAR-HUMAN-QA-PROTOCOL** — full click/hover/drag/scrub sweep of every
   control on A–D, edit round-trip (capture → plays in canvas → Save → reload →
   persists), desktop+mobile frames, typecheck 0-new, gates, both judges (user-advocate +
   prism-criteria-reviewer) PASS 0 MUST-FIX.

**Guardrails honored** (workspace-completion Forbidden Drift): no new editor shell, no
authoring from Preview, no stock icons, no remote chrome assets, no raw secrets, no full
rebuild for a node edit; runtime + `.prism` untouched; keyframe engines/stores preserved;
DOM/CSS stays legal (overlays are editor chrome, outside the no-dom-ui gate scope).

## 4. EARLY CHECKPOINT — before frames (founder review)

Captured on the live app (real Chrome, this worktree):

- `verification/finish-f1/desktop/00-before-keyframe-panel.png` — root editor, panel open
  under the animation flyout; `00-before-keyframe-closeup.png` — the strip @2.3×: flat
  near-black, hairline lanes, cyan/metal accents, **camera HUD sitting on the lanes**.
- `desktop/01-before-panel-clear.png` (+ `-closeup`) — panel with a captured key: tiny
  grey diamonds, no material read.
- `desktop/02-before-camera-hud-journey.png` — JOURNEY/REC strip closeup (off-palette REC
  dot, overlap position).
- `desktop/03-before-keyframe-lab.png` — `/keyframe-editor`: jewel-tone rainbow knobs on
  clear blue glass.
- `desktop/04-before-editor-shell-dock.png` — `/editor` KEYFRAMES dock: brass/ice/green.
- `mobile/00-before-keyframe-sheet.png` — the mobile bottom sheet (flat dark wells).

**Direction, one line:** the keyframe editor becomes a machined black+chrome instrument
with signal-red jewels — the toolbar's exact material language — and its scrub actually
drives the selected node in the canvas.

> EARLY CHECKPOINT — direction set; before-frames captured. Building now. After frames,
> gate + judge results follow below as the run proceeds.

## 5. What changed (surgical, additive, behavior-preserving)

**ONE shared design system** — new `src/components/editor/design-system/premium.ts`: the
founder's RED/BLACK/WHITE photoreal tokens (`SIGNAL_RED #ff2a38` / `RED_DEEP #7d0f18` /
`RED_HOT #ff5a55`; gunmetal blacks; chrome whites; the smoked-glass recipe + machined-metal
CSS gradient recipes). `liquid-toolbar/config.ts` now **re-exports its reds from this module**
(API unchanged), so the toolbar and the keyframe editor reference the same source of truth.

**A — Keyframe panel** (`overlays/KeyframeEditor.tsx`, PRIMARY):
- Flat charcoal strip → **machined black instrument**: brushed-gunmetal body with a chrome
  bezel edge (specular top / shadowed bottom / red hairline), a Sora-display header title
  and lane names (was JetBrains Mono), a recessed machined scrubber well with a **red**
  progress glow and a chrome+red playhead jewel, and keys rendered as **signal-red jewel
  diamonds** (radial red core, chrome rim, glow, hover-grow to 1.35×). Transport/snap/loop
  keycaps go red when active.
- **NEW live canvas driver**: while the panel is open, a rAF loop applies the interpolated
  keyframe pose (`lib/prism-graph/keyframe-scrub.evalScrubPose`, pure + unit-tested) to the
  selected node's rendered group over its base `scenePosition ⊕ canvasTransform`; base pose
  restored on close. Scrub/play now **visibly animate the node in the canvas** (was UI-only).
- Capture reads the live preview buffer before appending (fixes a stale-closure add) and
  still routes through `usePreviewStateStore` (FP-15 — never writes source directly).

**HUD de-collision** — additive `keyframePanelOpen` UI flag on `useGraphEditorStore` (same
idiom as `editInPreview`; owned by `CanvasToolbar`, reset on mode change). The camera HUD
(`CanvasCameraHud.tsx`) and the Node-Agent panel (`NodeAgentPanel.tsx`) **lift above the open
strip** with a 300ms transition (they were overlapping the lanes). The panel itself is inset
past the toolbar rail (`left-[114px]`). REC dot + record affordance → `SIGNAL_RED`.

**C — /editor dock** (`editor-shell/EditorKeyframeDock.tsx`): playhead bar + property faders
+ PLAY → `SIGNAL_RED`; TIME fader + CLEAR → chrome. Wiring / probes / FaderRow untouched.

**D — /keyframe-editor lab** (`editor/keyframe/*`): pane → **smoked dark glass** (dark
attenuation, higher env + clearcoat); jewel-tone rainbow knobs → one worn **oxblood alloy**
red-tinted, playhead knob chrome; pips + PLAY glyph → signal-red jewels; engraved labels →
**Sora** (`fonts/ui/Sora-Variable.ttf`, was Inter=grotesque) in chrome fills, title in red;
backdrop → black w/ deep-red bloom; lavender rim light → signal-red rim; subject cube →
oxblood.

## 6. Verification (NEAR-HUMAN-QA-PROTOCOL — all evidence cited)

**Gates (§5):**
- `tsc --noEmit` → **9 errors = pre-existing baseline, 0 new** (GraphScene GLProps + 8 test
  NodeContext.THREE — none in changed files).
- `no-dom-ui-gate` → **PASS** (44 files; `editor-shell` + `app/editor` in scope; my dock edit
  swapped only color constants).
- `verify-galaxy-semantics` → **7/7 PASS** · `verify-global-shell-semantics` → **6/6 PASS**
  (the `galaxy:global-hub-missing` WARN is the pre-existing intentional deferral, unrelated).
- `node-authorship-gate --editor` → **7/7, 0 hard-fail** (327 seeded, 36 realized, clean).
- Unit tests: `finish-f1.keyframe-scrub` **7/7** + T08/EB-08-02/EB-08-05 → **55/55 pass**.
- Secret scan on all changed files → **clean** (color/geometry only; no capability/secret drift).

**Interaction sweep (§1) — root editor `/`, canvas, real Chrome, node `orr-arrival-watch`:**
- CLICK: Animation tool → "Keyframe Editor" opens the strip; play/pause, loop, 1/60·1/100·
  1/120 snap chips (active styling switches), close all fire; every lane **+** capture button
  reachable (not covered) — `addReachable:[true,true,true,true]`.
- HOVER: jewel hover-grows to **scale 1.35** (`26-jewel-hover-grow.png`).
- DRAG/SCRUB: scrubber input drives the playhead; diamond click seeks to its `t` (0.08).
- EDIT ROUND-TRIP: two poses captured at t=0.08 / 0.92 → **scrub drives the node live** in
  the canvas (node x −1.6 @ t0 → +1.6 @ t1, rotZ 0→0.5; midpoint eased; side-by-side
  `22-scrub-motion-sidebyside.png`) → **Save** (commit → source, `2 KEYS`, isDirty=false) →
  **reload** → keyframes persist (`persistedTs:[0.08,0.92]`) and **still drive from source**
  (`23-after-reload-persisted.png`, node moves −1.6→+1.6 after reload). Test-pose fixture
  restored via git afterward (design lives in code, not the mock graph).
- JOURNEY/REC (§ founder "must keep working"): REC records waypoints (0→1→2 pts), Clear +
  Play-in-Preview enable at ≥2 pts (`25-after-journey-2pts.png`); HUD sits clear of the open
  strip (`hudClearOfPanel:true`).
- Close restores the node's **base pose** (scrubbed −1.6 → restored +1.6) and returns the HUD.
- **0 page/console errors** across the run.

**Both viewports (§2):** desktop 1600×900 (`10..26`, `30`, `31`) + mobile 390×844 sheet
(`mobile/10-after-keyframe-sheet.png`, tap sweep: seek 0.92, all + reachable, jewel tap-area
expanded to ±11px) and lab (`mobile/11-after-keyframe-lab.png`, fills viewport, red knobs).

**/editor dock (C):** retinted red/chrome (`30-after-editor-shell-dock.png`); scrub + play
verified live through the committed probes (`playAdvanced:true`, 5 faders registered).

**/keyframe-editor lab (D):** smoked glass + red alloy (`31-after-keyframe-lab.png`); scrub
interpolates (posY −0.8↔0.9), fader drag writes a key (4→5), hover-spin + play fire; mobile
`11`. Sora font 200 OK.

## 7. Design-language continuity

The keyframe editor now shares `premium.ts` with the toolbar — one accent family, one smoked
glass recipe, one machined-metal vocabulary, one non-grotesque display face (Sora). The next
FINISH phase inherits the SAME module (no re-derivation).

## 8. Progress log

- 2026-07-01 — Oriented; harness up (chrome-devtools on :3000); 4 surfaces assessed; before
  frames (desktop+mobile); plan written; EARLY CHECKPOINT committed.
- 2026-07-01 — Built `premium.ts` (shared RBW system) + `keyframe-scrub.ts` (pure, 7/7 tests);
  elevated panel A + live canvas driver + HUD de-collision; retinted dock C + lab D; Sora on
  labels. Typecheck 0-new, all gates green, 55/55 keyframe tests.
- 2026-07-01 — Full near-human sweep (click/hover/drag/scrub/edit-round-trip/persistence),
  desktop+mobile, 0 console errors. Elevation committed.

## 9. Judge results — both Fable-5 vision judges PASS, 0 MUST-FIX

- **user-advocate** (graded the frames as the founder, fresh context): **NET PASS / GATE
  GREEN / MUST-FIX none.** All 6 founder criteria pass with cited before→after frames
  ("the BEFORE→AFTER conversion off cyan/brass/rainbow onto the red/black/white photoreal
  system is complete … Ship it"). The two functional claims a founder cares about are shown
  not asserted: scrub drives the node live (`22-scrub-motion-sidebyside.png`) and keys
  persist across reload (`23-after-reload-persisted.png`). Non-blocking taste flag: the
  `/editor` dock fader-knob BODIES read plainer than the timeline/lab jewels (subjective —
  the diamonds + lab jewels carry the bar; left as-is).
- **prism-criteria-reviewer** (graded the diff, fresh context): **VERDICT pass, MUST-FIX
  none.** All 5 points PASS — full hex census confirms every introduced color is
  red/black/white (no cyan/brass/ice/emerald/sapphire/bronze/lavender/green survives); Sora
  token chain verified non-grotesque; `premium.ts` is the single accent source with
  `config.ts` re-exporting (no fork); additive-only (zero `types.ts` field churn, FP-15
  honored — panel writes only via `usePreviewStateStore`); no forbidden drift; no-dom-ui-gate
  PASS. Non-blocking nits: (1) FP-15 not auto-gated by the hook glob (future-proofing); (2)
  the scrub driver left `transparent:true` on opaque materials after an opacity fade — **FIXED
  in the judge-polish commit** (records + restores each material's original `transparent`
  flag; verified live: fade works, both `transparent` and `opacity` fully restore on close);
  (3) a cosmetic config re-export ordering — **also tidied**.

PRISM-FINISH-F1: RUN COMPLETE
