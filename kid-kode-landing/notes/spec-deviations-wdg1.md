# W-DG1 spec deviations (written BEFORE any deviating code, per prompt §8)

## DEV-1: Flight-recorder schema extension (touches an existing file)

**Invariant in tension:** I-ADDITIVE says "new dirs only; zero product-surface
changes this wave." Deliverable 7 says "Flight-record the harvest (analysis
events) via src/lib/flight-recorder/."

**Conflict:** `FlightRecordType` in `src/lib/flight-recorder/schema.ts` is a
closed 7-literal union. No existing record type honestly models a design-
analysis event (`verify_signal`/`capability_usage` would be semantic misuse —
data-honesty violation, which W-FR treats as worse than an additive edit).

**Resolution (following the ratified `import_event` precedent from W-IMPORT):**
additively extend the schema with one new record type
`design_analysis_event` + touchpoint `'design-grammar'` + one new emit helper
`recordDesignAnalysis` in `index.ts`, then regenerate the schema doc
(`npm run fr:schema-doc`) so the verify gate's freshness check passes. No
existing field, type, or helper is modified or renamed. This is not a
product-surface change (flight recorder is telemetry substrate; no UI/runtime
behavior changes).

**Exemplar-generation events** are recorded through the EXISTING
`capability_usage` record type (that is exactly what they are), with
touchpoint `'design-grammar'` (the `PrismTouchpoint` union is open by design).

## DEV-2: "Full gallery" coverage = enumerate-all + deep-analyze sample

**Prompt language:** "live analysis of the full Slider Revolution template
gallery." The gallery contains 250+ templates; live-driving every one is not
tractable in one wave and adds little marginal grammar signal past family
saturation.

**Resolution (honesty law):** we ENUMERATE the full gallery (title + category
+ URL for every template we can list), DEEP-ANALYZE in a real browser: all 17
founder-linked templates + a stratified sample across every gallery category
+ ~top Awwwards winners, and we record exact counts (enumerated vs
deep-analyzed) in the report §4. Family distillation notes which families are
grounded in deep analysis vs listing-level classification. No family ships
without at least one deep-analyzed source behind it.

## DEV-3: Scratch dir location

Prompt says screenshots "stay in a gitignored scratch dir." We use
`/tmp/wdg1-scratch/` — outside the repo entirely, which is strictly stronger
(cannot be committed even by accident) and still deleted before wave end.

## DEV-4: `notes/prism-mock-progress.md` discipline

kid-kode-landing/CLAUDE.md requires commits that change source to touch
`notes/prism-mock-progress.md`. The flight-recorder extension commit (DEV-1)
will append a progress line. Corpus-only commits (design-grammar/, notes/)
are not "source" changes but will follow the same discipline for
traceability.
