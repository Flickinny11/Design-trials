# PRISM-WFR — FLIGHT RECORDER (founder-ratified 2026-07-05; authored 21:40)
# FOUNDER-SIGNOFF: "please go ahead author that flight recorder spec and wave
# ... lets go ahead and get everything ready for ship."

You are the W-FR orchestrator. Working dir:
/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing
Branch: current checkout. Do NOT switch branches.

## MISSION
Build the training-data + telemetry substrate that must exist BEFORE launch:
every model interaction, node generation, verification signal, and user
keep/edit/regen decision recorded durably from the first user's first build.
This corpus is the platform's future own-model flywheel AND its acquisition
asset. Design bar: "would an ML engineer at an acquirer call this corpus
training-ready on day one?"

## READ FIRST
1. notes/PRISM-SELF-LEARNING-PROPOSAL.md — RATIFIED program; §3 is your spec.
2. src/lib/capabilities/ (W10 CapabilityUsage metering) — extend, don't fork.
3. src/app/api/material-gen/route.ts + the mock build pipeline event paths.
4. docs/prism/DIFFUSION-ENGINE-SPEC.md — buildEvents/SSE law (INVARIANT 5:
   SSE only; the recorder is a SINK, never a new realtime channel).

## FRESH-DATED RESEARCH DUTY + SCHEMA LAW (founder-verified 2026-07-05)
Align the schema to OpenTelemetry GenAI semantic conventions — verify the
CURRENT attribute set yourself today (v1.37+ overhauled content capture:
gen_ai.system_instructions / gen_ai.input.messages / gen_ai.output.messages,
gen_ai.usage.* tokens, gen_ai.request.model, gen_ai.provider.name; multi-
agent conventions in active development; status experimental — pin the
version you implement and record it in the schema header). Prism-specific
signals live in a prism.* extension namespace (node id, graph ref, SWE-RM
score, repair attempt class, verify outcomes, keep/edit/regen, credits).
Dual purpose by construction: OTel-compatible observability + training corpus.

## REQUIRED WORK
1. SCHEMA v1 (src/lib/flight-recorder/schema.ts): record types for
   build_session, node_attempt (spec -> code -> score -> repair chain),
   edit_event (before/after spec diff -> regen -> keep/undo), capability_usage
   (wrap W10's), verify_signal (judge/gate outcomes), user_signal (ship,
   abandon, return). Every record: schema_version, consent flag, timestamps,
   gen_ai.* + prism.* attributes. Schema doc generated from types.
2. RECORDER LIB (src/lib/flight-recorder/): append-only writer — batched,
   non-blocking, fail-open (recorder failure NEVER breaks a build). Local
   NDJSON sink with daily rotation + Parquet compaction script; R2 sink as a
   typed interface behind the same writer (stub until R2 creds; wired at
   SHIP-BRAND). PII SCRUB at write: redact emails, names in free text, any
   key-shaped strings; scrub covered by unit tests with adversarial fixtures.
3. WIRING (additive): instrument material-gen route, W10 generative dispatch
   + CapabilityUsage, mock build pipeline events, and editor node
   edit/regen/keep/undo actions. Server-side capture only.
4. GOLDEN EVAL SEED (eval/golden-v1/): harvest certified fixtures — ORRERY
   nodes, W5B ship fixtures, W10 demo assets — into versioned eval cases
   (input spec + expected-pass criteria). Manifest with provenance per case.
5. TOS DATA-RIGHTS DRAFT (notes/TOS-DATA-RIGHTS-DRAFT.md): plain-language
   clause granting platform right to use interaction data to improve models;
   enterprise opt-out flag honored end-to-end (consent=false records are
   quarantined to a separate non-training sink). FLAG FOR LEGAL REVIEW —
   draft only, not shipped copy.
6. DEV LEDGER VIEW: minimal dev-only route showing record counts by
   type/day/touchpoint + last-24h sample browser (PII-scrubbed view). This
   is the seed surface W-IM's investor mezzanine will later read from.
7. DEMO PROOF: run one real end-to-end demo (guided-build mock + one W10
   generation + one node edit) and show the resulting corpus records.
8. notes/spec-deviations-wfr.md BEFORE any deviating code.

## INVARIANTS (violation = MUST-FIX)
- I-FAILOPEN: recorder outage never blocks or slows a user build (async,
  bounded queue, drop-with-counter under pressure). Prove with a kill test.
- I-PII: no raw emails/names/keys in the training sink; tests prove it.
- I-CONSENT: consent flag on every record; consent=false never reaches the
  training sink. I-SECRETS: INV-19. I-ADDITIVE: no rewrites of existing
  paths. I-SSE: no new realtime channels. I-SPEC: no canonical spec edits.
- I-PROVENANCE: commit messages never claim unperformed acts.
- npm run verify EXIT 0 (all suites) at end.

## EVIDENCE + JUDGES + MARKERS
Evidence to notes/verification/shell-wfr/: corpus sample (scrubbed), schema
doc, dev-ledger frames (desktop+mobile), fail-open kill-test output, PII
adversarial test output, verify output. Dual judges fresh-context:
criteria-reviewer (every numbered requirement + invariant) + user-advocate
acting as "acquirer's ML engineer": is this corpus training-ready, standard-
compatible, and legally clean by design? 0 MUST-FIX gate, fix rounds.
Report: notes/SHELL-WFR-REPORT.md (skeleton first).
Complete: PRISM-WFR: RUN COMPLETE
Blocked: PRISM-WFR: BLOCKED-NEEDS-FOUNDER
Commit small and often. On resume, read report + git log first.
