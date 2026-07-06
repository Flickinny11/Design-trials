// PRISM FLIGHT RECORDER — public emit API (W-FR).
//
// The ONE surface the wiring call sites import. Each `record*` helper:
//   1. resolves consent (sync, D6),
//   2. assembles the typed record + envelope (id, schema_version, timestamps),
//   3. SCRUBS at write (I-PII / I-SECRETS) with the actor's known identifiers,
//   4. re-stamps the structural invariants (so a scrub can never corrupt them),
//   5. enqueues fire-and-forget on the fail-open writer (I-FAILOPEN).
//
// Every helper is SYNCHRONOUS and returns void — a call site adds one line and is
// never slowed or blocked by recording. Recorder failure returns silently.
//
// NOT `server-only`: the writer + sinks are plain node so the compaction script
// and unit tests import them directly. Call sites are all server-side routes.

import {
  FLIGHT_RECORDER_SCHEMA_VERSION,
  type BuildSessionRecord,
  type CapabilityUsageRecord,
  type EditEventRecord,
  type FlightRecord,
  type GenAiAttributes,
  type NodeAttemptRecord,
  type PrismAttributes,
  type PrismTouchpoint,
  type RecordEnvelope,
  type UserSignalRecord,
  type VerifySignalRecord,
} from './schema';
import { resolveConsent } from './consent';
import { makeRecordId } from './ids';
import { scrubValue } from './scrub';
import { FlightRecorderWriter, type WriterStats } from './writer';

// ─── Singleton writer (one per server process) ────────────────────────────────
let writer: FlightRecorderWriter | null = null;
export function getWriter(): FlightRecorderWriter {
  if (!writer) writer = new FlightRecorderWriter();
  return writer;
}
/** Test seam: swap the writer (e.g. manual-flush + injected sinks). */
export function __setWriter(w: FlightRecorderWriter | null): void {
  writer = w;
}

// ─── Actor / scope context threaded through every emit ────────────────────────
export interface RecordActor {
  tenantId?: string;
  userRef?: string; // opaque — never a raw email
  projectId?: string;
  sessionId?: string;
  /** Explicit consent override (enterprise opt-out flows pass false). */
  consentOverride?: boolean;
  /** The actor's real personal identifiers (name, email) to redact from free
   *  text. The recorder always has these server-side; the scrub redacts them
   *  exactly (precise name removal without open-vocab NER). */
  actorIdentifiers?: string[];
}

/** Fields shared by every emit input (envelope + scope + attribute bags). */
export interface EmitCommon {
  actor?: RecordActor;
  touchpoint: PrismTouchpoint;
  createdAt?: string;
  endedAt?: string;
  otel?: GenAiAttributes;
  prism?: PrismAttributes;
}

/** Build the shared envelope from an emit input. */
function buildEnvelope(common: EmitCommon, recordType: FlightRecord['record_type']): RecordEnvelope {
  const actor = common.actor ?? {};
  const consent = resolveConsent({ tenantId: actor.tenantId, override: actor.consentOverride });
  return {
    schema_version: FLIGHT_RECORDER_SCHEMA_VERSION,
    record_id: makeRecordId(),
    record_type: recordType,
    touchpoint: common.touchpoint,
    created_at: common.createdAt ?? new Date().toISOString(),
    ended_at: common.endedAt,
    consent: consent.consent,
    consent_basis: consent.basis,
    tenant_id: actor.tenantId,
    user_ref: actor.userRef,
    project_id: actor.projectId,
    session_id: actor.sessionId,
    otel: common.otel,
    prism: common.prism,
  };
}

/** Scrub → re-stamp structural invariants → enqueue. The single write path. */
function finalize(record: FlightRecord, env: RecordEnvelope, knownIds: string[]): void {
  try {
    const scrubbed = scrubValue(record, knownIds) as FlightRecord;
    const safe: FlightRecord = {
      ...scrubbed,
      // Structural invariants a scrub must never corrupt. These are server-
      // generated ids/keys (never user PII), re-stamped so they survive as
      // stable join keys — tenant_id / user_ref are deliberately NOT re-stamped
      // (they stay scrubbed, in case a raw email is ever passed by mistake).
      schema_version: FLIGHT_RECORDER_SCHEMA_VERSION,
      record_id: env.record_id,
      record_type: env.record_type,
      touchpoint: env.touchpoint,
      created_at: env.created_at,
      ended_at: env.ended_at,
      session_id: env.session_id,
      project_id: env.project_id,
      consent: env.consent,
      consent_basis: env.consent_basis,
    } as FlightRecord;
    getWriter().enqueue(safe);
  } catch {
    // Fail-open: scrub/enqueue must never break a build.
  }
}

// ─── Typed emit helpers (one per record type) ─────────────────────────────────

export function recordBuildSession(
  input: EmitCommon & Partial<Pick<BuildSessionRecord, 'app_name' | 'direction_id' | 'plan_origin' | 'hub_count' | 'node_count' | 'repaired_count' | 'sla_tier' | 'outcome' | 'verified_shippable'>>,
): void {
  try {
    const env = buildEnvelope(input, 'build_session');
    const record: BuildSessionRecord = {
      ...env,
      record_type: 'build_session',
      app_name: input.app_name,
      direction_id: input.direction_id,
      plan_origin: input.plan_origin,
      hub_count: input.hub_count,
      node_count: input.node_count,
      repaired_count: input.repaired_count,
      sla_tier: input.sla_tier,
      outcome: input.outcome,
      verified_shippable: input.verified_shippable,
    };
    finalize(record, env, input.actor?.actorIdentifiers ?? []);
  } catch { /* fail-open */ }
}

export function recordNodeAttempt(
  input: EmitCommon & Partial<Pick<NodeAttemptRecord, 'spec' | 'succeeded'>>,
): void {
  try {
    const env = buildEnvelope(input, 'node_attempt');
    const record: NodeAttemptRecord = { ...env, record_type: 'node_attempt', spec: input.spec, succeeded: input.succeeded };
    finalize(record, env, input.actor?.actorIdentifiers ?? []);
  } catch { /* fail-open */ }
}

export function recordEditEvent(
  input: EmitCommon & Partial<Pick<EditEventRecord, 'before' | 'after' | 'plan_ref' | 'applied_count'>>,
): void {
  try {
    const env = buildEnvelope(input, 'edit_event');
    const record: EditEventRecord = { ...env, record_type: 'edit_event', before: input.before, after: input.after, plan_ref: input.plan_ref, applied_count: input.applied_count };
    finalize(record, env, input.actor?.actorIdentifiers ?? []);
  } catch { /* fail-open */ }
}

export function recordCapabilityUsage(
  input: EmitCommon & Partial<Pick<CapabilityUsageRecord, 'capability_id' | 'job_id' | 'result_asset_ref' | 'ok'>>,
): void {
  try {
    const env = buildEnvelope(input, 'capability_usage');
    const record: CapabilityUsageRecord = { ...env, record_type: 'capability_usage', capability_id: input.capability_id, job_id: input.job_id, result_asset_ref: input.result_asset_ref, ok: input.ok };
    finalize(record, env, input.actor?.actorIdentifiers ?? []);
  } catch { /* fail-open */ }
}

export function recordVerifySignal(
  input: EmitCommon & Partial<Pick<VerifySignalRecord, 'gate' | 'outcome' | 'evidence'>>,
): void {
  try {
    const env = buildEnvelope(input, 'verify_signal');
    const record: VerifySignalRecord = { ...env, record_type: 'verify_signal', gate: input.gate, outcome: input.outcome, evidence: input.evidence };
    finalize(record, env, input.actor?.actorIdentifiers ?? []);
  } catch { /* fail-open */ }
}

export function recordUserSignal(
  input: EmitCommon & Partial<Pick<UserSignalRecord, 'signal' | 'detail'>>,
): void {
  try {
    const env = buildEnvelope(input, 'user_signal');
    const record: UserSignalRecord = { ...env, record_type: 'user_signal', signal: input.signal, detail: input.detail };
    finalize(record, env, input.actor?.actorIdentifiers ?? []);
  } catch { /* fail-open */ }
}

/** Flush + stats passthrough for the dev ledger + demo. */
export async function flushRecorder(): Promise<void> {
  await getWriter().flush();
}
export function recorderStats(): WriterStats {
  return getWriter().getStats();
}

export type { WriterStats } from './writer';
export * from './schema';
