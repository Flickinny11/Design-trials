// Acceptance test for T-VID-02 — Add interactive-element classifier
// note (§-SPEC-ENRICH) to prism-spec-extract.md.
//
// Spec ref: §-SPEC-ENRICH. T-VID-01 wrote video-slot playback hooks
// against interactions[] entries of shape { event, effect, src } — but
// prism-spec-extract.md:626 still only defines `{ event: string; effect:
// string }`. This task adds a design note that (a) tells future Ralph
// iterations where playback hooks come from (a post-segmentation
// classifier pass, not hand-coded rules), and (b) documents the `src`
// field as a permitted extension to the canonical interaction tuple.
//
// This is a documentation task. The "runtime" this test gates is the
// written spec itself — the check is schema-of-text. If the design note
// is missing, any downstream Ralph iteration that wires the classifier
// will have to re-derive the decisions from scratch.
//
// Acceptance contract (exactly what this test locks):
//
//   (A) Section presence. prism-spec-extract.md contains exactly one
//       section heading matching /^##\s+§-SPEC-ENRICH\b/m. More than
//       one, or zero, fails — the tag is an identifier, not a theme.
//
//   (B) Pipeline position. The section body describes the classifier
//       as a *post-segmentation* pass — i.e. it runs AFTER SAM returns
//       bboxes, not before and not during. The section must name SAM
//       explicitly so the pipeline ordering is unambiguous.
//
//   (C) Classifier shape. The section must specify that play-button /
//       video-like region detection goes through a vision-model prompt,
//       NOT hand-coded pixel rules. (Hand-coded rules for this were
//       rejected during T-VID-01 planning — this task locks the
//       decision in the spec so future iterations don't re-argue it.)
//
//   (D) User-vs-auto branch. The section must describe the branch where
//       the classifier prompts the user: "user-supplied content" vs
//       "auto-generated content". Both branches must be named. T-VID-03
//       wires the auto-generation half; the user-supplied branch is
//       the early-exit path.
//
//   (E) Emission shape. The section must document that the classifier
//       emits an interactions[] entry with the canonical {event, effect}
//       pair plus an extension field `src`. Without this, `src` is an
//       undeclared field; with it, the spec ratifies what T-VID-01
//       already wrote to home-hub.json.
//
//   (F) Forward reference. The section must name T-VID-03 as the task
//       that wires the generation half, so the design note and its
//       implementation don't drift apart.
//
// Run with: node tests/enrich/T-VID-02.test.mjs

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, "..", "..");
const specPath = resolve(kidKodeRoot, "notes/prism-spec-extract.md");

const spec = readFileSync(specPath, "utf8");

// ─── (A) Section presence ─────────────────────────────────────────────
const HEADING_RE = /^##\s+§-SPEC-ENRICH\b/gm;
const headingMatches = spec.match(HEADING_RE) ?? [];
assert.equal(
  headingMatches.length,
  1,
  `prism-spec-extract.md: expected exactly 1 heading matching /^##\\s+§-SPEC-ENRICH\\b/m, got ${headingMatches.length}`,
);

// Extract section body: from the §-SPEC-ENRICH heading to the next
// `## ` heading (or end of file). The trailing `---` separator line
// that typically precedes the next section is included in the body
// for simpler regex work; this is intentional.
const sectionRe = /^##\s+§-SPEC-ENRICH\b[^\n]*\n([\s\S]*?)(?=^##\s|\Z)/m;
const sectionMatch = spec.match(sectionRe);
assert.ok(
  sectionMatch,
  "prism-spec-extract.md: could not extract §-SPEC-ENRICH section body",
);
const body = sectionMatch[1];
assert.ok(
  body.trim().length > 200,
  `§-SPEC-ENRICH body is too short (${body.trim().length} chars) — a design note needs more substance`,
);

// ─── (B) Pipeline position: post-segmentation, names SAM ──────────────
assert.ok(
  /post-segmentation|after\s+SAM|after\s+the\s+segmentation/i.test(body),
  "§-SPEC-ENRICH: must describe the classifier as post-segmentation (runs AFTER SAM returns bboxes)",
);
assert.ok(
  /\bSAM\b/.test(body),
  "§-SPEC-ENRICH: must name SAM explicitly so pipeline ordering is unambiguous",
);
assert.ok(
  /\bbbox(es)?\b|\bbounding\s+box(es)?\b/i.test(body),
  "§-SPEC-ENRICH: must mention bboxes (the SAM output that the classifier consumes)",
);

// ─── (C) Classifier shape: vision-model prompt, NOT hand-coded rules ──
assert.ok(
  /vision[-\s]?model|vision\s+LM|VLM/i.test(body),
  "§-SPEC-ENRICH: must specify a vision model does the classification",
);
assert.ok(
  /not\s+hand-coded|not\s+hardcoded|not\s+(?:hand-?tuned\s+)?(?:pixel\s+)?rules|no\s+hand-coded\s+rules/i.test(
    body,
  ),
  "§-SPEC-ENRICH: must explicitly reject hand-coded pixel rules (they were debated in T-VID-01 planning; lock the decision)",
);
assert.ok(
  /play[-\s]?button|playable\s+region|video[-\s]?like|video\s+region/i.test(
    body,
  ),
  "§-SPEC-ENRICH: must name the category being classified (play-button-like / playable / video-like regions)",
);

// ─── (D) User-vs-auto branch ──────────────────────────────────────────
assert.ok(
  /user-supplied/i.test(body),
  '§-SPEC-ENRICH: must name the "user-supplied content" branch',
);
assert.ok(
  /auto[-\s]?generated/i.test(body),
  '§-SPEC-ENRICH: must name the "auto-generated" branch',
);
assert.ok(
  /prompt(s)?\s+(?:the\s+)?user|ask(s)?\s+(?:the\s+)?user/i.test(body),
  "§-SPEC-ENRICH: must describe the classifier prompting the user for a choice",
);

// ─── (E) Emission shape: interactions[] with {event, effect, src} ─────
assert.ok(
  /interactions\[\]/.test(body),
  "§-SPEC-ENRICH: must document the interactions[] emission",
);
assert.ok(
  /playVideo/.test(body),
  "§-SPEC-ENRICH: must name the `playVideo` effect emitted for playable regions",
);
assert.ok(
  /\bpointertap\b/.test(body),
  "§-SPEC-ENRICH: must name `pointertap` as the event (mirrors home-hub.json video-slot entries)",
);
// The central contribution: `src` is ratified as a permitted extension
// to {event, effect}. Require the section to name the field AND mark it
// explicitly as an extension (not a rename).
assert.ok(/\bsrc\b/.test(body), "§-SPEC-ENRICH: must name the `src` field");
assert.ok(
  /permitted\s+extension|optional\s+extension|extension\s+to|extends?\s+the\s+canonical/i.test(
    body,
  ),
  "§-SPEC-ENRICH: must flag `src` as an extension to the canonical {event, effect} tuple (line 626), not a replacement",
);

// ─── (F) Forward reference to T-VID-03 ────────────────────────────────
assert.ok(
  /T-VID-03/.test(body),
  "§-SPEC-ENRICH: must name T-VID-03 as the task that wires the generation half",
);

console.log("[T-VID-02] PASS — §-SPEC-ENRICH section present and covers (A–F)");
