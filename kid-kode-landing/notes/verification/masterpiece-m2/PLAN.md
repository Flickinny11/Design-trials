# MASTERPIECE M-2 — plan (checkpoint, 2026-07-04)

Founder intent: the watch app running in the Prism runtime IS the demo of the
editor's power. Every polish item below is authored THROUGH the graph
(`public/prism-mock/home/live-graph.json` via a deterministic
`scripts/m2-masterpiece-polish.mjs`, the F-3 idiom) — zero hardcoded visuals,
so parity + node-realization hold by construction.

## BEFORE evidence (committed with this plan)

`notes/verification/masterpiece-m2/before/{desktop,mobile}/01..06-*.png` — all
six hubs in preview-app, 1600×900 + 390×844, 0 console errors.

## Task 1 — the masterpiece pass (graph-authored)

- **A · One machined-brass headline system (s1–s6).** Today three treatments
  coexist and two are broken at masterpiece grade:
  - s1 `orr-arrival-headline` + s6 `orr-atelier-headline`: glass extrude
    (`transmission: 0.9`) → each glyph reads as whatever is behind it →
    per-glyph incoherence (crop: `Time, machined.` mixes opaque cream and
    dark glass letters). The s1 caption says "molten brass" — the render
    contradicts the node's own authored intent.
  - s2/s3/s5 headlines: `brass-macro.png` photo texture as faceFill → blotchy
    per-glyph luminance (crop: s5 `Eleven made. One is yours.` — 'a'/'O'
    read as broken gold glyphs; F-4 logged this as the "gold glyph",
    data-tune deferred to founder → M-2 IS that founder-directed pass).
  - s4 `orr-celestia-headline`: coherent but FLAT (no extrude → thinnest
    of the six; "nothing flat" law).
  Fix: one canonical treatment on all six — champagne→brass **gradient**
  PBR face (no photo blotch), extrude + bevel (real depth), dark bronze
  walls `#6b4f1d`, warm emissive glow; `transmission: 0`. Pure `textSpec`
  data.
- **B · s3 Materia composition.** Mobile: title overlaps the gem card
  (before/mobile/03). Desktop: subhead scrim rides the title baseline.
  Clearance via `scenePosition`/`responsiveScenePos` on the title, subhead
  and card stack; card label legibility on mobile.
- **C · s6 Atelier configurator framing (mobile).** The watch preview reads
  as a washed-out crop (before/mobile/06): reframe pose/scale for 390×844;
  verify face exposure in the mobile frame.
- **D · s1 Arrival clearance + CTA contrast.** Mobile headline sits tight
  under the header band; RESERVE No.7 amber ghost CTA gets the F-4-queued
  contrast pass (graph data: label/slab colors).
- **E · Narrative chapter folios I–VI.** One editorial wayfinding system
  Arrival→Atelier: numeral-prefixed eyebrow per hub (new small Sora text
  nodes on s1/s2/s4/s6; numeral prefixes on the existing s3/s5 eyebrows).
  New nodes are complete, self-describing schemas (dogfoods Task 4).
- **F · Motion with weight.** Staggered in-view reveals on stat chips /
  material cards where missing (`animationBindings` data), nothing linear,
  no confetti.

Each slice: author → fresh frames (both viewports) → next. Judges at the end
at the M-1 bar.

## Task 2 — true-runtime proof (3 diverse elements + 1 canvas round-trip)

1. TEXT: edit a headline's `textSpec.content` via the node editor → rebuild →
   canvas + preview → save → reload → persists → galaxy parity intact.
2. MATERIAL: edit a mesh node's `materialSpec` the same way.
3. BEHAVIOR: retarget a CTA's `functionBinding` (navigate target) the same
   way; prove preview executes the new navigation.
Then: one canvas gizmo edit round-trips INTO the node schema
(`canvasTransform`) — continued editability. Every step framed.

## Task 3 — node-editor shippable certification

Capability matrix vs `PRISM-NODE-EDITOR-SPEC.md` §10 (NE-SC-01..15) +
`-V2` (A/B/C/D/E criteria) + the canvas amendment (Function-in-Canvas):
spec'd → implemented? → works end-to-end (fresh proof or cited committed
evidence) → schema round-trips? Close in-spec gaps; list explicit deferrals
with rationale. Nothing "shippable" may be a stub.

## Task 4 — schema comprehension readiness

- `scripts/m2-schema-sync.mjs`: derive `intent.behaviorSpec.interactions` /
  `emits` from the operative behavior fields (`functionBinding`,
  `animationBindings`, cinematic triggers) so a cold model reading ONE node's
  intent block understands the element (today: 331/331 have EMPTY
  behaviorSpec while 196 carry a live functionBinding — the split the AI
  builder would trip on).
- `scripts/schema-completeness-gate.mjs` wired into `npm run verify`:
  caption non-empty + artifact coherence per renderMode + behavior
  coherence (functionBinding ⇒ described in behaviorSpec) + contracts
  present. Regressions can't ship.

## Task 5 — board green + judges + signoff

verify:prism · verify:galaxy · verify:global-shell · verify:parity (live) ·
node-authorship (9/9, GATE_URL=:3001) · typecheck:gate 0-new · no-dom-ui ·
secret grep · schema gate (new). Both viewports. Two fresh-context Fable-5
judges (criteria-reviewer + user-advocate) at the M-1 masterpiece bar,
0 MUST-FIX. Update FINISH-F4 founder-signoff summary with M-1/M-2 (merge
commands current; merge stays the founder's call). Output:
`notes/MASTERPIECE-M2-REPORT.md`.
