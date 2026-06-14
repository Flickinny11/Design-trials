# APP-REALITY — make the Prism editor a real navigable 3D app

**Run goal (Logan):** the live app "reads as 3D scenes, not a navigable app." Fix per spec — camera
model, preview-as-app, full-viewport backgrounds, device modes, Function/nav binding.
**Bar:** WOW + "behaves like a real app." Interactive + visual verification (real frames),
DPR-2, desktop + mobile + constrained. 0 MUST-FIX per phase.
**Model:** claude-opus-4-8 (env-confirmed). **Branch:** `prism-editor-build`.
**Frames:** `notes/verification/app-reality/<phase>/`. **Resumable ledger:**
`notes/verification/APP-REALITY-PROGRESS.md`. **fal:** `notes/verification/app-reality/fal-ledger.json`.

---

## P1 — CAMERA MODEL (canvas free / preview locked + reset-zero + angle HUD + haptic)

### What changed
- **Canvas = fully FREE 3D edit camera.** The canvas camera was wrongly restricted by
  `computeCanvasCameraRail` (±0.35 rad ≈ ±20° polar/azimuth windows + a pan-boundary box +
  a narrow distance window). Those clamps are removed from the live `CameraControls` in
  `SceneControlsBridge` (`GraphScene.tsx`). Canvas now orbits/pans/zooms freely
  (minDistance 1.5 … maxDistance 220, full polar/azimuth, no pan boundary). **This deliberately
  supersedes SC-071 for canvas** — a Logan-authorized override for this run (recorded in the
  progress ledger), the same kind of deliberate boundary change as the 2026-06-14 AMENDMENT.
  The rail helper is retained only to keep the `__PRISM_EDITOR_GET_CANVAS_RAIL__` dev hook alive.
- **Preview-app = camera LOCKED.** `CameraControls enabled={!isPreview}` — the user can no longer
  orbit/pan/zoom the running app, so they can never spin it to expose scene edges. Programmatic
  `setLookAt` still works while disabled (the configured view today; the P2 camera journey next).
  On entering preview-app the camera snaps to the deterministic front-facing "configured" pose so
  it never strands on a prior canvas orbit.
- **Reset-view-to-zero (straight-on).** New `resetViewSignal` + `resetViewToZero()` on the editor
  store. In canvas it snaps the camera back to the straight-on pose on the active hub (keeps the
  hub — distinct from the galaxy `resetCamera`). One click from the HUD.
- **Live angle read-out + haptic + pulse.** New `CanvasCameraHud` overlay (Observatory-Brass glass
  pill, canvas-only): a live compass + `AZ / TILT / ZOOM` read-out fed each frame (throttled) from
  the controls; a reset-to-zero button; and — when the view returns to straight-on (button OR a
  manual orbit back to centre) — a `navigator.vibrate()` haptic + a brass `ds-zero-pulse` glow, so
  "centred" is felt. Responsive: top-anchored on mobile (clears the Inspector bottom-sheet),
  bottom-centre on desktop/tablet.

### Evidence — `notes/verification/app-reality/p1/` (real browser, DPR-2, 3 viewports)
Numeric camera proof (`p1-camera-log.json`), via the live `CameraControls` instance:

| Viewport | Canvas free orbit (az / polar°) | Free? (past old ±20° rail) | Reset→zero (az / polar°) | Preview lock Δpos |
|---|---|---|---|---|
| desktop 1440×900 | −84 / 48 | ✅ | 0 / 90 | 0.0000 ✅ |
| mobile 390×844 | −89.6 / 45.2 | ✅ | 0 / 90 | 0.0000 ✅ |
| constrained 900×620 | −121.9 / 29 | ✅ | 0 / 90 | 0.0000 ✅ |

Frames: `*-canvas-default.png` (front-facing), `*-canvas-orbit-free.png` (clearly off-axis — skewed
viewport-frame, HUD reads the live angle), `*-canvas-reset-pulse.png` / `*-canvas-reset-zero.png`
(HUD "STRAIGHT ON", front-facing rectangle), `*-preview-locked-before/after.png` (drag did not move
the camera; editor chrome hidden → reads as the running app). 0 console errors in all 3 contexts.

### Adversarial review + regression fix (verified)
A parallel read-only review (invariants + regression) passed all invariants (one renderer; additive
schema; canonical viewMode only; FP-05 DOM scope; tokens-only) and caught one real MUST-FIX: the new
preview-app entry `setLookAt` ran in the same commit *before* the pre-existing canvas-pose snapshot
effect, and `camera-controls.getPosition()` defaults to reading the transition *destination*
(`receiveEndValue=true`) — so the snapshot was checkpointing the front pose over the user's last
orbit, breaking canvas→preview-app→canvas restore (SC-027/INV-20). **Fix:** snapshot the live pose
(`getPosition(pos,false)`/`getTarget(tgt,false)`). **Proof** (`p1-roundtrip.json`): orbit to
az −84°/pol 48° → preview-app → back to canvas → restored az −84°/pol 48° **exactly (Δ0)**, not the
front pose. Galaxy bridge confirmed byte-for-byte untouched; programmatic `setLookAt` + live
pointer/scroll drivers confirmed still active under `enabled={false}`.

### Honest flags
- **Full-bleed background is P4, not P1.** The preview frame confirms the camera is locked and the
  composition is clean, but the hub content currently floats as a card on a dark void with visible
  margins. The "preview never shows a blank/obvious background" requirement is the job of **P4
  (Backgrounds — full viewport)**; P1 delivers the camera lock + framing it sits on. Flagged, not
  hidden.
- tsc: 0 new errors (9 pre-existing baseline: GraphScene:`GLProps` async-gl factory + 8 `tests/`
  `NodeContext.THREE` fixture mocks — all predate this run).

### Verdict: camera model behaves like a real app's — free to author, locked to ship. ✅ (full-bleed → P4)

---

## P2 — CAMERA-IN-KEYFRAME (keyframeable camera journey)

### What changed
- **The camera is now a keyframeable track.** New additive `PrismHub.cameraKeyframes?: PrismKeyframe[]`
  — each a `PrismKeyframe` with `coordinateSpace: 'camera'` (INV-21) and `params {px,py,pz,tx,ty,tz,fov}`.
  Stored in the SHARED source graph (new `useGraphSourceStore.updateHub`), so the future node-editor
  reads/writes the same data. No global fps (INV-4) — playback is progress-over-time.
- **Canvas authors the journey.** The camera HUD gains a JOURNEY strip: orbit the free edit camera
  to a vantage → **● REC** captures the live pose+fov as a waypoint (count badge updates live), **✕**
  clears, **▶ Preview** plays it. New editor-store signals `captureCameraKeyframe` / `replayCameraJourney`;
  `SceneControlsBridge` reads the live pose (receiveEndValue=false) and appends to the active hub.
- **Preview plays exactly that journey.** New pure sampler `src/lib/editor/camera-journey.ts`
  (`sampleJourney`, evenly-spaced segments, per-segment smoothstep ease). On entering preview-app, if
  the hub has ≥2 waypoints the camera lands on waypoint 0 and the per-frame block flies position/target/
  fov to the end, then holds — all via programmatic `setLookAt` (works while the camera is user-LOCKED
  from P1). A preview-side **↻ Replay intro** pill re-runs it. Deterministic (same waypoints → same path).

### Evidence — `notes/verification/app-reality/p2/` (real browser, DPR-2)
`p2-journey-log.json`: authored 3 waypoints in canvas → `hub.cameraKeyframes.length === 3` ✅. Preview
auto-play: **start pose = waypoint 0 (Δ 0.000)**, **end pose = last waypoint (Δ 0.000)**, 18.1-unit
camera travel between (a real fly-through, not a static frame). **Determinism:** replay → ran full
duration → landed on the same end pose (**Δ 0.000**). Replay restart independently confirmed (camera
moved 22.1 units off the end pose on replay). 0 console errors through REC→Preview→Replay.
Frames: `desktop-canvas-journey-3pts.png` (HUD shows "3 pts" + REC/Preview), `desktop-preview-journey-
start/mid/end.png` (three distinct vantages — the camera flies the path), `↻ Replay intro` pill present.

### Adversarial review
`prism-criteria-reviewer`: **pass / zero MUST-FIX** — additive (cameraKeyframes optional, updateHub
non-destructive), INV-4 (no fps), INV-21 (coordinateSpace:'camera' set by buildCameraKeyframe), P1
lock/free unaffected (journey runs only in preview-app + only when hasJourney; canvas free-orbit/reset
untouched), FP-15 OK (the HUD is a camera tool, not an Inspector tab; journey capture is structural
authoring), no per-frame leak/loop (journeyActiveRef stops driving at progress≥1).

### Verdict: the canvas user designs a camera journey; preview plays it as a deterministic landing fly-in. ✅

---

## P3 — EDIT-IN-PREVIEW

### What changed
- New additive canvas sub-mode `editInPreview` on the editor store (reset on any mode change /
  drill-in). When on (in canvas): the camera locks to the configured shipped framing (the journey
  landing pose if the hub has one, else the deterministic front pose), the editor viewport-frame
  scaffolding (`CanvasViewportFrame` diamond) hides, but the toolbar, selection rings, and transform
  gizmo stay live — so the user designs **against the real result**. Distinct from free-orbit canvas
  editing. Toggle in the canvas HUD: "Edit in Preview" enter / "Editing in Preview · Exit" pill.
- Camera: `SceneControlsBridge` `enabled={!isPreview && !framed}` (framed = canvas+editInPreview);
  an effect snaps to the shipped pose on entry; exit re-enables free orbit at the current pose.

### Evidence — `notes/verification/app-reality/p3/` (real browser, DPR-2)
`p3-log.json`: free-orbit off-axis → **Edit-in-Preview**: snapped to shipped front view
(az −0.4° / pol 89.8°) ✅; camera **locked** (drag Δpos 0.0000) ✅; **still editable** (node selected
+ editorMode 'edit' + gizmo) ✅; **exit restores free orbit** (camera orbits off-axis again) ✅;
0 console errors. Frame `desktop-edit-in-preview.png`: front-facing composition, **no editor
viewport-frame diamond** (app-like), Transform toolbar flyout open, transform gizmo ring on the
selected node, Inspector present, "Editing in Preview · Exit" pill. Free-orbit / exit frames confirm
the round-trip.

### Review
Self-audited; the camera lock/snap logic mirrors the already-reviewed P1 lock + P2 configured-pose
patterns (only gating differs). editInPreview is additive, canvas-only, and resets on mode change —
it cannot leak into galaxy/preview-app. P9 advocate exercises it end-to-end.

### Verdict: edit the built app against its shipped framing, toolbar live — the real-result design loop. ✅
