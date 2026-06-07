'use client';

/**
 * STEP5 edit-path — verify-in-path (anchor §8, NE-SC-13, runtime RT-SC-06/07).
 *
 * "The rebuild verifies the artifact actually built and renders; if it fails,
 * DO NOT surface a broken/previous state." This module is the functional
 * verification step that runs *inside* the rebuild, immediately after the
 * factory produces the Object3D and before it is shown.
 *
 * What "built + renders" means for a Three.js artifact in this prototype:
 *   - The factory returned a real Object3D (not null/undefined).
 *   - It is NOT the empty-Group stand-in the factory falls back to when a
 *     `createNode` throws or a codeRef module fails to load (FP-R3: "no
 *     empty-Group placeholder mounted as a built artifact"). The fallback is
 *     tagged `name = 'node:<id>:fallback'`.
 *   - It contains at least one *renderable* descendant — a Mesh / Points /
 *     Line / SkinnedMesh / Sprite — OR a pending async artifact load that will
 *     populate it (mesh/coderef nodes graft their content in asynchronously,
 *     so an intentionally-empty group for those modes is "building", not
 *     "failed"). A node whose mode implies inline geometry (sprite / plane /
 *     parallax-plane) but produced no renderable child is a hard failure.
 *
 * Verification is structural (functional layer); the vision layer (screenshot
 * + judge) is the operator's `/prism-verify` pass. Both are required by the
 * canonical-3 "two-layer" rule; this is the half that runs in-process so a
 * broken build never reaches preview.
 */

import type { Object3D } from 'three';
import type { PrismNode } from '@/lib/prism-graph/types';

export interface VerifyResult {
  ok: boolean;
  /** Machine reason on failure, e.g. 'empty-group' | 'fallback-stand-in'. */
  reason?: string;
  /** Count of renderable descendants found (diagnostic). */
  renderableCount: number;
}

const RENDERABLE_TYPES = new Set([
  'Mesh',
  'SkinnedMesh',
  'InstancedMesh',
  'Points',
  'Line',
  'LineSegments',
  'LineLoop',
  'Sprite',
]);

/** Modes that load their artifact asynchronously after createNode returns, so
 *  an empty group at build time is "still building", not a failure. */
const ASYNC_ARTIFACT_MODES = new Set(['mesh']);

function countRenderable(object: Object3D): number {
  let n = 0;
  object.traverse((child) => {
    if (RENDERABLE_TYPES.has((child as { type?: string }).type ?? '')) n++;
  });
  return n;
}

/**
 * Verify a freshly-built artifact. `asyncPending` lets the caller signal that
 * a known async load (GLB / codeRef graft) is in flight for this node, in
 * which case an empty group is tolerated (it will populate). When false (or
 * for inline-geometry modes), an empty group is a hard failure.
 */
export function verifyBuiltNode(
  object: Object3D | null | undefined,
  node: PrismNode,
  asyncPending = false,
): VerifyResult {
  if (!object) {
    return { ok: false, reason: 'no-object', renderableCount: 0 };
  }
  // The factory's catch-block fallback is explicitly tagged — treat as failed.
  if (typeof object.name === 'string' && object.name.endsWith(':fallback')) {
    return { ok: false, reason: 'fallback-stand-in', renderableCount: 0 };
  }
  const renderableCount = countRenderable(object);
  if (renderableCount > 0) {
    return { ok: true, renderableCount };
  }
  // No renderable child yet. Tolerate only when a known async load will fill it.
  const mode = node.renderMode ?? 'sprite';
  const codeRef = node.codeRef ?? null;
  const mayPopulate =
    asyncPending || ASYNC_ARTIFACT_MODES.has(mode) || codeRef !== null;
  // A mesh/coderef node with NO source URL can never populate — still a failure.
  const hasAsyncSource =
    (mode === 'mesh' && !!node.meshUrl) || (!!codeRef && codeRef.length > 0);
  if (mayPopulate && hasAsyncSource) {
    return { ok: true, reason: 'async-pending', renderableCount: 0 };
  }
  return { ok: false, reason: 'empty-group', renderableCount: 0 };
}
