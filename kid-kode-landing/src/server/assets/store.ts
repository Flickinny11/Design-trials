import 'server-only';

// CANVAS-FINAL — content-hash asset store (server side).
//
// One URL space for uploaded AND generated artifacts (canvas-spec §12). Mirrors
// the discipline of the upload route (/api/prism/assets): content-addressed
// names, originals stored verbatim (no re-encode, sharpness directive),
// idempotent. This module adds two things the routes need:
//
//   • storeRemoteAsset(url, kind) — download an upstream (fal-hosted) result
//     and persist it through the same store, so a generated image / glb / mp4
//     lands at /prism-mock/uploads/<hash>.<ext> exactly like an upload.
//   • toFalReachableUrl(localOrRemote) — fal can't fetch our localhost asset
//     URLs, so resolve a local /prism-mock path to a fal.storage URL (upload
//     the bytes once) before handing it to an edit / 3D / video call.
//
// Raw FAL_KEY stays server-only (fal.storage.upload reads the configured creds).

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fal } from '@fal-ai/client';

export type AssetKind = 'image' | 'mesh' | 'video';

export interface StoredAsset {
  url: string;
  width?: number;
  height?: number;
  bytes: number;
  ext: string;
}

const MAX_REMOTE_BYTES = 64 * 1024 * 1024; // 64 MB ceiling for glb/video

function uploadsDir(): string {
  return (
    process.env.PRISM_UPLOADS_DIR ??
    path.join(process.cwd(), 'public', 'prism-mock', 'uploads')
  );
}

function publicUrlFor(fileName: string): string {
  // PRISM_UPLOADS_DIR override keeps the same public URL space.
  return `/prism-mock/uploads/${fileName}`;
}

let falConfigured = false;
function ensureFal(): void {
  if (falConfigured) return;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('Media generation is not configured on this server.');
  fal.config({ credentials: key });
  falConfigured = true;
}

const IMAGE_FORMAT_TO_EXT: Record<string, string> = {
  png: 'png', jpeg: 'jpg', webp: 'webp', avif: 'avif', heif: 'avif',
};

/** Sniff/extension for a non-image binary by content-type + URL hint. */
function binaryExt(kind: AssetKind, contentType: string, url: string): string {
  const lowerUrl = url.toLowerCase();
  if (kind === 'mesh') {
    if (lowerUrl.endsWith('.glb') || contentType.includes('gltf-binary') || contentType.includes('model/gltf')) return 'glb';
    if (lowerUrl.endsWith('.usdz')) return 'usdz';
    return 'glb';
  }
  // video
  if (lowerUrl.endsWith('.webm') || contentType.includes('webm')) return 'webm';
  return 'mp4';
}

async function writeContentAddressed(bytes: Buffer, ext: string): Promise<string> {
  const hash = createHash('sha256').update(bytes).digest('hex');
  const fileName = `${hash}.${ext}`;
  const dir = uploadsDir();
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, fileName);
  try {
    await fs.access(dest); // idempotent
  } catch {
    await fs.writeFile(dest, bytes);
  }
  return fileName;
}

/** Persist raw bytes (an uploaded File or fetched buffer) through the store.
 *  `hintExt` (lower-case, no dot) is used for non-image kinds; images are
 *  sniffed by sharp regardless of the hint. */
export async function storeBytes(
  bytes: Buffer,
  kind: AssetKind,
  hintExt?: string,
): Promise<StoredAsset> {
  if (bytes.byteLength === 0) throw new Error('That file is empty.');
  if (bytes.byteLength > MAX_REMOTE_BYTES) throw new Error('That file is too large to store.');
  if (kind === 'image') {
    let format: string | undefined;
    let width = 0;
    let height = 0;
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(bytes).metadata();
      format = meta.format;
      width = meta.width ?? 0;
      height = meta.height ?? 0;
      if ((meta.orientation ?? 1) >= 5) [width, height] = [height, width];
    } catch {
      throw new Error('That image could not be read.');
    }
    const ext = IMAGE_FORMAT_TO_EXT[format ?? ''] ?? 'png';
    const fileName = await writeContentAddressed(bytes, ext);
    return { url: publicUrlFor(fileName), width, height, bytes: bytes.byteLength, ext };
  }
  const ext = (hintExt && /^[a-z0-9]{1,5}$/.test(hintExt)) ? hintExt : (kind === 'mesh' ? 'glb' : 'mp4');
  const fileName = await writeContentAddressed(bytes, ext);
  return { url: publicUrlFor(fileName), bytes: bytes.byteLength, ext };
}

/** Download an upstream asset and persist it through the content-hash store. */
export async function storeRemoteAsset(url: string, kind: AssetKind): Promise<StoredAsset> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not retrieve the generated file (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error('The generated file came back empty.');
  if (buf.byteLength > MAX_REMOTE_BYTES) throw new Error('The generated file is too large to store.');

  if (kind === 'image') {
    let format: string | undefined;
    let width = 0;
    let height = 0;
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(buf).metadata();
      format = meta.format;
      width = meta.width ?? 0;
      height = meta.height ?? 0;
      if ((meta.orientation ?? 1) >= 5) [width, height] = [height, width];
    } catch {
      throw new Error('The generated image could not be read.');
    }
    const ext = IMAGE_FORMAT_TO_EXT[format ?? ''] ?? 'png';
    const fileName = await writeContentAddressed(buf, ext);
    return { url: publicUrlFor(fileName), width, height, bytes: buf.byteLength, ext };
  }

  const contentType = res.headers.get('content-type') ?? '';
  const ext = binaryExt(kind, contentType, url);
  const fileName = await writeContentAddressed(buf, ext);
  return { url: publicUrlFor(fileName), bytes: buf.byteLength, ext };
}

/** Map a local public asset URL to an absolute file path, or null if it is not
 *  a local public path. */
function localPublicPath(url: string): string | null {
  if (!url.startsWith('/')) return null;
  // /prism-mock/uploads/<file> → PRISM_UPLOADS_DIR/<file> (honor the override);
  // any other /x → public/x.
  const uploadsPrefix = '/prism-mock/uploads/';
  if (url.startsWith(uploadsPrefix)) {
    return path.join(uploadsDir(), url.slice(uploadsPrefix.length));
  }
  return path.join(process.cwd(), 'public', url.replace(/^\//, ''));
}

const FAL_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif',
};

/** Resolve an image URL to one fal can fetch. Local public paths are uploaded
 *  to fal.storage (once); already-remote https URLs pass through. */
export async function toFalReachableUrl(url: string): Promise<string> {
  if (/^https?:\/\//i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)) {
    return url; // already publicly reachable
  }
  const localPath = localPublicPath(url);
  if (!localPath) throw new Error('That image is not available to generate from.');
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(localPath);
  } catch {
    throw new Error('That image could not be read for generation.');
  }
  ensureFal();
  const ext = (path.extname(localPath).slice(1) || 'png').toLowerCase();
  const type = FAL_MIME[ext] ?? 'image/png';
  const uploaded = await fal.storage.upload(new Blob([bytes], { type }));
  if (typeof uploaded !== 'string') throw new Error('Could not prepare the image for generation.');
  return uploaded;
}
