// P3-assets-and-addobject — assets/upload server + flagged image-gen hook +
// the bubble's "Add Object" image-populate mutation (P3 Task C).
//
// Under test:
//   1. POST /api/prism/assets — multipart image upload: accepts PNG (and the
//      other allowed raster types), content-hash names the stored file
//      (sha256 + server-sniffed extension; the client's file name never
//      reaches the filesystem), is idempotent on re-upload, rejects oversize
//      (413) and wrong/unsupported types (415), probes native dimensions via
//      sharp, never caches. The write target is pointed at a temp dir via
//      PRISM_UPLOADS_DIR.
//   2. src/server/image-gen/generate.ts — the FLAGGED diffusion hook mirrors
//      text-fill/generate.ts: { wired: false, images: [] } today, full typed
//      request/response union so wiring later is a drop-in.
//   3. POST /api/prism/image-gen — routes through the hook; 400 validation.
//   4. Add Object mutation shape — buildImagePopulatePatch turns a stage-1
//      bubble into an image-populated node (isStage0Bubble → false,
//      renderMode 'sprite', sourceAsset set, aspect-preserving transform,
//      caption rewritten only when still the bubble placeholder) and changes
//      the build content hash (so the Save-and-Rebuild remount path picks the
//      change up — sourceAsset has always been in the hash).
//   5. uploadImageAsset — the frozen client seam: typed success, friendly
//      plain-language errors (no spec citations, no machine ids).
//
// (`server-only` is aliased to a no-op in vitest.config.mjs.)

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { POST as assetsPOST } from '@/app/api/prism/assets/route';
import { POST as imageGenPOST } from '@/app/api/prism/image-gen/route';
import {
  generateImages,
  clampImageCount,
  IMAGE_GEN_DEFAULT_COUNT,
  IMAGE_GEN_MAX_COUNT,
  type ImageGenerateRequest,
  type ImageGenerateResponse,
} from '@/server/image-gen/generate';
import {
  buildImagePopulatePatch,
  imagePlaneSize,
  uploadImageAsset,
  IMAGE_ELEMENT_CAPTION,
  IMAGE_PLANE_MAX_DIM,
  type UploadedImageAsset,
} from '@/components/editor/add-tools/upload-image';
import {
  BUBBLE_CAPTION_DEFAULT,
  buildBubbleElementNode,
  isStage0Bubble,
} from '@/components/editor/add-tools/create-element-node';
import { computeNodeContentHash } from '@/lib/editor/node-content-hash';
import type { PrismNode } from '@/lib/prism-graph/types';

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_WINDOW = (globalThis as { window?: unknown }).window;

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prism-uploads-test-'));
  process.env.PRISM_UPLOADS_DIR = tmpDir;
});

afterAll(async () => {
  delete process.env.PRISM_UPLOADS_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  if (ORIGINAL_FETCH === undefined) {
    delete (globalThis as { fetch?: unknown }).fetch;
  } else {
    globalThis.fetch = ORIGINAL_FETCH;
  }
  if (ORIGINAL_WINDOW === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = ORIGINAL_WINDOW;
  }
});

/** Real PNG bytes (sharp is already a dependency — same tool the route uses
 *  to probe, exercised here as the encoder). */
async function makePngBuffer(width = 5, height = 3): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 12, g: 34, b: 56, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

function uploadRequest(file: File): Request {
  const form = new FormData();
  form.append('file', file);
  return new Request('http://localhost/api/prism/assets', {
    method: 'POST',
    body: form,
  });
}

// ── 1. POST /api/prism/assets ───────────────────────────────────────────────
describe('POST /api/prism/assets — content-hashed image upload', () => {
  it('accepts a PNG → hash-named URL + native dimensions; idempotent re-upload', async () => {
    const png = await makePngBuffer(5, 3);
    // Hostile client file name — must never reach the filesystem path.
    const file = new File([new Uint8Array(png)], '..%2F..%2Fevil name.png', {
      type: 'image/png',
    });

    const res = await assetsPOST(uploadRequest(file));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const json = (await res.json()) as {
      ok: boolean;
      url: string;
      width: number;
      height: number;
    };
    expect(json.ok).toBe(true);
    // Name = sha256 hex + server-sniffed extension, nothing client-supplied.
    expect(json.url).toMatch(/^\/prism-mock\/uploads\/[0-9a-f]{64}\.png$/);
    expect(json.url).not.toContain('evil');
    expect(json.width).toBe(5);
    expect(json.height).toBe(3);

    // The bytes landed in the (overridden) uploads dir, stored verbatim.
    const storedName = json.url.split('/').pop()!;
    const stored = await fs.readFile(path.join(tmpDir, storedName));
    expect(Buffer.compare(stored, png)).toBe(0);

    // Idempotent: same bytes → same URL, still exactly one file on disk.
    const res2 = await assetsPOST(
      uploadRequest(new File([new Uint8Array(png)], 'other-name.png', { type: 'image/png' })),
    );
    expect(res2.status).toBe(200);
    const json2 = (await res2.json()) as { url: string };
    expect(json2.url).toBe(json.url);
    const entries = await fs.readdir(tmpDir);
    expect(entries.filter((e) => e === storedName)).toHaveLength(1);
  });

  it('rejects an oversize file with 413 and a plain-language error', async () => {
    const big = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.png', {
      type: 'image/png',
    });
    const res = await assetsPOST(uploadRequest(big));
    expect(res.status).toBe(413);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toContain('12 MB');
  });

  it('rejects a disallowed MIME type with 415', async () => {
    const file = new File([new TextEncoder().encode('hello')], 'note.txt', {
      type: 'text/plain',
    });
    const res = await assetsPOST(uploadRequest(file));
    expect(res.status).toBe(415);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/PNG, JPEG, WebP, or AVIF/);
  });

  it('rejects bytes that are not a real image even with an image/* claim (sniff is authoritative)', async () => {
    const fake = new File([new TextEncoder().encode('not actually a png')], 'fake.png', {
      type: 'image/png',
    });
    const res = await assetsPOST(uploadRequest(fake));
    expect(res.status).toBe(415);
  });

  it('missing "file" field → 400', async () => {
    const form = new FormData();
    const res = await assetsPOST(
      new Request('http://localhost/api/prism/assets', { method: 'POST', body: form }),
    );
    expect(res.status).toBe(400);
  });
});

// ── 2 + 3. Flagged image-gen hook + route ───────────────────────────────────

// Compile-time drop-in guarantee: the wired shape is already representable.
const _wiredShape: ImageGenerateResponse = {
  wired: true,
  images: [
    {
      url: '/prism-mock/uploads/abc123.png',
      width: 1024,
      height: 1024,
      label: 'Brass pocket watch #1',
    },
  ],
};
void _wiredShape;
const _request: ImageGenerateRequest = { prompt: 'a brass pocket watch', count: 2 };
void _request;

describe('image-gen hook — flagged shape', () => {
  it('returns { wired: false, images: [] } (the flagged answer)', async () => {
    const res = await generateImages('a brass pocket watch on black');
    expect(res).toEqual({ wired: false, images: [] });
    expect(res.wired).toBe(false);
    expect(res.images).toHaveLength(0);
  });

  it('count does not change the flagged shape', async () => {
    expect(await generateImages('x', 4)).toEqual({ wired: false, images: [] });
  });

  it('clampImageCount: default, floor/ceiling, non-finite', () => {
    expect(clampImageCount()).toBe(IMAGE_GEN_DEFAULT_COUNT);
    expect(clampImageCount(Number.NaN)).toBe(IMAGE_GEN_DEFAULT_COUNT);
    expect(clampImageCount(0)).toBe(1);
    expect(clampImageCount(2.7)).toBe(2);
    expect(clampImageCount(999)).toBe(IMAGE_GEN_MAX_COUNT);
  });
});

function imageGenRequest(body: unknown): Request {
  return new Request('http://localhost/api/prism/image-gen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/prism/image-gen', () => {
  it('{ prompt } → 200 with the flagged shape, never cached', async () => {
    const res = await imageGenPOST(imageGenRequest({ prompt: 'a brass pocket watch' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ wired: false, images: [] });
  });

  it('missing / malformed prompt or count → 400', async () => {
    expect((await imageGenPOST(imageGenRequest({}))).status).toBe(400);
    expect((await imageGenPOST(imageGenRequest({ prompt: '  ' }))).status).toBe(400);
    expect((await imageGenPOST(imageGenRequest('{not json'))).status).toBe(400);
    expect((await imageGenPOST(imageGenRequest({ prompt: 'x', count: 0 }))).status).toBe(400);
    expect((await imageGenPOST(imageGenRequest({ prompt: 'x', count: 1.5 }))).status).toBe(400);
  });
});

// ── 4. Add Object mutation shape ────────────────────────────────────────────

function asNode(input: ReturnType<typeof buildBubbleElementNode>, nodeId: string): PrismNode {
  return { ...input, nodeId } as PrismNode;
}

describe('Add Object — buildImagePopulatePatch (bubble → image-populated)', () => {
  const asset: UploadedImageAsset = {
    url: '/prism-mock/uploads/deadbeef.png',
    width: 1600,
    height: 900,
  };

  it('turns isStage0Bubble false: sourceAsset set, renderMode sprite', () => {
    const bubble = asNode(buildBubbleElementNode({ parentHubId: 'home' }), 'n-bub-1');
    expect(isStage0Bubble(bubble)).toBe(true);

    const patch = buildImagePopulatePatch(bubble, asset);
    expect(patch.renderMode).toBe('sprite');
    expect(patch.visual?.sourceAsset).toBe(asset.url);

    // The shallow-merge updateNode applies: { ...node, ...patch }.
    const merged = { ...bubble, ...patch } as PrismNode;
    expect(isStage0Bubble(merged)).toBe(false);
  });

  it('preserves aspect ratio in the resized transform (position untouched)', () => {
    const bubble = asNode(buildBubbleElementNode({ parentHubId: 'home' }), 'n-bub-2');
    const patch = buildImagePopulatePatch(bubble, asset);
    const t = patch.visual!.transform;
    expect(t.width).toBeCloseTo(IMAGE_PLANE_MAX_DIM, 5);
    expect(t.height).toBeCloseTo(IMAGE_PLANE_MAX_DIM * (900 / 1600), 5);
    // Position comes from the bubble's existing transform.
    expect(t.x).toBe(bubble.visual!.transform.x);
    expect(t.y).toBe(bubble.visual!.transform.y);
    expect(t.z).toBe(bubble.visual!.transform.z);

    // Portrait asset pins height instead.
    const portrait = buildImagePopulatePatch(bubble, { ...asset, width: 600, height: 1200 });
    expect(portrait.visual!.transform.height).toBeCloseTo(IMAGE_PLANE_MAX_DIM, 5);
    expect(portrait.visual!.transform.width).toBeCloseTo(IMAGE_PLANE_MAX_DIM / 2, 5);
  });

  it('changes the build content hash (the rebuild path keys on it)', () => {
    const bubble = asNode(buildBubbleElementNode({ parentHubId: 'home' }), 'n-bub-3');
    const before = computeNodeContentHash(bubble);
    const merged = { ...bubble, ...buildImagePopulatePatch(bubble, asset) } as PrismNode;
    expect(computeNodeContentHash(merged)).not.toBe(before);
  });

  it('rewrites the placeholder caption, preserves a user-authored one', () => {
    const fresh = asNode(buildBubbleElementNode({ parentHubId: 'home' }), 'n-bub-4');
    expect(fresh.intent!.caption).toBe(BUBBLE_CAPTION_DEFAULT);
    const patched = buildImagePopulatePatch(fresh, asset);
    expect(patched.intent?.caption).toBe(IMAGE_ELEMENT_CAPTION);

    const named = asNode(
      buildBubbleElementNode({ parentHubId: 'home', caption: 'Hero banner' }),
      'n-bub-5',
    );
    expect(buildImagePopulatePatch(named, asset).intent?.caption).toBe('Hero banner');
  });

  it('imagePlaneSize guards degenerate inputs', () => {
    expect(imagePlaneSize(0, 0)).toEqual({ width: IMAGE_PLANE_MAX_DIM, height: IMAGE_PLANE_MAX_DIM });
    expect(imagePlaneSize(Number.NaN, 100).width).toBeGreaterThan(0);
  });
});

describe('Add Object — store integration (updateNode applies the patch)', () => {
  it('addNode bubble → updateNode(patch) → node is image-populated in the store', async () => {
    // Same fresh-store harness as P2-add-element: suppress the eager
    // live-graph fetch, give the module a window.
    vi.resetModules();
    globalThis.fetch = vi.fn(async () => {
      throw new Error('eager-init fetch suppressed in P3 unit test');
    }) as unknown as typeof fetch;
    (globalThis as { window?: unknown }).window = globalThis as unknown as Window;
    const { useGraphSourceStore } = (await import('@/stores/useGraphSourceStore')) as unknown as {
      useGraphSourceStore: {
        getState: () => {
          nodes: PrismNode[];
          addNode: (input: Partial<PrismNode> & { parentHubId: string }) => string;
          updateNode: (nodeId: string, patch: Partial<PrismNode>) => void;
        };
        setState: (p: Record<string, unknown>) => void;
      };
    };
    useGraphSourceStore.setState({
      hubs: [],
      nodes: [],
      edges: [],
      ready: true,
      error: null,
      isDirty: false,
    });

    const id = useGraphSourceStore
      .getState()
      .addNode(buildBubbleElementNode({ parentHubId: 'home' }));
    const bubble = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id)!;
    expect(isStage0Bubble(bubble)).toBe(true);

    const asset: UploadedImageAsset = {
      url: '/prism-mock/uploads/cafef00d.png',
      width: 800,
      height: 800,
    };
    useGraphSourceStore.getState().updateNode(id, buildImagePopulatePatch(bubble, asset));

    const populated = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id)!;
    expect(isStage0Bubble(populated)).toBe(false);
    expect(populated.visual?.sourceAsset).toBe(asset.url);
    expect(populated.renderMode).toBe('sprite');
    expect(populated.intent.caption).toBe(IMAGE_ELEMENT_CAPTION);
    // The artifact field is visual.sourceAsset — nothing else was destroyed.
    expect(populated.parentHubId).toBe('home');
    expect(populated.scenePosition).toEqual(bubble.scenePosition);
  });
});

// ── 5. uploadImageAsset — the frozen client seam ────────────────────────────
describe('uploadImageAsset — frozen client seam', () => {
  it('POSTs multipart to /api/prism/assets and returns the typed asset', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, url: '/prism-mock/uploads/aa.png', width: 4, height: 2 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const file = new File([new Uint8Array([1, 2, 3])], 'pic.png', { type: 'image/png' });
    const asset = await uploadImageAsset(file);
    expect(asset).toEqual({ url: '/prism-mock/uploads/aa.png', width: 4, height: 2 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/prism/assets');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('surfaces the server error message verbatim (already plain language)', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: false, error: 'That image is too large — keep it under 12 MB.' }),
          { status: 413, headers: { 'Content-Type': 'application/json' } },
        ),
    ) as unknown as typeof fetch;

    const file = new File([new Uint8Array([1])], 'big.png', { type: 'image/png' });
    await expect(uploadImageAsset(file)).rejects.toThrow(/12 MB/);
  });

  it('falls back to a friendly per-status message when the body is unreadable', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('garbage', { status: 415 }),
    ) as unknown as typeof fetch;

    const file = new File([new Uint8Array([1])], 'odd.bin', { type: 'image/png' });
    await expect(uploadImageAsset(file)).rejects.toThrow(/PNG, JPEG, WebP, or AVIF/);
  });

  it('network failure → friendly connection message', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    const file = new File([new Uint8Array([1])], 'pic.png', { type: 'image/png' });
    await expect(uploadImageAsset(file)).rejects.toThrow(/connection/);
  });
});
