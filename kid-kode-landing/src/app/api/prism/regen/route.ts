// HL06 — POST /api/prism/regen
//
// Plan ref: §P6. Two actions on a single endpoint:
//   - 'persist'      → atomic-write public/prism-mock/home/live-graph.json
//                      (validates each node via plan-output-hook before writing).
//   - 'verify-node'  → applyPlanRendererDefaults + validatePlanRendererFields
//                      + verifyNodeModule (when codeModule is provided).
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §10 (verifier rules).
//
// The endpoint is consumed by:
//   - useGraphSourceStore.saveToServer()        (persist)
//   - regen-api.saveAndVerify(node, codeModule) (verify-node)

import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

import {
  applyPlanRendererDefaults,
  validatePlanRendererFields,
} from '@/lib/prism/codegen/plan-output-hook';
import {
  verifyNodeModule,
  type VerifierViolation,
} from '@/lib/prism/codegen/verifier';
import type { PrismNode } from '@/lib/prism-graph/types';

export const runtime = 'nodejs';

const LIVE_GRAPH_REL = ['public', 'prism-mock', 'home', 'live-graph.json'];

type VerifierStatus = 'clean' | 'warning' | 'error';

interface RegenResponseBody {
  ok: boolean;
  verifierStatus?: VerifierStatus;
  regeneratedAt?: string;
  violations?: VerifierViolation[];
  error?: string;
}

function statusFromViolations(violations: VerifierViolation[]): VerifierStatus {
  if (violations.some((v) => v.severity === 'error')) return 'error';
  if (violations.some((v) => v.severity === 'warning')) return 'warning';
  return 'clean';
}

function jsonResponse(body: RegenResponseBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface PersistBody {
  action: 'persist';
  graph?: unknown;
}

interface VerifyNodeBody {
  action: 'verify-node';
  node?: unknown;
  codeModule?: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function handlePersist(body: PersistBody): Promise<Response> {
  // FIDELITY-2 W3 (INV-18 additive): accept EITHER the legacy `hub` singular
  // OR the multi-hub `hubs` array (non-empty). The atomic write below spreads
  // `body.graph` over the existing file, so whichever form the payload
  // carried (`hub`, `hubs`, or both) is persisted verbatim.
  if (!isPlainObject(body.graph) || !Array.isArray(body.graph.nodes)) {
    return jsonResponse(
      { ok: false, error: 'persist: body.graph must include hub (or non-empty hubs[]) and nodes[]' },
      400,
    );
  }
  const hasHub = isPlainObject(body.graph.hub);
  const hasHubs = Array.isArray(body.graph.hubs) && body.graph.hubs.length > 0;
  if (!hasHub && !hasHubs) {
    return jsonResponse(
      { ok: false, error: 'persist: body.graph must include hub (or non-empty hubs[]) and nodes[]' },
      400,
    );
  }

  const inputNodes = body.graph.nodes as Array<Partial<PrismNode>>;
  const violations: VerifierViolation[] = [];
  const normalizedNodes = inputNodes.map((n) => {
    const norm = applyPlanRendererDefaults(n);
    violations.push(...validatePlanRendererFields(norm as PrismNode));
    return norm;
  });

  const regeneratedAt = new Date().toISOString();

  if (violations.some((v) => v.severity === 'error')) {
    return jsonResponse({
      ok: false,
      verifierStatus: 'error',
      regeneratedAt,
      violations,
    });
  }

  // EBR2-E-04 fix — preserve top-level fields the wire payload doesn't carry
  // (e.g. `_comment`, future canonical-seed metadata). The persist contract
  // is "graph merge over existing on-disk file", not "wire payload replaces
  // the file". Without this, every save dropped the hand-authored seed
  // documentation and any field added server-side after the client loaded.
  const target = join(process.cwd(), ...LIVE_GRAPH_REL);
  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(target, 'utf8');
    const parsed = JSON.parse(raw);
    if (isPlainObject(parsed)) existing = parsed;
  } catch {
    // Missing/unreadable existing file — fall back to wire-only payload.
  }
  const finalGraph = {
    ...existing,
    ...(body.graph as Record<string, unknown>),
    nodes: normalizedNodes,
  };
  const json = JSON.stringify(finalGraph, null, 2);
  const tmp = `${target}.tmp`;

  try {
    await writeFile(tmp, json, 'utf8');
    await rename(tmp, target);
  } catch (err) {
    return jsonResponse(
      { ok: false, error: `persist failed: ${(err as Error).message}` },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    verifierStatus: statusFromViolations(violations),
    regeneratedAt,
    violations: violations.length ? violations : undefined,
  });
}

async function handleVerifyNode(body: VerifyNodeBody): Promise<Response> {
  if (!isPlainObject(body.node)) {
    return jsonResponse(
      { ok: false, error: 'verify-node: body.node required' },
      400,
    );
  }

  const normalized = applyPlanRendererDefaults(body.node as Partial<PrismNode>);
  const planViolations = validatePlanRendererFields(normalized as PrismNode);

  let codeViolations: VerifierViolation[] = [];
  if (typeof body.codeModule === 'string' && body.codeModule.length > 0) {
    // Spec §10.C L385 gates the MISSING_TEXT_CONTENT rule on whether the
    // node ships any text. The PrismNode schema in this repo does not
    // statically expose a `textContent` field (legacy plans nest it under
    // visual.layers.textContent). Read defensively from the raw input.
    const raw = body.node as Record<string, unknown>;
    const tc = raw['textContent'];
    const hasTextContent = Array.isArray(tc) && tc.length > 0;
    const result = verifyNodeModule(body.codeModule, {
      renderMode: normalized.renderMode,
      hasTextContent,
    });
    codeViolations = result.violations;
  }

  const violations = [...planViolations, ...codeViolations];
  const verifierStatus = statusFromViolations(violations);
  const ok = verifierStatus !== 'error';

  return jsonResponse({
    ok,
    verifierStatus,
    regeneratedAt: new Date().toISOString(),
    violations: violations.length ? violations : undefined,
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid JSON body' }, 400);
  }
  if (!isPlainObject(body)) {
    return jsonResponse({ ok: false, error: 'body must be a JSON object' }, 400);
  }

  const action = body.action;
  if (action === 'persist') {
    return handlePersist(body as unknown as PersistBody);
  }
  if (action === 'verify-node') {
    return handleVerifyNode(body as unknown as VerifyNodeBody);
  }
  return jsonResponse(
    { ok: false, error: `unknown action: ${String(action)}` },
    400,
  );
}
