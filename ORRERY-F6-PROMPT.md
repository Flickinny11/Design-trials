# ORRERY No.7 — F6 WORLD-WEAVE (autonomous chain phase 2)

You are the autonomous ORRERY build agent. Repo: `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing`, branch `prism-editor-build`. Operator is non-technical, pre-authorized all ops, NOT watching — never stop for "go". Commit + push per verified wave. Print the completion marker only when fully done + verified.

## IF RESUMING (session was interrupted)
Run `cd kid-kode-landing && git log --oneline -10`. `AUTO-CKPT: F6 ...` commits = done waves; audit, skip them, continue from the first incomplete wave. If `notes/ORRERY-F6-REPORT.md` exists with the marker, re-print the marker and stop.

## READ FIRST
- `docs/prism/ORRERY-NO7-PROTOTYPE-SPEC.md` §2 (the continuous-orrery world), §9.6 (SC-O9 world criteria), §10.3 (F6 plan).
- The critical rules + verification protocol are identical to F5.5: graph-is-the-app, TSL only, MSDF text only, synchronous createNode, allowlist before import, 3 view modes, NO test fixtures left in live-graph, zero console errors.
- **Verification = Playwright MCP, force `graphSource.loadFromUrl()` before asserting, SCREENSHOT and look at pixels, cold loads.** (Same protocol block as F5.5 — a scene-graph assertion is not proof of render.)

## THIS PHASE — weave the 6 hubs into ONE continuous scrollable world
Today each hub is reached by discrete `goTo()` nav. F6 makes the hubs regions of one persistent world traversed by scroll, with no load seam (SC-O9).

Build incrementally, committing each wave:

1. **Smooth scroll + scrub.** Add Lenis + GSAP ScrollTrigger to the app shell (both already allowed per spec §1; if not in the allowlist, add them first). Map `scroll 0→1` to a camera path.
2. **Camera spline.** Define a `CatmullRomCurve3` through the 6 hub camera positions (arrival→movement→materia→atelier→celestia→acquire). A GSAP timeline drives `cameraAnim.position` + a separate `targetAnim` look-at, `scrub: 1`. No position jump > 0.5 units/frame (SC-O9.2).
3. **No disposal.** Keep all hub regions resident; gate heavy per-region detail with `IntersectionObserver` + `THREE.LOD`, but never `scene.remove` a hub on scroll (SC-O9.4). Verify zero disposal across a full scroll.
4. **Atelier as a region.** At ~65% scroll the Atelier configurator is reachable in-world (sticky-pin / decelerate), still fully functional (tap a dial variant → texture applies). The built watch flies toward Celestia near ~85%.
5. **Audio (optional, time-permitting).** A synthesized orrery hum via Web Audio that runs during scroll; skippable. Don't block the phase on this.

Preserve the existing `goTo()` nav and the preview-app chrome — scroll is additive, not a replacement. The configurator (F5.x) must keep working unchanged.

## VERIFY (SC-O9)
Cold-load the app, force graph reload, then drive scroll via `mcp__playwright__browser_evaluate` (set `window.scrollTo` / Lenis target) sampling camera position every 100ms:
- SC-O9.1 full scroll 0→100% fires no navigation event (`performance.getEntriesByType('navigation').length === 1`).
- SC-O9.2 camera moves continuously (max per-frame delta ≤ 0.5).
- SC-O9.3 at ~65% the Atelier geometry is visible (screenshot) and a dial tap still applies a texture.
- SC-O9.4 zero `scene.remove` during the traverse.
- Screenshots at 0/25/50/65/85/100% saved under `notes/verification/orrery-f6/`. 0 console errors throughout.

## DELIVERABLE
`kid-kode-landing/notes/ORRERY-F6-REPORT.md` — SC-O9.1..9.5 PASS/FAIL with screenshot evidence, what shipped, honest flags (e.g. audio deferred). Commit waves as `AUTO-CKPT: F6 <wave>`, push each. Append to `notes/ORRERY-ATELIER-PROGRESS.md`.

## ANTI-STUCK
After 2 failed attempts: web-search / context7 the current Lenis+ScrollTrigger+three/webgpu approach, root-cause, retry. Never downgrade a dependency. If a sub-step (e.g. audio) proves too costly, ship the rest and flag it OPEN in the report rather than blocking the phase.

## COMPLETION MARKER (print this EXACT line last, only after report written + committed + pushed):
ORRERY-F6: RUN COMPLETE
