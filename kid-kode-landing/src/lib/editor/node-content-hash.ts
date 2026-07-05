'use client';

/**
 * STEP5 edit-path — builtSnapshot content hash (runtime-spec §7 / canvas-spec §11).
 *
 * Every node's `builtSnapshot` is "keyed by a content hash over its
 * build-relevant inputs (artifact source + visual/material/animation/lighting/
 * text spec + composed transform + caption/version)" (runtime §7). This module
 * is the single definition of that hash for the editor build path.
 *
 * The hash is a deterministic, dependency-free FNV-1a over a *canonical*
 * projection of the node — only the fields the factory actually reads when it
 * builds the artifact. Two nodes that would produce an identical artifact hash
 * identically; an edit to any build-relevant field changes the hash (and only
 * that node's). Fields that are NOT build-relevant (selection, dirty flag,
 * transient ids) are excluded so they never spuriously invalidate a snapshot.
 *
 * Runtime-spec §13 explicitly permits a built-in over a content-hash library;
 * FNV-1a is stable across runs and process restarts (no Math.random / Date).
 */

import type { PrismNode } from '@/lib/prism-graph/types';

/** Stable stringify: object keys sorted recursively so key order never
 *  perturbs the hash. Arrays keep order (order is semantic for primitives /
 *  keyframes / text runs). */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

/** FNV-1a 32-bit, returned as 8-char hex. Deterministic and synchronous. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts to stay in integer range.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The canonical build-relevant projection of a PrismNode. Anything the
 *  `defaultRenderModeFactory` / coderef factory reads at build time belongs
 *  here; anything they ignore must NOT (so it can't invalidate the snapshot). */
function buildRelevantProjection(node: PrismNode): Record<string, unknown> {
  return {
    renderMode: node.renderMode ?? 'sprite',
    codeRef: node.codeRef ?? null,
    meshUrl: node.meshUrl ?? null,
    depthMapUrl: node.depthMapUrl ?? null,
    sourceAsset: node.visual?.sourceAsset ?? null,
    // Plane geometry size is baked into PlaneGeometry at createNode time.
    transform: node.visual?.transform ?? null,
    shape: node.visual?.shape ?? null,
    alpha: node.visual?.alpha ?? null,
    // MSDF text runs are built into the artifact group.
    textContent: node.intent?.visualSpec?.textContent ?? null,
    // Caption is part of the build/version identity (runtime §7) — a re-caption
    // is a build-relevant change for repair + the future AI builder.
    caption: node.intent?.caption ?? null,
    scenePosition: node.scenePosition ?? null,
    canvasTransform: node.canvasTransform ?? null,
    cinematicPrimitives: node.cinematicPrimitives ?? null,
    keyframes: node.keyframes ?? null,
    scrollBinding: node.scrollBinding ?? null,
    // P1 TEXT (canvas-spec §7) — the text factory branch reads textSpec at
    // build time, so a committed textSpec change must invalidate the snapshot.
    textSpec: node.textSpec ?? null,
    // P3 IMAGE (canvas-spec §5) — the sprite/plane/parallax-plane branches
    // read imageSpec at build time, so a committed imageSpec change must
    // invalidate the snapshot (same rule as textSpec).
    imageSpec: node.imageSpec ?? null,
    // P4 3D-OBJECT (canvas-spec §5) — the mesh branch reads meshPrimitive at
    // build time (geometry from kind + params), so a committed meshPrimitive
    // change must invalidate the snapshot (same rule as textSpec/imageSpec).
    meshPrimitive: node.meshPrimitive ?? null,
    // CANVAS-FINAL §12.1 (criterion 19) — the mesh branch reads faceTextures at
    // build time (per-face material array), so a committed face-mapping change
    // must invalidate the snapshot so the surgical rebuild re-textures the faces.
    faceTextures: node.faceTextures ?? null,
    // EDITOR-EXP C8-A / C9 — §11 MeshPhysical material spec + the §10
    // lit/unlit opt-in are BOTH read by `defaultRenderModeFactory` at build
    // time (buildLitTextureMaterial / resolveMaterialSpec; receivesLighting
    // selects the lit vs unlit material branch). The Material tab + the
    // canvas object flyout + the Visual-tab color pickers all stage these on
    // the preview overlay → on Save they must invalidate the snapshot so the
    // surgical Save-and-Rebuild re-realizes the material. Previously omitted,
    // which let a committed material/lighting edit slip past the rebuild
    // hash-gate (rebuild-node.ts step 2) as a no-op.
    materialSpec: node.materialSpec ?? null,
    receivesLighting: node.receivesLighting ?? null,
  };
}

/** Content hash over a node's build-relevant inputs. Stable across runs. */
export function computeNodeContentHash(node: PrismNode): string {
  return fnv1a(stableStringify(buildRelevantProjection(node)));
}
