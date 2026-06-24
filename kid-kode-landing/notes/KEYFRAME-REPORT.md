# PRISM KEYFRAME EDITOR — RUN REPORT

**Route:** `/keyframe-editor` (isolated WebGL R3F canvas, the proven toolbar-chassis /
Glb3DPreview idiom — never touches the unified three/webgpu graph scene).
**Branch:** `prism-editor-build`. **Date:** 2026-06-24.
**Source:** `src/components/editor/keyframe/**` + `src/app/keyframe-editor/**`.

A keyframe / timeline editor that animates a selected node's properties, built in the
**exact glass design language of the founder-approved Toolbar Chassis** (`/toolbar-chassis`):
a thick milled glass pane, worn-metal cube knobs riding the channels, and engraved-in-glass
labels. It **actually animates a real node property** — dragging a fader sets a keyframe,
scrubbing the playhead interpolates the bound node, and play/pause runs it.

---

## 1. Design-language match (reuses the committed chassis vocabulary)

| Chassis element | Keyframe editor element |
|---|---|
| Thick extruded rounded-rect **transmission glass pane** (`MeshPhysicalMaterial`, AgX, real studio env) | `GlassTimelinePane.tsx` — same material, wide horizontal pane |
| **Milled rounded-rect cutouts** (ExtrudeGeometry `Shape.holes` + bevel) | Channels milled through the glass, one per track (TIME ruler + RISE/SCALE/SPIN/FADE), + recessed **worn-metal channel beds** (`TrackBeds.tsx`) so each groove reads as a real milled channel, not an open slot |
| **Worn brushed-metal CUBE** buttons (generated FLUX.2 PBR sets, jewel-tone per section), hover-spin | `TrackKnobs.tsx` — smaller worn cubes (same `applyWornMaterial` + the same 5 generated PBR sets), jewel-tone per track (sapphire/emerald/bronze/oxblood + steel playhead), grip-notch caps, hover-spin (`easeInOutCubic` end-over-end) |
| **Engraved-into-glass** Troika SDF labels (3-copy V-groove, recessed, opaque+alphaTest) | `EngravedTrackLabels.tsx` — identical intaglio technique for track names, the 0s–4s ruler ticks, and the title |
| Studio env + editorial dark backdrop + premium lighting + ContactShadows | `KeyframeScene.tsx` — reuses chassis `StudioEnv` + matched lighting |

Direct reuse: `@/components/editor/chassis/{materials,StudioEnv,FaceGlyph}`.
New: the timeline pane, milled channels + beds, worn-cube faders + steel playhead, engraved
track labels, the bound subject node, transport buttons, and the seconds-based keyframe engine.

The **playhead** is a thin worn-metal bar that sweeps horizontally across the grooves; the
**TIME axis is in SECONDS** (0–4s), never fps.

---

## 2. What it does — behavioral results (all verified via the REAL pointer pipeline)

Verified by driving the live route through Chrome DevTools with **real raycast-hit pointer
events** (see §5 on method). Every interaction exercises the production code path.

| Behavior | Result | Evidence |
|---|---|---|
| **Hover a fader → spin / see-through** | Knob turns edge-on (chassis mechanic) | `verification/keyframe/w-knobs-spin-edgeon.png` |
| **Drag a fader along its groove → knob travels + value changes + keyframe written** | `posY 0 → 0.95`; a `PrismKeyframe {t:0, values:{posY:0.95}, coordinateSpace:'hub-scene'}` is written into the node; **camera does NOT move** | `drag-before.png` → `drag-after.png` |
| **Drag the playhead → scrub time** | `playhead 0 → 2.5s`, camera stable | (measured) |
| **2+ keyframes + scrub → bound node ANIMATES** | At playhead 0/1/2s the SELECTED NODE cube morphs high+small+rotated+opaque → centered+upright+mid → low+large+rotated+faded, and **every fader glides to its interpolated position** | `scrub2-t0.png`, `scrub2-t1.png`, `scrub2-t2.png` |
| **Play / Pause (in-canvas transport button)** | Click play → `playing:true`, clock advances `playhead 0 → 0.8` over 800ms, glyph swaps play▶→pause❚❚; click again → stops (playhead frozen at 3.75) | `play-mid.png` |
| **Add keyframe** | = the drag write (keyframe at playhead time) | `drag-after.png` |
| **Remove keyframe** | Double-click a fader → `removeKeyframe(track, playhead)`; kf `1 → 0`, value returns to rest | (measured) |
| **Clear all** | In-canvas CLEAR button (`clearAll`) | `overview-rest.png` |

### NODE LAW (single source of truth)
Animation data lives in the **selected node's schema** — `node.keyframes: PrismKeyframe[]`,
each with the required `coordinateSpace` discriminator (`'hub-scene'`, one of the canonical 5,
INV-21). The renderer reads the node's keyframes and interpolates; the faders read the same.
Proof: `window.__PRISM_KEYFRAME_NODE__()` returns the node and its keyframes; every written
keyframe is a schema-valid `PrismKeyframe`. The node holds its own animation.

---

## 3. Fresh-context USER-ADVOCATE verdict — **PASS** (blocking gate satisfied)

A fresh-context user-advocate (no build context) judged the evidence frames against the four
axes and returned **PASS** on all four (STYLE / FUNCTION / INTUITIVENESS / USABILITY), **0
MUST-FIX**, 3 minor non-blocking FLAGs:

1. Frosted-label refraction double-image (on-style for intaglio glass).
2. A roving studio specular can briefly bloom over the TIME label **in the lighting-sweep
   frame `w-pane-03.png`** — an intermediate frame; the final lighting (see `overview-rest.png`)
   is even and the labels are clean. (This was addressed during w-pane: front lights moved
   right-of-centre + clearcoat softened so no hot spot lands on the left-gutter labels.)
3. The TIME-row playhead handle is steel like a fader — context resolves it, but a brand-new
   user might pause for a beat.

The advocate confirmed the central claim with cited frames: scrub genuinely animates the node
across keyframes and the faders track the playhead.

---

## 4. Hard gates

| Gate | Result |
|---|---|
| `no-dom-ui-gate.mjs` (scope `src/components/editor/keyframe` + `src/app/keyframe-editor`) | **PASS** — 14 files, pure in-engine (no Tailwind/CSS-module/className/inline-style/drei-Html). The only stylesheet is the route stage-sizer (`keyframe-editor.css`, attribute/element selectors only). |
| `tsc --noEmit` | **9 total = baseline; 0 new**; 0 errors in the keyframe dir. |
| `node-authorship-gate.mjs` (main app) | **9/10 checks, 0 hard-fail (exit 0)**. The isolated route adds zero graph drift — `gate.no-accidental-drift` (foundation clean, Law 0) and `runtime.no-pageerrors` PASS. The single non-fatal FAIL (`authored.text-warm`) is the main app's pre-existing async MSDF warming, unrelated to this surface. |
| Console errors on the route | **0** (only a pre-existing `THREE.Clock` deprecation warn + Troika font debug logs, both inherited from the chassis stack). |

---

## 5. Honest flags / deviations

### 5a. Theatre.js was NOT used — and why (founder decision point)
The brief named **Theatre.js as the keyframe model**. After investigation this is a genuine
architectural conflict with two of this build's hard laws:

- `@theatre/core` is headless but exposes **no runtime keyframe-AUTHORING API** — keyframes are
  created only through **`@theatre/studio`, which injects a DOM editing panel**. That directly
  violates the surface's **WebGL-only / ZERO-DOM LAW** (enforced by the blocking
  `no-dom-ui-gate`).
- Theatre's source of truth is its own project state, which conflicts with the **NODE LAW**
  (animation must live in the node schema as the single source of truth).

Forcing Theatre would mean either shipping a fragile, undocumented project-state-JSON hack or
importing the banned DOM studio. So the keyframe / interpolation engine is implemented
**natively** (`keyframe-engine.ts`): seconds-based time, per-property tracks, eased
interpolation, stored in `node.keyframes` — honoring the brief's *intent* (a real
seconds-based keyframe engine where drag→keyframe→scrub→animate works) while respecting both
laws. **No new dependency was added.** If the founder wants the Theatre dependency specifically,
the engine seam is small and could be swapped behind the same store API — flagging for a call.

### 5b. Verification input method
R3F's canvas pointer events are raycast-based; plain synthetic DOM events miss because a
constructed `PointerEvent` leaves `offsetX/offsetY` at 0 (R3F aims the ray from those). Both the
Playwright MCP `run_code_unsafe` tool and the Chrome DevTools MCP lacked a working
coordinate-mouse path in this environment. So interactions were driven by **offset-corrected**
pointer events that produce a genuine raycast hit and run the exact production pipeline
(`onPointerDown` → `start()` → window-drag → `writeKeyframe`). This is real input, not a
store shortcut; the demo keyframe *sets* in the scrub frames were additionally authored via the
identical `writeKeyframe` the drag calls, for reliable multi-keyframe setup. Verification hooks
(`__PRISM_KEYFRAME_{SCENE,STORE,NODE,CAM,MAP,GRAB,HOVER,FORCESPIN}__`) are editor-chrome window
hooks (same pattern as the chassis), used for capture only.

### 5c. Minor
- An OrbitControls-vs-knob-drag bug was found and fixed: dragging a knob also orbited the camera
  (OrbitControls is a DOM listener, so R3F `stopPropagation` can't reach it). Fix: disable
  `controls.enabled` for the duration of a knob/playhead drag.
- The advocate's 3 FLAGs (above) are minor and non-blocking; none are MUST-FIX.

---

## 6. Files

- `src/app/keyframe-editor/{page,layout}.tsx`, `keyframe-editor.css`
- `src/components/editor/keyframe/`: `keyframe-config.ts`, `keyframe-engine.ts`,
  `use-keyframe-store.ts`, `GlassTimelinePane.tsx`, `TrackBeds.tsx`, `Playhead.tsx`,
  `EngravedTrackLabels.tsx`, `TrackKnobs.tsx`, `TransportControls.tsx`, `SubjectNode.tsx`,
  `KeyframeScene.tsx`
- Evidence: `notes/verification/keyframe/*.png`
- Commits: `AUTO-CKPT: KEYFRAME w-pane` → `w-knobs` → `w-wire` → `w-verify` on `prism-editor-build`.

**Status: DONE.** Glass keyframe editor renders in the chassis language and actually animates a
node property (drag sets keyframes, scrub/play animates); behavioral verification + advocate
both clean; all hard gates green.
