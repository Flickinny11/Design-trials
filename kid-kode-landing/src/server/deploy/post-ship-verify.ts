// PRISM SHELL — POST-SHIP VERIFICATION (SHELL W5B / E15 · §11.2, 2026-07-05)
//
// After a deploy lands, §11.2 requires verifying the LIVE shipped artifact —
// not that the deploy record was written, but that the shipped URL/endpoint
// actually works. Two checks, keyed off the host's `postShipCheck`:
//
//   • frontend (`http-reachable`) — the shipped app is reachable and serves the
//     project's graph. For `prism-cloud`/dry-run the shipped artifact is this
//     app's token-guarded `/preview/[projectId]` route; reachability is proven
//     by resolving the token to its pinned snapshot (readPreviewGraph) — a real
//     round-trip through the exact code the route runs. For a live external
//     host with a `productionUrl`, an injected fetcher does a real HTTP GET.
//
//   • backend (`inference-roundtrip`) — the shipped model endpoint answers a
//     REAL inference call. In dry-run the endpoint is backed by the
//     deterministic reference model (runReferenceInference); the latch sends
//     the contract's fixture and validates the response shape. Live → the same
//     round-trip against the host endpoint (env-gated; injected runner).
//
// This is the server §11.2 layer (W5B-D1). The browser harness + advocate still
// drive the shipped preview visually. The fetcher/runner are injectable so the
// headless suite exercises the same code path with no live server.

import 'server-only';
import type {
  DeployRecord,
  InferenceContract,
  InferenceResult,
  VerifyCheck,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import { readPreviewGraph } from '../conductor/preview-tokens';
import { runReferenceInference, validateInferenceResult } from './reference-model';

export interface PostShipOptions {
  /** Live external HTTP probe (frontend productionUrl / live backend endpoint).
   *  Injected so the headless suite runs in-process; defaults to global fetch. */
  fetcher?: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
  /** Override the inference runner (live backend). Default = reference model. */
  runInference?: (contract: InferenceContract, input: string) => Promise<InferenceResult> | InferenceResult;
}

/** §11.2 reachability of a frontend deploy's shipped artifact. */
async function verifyReachable(record: DeployRecord, opts: PostShipOptions): Promise<VerifyCheck> {
  // Live external host → a real HTTP GET against its production URL.
  if (record.mode === 'live' && record.productionUrl && opts.fetcher) {
    try {
      const res = await opts.fetcher(record.productionUrl, { method: 'GET' });
      const ok = res.ok;
      return {
        status: ok ? 'pass' : 'fail',
        label: 'Post-ship — shipped app reachable (§11.2)',
        evidence: [`GET ${record.productionUrl} → ${res.status}`, `host: ${record.kind} · live`],
        detail: ok ? undefined : `Host returned ${res.status}.`,
      };
    } catch (err) {
      return {
        status: 'fail',
        label: 'Post-ship — shipped app reachable (§11.2)',
        evidence: [`GET ${record.productionUrl} failed: ${err instanceof Error ? err.message : 'error'}`],
      };
    }
  }

  // prism-cloud / dry-run → the shipped artifact is our token-guarded preview.
  // Resolve the token to the pinned snapshot: proves the exact route the share
  // link runs actually serves the shipped graph (a real round-trip, no HTTP).
  const resolved = await readPreviewGraph(record.token);
  if (!resolved) {
    return {
      status: 'fail',
      label: 'Post-ship — shipped preview reachable (§11.2)',
      evidence: [`preview token did not resolve to a snapshot`, `url: ${record.previewUrl}`],
    };
  }
  const nodeCount = Array.isArray((resolved.graph as { nodes?: unknown[] }).nodes)
    ? (resolved.graph as { nodes: unknown[] }).nodes.length
    : 0;
  return {
    status: 'pass',
    label: 'Post-ship — shipped preview reachable (§11.2)',
    evidence: [
      `resolved ${record.previewUrl.replace(/\?t=.*/, '?t=…')}`,
      `served graph: ${nodeCount} node(s) from pinned snapshot`,
      `mode: ${record.mode} · host: ${record.kind}`,
    ],
    detail: record.mode === 'dry-run'
      ? 'Env-gated host — the token-guarded Prism Cloud preview is the reachable artifact; set the host token to ship live.'
      : undefined,
  };
}

/** §11.2 real inference round-trip against a backend deploy's endpoint. */
async function verifyInference(record: DeployRecord, opts: PostShipOptions): Promise<VerifyCheck> {
  const contract = record.inferenceContract ?? null;
  if (!contract) {
    return {
      status: 'fail',
      label: 'Post-ship — inference endpoint round-trip (§11.2)',
      evidence: ['backend deploy is missing an inference contract'],
    };
  }
  try {
    const runner = opts.runInference ?? runReferenceInference;
    const result = await runner(contract, contract.sampleInput);
    const valid = validateInferenceResult(contract, result);
    return {
      status: valid.ok ? 'pass' : 'fail',
      label: 'Post-ship — inference endpoint round-trip (§11.2)',
      evidence: [
        `POST ${record.endpointUrl?.replace(/\?t=.*/, '?t=…') ?? '(endpoint)'}`,
        `model: ${contract.model} (${result.mode})`,
        `in: "${contract.sampleInput.slice(0, 48)}" → out: ${result.output.slice(0, 60)}`,
        result.score != null ? `score: ${result.score} · ${result.latencyMs}ms` : `${result.latencyMs}ms`,
      ],
      detail: valid.ok
        ? (result.mode === 'dry-run'
          ? 'Dry-run: the deployed endpoint is backed by a deterministic OSS reference model; set the host token to run the live model.'
          : undefined)
        : `Invalid inference response: ${valid.reason}`,
    };
  } catch (err) {
    return {
      status: 'fail',
      label: 'Post-ship — inference endpoint round-trip (§11.2)',
      evidence: [`inference failed: ${err instanceof Error ? err.message : 'error'}`],
    };
  }
}

/** Run §11.2 post-ship verification against the shipped artifact. */
export async function postShipVerify(
  record: DeployRecord,
  opts: PostShipOptions = {},
): Promise<VerifyCheck> {
  if (record.category === 'backend') return verifyInference(record, opts);
  return verifyReachable(record, opts);
}
