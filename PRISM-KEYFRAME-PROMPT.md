# PRISM KEYFRAME EDITOR — same glass language as the toolbar: grooved-glass tracks + worn-cube fader knobs + engraved labels. IN-ENGINE (R3F/Three). ZERO CSS/Tailwind/DOM UI. Verified like a USER.

Autonomous senior build agent for Prism (ULTRACODE). Repo root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV` always. Pre-authorized (bypassPermissions), founder NOT watching. Commit+push every wave.

## NOTIFY OFTEN — the founder's ONLY window is notifications, be chatty
The founder runs you headless via CLI and sees NOTHING except macOS notifications. Fire one at: each wave START, each COMMIT, verification START, EACH behavioral check result, the advocate result, frames captured, and any blocker. Pattern:
  osascript -e 'display notification "<short msg>" with title "Prism · KEYFRAME" sound name "Glass"'
Short + specific ("w-knobs: fader knobs mounted", "drag-fader check PASS", "advocate: 1 friction").

## WHAT THIS IS
A keyframe / timeline editor for animating a SELECTED NODE's properties, in the SAME design language as the just-approved toolbar (route `/toolbar-chassis`). The toolbar's committed Pane + Cube components + worn PBR materials + engraved-glass technique ALREADY EXIST — REUSE them. Build on committed work; do not reinvent.

## THE DESIGN LANGUAGE (locked — match the toolbar exactly)
- A thick GLASS timeline pane (real thickness, extruded rounded-rect, MeshPhysicalMaterial transmission + studio env map + AgX + sRGB + soft shadows + editorial dark backdrop).
- TRACKS = GROOVES milled into the glass pane (recessed horizontal channels, one per animatable property) — parametric channels (three-bvh-csg where a true cut is needed), NOT painted lines.
- FADER KNOBS / keyframe handles = the worn-metal CUBE buttons (the toolbar's cube, SMALLER) seated in / riding the grooves. Same worn brushed-metal PBR (reuse the generated worn map sets; tint per track if useful). Hover-spin allowed (same mechanic), but the PRIMARY interaction is DRAG along the groove.
- TRACK LABELS = engraved INTO the glass (recessed, frozen-in-glass — the toolbar technique). PLAYHEAD = a thin vertical worn-metal element scrubbing across the grooves.
- NO glossy plastic. NO DOM/CSS. NO stock icons / emoji.

## WHAT IT DOES (must ACTUALLY work — verified behaviorally)
- Engine: Theatre.js as the keyframe model (time in SECONDS, not fps) — the data/interpolation layer.
- NODE LAW: keyframes animate a NODE's properties; animation data lives in the SELECTED NODE's schema (a node holds animations) — single source of truth (node-authorship-gate applies).
- Interactions: DRAG a fader-knob along its groove -> sets/moves a keyframe value at the playhead time AND the bound node property updates. SCRUB the playhead -> the node property animates across keyframes (interpolated). PLAY/PAUSE. Add/remove a keyframe. 2+ keyframes on a property MUST produce a visible animation on scrub/play.
- Reviewable route (e.g. `/keyframe-editor`). Do NOT touch the production editor.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ Theatre.js, drei). EVERYTHING in-canvas — labels/values/tooltips in-engine (engraving on glass; Troika / drei `<Text>` / SDF for floating text), NEVER DOM, NEVER drei `<Html>`, NEVER CSS/Tailwind/inline-style. Run `scripts/no-dom-ui-gate.mjs` -> must PASS (paste output).

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL
Render is the FLOOR. INTERACT like a user via chrome-devtools MCP, FREQUENTLY (every wave + every non-trivial edit), judging the four axes (style / function / intuitiveness / usability) vs this spec + DESIGN-REFERENCES.md. Required behavioral checks (each = interact -> screenshot -> read console -> vision-judge the RESULT):
- HOVER a fader knob -> spin fires, reads worn/glassy.
- DRAG a fader knob along its groove -> the KNOB travels the channel AND the bound value changes (capture before/after).
- Set 2+ keyframes on a property, SCRUB the playhead -> the node property visibly ANIMATES (capture frames across the scrub).
- PLAY/PAUSE -> animation runs / stops.
- Engraved labels legible + recessed; grooves read as milled channels; knobs seated in grooves.
Then a FRESH-CONTEXT USER-ADVOCATE subagent (NO build context; given this spec + the live URL; task: "set two keyframes on a property and scrub to watch it animate; report friction / confusion / breakage / ugliness"). Its FAIL BLOCKS completion. Evidence frames -> notes/verification/keyframe/. Resize before reading (`sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`). Do NOT self-grade aesthetics — capture + advocate.

## MODEL / ORCH
MODEL claude-opus-4-8 (confirm; never opusplan). ULTRACODE parallel subagents (reuse kid-kode-landing/notes/catalog-finish-workflow.mjs `parallel()`). Read first: the committed toolbar route/components, docs/prism/VERIFICATION-STANDARD.md, PRISM-CANVAS-EDITOR-SPEC.md, DESIGN-REFERENCES.md, PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md (the pane/cube are primitives — dogfood them).

## WAVES (commit+push+NOTIFY each)
1. w-pane: glass timeline pane + grooved tracks (milled channels) + playhead. Notify + commit `AUTO-CKPT: KEYFRAME w-pane`.
2. w-knobs: worn-cube fader knobs riding grooves + engraved track labels. Notify + commit `AUTO-CKPT: KEYFRAME w-knobs`.
3. w-wire: Theatre.js wiring — drag->keyframe, scrub->animate node property, play/pause, bound to the selected node's schema. Notify + commit `AUTO-CKPT: KEYFRAME w-wire`.
4. w-verify: behavioral verification per the STANDARD (interact + four axes + advocate) + frames + report. Notify + commit `AUTO-CKPT: KEYFRAME w-verify`.

## ANTI-STUCK
NEVER fall back to CSS / DOM / plastic / painted-line stand-ins. If a behavior genuinely can't reach the bar after real effort, land what works, note it, write the report, emit BLOCKED — don't thrash.

## DONE / MARKERS
DONE when: keyframe editor renders in the glass language (glass pane + grooved tracks + worn-cube knobs + engraved labels + playhead) AND actually animates a node property (drag sets keyframes, scrub/play animates), behavioral verification + advocate both clean, no-dom-ui PASS, node-authorship PASS, tsc 0-new, 0 console errors, evidence frames captured. Write notes/KEYFRAME-REPORT.md (design-language match, behavioral results w/ frame paths, advocate verdict, gate outputs, honest flags). Print LAST:
PRISM-KEYFRAME: RUN COMPLETE
If genuinely blocked: write the report w/ the blocker and print LAST:
PRISM-KEYFRAME: BLOCKED-NEEDS-FOUNDER
