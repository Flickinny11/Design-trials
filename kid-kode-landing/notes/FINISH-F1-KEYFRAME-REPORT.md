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
