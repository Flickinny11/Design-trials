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
