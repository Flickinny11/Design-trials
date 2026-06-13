import 'server-only';

// CANVAS-FINAL — Prism Media Generator: the fal backing provider.
//
// Wraps @fal-ai/client. The ONLY place an upstream endpoint id is used at
// runtime. FAL_KEY is read from the server env and never logged or returned.
// Result-shape accessors are the ones PROVEN in the repo's June-2026 scripts
// (scripts/fidelity2-showcase-gen.mjs, scripts/generate-prism-mock-mesh.mjs).
//
// Inputs that reference an image (edit / 3D / video) require a fal-REACHABLE
// URL — the routes resolve local /prism-mock asset paths to fal.storage URLs
// before calling here (see src/server/assets/store#toFalReachableUrl).

import { fal } from '@fal-ai/client';
import { getModel, modelForKind, MESH_FALLBACK_BACKINGS } from './catalog';
import { parseComposeSpec } from './compose-spec';
import type {
  Gen3DInput,
  Gen3DOutput,
  GenCodeInput,
  GenCodeOutput,
  GenEditInput,
  GenImageInput,
  GenImageOutput,
  GenVideoInput,
  GenVideoOutput,
  MediaProvider,
  RawImage,
} from './types';

// Production output must never bake letterforms into the image (INV-R11): real
// text is MSDF, generated elsewhere. Carried-forward negative prompt.
const NO_TEXT_NEGATIVE =
  'text, letters, words, typography, labels, captions, watermark, signature, ' +
  'logo, low quality, blurry, jpeg artifacts, deformed';

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new Error('Media generation is not configured on this server.');
  }
  fal.config({ credentials: key });
  configured = true;
}

function clampCount(count: number | undefined): number {
  if (!count || !Number.isFinite(count)) return 1;
  return Math.min(4, Math.max(1, Math.floor(count)));
}

function extractImages(data: unknown): RawImage[] {
  const d = (data ?? {}) as { images?: Array<{ url?: unknown; width?: unknown; height?: unknown }> };
  const imgs = Array.isArray(d.images) ? d.images : [];
  return imgs
    .filter((i) => typeof i?.url === 'string')
    .map((i) => ({
      url: i.url as string,
      width: typeof i.width === 'number' ? i.width : undefined,
      height: typeof i.height === 'number' ? i.height : undefined,
    }));
}

export const falProvider: MediaProvider = {
  providerId: 'fal',

  async generateImage(input: GenImageInput): Promise<GenImageOutput> {
    ensureConfigured();
    const model = modelForKind('image', input.quality);
    const width = input.width && input.width > 0 ? Math.round(input.width) : 1024;
    const height = input.height && input.height > 0 ? Math.round(input.height) : 1024;
    const fInput: Record<string, unknown> = {
      prompt: input.prompt,
      negative_prompt: NO_TEXT_NEGATIVE,
      image_size: { width, height },
      num_images: clampCount(input.count),
    };
    if (input.imageUrl) fInput.image_url = input.imageUrl;
    const r = await fal.subscribe(model.backing, { input: fInput, logs: false });
    const images = extractImages(r.data);
    if (images.length === 0) throw new Error('No image came back from generation.');
    return { images };
  },

  async editImage(input: GenEditInput): Promise<GenImageOutput> {
    ensureConfigured();
    const model = getModel('prism-edit');
    if (!model) throw new Error('edit model missing from catalog');
    const r = await fal.subscribe(model.backing, {
      input: {
        prompt: input.prompt,
        image_url: input.imageUrl,
        negative_prompt: NO_TEXT_NEGATIVE,
        num_images: clampCount(input.count),
        strength: 0.85,
      },
      logs: false,
    });
    const images = extractImages(r.data);
    if (images.length === 0) throw new Error('No image came back from the modification.');
    return { images };
  },

  async imageTo3D(input: Gen3DInput): Promise<Gen3DOutput> {
    ensureConfigured();
    const primary = getModel('prism-3d')?.backing ?? MESH_FALLBACK_BACKINGS[0];
    const order = [primary, ...MESH_FALLBACK_BACKINGS.filter((b) => b !== primary)];
    const urls = input.imageUrls.filter((u) => typeof u === 'string' && u.length > 0);
    if (urls.length === 0) throw new Error('A picture is needed to make a 3D model.');

    let lastErr: unknown = null;
    for (const backing of order) {
      try {
        const fInput = buildMeshInput(backing, urls, input.prompt);
        const r = await fal.subscribe(backing, { input: fInput, logs: false });
        const meshUrl = extractMeshUrl(r.data);
        if (meshUrl) {
          return {
            meshUrl,
            format: 'glb',
            previewUrl: extractMeshPreview(r.data),
          };
        }
        lastErr = new Error(`no mesh url from ${backing}`);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('3D generation failed.');
  },

  async generateVideo(input: GenVideoInput): Promise<GenVideoOutput> {
    ensureConfigured();
    const model = getModel('prism-video');
    if (!model) throw new Error('video model missing from catalog');
    if (!input.imageUrl) throw new Error('A starting picture is needed to make a clip.');
    const seconds = Math.min(10, Math.max(2, Math.round(input.durationSeconds ?? 5)));
    const r = await fal.subscribe(model.backing, {
      input: {
        prompt: input.prompt ?? 'gentle, subtle, looping motion',
        image_url: input.imageUrl,
        end_image_url: input.imageUrl, // start == end → seamless loop
        duration: String(seconds),
      },
      logs: false,
    });
    const d = (r.data ?? {}) as { video?: { url?: unknown }; image?: { url?: unknown } };
    const videoUrl = typeof d.video?.url === 'string' ? d.video.url : undefined;
    if (!videoUrl) throw new Error('No clip came back from generation.');
    return { videoUrl, posterUrl: input.imageUrl };
  },

  async generateCode(input: GenCodeInput): Promise<GenCodeOutput> {
    ensureConfigured();
    const model = getModel('prism-compose');
    if (!model) throw new Error('compose model missing from catalog');
    const r = await fal.subscribe(model.backing, {
      input: {
        model: 'anthropic/claude-3.5-sonnet',
        system_prompt: COMPOSE_SYSTEM_PROMPT,
        prompt: `Compose a single 3D element for: "${input.prompt}". Reply with ONLY the JSON object.`,
      },
      logs: false,
    });
    const d = (r.data ?? {}) as { output?: unknown };
    const raw = typeof d.output === 'string' ? d.output : JSON.stringify(d);
    const spec = parseComposeSpec(raw);
    return { spec, summary: describeSpec(spec) };
  },
};

// ── mesh input/result shape helpers (per-endpoint, proven June 2026) ─────────

function buildMeshInput(backing: string, urls: string[], prompt?: string): Record<string, unknown> {
  const first = urls[0];
  if (backing.includes('hyper3d') || backing.includes('rodin')) {
    return { input_image_urls: urls, ...(prompt ? { prompt } : {}) };
  }
  if (backing.includes('trellis')) {
    return { image_url: first };
  }
  // hunyuan3d family
  return { input_image_url: first, enable_pbr: true };
}

function extractMeshUrl(data: unknown): string | undefined {
  const d = (data ?? {}) as {
    model_glb?: { url?: unknown };
    model_mesh?: { url?: unknown };
    model_urls?: { glb?: unknown };
    glb?: { url?: unknown };
    mesh?: { url?: unknown };
  };
  const candidates = [
    d.model_glb?.url,
    d.model_mesh?.url,
    d.model_urls?.glb,
    d.glb?.url,
    d.mesh?.url,
  ];
  return candidates.find((u): u is string => typeof u === 'string');
}

function extractMeshPreview(data: unknown): string | undefined {
  const d = (data ?? {}) as { preview_image?: { url?: unknown }; rendered_image?: { url?: unknown } };
  const c = [d.preview_image?.url, d.rendered_image?.url];
  return c.find((u): u is string => typeof u === 'string');
}

function describeSpec(spec: GenCodeOutput['spec']): string {
  const k = spec.meshPrimitive.kind;
  const color = spec.materialSpec?.baseColor ? ` in ${spec.materialSpec.baseColor}` : '';
  const anim = spec.animationBindings && spec.animationBindings.length > 0
    ? `, animated (${spec.animationBindings.map((a) => a.primitive).join(', ')})`
    : '';
  return `A ${k}${color}${anim}.`;
}

const COMPOSE_SYSTEM_PROMPT = `You compose ONE procedural 3D element for a design tool. Reply with ONLY a JSON object, no prose, matching exactly:
{
  "meshPrimitive": { "kind": "cube"|"sphere"|"plane"|"cylinder"|"cone"|"torus"|"capsule", "params": { "width"?:n, "height"?:n, "depth"?:n, "radius"?:n, "tube"?:n, "length"?:n, "segments"?:n } },
  "materialSpec": { "baseColor"?:"#rrggbb", "metalness"?:0..1, "roughness"?:0..1, "transmission"?:0..1, "ior"?:1..2.4, "emissive"?:"#rrggbb", "emissiveIntensity"?:n, "clearcoat"?:0..1 },
  "animationBindings": [ { "primitive": "<name>", "driver": "time"|"scroll"|"pointer"|"state"|"event" } ]
}
Dimensions are in small scene units (~0.2 to 1.0). Pick a shape + finish that best matches the description. animationBindings is optional; include at most one. Do NOT include any text/letters in the element. Output JSON only.`;
