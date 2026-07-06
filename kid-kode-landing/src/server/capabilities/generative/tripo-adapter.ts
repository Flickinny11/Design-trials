// PRISM SHELL-W10 — LIVE Tripo adapter. Server-only.
//
// Implements the generative surface for object generation (text/image → 3D),
// 8K PBR texturing, universal auto-rig, and part segmentation — the Tripo family
// named MODEL + FUNCTION on the tiles. ALL Tripo REST lives in the committed
// vendor client `.assetgen/tripo.py` (one swappable site; INV-NEV2-4); this
// adapter is the thin interface impl that spawns it. The key is read ONLY by the
// spawned child (never by this process, never returned to the client; INV-19).
//
// Live when tripo.py + tripo.key are present. Absent → live:false and the
// demo-safe offline path serves committed real fixtures, so the flow works on a
// keyless machine and the build + verify never break.
import 'server-only';
import path from 'node:path';
import type {
  GenerativeCapabilityAdapter,
  GenerativeCapabilityDescriptor,
  GenerativeJob,
  GenerativeSubmitInput,
  GenerativeAssetRef,
} from '../../../lib/capabilities/generative';
import { GENERATIVE_CATALOG, GENERATIVE_BY_ID } from '../../../lib/capabilities/generative-catalog';
import {
  TRIPO_SCRIPT, TRIPO_KEY, MODELS_DIR, hasFile, modelUrl, newJobId,
  ensureDir, spawnCapture, parseProgress, parseVendorTaskId, finalizeGlb,
} from './pipeline';
import { putJob, patchJob, getJob } from './job-store';
import { recordUsage } from './usage-ledger';
import { promises as fs } from 'node:fs';

const CAPS = GENERATIVE_CATALOG.filter((c) => c.adapterId === 'tripo');
const USER = 'local-user';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Committed demo fixtures (real Tripo output, optimized + committed) served when
// the live key is absent OR the caller asks for a demo run.
function demoFixture(desc: GenerativeCapabilityDescriptor): GenerativeAssetRef {
  switch (desc.kind) {
    case 'textureMesh':
      return { kind: 'texture-set', url: modelUrl('demo-tripo-robot-textured'), label: 'Robot · 8K PBR textured', meta: { demo: true } };
    case 'rigMesh':
      return { kind: 'rig', url: modelUrl('demo-tripo-robot-rigged'), label: 'Robot · auto-rigged (biped)', meta: { demo: true, skeleton: 'biped' } };
    case 'segmentMesh':
      return { kind: 'segments', url: modelUrl('demo-tripo-robot-segments'), label: 'Robot · 20 segmented parts', meta: { demo: true, parts: 20 } };
    default:
      return { kind: 'glb', url: modelUrl('demo-tripo-robot'), label: 'Robot mascot · Tripo 3.1', meta: { demo: true } };
  }
}

export class TripoAdapter implements GenerativeCapabilityAdapter {
  readonly id = 'tripo';
  get live(): boolean { return hasFile(TRIPO_SCRIPT) && hasFile(TRIPO_KEY); }

  listCapabilities(): GenerativeCapabilityDescriptor[] {
    const live = this.live;
    return CAPS.map((c) => ({ ...c, live }));
  }

  async submit(input: GenerativeSubmitInput): Promise<GenerativeJob> {
    const desc = GENERATIVE_BY_ID[input.capabilityId];
    if (!desc || desc.adapterId !== 'tripo') throw new Error(`unknown tripo capability ${input.capabilityId}`);
    for (const p of desc.params) {
      if (p.required && !input.params[p.name] && p.type !== 'sourceJob') throw new Error(`missing required param "${p.name}"`);
    }
    const demo = input.params.__demo === true || !this.live;
    const now = new Date().toISOString();
    const job: GenerativeJob = {
      jobId: newJobId('tripo'), capabilityId: desc.capabilityId, adapterId: 'tripo', model: desc.model,
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

  // ── demo-safe offline path — serves committed real fixtures ────────────────
  private async runDemo(job: GenerativeJob, desc: GenerativeCapabilityDescriptor): Promise<void> {
    await patchJob(job.jobId, { status: 'running', progress: 15 });
    await sleep(500);
    await patchJob(job.jobId, { progress: 55 });
    await sleep(500);
    await patchJob(job.jobId, { progress: 85 });
    await sleep(400);
    const result = demoFixture(desc);
    const cost = { unit: desc.costBasis.unit, amount: desc.costBasis.estimate, estimated: true };
    await patchJob(job.jobId, { status: 'succeeded', progress: 100, result, cost });
    await this.meter(job, desc, result, cost);
  }

  // ── live path — spawns the committed .assetgen/tripo.py vendor client ──────
  private async runLive(job: GenerativeJob, desc: GenerativeCapabilityDescriptor, input: GenerativeSubmitInput): Promise<void> {
    const jobDir = path.join(MODELS_DIR, job.jobId);
    const srcDir = path.join(jobDir, 'src');
    const srcGlb = path.join(srcDir, 'model.glb');
    await ensureDir(srcDir);
    await patchJob(job.jobId, { status: 'running', progress: 4 });

    let vendorTaskId: string | undefined;
    const onLine = (line: string) => {
      const p = parseProgress(line);
      if (p != null) void patchJob(job.jobId, { progress: Math.max(4, Math.min(99, p)) });
      const t = parseVendorTaskId(line);
      if (t) vendorTaskId = t;
    };

    let args: string[];
    const env: NodeJS.ProcessEnv = { ...process.env };
    try {
      args = await this.buildArgs(desc, input, srcGlb, env);
    } catch (e) {
      await patchJob(job.jobId, { status: 'failed', error: (e as Error).message });
      return;
    }

    const res = await spawnCapture('python3', [TRIPO_SCRIPT, ...args], { cwd: path.dirname(TRIPO_SCRIPT), env, timeoutMs: 900_000 }, onLine);
    if (res.code !== 0 || !hasFile(srcGlb)) {
      await patchJob(job.jobId, { status: 'failed', error: `tripo failed (code ${res.code}): ${res.err.slice(-240) || res.out.slice(-240)}` });
      return;
    }
    let finalUrl: string;
    try {
      const finalPath = await finalizeGlb(srcGlb, jobDir);
      finalUrl = modelUrl(job.jobId, path.basename(finalPath));
      await fs.rm(srcDir, { recursive: true, force: true });
    } catch (e) {
      await patchJob(job.jobId, { status: 'failed', error: `finalize failed: ${(e as Error).message}` });
      return;
    }
    const result: GenerativeAssetRef = {
      kind: desc.kind === 'textureMesh' ? 'texture-set' : desc.kind === 'rigMesh' ? 'rig' : desc.kind === 'segmentMesh' ? 'segments' : 'glb',
      url: finalUrl, label: `${desc.model} · ${desc.fn}`,
      meta: { model: desc.model, fn: desc.fn },
    };
    const cost = { unit: desc.costBasis.unit, amount: desc.costBasis.estimate, estimated: true };
    await patchJob(job.jobId, { status: 'succeeded', progress: 100, result, cost, vendorTaskId });
    await this.meter(job, desc, result, cost);
  }

  /** Build tripo.py args for a capability, resolving source-mesh vendor task ids. */
  private async buildArgs(
    desc: GenerativeCapabilityDescriptor,
    input: GenerativeSubmitInput,
    srcGlb: string,
    env: NodeJS.ProcessEnv,
  ): Promise<string[]> {
    const P = input.params;
    if (desc.kind === 'generate3D') {
      if (desc.capabilityId === 'tripo.text-3d') {
        env.TRIPO_TEX_QUALITY = String(P.quality ?? 'standard');
        return ['text', srcGlb, 'v3.1-20260211', String(P.prompt ?? '')];
      }
      // image → 3D (Smart Mesh P1): fetch the reference URL to a temp file first.
      const imgPath = await this.fetchImage(String(P.imageUrl ?? ''), path.dirname(srcGlb));
      return ['image', srcGlb, 'P1-20260311', imgPath];
    }
    // downstream ops chain off the source job's vendor task id.
    const vendorTaskId = await this.resolveSourceTaskId(String(P.sourceJobId ?? ''));
    if (desc.kind === 'textureMesh') { env.TRIPO_TEX_QUALITY = String(P.quality ?? 'detailed'); return ['texture', srcGlb, vendorTaskId, String(P.quality ?? 'detailed')]; }
    if (desc.kind === 'rigMesh') return ['rig', srcGlb, vendorTaskId, 'tripo'];
    if (desc.kind === 'segmentMesh') return ['segment', srcGlb, vendorTaskId];
    throw new Error(`unsupported tripo kind ${desc.kind}`);
  }

  private async resolveSourceTaskId(sourceJobId: string): Promise<string> {
    if (!sourceJobId) throw new Error('a source mesh (a prior Tripo job) is required');
    const src = await getJob(sourceJobId);
    if (!src) throw new Error(`source job ${sourceJobId} not found`);
    if (!src.vendorTaskId) throw new Error('source mesh has no Tripo task handle (was it generated live?)');
    return src.vendorTaskId;
  }

  private async fetchImage(url: string, dir: string): Promise<string> {
    if (!/^https?:\/\//.test(url)) throw new Error('imageUrl must be an http(s) URL');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`image fetch ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || 'png';
    const out = path.join(dir, `ref.${ext.length <= 4 ? ext : 'png'}`);
    await ensureDir(dir);
    await fs.writeFile(out, buf);
    return out;
  }

  private async meter(job: GenerativeJob, desc: GenerativeCapabilityDescriptor, result: GenerativeAssetRef, cost: { unit: 'credits' | 'usd'; amount: number; estimated: boolean }): Promise<void> {
    await recordUsage({
      id: `use-${job.jobId}`, capabilityId: desc.capabilityId, model: desc.model, provider: 'tripo',
      userId: USER, projectId: job.projectId, nodeId: job.nodeId,
      jobId: job.jobId, costBasis: cost, resultAssetRef: result.url, live: job.live, at: new Date().toISOString(),
    });
  }
}
