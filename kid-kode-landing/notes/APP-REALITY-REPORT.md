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
