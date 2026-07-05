// PRISM SHELL — REFERENCE INFERENCE MODEL (SHELL W5B / E15·E19, 2026-07-05)
//
// A deterministic, offline open-source-class reference model that stands in for
// a small OSS endpoint (e.g. a DistilBERT-SST2 sentiment head or a MiniLM
// embedding model) when a backend/GPU host token is ABSENT (dry-run). It runs
// entirely in-process — no GPU, no network — so a backend deploy can be proven
// end-to-end and the post-ship latch can validate a REAL inference round-trip
// against a genuinely reachable endpoint (W5B-D2). When a host token IS present
// the deploy proxies to the live host instead; this reference is the dry-run
// path only, always labeled `dry-run` in its result.
//
// Determinism: the same input always yields the same output (no Math.random,
// no Date.now) so the round-trip is reproducible in the headless suite.

import type {
  InferenceContract,
  InferenceResult,
} from '../../../packages/shared-interfaces/src/prism-conductor';

// A tiny, transparent lexicon — this is a REFERENCE stand-in, not a trained
// model; it is honest about being deterministic.
const POSITIVE = ['love', 'great', 'excellent', 'amazing', 'good', 'happy', 'best', 'wonderful', 'fast', 'beautiful', 'delight'];
const NEGATIVE = ['hate', 'terrible', 'awful', 'bad', 'slow', 'broken', 'worst', 'buggy', 'ugly', 'crash', 'fail'];

/** Stable 32-bit hash (FNV-1a) — deterministic, workflow-safe. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic pseudo-latency (ms) derived from input length — evidence only,
 *  never a timing guarantee. */
function refLatency(input: string): number {
  return 8 + (input.length % 40);
}

function sentiment(text: string): { label: string; score: number } {
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let pos = 0;
  let neg = 0;
  for (const w of words) {
    if (POSITIVE.includes(w)) pos += 1;
    if (NEGATIVE.includes(w)) neg += 1;
  }
  if (pos === 0 && neg === 0) {
    // No lexicon hit — fall back to a stable hash-derived lean so the result is
    // still deterministic and non-degenerate.
    const lean = (fnv1a(text) % 100) / 100;
    return { label: lean >= 0.5 ? 'POSITIVE' : 'NEGATIVE', score: 0.5 + Math.abs(lean - 0.5) * 0.5 };
  }
  const total = pos + neg;
  const score = Math.max(pos, neg) / total;
  return { label: pos >= neg ? 'POSITIVE' : 'NEGATIVE', score: Math.min(0.99, 0.5 + score * 0.49) };
}

/** A stable 8-dim unit-ish embedding from the input hash (a MiniLM stand-in). */
function embed(text: string): number[] {
  const seed = fnv1a(text);
  const dims: number[] = [];
  let s = seed;
  for (let i = 0; i < 8; i++) {
    s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) >>> 0;
    dims.push(Number((((s % 2000) - 1000) / 1000).toFixed(3)));
  }
  return dims;
}

/** Run one inference against the reference model per the endpoint's contract.
 *  Pure + deterministic; the same function backs both the HTTP endpoint route
 *  and the post-ship latch's in-process round-trip. */
export function runReferenceInference(
  contract: InferenceContract,
  input: string,
): InferenceResult {
  const latencyMs = refLatency(input);
  const base = { mode: 'dry-run' as const, model: contract.model, latencyMs };

  switch (contract.outputKind) {
    case 'label': {
      const { label, score } = sentiment(input);
      return { ...base, outputKind: 'label', output: label, score: Number(score.toFixed(3)) };
    }
    case 'embedding': {
      const v = embed(input);
      return { ...base, outputKind: 'embedding', output: `[${v.join(', ')}]`, score: null };
    }
    case 'text': {
      // A deterministic "summary": first 12 words, capitalized — a stand-in for
      // a small seq2seq head.
      const summary = input.split(/\s+/).slice(0, 12).join(' ').trim();
      return { ...base, outputKind: 'text', output: summary.length > 0 ? summary : '(empty)', score: null };
    }
    case 'json':
    default: {
      const { label, score } = sentiment(input);
      return {
        ...base,
        outputKind: 'json',
        output: JSON.stringify({ label, score: Number(score.toFixed(3)), tokens: input.split(/\s+/).length }),
        score: Number(score.toFixed(3)),
      };
    }
  }
}

/** Is a reference result well-formed for its contract? The post-ship latch uses
 *  this to assert the round-trip actually produced a valid inference. */
export function validateInferenceResult(
  contract: InferenceContract,
  result: InferenceResult,
): { ok: boolean; reason: string | null } {
  if (result.outputKind !== contract.outputKind) {
    return { ok: false, reason: `outputKind ${result.outputKind} ≠ contract ${contract.outputKind}` };
  }
  if (result.output.length === 0) return { ok: false, reason: 'empty output' };
  if (contract.outputKind === 'label' && (result.score == null || result.score <= 0)) {
    return { ok: false, reason: 'label result missing a score' };
  }
  if (contract.outputKind === 'embedding') {
    const dims = result.output.replace(/[[\]]/g, '').split(',').filter((s) => s.trim().length > 0);
    if (dims.length < 4) return { ok: false, reason: `embedding too short (${dims.length} dims)` };
  }
  return { ok: true, reason: null };
}
