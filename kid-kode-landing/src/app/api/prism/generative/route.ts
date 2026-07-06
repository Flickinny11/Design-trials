// PRISM SHELL-W10 — POST /api/prism/generative. Server-only entry for the
// Generate capability family (object generation, texturing, rig, segmentation,
// PBR material, world, mesh-ops).
//
// The client never imports an adapter (INV-NEV2-4) — it calls this route, which
// dispatches to the active generative adapter via the registry. Vendor keys are
// read ONLY inside the spawned vendor clients (INV-19); nothing secret is ever
// returned. Every response carries only non-secret job/asset REFERENCES.
import {
  getAdapterForCapability,
  listAllCapabilities,
} from '@/server/capabilities/generative/registry';
import { getJob, listJobs } from '@/server/capabilities/generative/job-store';
import { listUsage } from '@/server/capabilities/generative/usage-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { 'content-type': 'application/json' } });
}
function ok(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...data }), { status: 200, headers: { 'content-type': 'application/json' } });
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return err('invalid JSON body'); }
  const op = typeof body.op === 'string' ? body.op : '';

  try {
    switch (op) {
      case 'listCapabilities':
        return ok({ capabilities: listAllCapabilities() });

      case 'submit': {
        const capabilityId = typeof body.capabilityId === 'string' ? body.capabilityId : '';
        if (!capabilityId) return err('capabilityId required');
        const adapter = getAdapterForCapability(capabilityId);
        if (!adapter) return err(`no adapter for capability ${capabilityId}`, 404);
        const params = (body.params ?? {}) as Record<string, unknown>;
        const job = await adapter.submit({
          capabilityId,
          params,
          userId: typeof body.userId === 'string' ? body.userId : undefined,
          projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
          nodeId: typeof body.nodeId === 'string' ? body.nodeId : undefined,
        });
        return ok({ job });
      }

      case 'poll': {
        const jobId = typeof body.jobId === 'string' ? body.jobId : '';
        if (!jobId) return err('jobId required');
        const job = await getJob(jobId);
        if (!job) return err(`job ${jobId} not found`, 404);
        return ok({ job });
      }

      case 'jobs': {
        const jobs = await listJobs({
          projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
          nodeId: typeof body.nodeId === 'string' ? body.nodeId : undefined,
        });
        return ok({ jobs });
      }

      case 'ledger': {
        const ledger = await listUsage({
          userId: typeof body.userId === 'string' ? body.userId : undefined,
          projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
        });
        return ok({ ledger });
      }

      default:
        return err(`unknown op "${op}"`);
    }
  } catch (e) {
    return err(`generative op failed: ${(e as Error).message}`, 500);
  }
}
