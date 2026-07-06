// PRISM SHELL-W10 — generative typed STUBS. Server-only.
//
// Marble (World Labs World API), Meshy (texturing + animation), and a mesh-ops
// aggregator are documented live SDKs with no key on this machine yet. They ship
// as TYPED STUBS behind the SAME GenerativeCapabilityAdapter interface (D1 sibling
// law), exactly like the Pipedream/Composio CapabilityProvider stubs. Choosing to
// enable one later is a key + a wired adapter — NO UI rework. A stub submit
// records the job and returns it in a `failed` state carrying an honest,
// actionable "connect to enable" note (never a faked success — I-PROVENANCE).
import 'server-only';
import type {
  GenerativeCapabilityAdapter, GenerativeCapabilityDescriptor, GenerativeJob,
  GenerativeSubmitInput,
} from '../../../lib/capabilities/generative';
import { GENERATIVE_CATALOG, GENERATIVE_BY_ID } from '../../../lib/capabilities/generative-catalog';
import { newJobId } from './pipeline';
import { putJob, patchJob, getJob } from './job-store';

abstract class GenerativeStubAdapter implements GenerativeCapabilityAdapter {
  abstract readonly id: string;
  /** The documented live integration this stub stands in for. */
  abstract readonly sdk: { name: string; docs: string; env: string };

  get live(): boolean { return Boolean(process.env[this.sdk.env]); }

  listCapabilities(): GenerativeCapabilityDescriptor[] {
    const live = this.live;
    return GENERATIVE_CATALOG.filter((c) => c.adapterId === this.id).map((c) => ({ ...c, live }));
  }

  async submit(input: GenerativeSubmitInput): Promise<GenerativeJob> {
    const desc = GENERATIVE_BY_ID[input.capabilityId];
    if (!desc || desc.adapterId !== this.id) throw new Error(`unknown ${this.id} capability ${input.capabilityId}`);
    const now = new Date().toISOString();
    const job: GenerativeJob = {
      jobId: newJobId(this.id), capabilityId: desc.capabilityId, adapterId: this.id, model: desc.model,
      status: 'queued', progress: 0, submittedAt: now, updatedAt: now,
      nodeId: input.nodeId, projectId: input.projectId, live: false,
    };
    await putJob(job);
    const failed = await patchJob(job.jobId, {
      status: 'failed', progress: 0,
      error: `${desc.label} is a documented live capability (${this.sdk.name} · ${this.sdk.docs}). Set ${this.sdk.env} to enable — no UI change needed.`,
    });
    return failed ?? job;
  }

  async poll(jobId: string): Promise<GenerativeJob> {
    const j = await getJob(jobId);
    if (!j) throw new Error(`job ${jobId} not found`);
    return j;
  }
}

/** World Labs Marble — text/image/video → navigable 3D world (launched 2026-01). */
export class MarbleAdapter extends GenerativeStubAdapter {
  readonly id = 'marble';
  readonly sdk = { name: 'World Labs Marble World API', docs: 'worldlabs.ai', env: 'MARBLE_API_KEY' };
}

/** Meshy AI — mesh texturing + animation presets. */
export class MeshyAdapter extends GenerativeStubAdapter {
  readonly id = 'meshy';
  readonly sdk = { name: 'Meshy AI', docs: 'meshy.ai', env: 'MESHY_API_KEY' };
}

/** Mesh-ops aggregator — retopo / repair / format-convert. */
export class MeshOpsAdapter extends GenerativeStubAdapter {
  readonly id = 'meshops';
  readonly sdk = { name: 'Mesh Ops aggregator', docs: '3daistudio.com', env: 'MESHOPS_API_KEY' };
}
