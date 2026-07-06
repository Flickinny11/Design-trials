// PRISM SHELL-W10 — LIVE FLUX 2 Pro PBR-material adapter. Server-only.
//
// Reuses (does NOT fork) the committed `.assetgen/gen-material.sh` pipeline — the
// same FLUX-2-Pro tileable plate + matched-latent de-lit PBR derive that
// /api/material-gen already spawns. All FLUX REST lives in that committed client
// (INV-NEV2-4); the Replicate key is read ONLY by the child (INV-19). Live when
// the script + key are present; otherwise the demo-safe path serves a committed
// material set.
import 'server-only';
import type {
  GenerativeCapabilityAdapter, GenerativeCapabilityDescriptor, GenerativeJob,
  GenerativeSubmitInput, GenerativeAssetRef,
} from '../../../lib/capabilities/generative';
import { GENERATIVE_CATALOG, GENERATIVE_BY_ID } from '../../../lib/capabilities/generative-catalog';
import { GEN_MATERIAL_SCRIPT, REPLICATE_KEY, ASSETGEN_DIR, hasFile, newJobId, spawnCapture } from './pipeline';
import { putJob, patchJob, getJob } from './job-store';
import { recordUsage } from './usage-ledger';

const CAPS = GENERATIVE_CATALOG.filter((c) => c.adapterId === 'flux');
const USER = 'local-user';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'material';
}

function texUrl(id: string, file: string): string {
  return `/prism-mock/editor/textures/generated/${id}/${file}`;
}

function materialResult(id: string, kind: string, label: string, demo: boolean): GenerativeAssetRef {
  // gen-material.sh writes: albedo.png (de-lit), normal.png, rough.png, metal.png, ao.png.
  return {
    kind: 'material', url: texUrl(id, 'albedo.png'), label,
    meta: { family: kind, albedo: texUrl(id, 'albedo.png'), normal: texUrl(id, 'normal.png'), roughness: texUrl(id, 'rough.png'), metallic: texUrl(id, 'metal.png'), ao: texUrl(id, 'ao.png'), demo },
  };
}

export class FluxMaterialAdapter implements GenerativeCapabilityAdapter {
  readonly id = 'flux';
  get live(): boolean { return hasFile(GEN_MATERIAL_SCRIPT) && hasFile(REPLICATE_KEY); }

  listCapabilities(): GenerativeCapabilityDescriptor[] {
    const live = this.live;
    return CAPS.map((c) => ({ ...c, live }));
  }

  async submit(input: GenerativeSubmitInput): Promise<GenerativeJob> {
    const desc = GENERATIVE_BY_ID[input.capabilityId];
    if (!desc || desc.adapterId !== 'flux') throw new Error(`unknown flux capability ${input.capabilityId}`);
    if (!input.params.prompt) throw new Error('missing required param "prompt"');
    const demo = input.params.__demo === true || !this.live;
    const now = new Date().toISOString();
    const job: GenerativeJob = {
      jobId: newJobId('flux'), capabilityId: desc.capabilityId, adapterId: 'flux', model: desc.model,
      status: 'queued', progress: 0, submittedAt: now, updatedAt: now,
      nodeId: input.nodeId, projectId: input.projectId, live: !demo,
    };
    await putJob(job);
    if (demo) void this.runDemo(job, desc);
    else void this.runLive(job, desc, input);
    return job;
  }

  async poll(jobId: string): Promise<GenerativeJob> {
    const j = await getJob(jobId);
    if (!j) throw new Error(`job ${jobId} not found`);
    return j;
  }

  private async runDemo(job: GenerativeJob, desc: GenerativeCapabilityDescriptor): Promise<void> {
    await patchJob(job.jobId, { status: 'running', progress: 30 });
    await sleep(500);
    await patchJob(job.jobId, { progress: 75 });
    await sleep(400);
    const result = materialResult('demo-flux-brass', 'metal', 'Hammered antique brass · FLUX 2 Pro', true);
    const cost = { unit: desc.costBasis.unit, amount: desc.costBasis.estimate, estimated: true };
    await patchJob(job.jobId, { status: 'succeeded', progress: 100, result, cost });
    await this.meter(job, desc, result, cost);
  }

  private async runLive(job: GenerativeJob, desc: GenerativeCapabilityDescriptor, input: GenerativeSubmitInput): Promise<void> {
    const prompt = String(input.params.prompt ?? '');
    const kind = String(input.params.kind ?? 'generic');
    const id = slugify(prompt);
    const seed = String(7 + (id.length * 7) % 900);
    await patchJob(job.jobId, { status: 'running', progress: 20 });
    const res = await spawnCapture('bash', [GEN_MATERIAL_SCRIPT, prompt, id, kind, seed], { cwd: ASSETGEN_DIR, timeoutMs: 300_000 }, (line) => {
      if (line.includes('FLUX')) void patchJob(job.jobId, { progress: 45 });
      if (line.includes('derive')) void patchJob(job.jobId, { progress: 75 });
    });
    if (res.code !== 0 || !res.out.includes('MATERIAL-GEN-DONE')) {
      await patchJob(job.jobId, { status: 'failed', error: `material gen failed (code ${res.code}): ${res.err.slice(-240) || res.out.slice(-240)}` });
      await this.meterFail(job, desc, res.out.includes('FLUX')); // spent iff the FLUX call started
      return;
    }
    const result = materialResult(id, kind, `${prompt} · FLUX 2 Pro`, false);
    const cost = { unit: desc.costBasis.unit, amount: desc.costBasis.estimate, estimated: true };
    await patchJob(job.jobId, { status: 'succeeded', progress: 100, result, cost });
    await this.meter(job, desc, result, cost);
  }

  private async meter(job: GenerativeJob, desc: GenerativeCapabilityDescriptor, result: GenerativeAssetRef | null, cost: { unit: 'credits' | 'usd'; amount: number; estimated: boolean }, ok = true): Promise<void> {
    await recordUsage({
      id: `use-${job.jobId}`, capabilityId: desc.capabilityId, model: desc.model, provider: 'flux',
      userId: USER, projectId: job.projectId, nodeId: job.nodeId, jobId: job.jobId,
      costBasis: cost, resultAssetRef: result?.url, live: job.live, ok, at: new Date().toISOString(),
    });
  }

  private async meterFail(job: GenerativeJob, desc: GenerativeCapabilityDescriptor, spent: boolean): Promise<void> {
    await this.meter(job, desc, null, { unit: desc.costBasis.unit, amount: spent ? desc.costBasis.estimate : 0, estimated: true }, false);
  }
}
