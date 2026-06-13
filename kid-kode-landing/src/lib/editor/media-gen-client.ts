'use client';

// CANVAS-FINAL — client helper for the Prism Media Generator + asset store.
// The Change Artifact wizards call these; the responses carry ONLY Prism-
// branded model ids + credit costs (the backing provider is never surfaced).

export type MediaKind = 'image' | 'mesh' | 'video' | 'edit' | 'code';
export type GenerateKind = 'image' | 'edit' | '3d' | 'video' | 'code';
export type GenQuality = 'standard' | 'studio';

export interface PrismModelPublic {
  id: string;
  label: string;
  blurb: string;
  kind: MediaKind;
  quality?: GenQuality;
  credits: number;
}

export interface CreditMeter {
  used: number;
  generations: number;
}

export interface GeneratedImagePublic {
  url: string;
  width?: number;
  height?: number;
}

/** Mirror of the server compose spec (client-side; applied to a node). */
export interface ArtifactComposeSpec {
  meshPrimitive: {
    kind: 'cube' | 'sphere' | 'plane' | 'cylinder' | 'cone' | 'torus' | 'capsule';
    params?: Record<string, number>;
  };
  materialSpec?: Record<string, unknown>;
  animationBindings?: Array<{ id: string; primitive: string; driver: string; order?: number }>;
}

export interface MediaGenResult {
  ok: true;
  kind: GenerateKind;
  model: PrismModelPublic;
  images?: GeneratedImagePublic[];
  meshUrl?: string;
  previewUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
  compose?: ArtifactComposeSpec;
  summary?: string;
  credits: number;
  meter: CreditMeter;
}

export interface MediaGenError {
  ok: false;
  error: string;
}

export interface GenerateRequest {
  kind: GenerateKind;
  prompt?: string;
  quality?: GenQuality;
  count?: number;
  width?: number;
  height?: number;
  imageUrl?: string;
  imageUrls?: string[];
  durationSeconds?: number;
}

/** GET the Prism-branded model catalog + current credit meter. */
export async function fetchMediaCatalog(): Promise<{ catalog: PrismModelPublic[]; meter: CreditMeter }> {
  const res = await fetch('/api/prism/media-gen', { method: 'GET' });
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; catalog?: PrismModelPublic[]; meter?: CreditMeter }
    | null;
  if (!res.ok || !data?.ok || !Array.isArray(data.catalog)) {
    return { catalog: [], meter: { used: 0, generations: 0 } };
  }
  return { catalog: data.catalog, meter: data.meter ?? { used: 0, generations: 0 } };
}

/** Run a generation. Returns the result, or a plain-language error message. */
export async function generateMedia(req: GenerateRequest): Promise<MediaGenResult | MediaGenError> {
  try {
    const res = await fetch('/api/prism/media-gen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !data || data.ok !== true) {
      const msg = (data && typeof data.error === 'string' && data.error) || 'Generation could not be completed.';
      return { ok: false, error: msg };
    }
    return data as unknown as MediaGenResult;
  } catch {
    return { ok: false, error: 'Generation could not be reached — check your connection.' };
  }
}

export interface UploadedAsset {
  url: string;
  kind?: 'image' | '3d' | 'video' | 'rive';
  width?: number;
  height?: number;
  ext?: string;
}

/** Upload a file (image / GLB / USDZ / MP4 / .riv) through the content-hash
 *  asset store. Returns the persisted URL. */
export async function uploadArtifactFile(file: File): Promise<UploadedAsset> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/prism/assets', { method: 'POST', body: form });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !data || data.ok !== true || typeof data.url !== 'string') {
    const msg = (data && typeof data.error === 'string' && data.error) || 'That file could not be uploaded.';
    throw new Error(msg);
  }
  return {
    url: data.url,
    kind: typeof data.kind === 'string' ? (data.kind as UploadedAsset['kind']) : 'image',
    width: typeof data.width === 'number' ? data.width : undefined,
    height: typeof data.height === 'number' ? data.height : undefined,
    ext: typeof data.ext === 'string' ? data.ext : undefined,
  };
}
