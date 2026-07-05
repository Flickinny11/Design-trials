// PRISM NODE-EDITOR V2 — POST /api/prism/prompt-edit (criteria A).
//
// The canvas "Prompt Edit" action and the node editor's own prompt-edit both
// POST here. The route INJECTS the premium catalogs server-side (A3), runs the
// orchestrator (live Opus when keyed, deterministic stub otherwise — A6), and
// returns the structured PromptEditPlan. It NEVER returns secrets and NEVER
// mutates the graph — the client applies the validated plan via applyPlan.
import { getOrchestrator } from '@/server/orchestration/get-orchestrator';
import { buildCatalogContext, extractAtTags } from '@/lib/prompt-edit/catalog-context';
import type { PromptEditRequest, PromptEditScope } from '@/lib/prompt-edit/contract';

export const runtime = 'nodejs';

const SCOPES: PromptEditScope[] = ['canvas', 'node-function', 'node-integration', 'node-schema', 'node-behavior', 'node-backend'];

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { 'content-type': 'application/json' } });
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err('invalid JSON body');
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return err('prompt is required');
  if (prompt.length > 4000) return err('prompt too long (max 4000 chars)');

  const scope: PromptEditScope = SCOPES.includes(body.scope as PromptEditScope) ? (body.scope as PromptEditScope) : 'canvas';
  const selRaw = (body.selection ?? {}) as { nodeIds?: unknown; hubId?: unknown };
  const nodeIds = Array.isArray(selRaw.nodeIds) ? selRaw.nodeIds.filter((x): x is string => typeof x === 'string') : [];
  const hubId = typeof selRaw.hubId === 'string' ? selRaw.hubId : undefined;
  const nodes = Array.isArray(body.nodes) ? (body.nodes as PromptEditRequest['nodes']) : [];

  const atTags = extractAtTags(prompt);
  const request: PromptEditRequest = {
    prompt,
    scope,
    selection: { nodeIds, hubId },
    context: buildCatalogContext(atTags),
    nodes,
  };

  try {
    const orchestrator = getOrchestrator();
    const plan = await orchestrator.plan(request);
    return new Response(JSON.stringify({ ok: true, plan, prompt }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return err(`orchestration failed: ${(e as Error).message}`, 500);
  }
}
