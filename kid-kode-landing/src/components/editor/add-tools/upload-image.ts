// upload-image.ts — Add Object image helpers (P3 Task C).
//
// FROZEN CLIENT SEAM (cross-agent contract, 2026-06-10):
//   uploadImageAsset(file: File): Promise<{ url: string; width: number; height: number }>
//   POSTs the file to /api/prism/assets (multipart) and returns the typed
//   response. Error messages are PLAIN LANGUAGE (advocate MUST-FIX rule: no
//   spec citations, no machine ids in anything a user might see).
//
// Additive helpers (this module's own, not part of the frozen seam):
//   - probeImageUrl(url)        — URL-input path: load the image client-side
//                                 to learn its native dimensions.
//   - imagePlaneSize(w, h)      — native pixel box → scene-unit plane box,
//                                 aspect preserved.
//   - buildImagePopulatePatch() — the exact `updateNode` payload that turns a
//                                 stage-1 bubble into an image-populated node
//                                 (artifact stays `visual.sourceAsset`;
//                                 renderMode 'sprite'; additive schema only).
//
// The mounted artifact does NOT live-swap on a sourceAsset write (ArtifactNode
// memoizes its Object3D by nodeId+codeRef), so the caller pairs this patch
// with the Save-and-Rebuild surgical remount (src/lib/editor/rebuild-node.ts)
// — `sourceAsset` has always been in the build content hash, so the evict +
// version bump rebuilds exactly this node as an image plane.

import type { PrismNode } from '@/lib/prism-graph/types';
import { BUBBLE_CAPTION_DEFAULT } from './create-element-node';

export interface UploadedImageAsset {
  /** Public URL of the stored asset ('/prism-mock/uploads/<hash>.<ext>'). */
  url: string;
  /** Native pixel dimensions (no downscaling anywhere — sharpness directive). */
  width: number;
  height: number;
}

/** Friendly fallbacks per HTTP status when the server body is unreadable. */
const STATUS_FALLBACKS: Record<number, string> = {
  413: 'That image is too large — keep it under 12 MB.',
  415: 'That file type is not supported — use a PNG, JPEG, WebP, or AVIF image.',
};

/**
 * FROZEN SEAM — upload an image file to the Prism asset store.
 *
 * Resolves with the stored asset's public URL and native dimensions; rejects
 * with an Error whose message is safe to show to the user as-is.
 */
export async function uploadImageAsset(file: File): Promise<UploadedImageAsset> {
  const form = new FormData();
  form.append('file', file);

  let res: Response;
  try {
    res = await fetch('/api/prism/assets', { method: 'POST', body: form });
  } catch {
    throw new Error('Upload failed — check your connection and try again.');
  }

  if (!res.ok) {
    let serverMessage: string | null = null;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim() !== '') {
        serverMessage = body.error;
      }
    } catch {
      // fall through to the status fallback
    }
    throw new Error(
      serverMessage ??
        STATUS_FALLBACKS[res.status] ??
        'Upload failed — please try again.',
    );
  }

  let body: { ok?: unknown; url?: unknown; width?: unknown; height?: unknown };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new Error('Upload failed — the server sent back something unexpected.');
  }
  if (
    body.ok !== true ||
    typeof body.url !== 'string' ||
    typeof body.width !== 'number' ||
    typeof body.height !== 'number'
  ) {
    throw new Error('Upload failed — the server sent back something unexpected.');
  }
  return { url: body.url, width: body.width, height: body.height };
}

/**
 * URL-input path: probe an image URL client-side for its native dimensions.
 * Editor-shell scope (the DOM-free discipline scopes to src/lib/prism/**;
 * this is a browser-only editor helper, same as the flyouts it serves).
 */
export function probeImageUrl(url: string): Promise<UploadedImageAsset> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image links can only be added from the editor.'));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('Could not read that image — try a different link.'));
        return;
      }
      resolve({ url, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(
        new Error('Could not load an image from that link — check the URL and try again.'),
      );
    };
    img.src = url;
  });
}

/** Largest scene-unit dimension for a freshly-populated image plane. Sized to
 *  sit comfortably in the canvas viewport band where bubbles spawn. */
export const IMAGE_PLANE_MAX_DIM = 1.2;

/** Native pixel box → scene-unit plane box, aspect preserved, longest side
 *  pinned to IMAGE_PLANE_MAX_DIM. The factory bakes this into PlaneGeometry;
 *  the TEXTURE itself stays native resolution (sharpness directive). */
export function imagePlaneSize(
  width: number,
  height: number,
): { width: number; height: number } {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  const scale = IMAGE_PLANE_MAX_DIM / Math.max(w, h);
  return { width: w * scale, height: h * scale };
}

/** Plain-language caption a populated bubble gets when the user has not
 *  renamed it (machine ids never shown). */
export const IMAGE_ELEMENT_CAPTION = 'Image element';

/**
 * The `updateNode` payload that populates a stage-1 bubble with an image
 * artifact (canvas-spec §6 stage 1 → 2):
 *   - `visual.sourceAsset` = the asset URL (the artifact field — upload, URL,
 *     and generation all end here); renderMode 'sprite' (the image-plane
 *     factory path). `isStage0Bubble` goes false on the merged node.
 *   - `visual.transform` is resized to the image's aspect ratio (position
 *     untouched — the node stays where the user put it).
 *   - the placeholder bubble caption is rewritten to plain 'Image element';
 *     a user-authored caption is preserved.
 * Additive only: nothing existing is deleted or renamed (INV-18).
 */
export function buildImagePopulatePatch(
  node: PrismNode,
  asset: UploadedImageAsset,
): Partial<PrismNode> {
  const { width, height } = imagePlaneSize(asset.width, asset.height);
  const prev = node.visual?.transform;
  const keepCaption =
    typeof node.intent?.caption === 'string' &&
    node.intent.caption.trim() !== '' &&
    node.intent.caption !== BUBBLE_CAPTION_DEFAULT;
  return {
    renderMode: 'sprite',
    visual: {
      ...(node.visual ?? {}),
      sourceAsset: asset.url,
      transform: {
        x: prev?.x ?? 0,
        y: prev?.y ?? 0,
        z: prev?.z ?? 0,
        width,
        height,
      },
      alpha: node.visual?.alpha ?? 1,
    },
    intent: keepCaption
      ? node.intent
      : { ...node.intent, caption: IMAGE_ELEMENT_CAPTION },
  };
}
