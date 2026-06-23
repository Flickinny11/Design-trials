# PRISM TOOLBAR V2 — REDO against the hardened spec: GENERATED photoreal 3D objects, procedural version DISCARDED

You are an autonomous senior build agent for **Prism** (WebGPU/Three.js graph-native 3D app-builder, ULTRACODE). Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials` (git root, branch `prism-editor-build`). App in `kid-kode-landing/`. Always `unset NODE_ENV`. Operator non-technical, pre-authorized (bypassPermissions), NOT watching — never ask. Commit + push every wave. Print the marker ONLY when done. Fire a macOS notification at each wave boundary + completion (see ALERTS).

## WHY THIS RUN EXISTS — read before anything
The previous toolbar run VIOLATED the core instruction: it built the toolbar, buttons, and icons as PROCEDURAL Three.js geometry + shaders. The founder explicitly required **GENERATED photorealistic 3D objects** (real GLB files from the 3D generators, like the watch case/bezel/crown GLBs). This run REDOES the toolbar to the **binding spec** at `kid-kode-landing/docs/prism/PRISM-EDITOR-CHROME-SPEC.md` — read it IN FULL and obey EVERY directive + criterion. The procedural forms are DISCARDED. **You MAY reuse the prior run's liquid-glass MATERIAL treatment, the spin physics, the tooltips, and the action wiring as the BEHAVIOR layer — but the FORMS (toolbar shell, every button, every icon) MUST become GENERATED GLBs on disk.** Behaviors ride on top of the generated forms.

## SCOPE (founder-scoped): the TOOLBAR only
In scope: spec sections **§0 directives D1-D7, §1 TB-1..TB-9, §2 IC-1..IC-5, §6 generation protocol, §7 verification**. The node editor (§3) and keyframe editor (§4) are explicitly **DEFERRED** to later founder-scoped runs — mark them DEFERRED in the checklist, do NOT touch them.

## THE NON-NEGOTIABLES (from the spec — any violation = MUST-FIX)
- **GENERATION MANDATORY (D1):** the toolbar shell is a GENERATED liquid-glass GLB; EACH button is its OWN generated GLB; EACH icon is its OWN generated bespoke GLB. All written to `kid-kode-landing/public/prism-mock/editor/meshes/`. NO procedural geometry, NO shader-only object, NO primitive stand-in. Generate best-model-per-object (Tripo v3.1/P1, Replicate Hunyuan3D/TRELLIS; multi-view for hard-surface; keys in `.assetgen/`). Textures/HDRIs via FLUX.2.
- **TB-1/TB-2:** toolbar = generated liquid-glass OBJECT, volumetric depth + transparency + ambient refraction, that WARPS/BENDS with movement (behavior on the GLB via design_references). Not iOS, not glassmorphism, not a flat/CSS bar.
- **TB-3:** each button = generated photoreal 3D GLB "sunk" into the glass, real depth/edges/shadows/lighting.
- **TB-4/5/6:** hover = full 3-4 end-over-end spins on the HORIZONTAL axis; click ACCELERATES then SMOOTHLY DECELERATES; spin reveals real 3D depth/edges/shadows.
- **TB-7:** most buttons textless + hover TOOLTIP; a few carry text.
- **TB-8:** a few buttons ENGRAVED with their icon; hover ANIMATES the engraving; photoreal depth + shadow.
- **TB-9:** every toolbar action still fires.
- **IC-1..5:** every icon a generated bespoke 3D GLB, COLORED, ANIMATED, gradients + shadows, hover tooltip — ZERO emoji/Lucide/lightning/boxes/line-drawings/cheap symbols.
- **D2/D3/D4:** nothing flat; no cheap icons; no grotesque fonts.

## MODEL & ORCHESTRATION
MODEL **claude-opus-4-8** (confirm modelUsage; never opusplan). ULTRACODE parallel subagents within waves (reuse `kid-kode-landing/notes/catalog-finish-workflow.mjs` `parallel()`), each pinned to opus — parallelize the per-object generation. READ FIRST: `PRISM-EDITOR-CHROME-SPEC.md` (binding), `notes/TOOLBAR-REPORT.md` (what the prior run built — salvage behaviors, replace forms), the current toolbar component + every action it wires, DESIGN-REFERENCES.md, the glass/refraction primitives.

## ALERTS
At START, each WAVE boundary, COMPLETION: `osascript -e 'display notification "<short status>" with title "PRISM TOOLBAR V2" sound name "Glass"'`

## WAVES (commit + push + notify each)
1. **Generate the forms.** Enumerate the toolbar shell + every button + every icon. Generate a GLB for EACH (parallelize), write to `public/prism-mock/editor/meshes/`, validate each loads + looks premium (art-fidelity per asset). Re-generate any junk asset. Commit `AUTO-CKPT: TOOLBAR-V2 wave1 (generated GLB forms)`.
2. **Mount the generated forms + dress + behaviors.** Replace the procedural toolbar shell/buttons/icons with the generated GLBs; layer the liquid-glass material (transmission/refraction from design_references) + the warp/bend animation on the shell; sink the button GLBs into the glass; wire each to its real handler; implement the hover-spin (3-4 horizontal, accelerate-on-click, smooth decel) on the generated button GLBs; mount the generated icon GLBs (colored, animated). Commit `AUTO-CKPT: TOOLBAR-V2 wave2 (mounted generated forms + behaviors)`.
3. **Tooltips + engraving + polish.** Hover tooltips for textless buttons; mark the few text buttons; a few engraved buttons with animated photoreal engraving. Verify zero defect-list hits. Commit `AUTO-CKPT: TOOLBAR-V2 wave3 (tooltips + engraving)`.
4. **Verify against the checklist (below).**

## VERIFICATION — the per-row checklist gate (this is the fix for "followed one of it")
`unset NODE_ENV`. Restart dev fresh: `cd kid-kode-landing && lsof -ti tcp:3000 | xargs kill -9 2>/dev/null; rm -rf .next; (unset NODE_ENV; nohup npm run dev > /tmp/dev.log 2>&1 &)`, wait `GET / 200`, then COLD-LOAD GATE via Chrome DevTools MCP — FAIL on any `_next` 404, pageerror, no `<canvas>`, or stuck loader.
Write `kid-kode-landing/notes/EDITOR-CHROME-CHECKLIST.md` with EVERY in-scope criterion (D1-D7, TB-1..9, IC-1..5) as a row; walk each row and mark PASS/FAIL with the SPECIFIC evidence per §7:
- **Generation rows (D1, TB-1, TB-3, IC-1):** the GLB file path on disk (`ls` proof) AND an `evaluate_script` scene-graph assertion that THAT GLB is the mounted geometry (count GLB-backed meshes; confirm NO procedural fallback). No GLB on disk OR procedural still rendering = FAIL.
- **Animation rows (TB-2 warp, TB-4/5/6 spin, TB-8 engraving, IC-3):** MULTI-FRAME capture (t=0/0.2/0.4/0.6/0.8/1.0) proving the motion occurs.
- **Tooltip rows (TB-7, IC-4):** hover frame showing the tooltip.
- **Action row (TB-9):** full action-fires matrix.
- **Defect gate (auto-MUST-FIX):** any flat surface; ANY procedural form standing in for a generated one; glassmorphism-as-liquid-glass; ANY emoji/Lucide/line-icon/lightning/box/generic symbol; any grotesque font; any non-firing action.
- Reviewers check EACH ROW (not holistically): art-fidelity (`scripts/art-fidelity-review.mjs`), `prism-criteria-reviewer`, **user-advocate** as a non-technical first-timer — *"Does the toolbar, EVERY button, and EVERY icon read as a premium GENERATED photoreal 3D object — or is anything flat/procedural/cheap?"* cited frames + MUST-FIX power.
DONE only when: 100% of the in-scope checklist rows PASS (node editor + keyframe marked DEFERRED), clean cold load, tsc green (`node scripts/typecheck-gate.mjs`, 0 new), art-fidelity clean, criteria-reviewer pass, advocate PLEASED. Frames -> `kid-kode-landing/notes/verification/toolbar-v2/`; resize before reading (`sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`).

## CONTRACT / ANTI-STUCK — no procedural fallback, no endless thrash
TSL/PBR. Allowlist before any new import. Zero console errors. Keys in `.assetgen/`, never committed. Do NOT touch app-content nodes / watch / orrery / node editor / keyframe. Never downgrade deps. **NEVER ship a procedural fallback** — generation is mandatory. If after genuine effort (re-prompting, multi-view, alternate generator) a specific generated form cannot reach premium quality, do NOT silently fall back to procedural and do NOT thrash indefinitely: land everything that IS working, mark the specific failing form FAIL in the checklist with the evidence + what was tried, write the report, and STOP for a human decision rather than burning resumes or shipping the wrong thing.

## RESUME / REPORTING + MARKER
`git log --oneline -12`; `AUTO-CKPT: TOOLBAR-V2 <wave>` = done-pending-reverify. If `kid-kode-landing/notes/TOOLBAR-V2-REPORT.md` has the marker, re-print + stop. Check `notes/LOGAN-INBOX.md` before each wave. Append to `notes/MONITOR-FEED.md` + `notes/TOOLBAR-V2-PROGRESS.md`. Write `kid-kode-landing/notes/TOOLBAR-V2-REPORT.md` (the generated GLBs with disk paths + how each was generated, the mount + behaviors, tooltips/engraving, the FULL filled-in checklist with per-row evidence, all gate verdicts incl cold-load + defect gate, honest flags). On FULL completion (100% in-scope rows pass), fire the completion notification and write the EXACT marker line LAST:
PRISM-TOOLBAR-V2: RUN COMPLETE
