// PRISM NODE-EDITOR V2 — POST /api/prism/capabilities (criteria B + C).
//
// The single server entry for the Functions + Integrations tabs. The client
// never imports an adapter (INV-NEV2-4) — it calls this route, which dispatches
// to the active CapabilityProvider (MCP reference adapter by default). Auth
// yields a capability REFERENCE only; no raw secret is ever returned (INV-R13).
import { getCapabilityProvider } from '@/server/capabilities/capability-provider';
import type { IntegrationAuthMethod, CapabilityRef } from '@/lib/prism-graph/types';

export const runtime = 'nodejs';

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { 'content-type': 'application/json' } });
}
function ok(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...data }), { status: 200, headers: { 'content-type': 'application/json' } });
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err('invalid JSON body');
  }
  const op = typeof body.op === 'string' ? body.op : '';
  const provider = getCapabilityProvider();

  try {
    switch (op) {
      case 'searchActions': {
        const q = typeof body.query === 'string' ? body.query : '';
        const tiles = await provider.searchActions(q, 24);
        return ok({ provider: provider.id, live: provider.live, tiles });
      }
      case 'validateAction': {
        const actionId = typeof body.actionId === 'string' ? body.actionId : '';
        if (!actionId) return err('actionId required');
        const params = (body.params ?? {}) as Record<string, unknown>;
        const result = await provider.validateAction({ actionId, params });
        return ok({ result });
      }
      case 'searchPlatforms': {
        const q = typeof body.query === 'string' ? body.query : '';
        const platforms = await provider.searchPlatforms(q, 24);
        return ok({ provider: provider.id, live: provider.live, platforms });
      }
      case 'connect': {
        const platformId = typeof body.platformId === 'string' ? body.platformId : '';
        const method = body.method as IntegrationAuthMethod;
        if (!platformId || !method) return err('platformId + method required');
        const result = await provider.connect({ platformId, method });
        // Defense-in-depth: never let a raw token field escape the route.
        if (result.capabilityRef) result.capabilityRef = redactRef(result.capabilityRef);
        return ok({ result });
      }
      case 'listAssets': {
        const platformId = typeof body.platformId === 'string' ? body.platformId : '';
        const capabilityRef = body.capabilityRef as CapabilityRef;
        if (!platformId || !capabilityRef) return err('platformId + capabilityRef required');
        const assets = await provider.listAssets({ platformId, capabilityRef });
        return ok({ assets });
      }
      default:
        return err(`unknown op "${op}"`);
    }
  } catch (e) {
    return err(`capability op failed: ${(e as Error).message}`, 500);
  }
}

// Strip anything that looks like a raw secret from a capability reference before
// it leaves the server (INV-NEV2-2 / INV-R13). The ref is an opaque handle.
function redactRef(ref: CapabilityRef): CapabilityRef {
  const SECRET_KEYS = /token|secret|key|password|credential|bearer/i;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ref)) {
    if (SECRET_KEYS.test(k)) continue;
    clean[k] = v;
  }
  return clean as unknown as CapabilityRef;
}
