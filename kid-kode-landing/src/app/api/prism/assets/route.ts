// P3 ASSETS (C) — POST /api/prism/assets
//
// Multipart image upload for the Add Object pipeline (canvas-spec §6 stage 1
// → 2: a bubble node's artifact stays `visual.sourceAsset`; upload and URL
// both end as a URL — this endpoint is where an upload becomes one).
//
// Contract (frozen P3 seam — upload-image.ts `uploadImageAsset` is the client
// half): accept image/png|jpeg|webp|avif up to MAX_UPLOAD_BYTES (~12 MB),
// content-hash the bytes (sha256), persist to
// `public/prism-mock/uploads/<hash>.<ext>`, respond
// `{ ok: true, url: '/prism-mock/uploads/<file>', width, height }`.
//
// Discipline:
//   - Path-traversal safe: the stored file name is derived ENTIRELY from the
//     content hash + the server-sniffed image format. The client's file name
//     and claimed MIME type are never used to build a path (the MIME gate is
//     a fast-reject courtesy only; the byte sniff is authoritative).
//   - Idempotent: re-uploading the same bytes hashes to the same name and
//     returns the same URL without rewriting the file.
//   - SHARPNESS (Logan directive, 2026-06-10): the ORIGINAL bytes are stored
//     verbatim — sharp (already a dependency; dynamic server-side import)
//     only PROBES dimensions, it never re-encodes or downscales, so every
//     texture path downstream loads the asset at native resolution.
//   - Errors are honest and PLAIN-LANGUAGE (advocate MUST-FIX vocabulary:
//     no spec citations in user-visible strings), same `{ ok: false, error }`
//     shape as the fonts atlas + text-fill routes.
//   - `PRISM_UPLOADS_DIR` env override exists so tests can point the write
//     target at a temp directory; the public URL space is unchanged.

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // ~12 MB cap (images)
const MAX_BINARY_UPLOAD_BYTES = 64 * 1024 * 1024; // ~64 MB cap (glb/video/riv)

/** Client-claimed MIME types we accept (fast reject before the byte sniff). */
const ACCEPTED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
]);

/** CANVAS-FINAL §12.1 — non-image artifact uploads (3D / video / Rive). The
 *  content-hash store name comes from the bytes + a sniffed extension; the
 *  client name/type are only a routing hint here. */
function classifyBinaryUpload(
  type: string,
  lowerName: string,
): { kind: 'mesh' | 'video'; label: string } | null {
  const t = type.toLowerCase();
  if (
    t.includes('gltf-binary') || t.includes('model/gltf') || lowerName.endsWith('.glb') ||
    t.includes('usd') || lowerName.endsWith('.usdz') || lowerName.endsWith('.usd')
  ) {
    return { kind: 'mesh', label: '3d' };
  }
  if (t.startsWith('video/') || lowerName.endsWith('.mp4') || lowerName.endsWith('.webm')) {
    return { kind: 'video', label: 'video' };
  }
  // Rive: store as a binary mesh-class asset (it is a node artifact); keep the
  // .riv extension so the runtime can route it to the Rive layer.
  if (lowerName.endsWith('.riv') || t.includes('rive')) {
    return { kind: 'mesh', label: 'rive' };
  }
  return null;
}

/** sharp-sniffed format → stored extension. sharp reports AVIF as 'heif'
 *  (AV1-compressed HEIF container), so both spellings map to .avif. */
const FORMAT_TO_EXT: Record<string, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  avif: 'avif',
  heif: 'avif',
};

function uploadsDir(): string {
  return (
    process.env.PRISM_UPLOADS_DIR ??
    path.join(process.cwd(), 'public', 'prism-mock', 'uploads')
  );
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(
      'Expected an image upload — send a multipart form with a "file" field.',
      400,
    );
  }

  const entry = form.get('file');
  if (!entry || typeof entry === 'string') {
    return jsonError('No image attached — add your picture as the "file" field.', 400);
  }
  const file = entry as File;

  // CANVAS-FINAL §12.1 — the Change Artifact Upload wizard accepts 3D models
  // (GLB/USDZ), video (MP4/WebM), and Rive (.riv) in addition to images. These
  // binary kinds route through the content-hash store (storeBytes) and return
  // { ok, url, kind, ext }. The IMAGE path below is unchanged (bit-identical).
  const lowerName = (file.name ?? '').toLowerCase();
  const binaryKind = classifyBinaryUpload(file.type, lowerName);
  if (binaryKind) {
    if (file.size > MAX_BINARY_UPLOAD_BYTES) {
      return jsonError('That file is too large — keep it under 64 MB.', 413);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength === 0) {
      return jsonError('That file is empty — pick one with something in it.', 400);
    }
    try {
      const { storeBytes } = await import('@/server/assets/store');
      const ext = lowerName.includes('.') ? lowerName.split('.').pop()! : undefined;
      const stored = await storeBytes(bytes, binaryKind.kind, ext);
      return new Response(
        JSON.stringify({ ok: true, url: stored.url, kind: binaryKind.label, ext: stored.ext }),
        { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return jsonError(`Saving the file failed on the server — ${reason}`, 500);
    }
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError('That image is too large — keep it under 12 MB.', 413);
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return jsonError(
      'That file type is not supported — use an image, a 3D model (GLB/USDZ), a video (MP4), or a Rive file.',
      415,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return jsonError('That file is empty — pick an image with something in it.', 400);
  }
  // Defense in depth: never trust the File's reported size over the bytes.
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return jsonError('That image is too large — keep it under 12 MB.', 413);
  }

  // Authoritative byte sniff + dimension probe via sharp (server-only dynamic
  // import; probe ONLY — the stored bytes are the untouched originals).
  let format: string | undefined;
  let width = 0;
  let height = 0;
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(bytes).metadata();
    format = meta.format;
    width = meta.width ?? 0;
    height = meta.height ?? 0;
    // EXIF orientations 5-8 are 90°-rotated: report the as-displayed box.
    if ((meta.orientation ?? 1) >= 5) {
      [width, height] = [height, width];
    }
  } catch {
    return jsonError(
      'That file does not look like a valid image — try a different one.',
      415,
    );
  }

  const ext = FORMAT_TO_EXT[format ?? ''];
  if (!ext) {
    return jsonError(
      'That image format is not supported — use a PNG, JPEG, WebP, or AVIF image.',
      415,
    );
  }
  if (!width || !height) {
    return jsonError(
      'Could not read the image dimensions — the file may be damaged.',
      415,
    );
  }

  // Content-addressed name: hash + sniffed extension only. Nothing the client
  // sent (file name, MIME string) ever reaches the filesystem path.
  const hash = createHash('sha256').update(bytes).digest('hex');
  const fileName = `${hash}.${ext}`;
  const dir = uploadsDir();

  try {
    await fs.mkdir(dir, { recursive: true });
    const dest = path.join(dir, fileName);
    try {
      await fs.access(dest); // already stored — idempotent re-upload
    } catch {
      await fs.writeFile(dest, bytes);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return jsonError(`Saving the image failed on the server — ${reason}`, 500);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      url: `/prism-mock/uploads/${fileName}`,
      width,
      height,
    }),
    {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    },
  );
}
