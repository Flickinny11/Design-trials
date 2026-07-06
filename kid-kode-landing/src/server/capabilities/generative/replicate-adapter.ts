// PRISM SHELL-W10 — LIVE Replicate adapter (alt object generation). Server-only.
//
// Object generation via Replicate-hosted models — Hunyuan 3D 3.1 and Rodin Gen-2,
// named MODEL + FUNCTION on the tiles. ALL Replicate REST lives in the committed
// vendor client `.assetgen/replicate-3d.py` (INV-NEV2-4); the key is read ONLY by
// that child (INV-19). Live when the script + key are present; otherwise the
// demo-safe offline path serves a committed real fixture.
import 'server-only';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type {
  GenerativeCapabilityAdapter, GenerativeCapabilityDescriptor, GenerativeJob,
  GenerativeSubmitInput, GenerativeAssetRef,
} from '../../../lib/capabilities/generative';
import { GENERATIVE_CATALOG, GENERATIVE_BY_ID } from '../../../lib/capabilities/generative-catalog';
import {
  REPLICATE_SCRIPT, REPLICATE_KEY, MODELS_DIR, hasFile, modelUrl, newJobId,
  ensureDir, spawnCapture, parseProgress, parseVendorTaskId, finalizeGlb,
} from './pipeline';
import { putJob, patchJob, getJob } from './job-store';
import { recordUsage } from './usage-ledger';

const CAPS = GENERATIVE_CATALOG.filter((c) => c.adapterId === 'replicate');
const USER = 'local-user';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const MODEL_SLUG: Record<string, string> = {
  'replicate.hunyuan-3d': 'tencent/hunyuan-3d-3.1',
  'replicate.rodin-gen2': 'hyper3d/rodin',
};

function demoFixture(): GenerativeAssetRef {
  return { kind: 'glb', url: modelUrl('demo-replicate-teapot'), label: 'Ceramic teapot · Hunyuan 3D', meta: { demo: true } };
}

export class ReplicateAdapter implements GenerativeCapabilityAdapter {
  readonly id = 'replicate';
  get live(): boolean { return hasFile(REPLICATE_SCRIPT) && hasFile(REPLICATE_KEY); }

  listCapabilities(): GenerativeCapabilityDescriptor[] {
    const live = this.live;
    return CAPS.map((c) => ({ ...c, live }));
  }

  async submit(input: GenerativeSubmitInput): Promise<GenerativeJob> {
    const desc = GENERATIVE_BY_ID[input.capabilityId];
    if (!desc || desc.adapterId !== 'replicate') throw new Error(`unknown replicate capability ${input.capabilityId}`);
    const demo = input.params.__demo === true || !this.live;
    const now = new Date().toISOString();
    const job: GenerativeJob = {
      jobId: newJobId('rep'), capabilityId: desc.capabilityId, adapterId: 'replicate', model: desc.model,
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
    await patchJob(job.jobId, { status: 'running', progress: 20 });
    await sleep(500);
    await patchJob(job.jobId, { progress: 65 });
    await sleep(500);
    const result = demoFixture();
    const cost = { unit: desc.costBasis.unit, amount: desc.costBasis.estimate, estimated: true };
    await patchJob(job.jobId, { status: 'succeeded', progress: 100, result, cost });
    await this.meter(job, desc, result, cost);
  }

  private async runLive(job: GenerativeJob, desc: GenerativeCapabilityDescriptor, input: GenerativeSubmitInput): Promise<void> {
    const slug = MODEL_SLUG[desc.capabilityId];
    if (!slug) { await patchJob(job.jobId, { status: 'failed', error: `no model slug for ${desc.capabilityId}` }); await this.meterFail(job, desc, false); return; }
    const jobDir = path.join(MODELS_DIR, job.jobId);
    const srcDir = path.join(jobDir, 'src');
    const srcGlb = path.join(srcDir, 'model.glb');
    await ensureDir(srcDir);
    await patchJob(job.jobId, { status: 'running', progress: 5 });

    // Build a non-secret input dict for the model.
    const P = input.params;
    const inp: Record<string, unknown> = {};
    if (P.imageUrl) inp[desc.capabilityId === 'replicate.rodin-gen2' ? 'images' : 'image'] = desc.capabilityId === 'replicate.rodin-gen2' ? [String(P.imageUrl)] : String(P.imageUrl);
    if (P.prompt) inp.prompt = String(P.prompt);
    if (desc.capabilityId === 'replicate.hunyuan-3d') inp.enable_pbr = P.enablePbr !== false;
    if (!inp.image && !inp.images && !inp.prompt) { await patchJob(job.jobId, { status: 'failed', error: 'provide an image URL or a prompt' }); await this.meterFail(job, desc, false); return; }

    let vendorTaskId: string | undefined;
    const onLine = (line: string) => {
      const p = parseProgress(line);
      if (p != null) void patchJob(job.jobId, { progress: Math.max(5, Math.min(99, p)) });
      const t = parseVendorTaskId(line);
      if (t) vendorTaskId = t;
    };

    const res = await spawnCapture('python3', [REPLICATE_SCRIPT, slug, srcGlb, JSON.stringify(inp)], { cwd: path.dirname(REPLICATE_SCRIPT), timeoutMs: 720_000 }, onLine);
    if (res.code !== 0 || !hasFile(srcGlb)) {
      await patchJob(job.jobId, { status: 'failed', error: `replicate failed (code ${res.code}): ${res.err.slice(-240) || res.out.slice(-240)}` });
      await this.meterFail(job, desc, false);
      return;
    }
    const finalPath = await finalizeGlb(srcGlb, jobDir);
    await fs.rm(srcDir, { recursive: true, force: true });
    const result: GenerativeAssetRef = { kind: 'glb', url: modelUrl(job.jobId, path.basename(finalPath)), label: `${desc.model} · ${desc.fn}`, meta: { model: desc.model } };
    const cost = { unit: desc.costBasis.unit, amount: desc.costBasis.estimate, estimated: true };
    await patchJob(job.jobId, { status: 'succeeded', progress: 100, result, cost, vendorTaskId });
    await this.meter(job, desc, result, cost);
  }

  private async meter(job: GenerativeJob, desc: GenerativeCapabilityDescriptor, result: GenerativeAssetRef | null, cost: { unit: 'credits' | 'usd'; amount: number; estimated: boolean }, ok = true): Promise<void> {
    await recordUsage({
      id: `use-${job.jobId}`, capabilityId: desc.capabilityId, model: desc.model, provider: 'replicate',
      userId: USER, projectId: job.projectId, nodeId: job.nodeId, jobId: job.jobId,
      costBasis: cost, resultAssetRef: result?.url, live: job.live, ok, at: new Date().toISOString(),
    });
  }

  private async meterFail(job: GenerativeJob, desc: GenerativeCapabilityDescriptor, spent: boolean): Promise<void> {
    await this.meter(job, desc, null, { unit: desc.costBasis.unit, amount: spent ? desc.costBasis.estimate : 0, estimated: true }, false);
  }
}
