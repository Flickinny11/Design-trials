# USER-ADVOCATE rubric — the human-grade gate (FROZEN CONTRACT)

> **Frozen 2026-06-09 before any tile was graded against it.** This is the capstone reviewer of the
> Prism verification loop: a fresh-context Claude Opus agent that judges a feature/tile **as a real,
> non-technical user would** — by looking at evidence captured from *driving the running app* (real
> focus / play / control-sweep interaction on the real Metal GPU), never by reading the DOM or the
> source. It is **parameterizable**: point it at any feature by giving it `{feature, claim,
> groundTruthSibling?, evidenceDir}`.
>
> It is the FINAL gate, after the functional gate (renders/plays/controls) and the art-fidelity gate.

## Why this exists (the failure it prevents)

A prior pass marked **53 tasks "verified" while the runtime showed only a background**. Assertion-based
"done" ("I added it", "the tile is registered", "the DOM node exists") is **FORBIDDEN**. This reviewer
exists to make *assertion-without-evidence* structurally impossible: **every answer must cite specific
evidence — a named frame file, a measured value from `metrics.json`, or an interaction result. A verdict
with no cited evidence is INVALID and is rejected by the schema validator** (`useradvocate-verdict-schema.mjs`).

## The rubric (answer ALL five, each with cited evidence)

For each question the agent MUST cite at least one concrete piece of evidence: a frame filename
(`<tile>/<state>/play-2.png`), a measured value (`metrics.json → play-2.meanRGB = [210, 96, 40], hue=18°`),
or an interaction result (`control burstRate low→high: frame changed, Δluma=37`).

1. **Is anything visibly broken, misaligned, low-contrast, cut off, glitchy, or laggy?**
   List EACH defect WITH the frame that shows it. (e.g. "slab-seam banding visible as horizontal shelves
   in `smoke/play-2.png`; `metrics.json bandingScore=0.41` (>0.25 = visible)".) "Nothing" is only a valid
   answer if the frames support it.

2. **Does it READ AS WHAT IT CLAIMS?** Compare against the claim/name and the ground-truth sibling.
   (e.g. fireball-burst claims "fire" — does it look like fire? Compare hue/saturation against the
   `fire-flame` ground-truth frames. A labeled control must do something *sensible* across its range.)
   Cite the frame(s) and the measured hue/saturation you compared. **"Reads as fire" requires the
   dominant warm hue to sit in fire's band (≈10–45°) at high saturation, like the ground truth — a pink
   ring (hue≈330°) or cream/olive body is NOT fire.**

3. **Would a first-time, non-technical user understand how to use it UNPROMPTED?** (interactive features)
   Cite the control-sweep frames: does driving the labeled control produce a visible, sensible change?

4. **Does it feel responsive, or janky?** Cite the play-phase frame deltas / control-apply latency in
   `metrics.json` (frameDeltaMag, controlLatencyMs). Visible motion across play frames = responsive;
   identical frames or >1 control with no change = janky/dead.

5. **NET VERDICT: would a user be PLEASED / INDIFFERENT / ANNOYED — and exactly WHY,** in one or two
   sentences a non-technical person would say out loud.

## Amendment — the PHOTOREAL bar for volumetrics (added 2026-06-09, volumetric sweep)

> Additive amendment; everything above is unchanged. Applies to every tile that claims to be a
> volume (fog / smoke / clouds / dust / rays / bursts / mist / ink — the volumetric family).

**Reject as MUST-FIX anything that looks BLOCKY, stacked, tiled, jagged, low-poly, or
game-engine-cheap. The bar is photorealistic, smooth, premium 4K motion-graphics. A user
dropping this into a real 3D scene must say "that looks professional", not "why does this look
like Minecraft". Cite the frame + the bandingScore.**

Concretely, each of these is a MUST-FIX (with the frame + measured value that proves it):
- **Slab/shelf banding** — discrete parallel sheets, horizontal/vertical shelves, "stacked
  cards" depth (the 5-slab stack artifact). `bandingScore > 0.25` corroborates; cite it.
- **Tile/lattice grid** — axis-aligned square/brick structure at any frequency (the naive
  value-noise lattice artifact).
- **Mirror/wrap seams** — a hard seam down the middle or at a wrap edge.
- **Jagged/aliased edges** where the claim implies softness (smoke, mist, rays).
- **Blow-out / out-of-gamut** — additive stacking that clips to white or shifts hue
  (ACES+additive warm→cool drift); fire must stay in fire's band.

## Powers — MUST-FIX vs FLAG

- **MUST-FIX (blocks "done").** Use for *clear, objective* failures: visibly broken / misaligned /
  cut-off / low-contrast / laggy, OR **"does not read as what it claims"** (fireball that isn't fire,
  a control that does nothing, a "volume" that's a flat blocky stack of shelves). Every MUST-FIX names
  the frame and the measured value that proves it.
- **FLAG-DON'T-BLOCK.** Use for *subjective taste* calls where a reasonable user could differ
  (slightly muddy, could be punchier, palette preference). Flags inform but do not block "done".

## NET-VERDICT → gate mapping (deterministic)

| NET | Any MUST-FIX? | Gate result |
|---|---|---|
| ANNOYED | (always implies ≥1 MUST-FIX) | **BLOCKED** |
| INDIFFERENT | yes | **BLOCKED** |
| INDIFFERENT | no (flags only) | **PASS-WITH-FLAGS** |
| PLEASED | no | **PASS** |
| PLEASED | yes | **INVALID** (contradiction — a tile with a MUST-FIX cannot be PLEASED; reviewer must re-grade) |

## Verdict object (schema; see `useradvocate-verdict-schema.mjs`)

```json
{
  "feature": "fireball-burst",
  "claim": "A fireball erupts ... a turbulent ball of FLAME ...",
  "groundTruthSibling": "fire-flame",
  "state": "before",
  "rubric": {
    "q1_defects":    { "answer": "...", "evidence": ["fireball-burst/before/play-2.png", "metrics: play-2 ..."] },
    "q2_reads_as":   { "answer": "...", "evidence": ["..."] },
    "q3_discoverable":{ "answer": "...", "evidence": ["..."] },
    "q4_responsive": { "answer": "...", "evidence": ["..."] },
    "q5_net":        { "answer": "...", "evidence": ["..."] }
  },
  "mustFix": [ { "issue": "...", "evidence": "fireball-burst/before/play-2.png : hue 332° (pink), sat 0.4" } ],
  "flags":   [ { "note": "...", "evidence": "..." } ],
  "net": "ANNOYED",
  "gate": "BLOCKED"
}
```

## Anti-rubber-stamp enforcement (load-bearing)

The validator (`useradvocate-verdict-schema.mjs`) **rejects** a verdict if ANY of:
- a rubric answer has an empty `evidence` array, or evidence that does not name a real file in the
  bundle OR a `metrics:`/`control:`/`console:` measured citation;
- `net`/`gate` disagree with the mapping table;
- `net !== PLEASED` but `mustFix` is empty (a non-pleased verdict must say what's wrong, with evidence);
- `net === PLEASED` but `mustFix` is non-empty.

A rejected verdict is NOT a pass and NOT a fail — it is sent back to the reviewer to re-grade with
evidence. **Evidence or it didn't happen.**

## Amendment — the ANTI-SLOP gate for editor chrome (added 2026-06-09, UI design overhaul)

> Additive amendment; everything above is unchanged. Applies to every EDITOR CHROME surface
> (catalog tiles/headers/detail panel, toolbars, panels, overlays, HUD, pickers, sliders,
> buttons, inputs). Engine-rendered tile CONTENT keeps being judged by the existing rubric +
> photoreal bar; this gate judges the chrome around it.

**ANTI-SLOP: Does this look like generic AI-generated dashboard chrome (flat dark cards,
purple/blue gradient accents, default shadows, zero material character)? If yes → MUST-FIX.
Would a senior product designer at a top-tier studio call this distinctive, premium, 3D, and
material-driven? Cite the frame. Purple anywhere → MUST-FIX.**

Concretely, each of these is a MUST-FIX in chrome (cite the frame that shows it):

- **Purple** — any violet/purple chrome accent (`#a978ff`-family, indigo, violet). Anywhere.
- **Flat untreated fills** — a surface with no gradient, no edge treatment, no elevation;
  the "flat dark card with a 1px white border" default.
- **Blue-default accenting** — the `#5d8bff`-family AI-dashboard blue as an accent.
- **No material character** — chrome that reads as "div with background-color" rather than
  glass / metal / ceramic; no visible edge/corner light behavior, no depth.
- **Broken or half-rendered material** — a tier downgrade must read as a clean lighter
  treatment of the same design, never as missing/broken chrome.
- **Illegible text** — contrast failures on any new surface.

The reference contract is the Wave-0 token sheet (`/design-system`,
`notes/verification/ui-design/wave0-token-sheet.png`). Chrome surfaces are judged against it:
same palette (graphite/bone/brass + ice), same material/edge/elevation language.

**THE FINISH-LINE TEST (apply verbatim, per surface):** A user looks at it and says: "damn,
this is really good looking. it's intuitive, easy to use, and all those animations and
primitives are awesome, and they're great to design with in our 3D space in canvas mode."
If a surface wouldn't earn that reaction, it is not done.
