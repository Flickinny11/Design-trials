# Prism — Data Rights clause (DRAFT)

> ⚠️ **DRAFT FOR LEGAL REVIEW — NOT SHIPPED COPY.** This is plain-language
> product intent for the Flight Recorder (W-FR), written to be reviewed and
> rewritten by counsel before it appears in any Terms of Service, Privacy
> Policy, or Data Processing Addendum. It is NOT legal advice and NOT final
> language. Founder-ratified 2026-07-05 as a day-1 requirement; the binding
> clause is counsel's to author.

## Why this exists (day-1 requirement)

The platform learns from how people build. Recording model interactions, build
outcomes, and keep/edit/regenerate decisions is what lets Prism improve its own
models over time (the flywheel) and is a core asset of the business. Without a
clear, affirmative data-rights grant on day one, the resulting dataset is both
unusable (can't legally train on it) and unsellable (an acquirer can't rely on
it). The Flight Recorder's technical guarantees — PII scrub at write, consent
gating, quarantine of opt-out data — exist to make this clause honest.

## Plain-language grant (consumer / self-serve tier)

> **Improving our models.** When you use Prism to design and build apps, we
> record how the build goes — the instructions you give, what the system
> generates, whether it passed our automated checks, and whether you kept,
> edited, or regenerated each piece. We use this interaction data to operate,
> secure, and **improve our products and the AI models that power them**,
> including training and evaluating models.
>
> **What we remove first.** Before this data is stored for model improvement, we
> automatically remove direct personal identifiers we can detect — email
> addresses, phone numbers, government and payment identifiers, secrets and API
> keys, and your name where we know it. We do not use the *content of secrets or
> credentials* you connect to build your app for model training; those are
> resolved server-side and never enter the training record.
>
> **Your controls.** You can request a copy or deletion of your interaction data
> as described in our Privacy Policy. Deleting your account removes your
> interaction data from future training runs (models already trained cannot be
> un-trained, but the underlying records are removed from the corpus).

## Enterprise opt-out (honored end-to-end)

> **Enterprise data controls.** Organizations on an Enterprise plan may turn OFF
> use of their interaction data for model improvement. When this control is off,
> we still record the minimum operational telemetry needed to run and secure the
> service, but those records are **quarantined and never used to train or
> evaluate models**, and are never sold or shared for that purpose.

**Technical enforcement of the opt-out (must match the words above):**

- Every record carries a `consent` flag and a `consent_basis`
  (`src/lib/flight-recorder/schema.ts`).
- The enterprise opt-out resolves to `consent=false`
  (`resolveConsent` → tenant flag seam, `src/lib/flight-recorder/consent.ts`,
  wired to the real tenant field at SHIP-BRAND — deviation D6).
- `consent=false` records are written ONLY to a separate **quarantine** sink and
  are physically absent from the training sink
  (`FlightRecorderWriter`, proven by `tests/unit/flight-recorder/consent.test.ts`).
- The training corpus a model ever reads is the training sink only.

## Scope + honesty notes for counsel

1. **PII removal is high-precision, not exhaustive NER.** We reliably strip
   emails, phones, SSNs, payment cards, a broad family of secret/key shapes, and
   the actor's known name/email. We do NOT claim to catch every possible personal
   name written in free text (open-vocabulary name detection is a later
   enhancement). The clause should not over-promise "all personal data removed."
2. **Secrets/credentials are excluded from training by construction** (INV-19):
   the graph holds capability *references*; raw credentials never enter a record.
3. **Retention + deletion** language should reference the actual corpus storage
   (append-only NDJSON → Parquet on R2, partitioned by day) so a deletion request
   maps to a concrete operation.
4. **Third-party model providers.** While the platform uses rented models
   (Anthropic, etc.) the DPA should reflect their data-use terms for prompts we
   send; the training grant here concerns Prism's OWN corpus and models.
5. **Regional law.** GDPR/CCPA/CPRA lawful-basis, DPA, and cross-border transfer
   language is counsel's to add; this draft only states product intent.

## Status

- [ ] Reviewed by legal counsel
- [ ] Reconciled with Privacy Policy + DPA
- [ ] Enterprise opt-out UI wired to `consent=false` (SHIP-BRAND, D6)
- [ ] Data subject access / deletion runbook mapped to corpus storage
