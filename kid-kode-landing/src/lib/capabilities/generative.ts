// PRISM SHELL-W10 — GenerativeCapabilityAdapter (sibling family to
// CapabilityProvider, same D1 provider-agnostic law).
//
// Generative-3D powers (object generation, PBR texturing, auto-rig, part
// segmentation, material generation, world generation, mesh ops) surface in the
// editor as capability TILES named MODEL + FUNCTION ("Smart Mesh P1 — image to
// 3D") — never as vendor platform tiles. Adapters do the vendor work behind
// this interface (INV-NEV2-4 carried over: no vendor REST/SDK call outside its
// adapter file under src/server/capabilities/generative/). The client reaches
// capabilities ONLY through /api/prism/generative.
//
// Shape: an async JOB pattern (submit → poll → typed asset ref) because 3D
// generation is long-running, unlike the search/validate/connect shape of
// CapabilityProvider. Live-vs-stub follows the established pattern: adapters
// with a key present are live; keyless adapters are typed stubs or demo-safe
// offline simulators (build + verify never break on a keyless machine).
//
// Metering (E20 pattern): every invocation records a CapabilityUsage event
// server-side (see src/server/capabilities/generative/usage-ledger.ts).
// Charging is wired later with the billing phase.

/** The fixed set of generative capability kinds W10 ships. */
export type GenerativeCapabilityKind =
  | 'generate3D'
  | 'textureMesh'
  | 'rigMesh'
  | 'segmentMesh'
  | 'generateMaterial'
  | 'generateWorld'
  | 'meshOps';

/** A declared, non-secret parameter a capability accepts (drives the form). */
export interface GenerativeParamSpec {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'sourceJob';
  required?: boolean;
  /** For 'select'. */
  options?: string[];
  placeholder?: string;
  default?: string | number | boolean;
  /** For 'sourceJob': restrict pickable prior jobs to these adapter ids. */
  sourceAdapter?: string;
}

/** Cost basis surfaced on the tile + recorded per invocation (metering, E20). */
export interface GenerativeCostBasis {
  unit: 'credits' | 'usd';
  /** Estimate shown on the tile; real consumption replaces it when the vendor reports it. */
  estimate: number;
  note?: string;
}

/** A generation capability tile (MODEL + FUNCTION naming law, DL14 glyphs). */
export interface GenerativeCapabilityDescriptor {
  /** Stable id, adapter-scoped ('tripo.text-to-3d'). */
  capabilityId: string;
  kind: GenerativeCapabilityKind;
  /** The MODEL name shown first on the tile ("Smart Mesh P1"). */
  model: string;
  /** The plain-language FUNCTION ("image to 3D"). */
  fn: string;
  /** Full tile label — always `${model} — ${fn}` (founder naming law). */
  label: string;
  /** DL14 custom glyph key (black/white/red; never a stock icon or brand mark). */
  glyph: GenerativeCapabilityKind;
  description: string;
  /** Whether the backing adapter has a live key. False → stub / demo-safe. */
  live: boolean;
  costBasis: GenerativeCostBasis;
  params: GenerativeParamSpec[];
  /** Owning adapter id ('tripo' | 'replicate' | 'flux' | 'marble' | 'meshy' | 'meshops'). */
  adapterId: string;
}

export type GenerativeJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** Typed result asset reference — what a finished job yields. */
export interface GenerativeAssetRef {
  kind: 'glb' | 'texture-set' | 'material' | 'rig' | 'segments' | 'world';
  /** Project-relative public URL under the existing asset store paths. */
  url: string;
  label: string;
  meta?: Record<string, string | number | boolean>;
}

/** A generation job as the CLIENT sees it (vendor internals stay server-side). */
export interface GenerativeJob {
  jobId: string;
  capabilityId: string;
  adapterId: string;
  model: string;
  status: GenerativeJobStatus;
  /** 0..100 coarse progress. */
  progress: number;
  submittedAt: string;
  updatedAt: string;
  /** Scoping — which node/project this job was invoked from (drives per-node lists). */
  nodeId?: string;
  projectId?: string;
  /** Present when status === 'succeeded'. */
  result?: GenerativeAssetRef;
  /** Present when status === 'failed'. */
  error?: string;
  /** Real (or estimated) cost recorded for this job. */
  cost?: { unit: 'credits' | 'usd'; amount: number; estimated: boolean };
  /** Whether this job ran against the live vendor or the demo-safe offline path. */
  live: boolean;
  /** Server-side vendor task handle (Tripo task id) so downstream ops
   *  (texture/rig/segment) can chain off this job. Non-secret, opaque. */
  vendorTaskId?: string;
}

export interface GenerativeSubmitInput {
  capabilityId: string;
  params: Record<string, unknown>;
  userId?: string;
  projectId?: string;
  nodeId?: string;
}

/** One CapabilityUsage metering event (E20 pattern — recorded now, charged later). */
export interface CapabilityUsageEvent {
  id: string;
  capabilityId: string;
  model: string;
  provider: string;
  userId: string;
  projectId?: string;
  nodeId?: string;
  jobId: string;
  costBasis: { unit: 'credits' | 'usd'; amount: number; estimated: boolean };
  resultAssetRef?: string;
  live: boolean;
  /** Whether the invocation succeeded. false = attempt recorded (failed job) —
   *  every invocation is metered (E20), even ones that error. */
  ok?: boolean;
  at: string;
}

/** The provider-agnostic generative capability surface (D1 sibling). */
export interface GenerativeCapabilityAdapter {
  /** Stable adapter id. */
  readonly id: string;
  /** Whether a live backend is configured (key present). False → stub/demo. */
  readonly live: boolean;
  /** The capability tiles this adapter contributes (named MODEL + FUNCTION). */
  listCapabilities(): GenerativeCapabilityDescriptor[];
  /** Start a generation job. Returns immediately with a queued/running job. */
  submit(input: GenerativeSubmitInput): Promise<GenerativeJob>;
  /** Poll a job to completion. Downloads + stores the asset on success. */
  poll(jobId: string): Promise<GenerativeJob>;
}
