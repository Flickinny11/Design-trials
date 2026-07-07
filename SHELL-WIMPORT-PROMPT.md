# PRISM-WIMPORT — "PRISM INGEST": GITHUB REPO -> PRISM RUNTIME (founder-directed 2026-07-05)
# Design ratified in ROADMAP-TO-SHIP.md: REGENERATION, NOT TRANSPILE.

You are the W-IMPORT orchestrator. Working dir:
/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing
Branch: current checkout. Do NOT switch branches.

## MISSION
Users bring an existing app's DNA into Prism. Their app cannot run in the
Prism runtime as-is (the graph IS the app — immutable law). So import =
ANALYZE the repo -> SYNTHESIZE the SAME plan format guided-build produces
(the repo is an extremely rich prompt + asset source) -> user approves the
plan at the EXISTING gate -> the normal parallel node build regenerates the
app AS Prism nodes -> FIDELITY REPORT tells the user honestly what carried,
what adapted, what needs them. Import is a PLAN SOURCE, not a second engine.
No competitor ships true runtime conversion (fresh-verified 2026-07-05:
Builder.io edits repos in place; Copilot gives migration guidance; that's
the state of the art). This is a differentiator — build it like one.

## READ FIRST
1. notes/ROADMAP-TO-SHIP.md — W-IMPORT design decision (your contract).
2. The W2 guided-build intake ("Import an existing GitHub repo" checkbox is
   your surface) + the plan format the Conductor consumes.
3. docs/prism/DIFFUSION-ENGINE-SPEC.md — plan -> graph -> node contract.
4. src/lib/flight-recorder/ — instrument EVERY import stage (analyze,
   synthesize, approve, regen outcome, fidelity) as first-class corpus
   records; import traces are premium training data.

## FRESH-DATED RESEARCH DUTY
Verify today's best repo-analysis approach before building: repo->context
packers, AST tooling for React/Next route+component extraction, current
Next.js App/Pages router conventions. Do not assume trained versions.

## REQUIRED WORK
1. ANALYZER (src/lib/ingest/): given a repo (public URL now; typed GitHubApp
   auth interface STUBBED until founder's GitHub App arrives), extract:
   routes/pages, components + hierarchy, data models, API surface, copy,
   brand tokens (colors, type, imagery assets). v1 scope: Next.js/React.
   Framework detection with a clear "not yet supported" path for others.
2. PLAN SYNTHESIS: emit the exact guided-build plan format — archetype,
   capabilities, direction seed (from extracted brand tokens), node graph
   plan. The user must be able to edit it like any guided-build plan.
3. INTAKE WIRING: the W2 checkbox becomes real — repo URL input, analysis
   progress (SSE, existing channel law), plan lands at the existing
   approval gate. Additive; zero restyle of certified intake surfaces.
4. FIDELITY REPORT: per-feature ledger (carried / adapted / needs-you) with
   honest reasons; rendered post-plan and attached to the project. Never
   overpromise — "needs-you" is a feature, not a failure.
5. REGEN PROOF: run the full path end-to-end on TWO fixtures: (a) a local
   fixture repo you author (small Next.js app: 3 routes, form, API call),
   (b) one real public GitHub repo (small OSS Next.js demo). Plan approved
   -> mock build pipeline regenerates -> fidelity report produced. Frames +
   corpus records as evidence.
6. FLIGHT RECORDER: import_event records (analyze/synthesize/approve/regen/
   fidelity) through the existing recorder; PII scrub applies to repo
   contents (emails in commit copy etc).
7. notes/spec-deviations-wimport.md BEFORE any deviating code.

## INVARIANTS (violation = MUST-FIX)
I-ADDITIVE (no rewrites of certified surfaces); I-SSE (no new realtime
channels); I-SECRETS/INV-19 (GitHub App key interface typed, never logged);
I-HONEST-FIDELITY (report may never claim a feature carried that didn't —
provenance law applies to user-facing claims too); I-FAILOPEN (analysis
failure degrades to plain guided-build, never a dead end); I-SPEC (no
canonical spec edits); npm run verify EXIT 0.

## EVIDENCE + JUDGES + MARKERS
Evidence to notes/verification/shell-wimport/: analyzer output JSON for both
fixtures, plan JSONs, fidelity reports, intake frames (desktop+mobile),
corpus records, verify output. Dual judges fresh-context: criteria-reviewer +
user-advocate as "developer importing their real app: do I trust what this
told me, and is the imported plan genuinely MY app's DNA?" 0 MUST-FIX gate.
Report: notes/SHELL-WIMPORT-REPORT.md (skeleton first).
Complete: PRISM-WIMPORT: RUN COMPLETE
Blocked: PRISM-WIMPORT: BLOCKED-NEEDS-FOUNDER
Commit small and often. On resume, read report + git log first.
