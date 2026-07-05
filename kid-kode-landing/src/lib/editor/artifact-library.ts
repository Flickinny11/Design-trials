// CANVAS-FINAL — Change Artifact swap / retain / restore contract
// (canvas-spec §12.2 "Use This … outgoing artifact retained in the artifact
// library"; §11 "Append-only; old snapshots persist in the artifact library";
// criterion 20). Pure functions — no React, no DOM, no store — so the wizard
// UI and any caller share one swap rule. The actual mutation goes through the
// sanctioned path (useGraphSourceStore.updateNode / commitPreviewToSource →
// rebuildNode); this module only computes the patch + the retained entry.
//
// A node's "active artifact" is whichever artifact-bearing fields its
// renderMode reads:
//   image  →  renderMode 'plane'|'sprite'|'parallax-plane' + visual.sourceAsset (+ videoUrl/depthMapUrl)
//   glb    →  renderMode 'mesh' + meshUrl
//   shape  →  renderMode 'mesh' + meshPrimitive (+ faceTextures + materialSpec)
//   text   →  renderMode 'text' + textSpec
// Swapping a new artifact in sets the new live fields AND clears the other
// artifact lanes (so a leftover meshUrl can't shadow a freshly-swapped image).

import type {
  AnimationBinding,
  ArtifactLibraryEntry,
  ArtifactSource,
  FaceTexture,
  ImageSpec,
  MaterialSpec,
  MeshPrimitive,
  PrismNode,
  RenderMode,
  TextSpec,
} from '../prism-graph/types';

/** The artifact kinds the Change Artifact wizard can produce. */
export type ArtifactKind = 'image' | 'mesh-glb' | 'mesh-primitive' | 'video' | 'text';

/** A fully-resolved artifact the wizard hands to `buildArtifactSwap`. Only the
 *  fields relevant to `kind` need be set. URLs are already persisted (the
 *  server stored them through the content-hash asset store). */
export interface ArtifactPayload {
  kind: ArtifactKind;
  source: ArtifactSource;
  /** Plain-language label for the library tile ("Brass sphere · generated"). */
  label?: string;
  /** Natural-language prompt that produced it (generated artifacts). */
  prompt?: string;
  // image / video poster
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  // glb mesh
  meshUrl?: string;
  // primitive shape (+ optional per-face textures / material / animation)
  meshPrimitive?: MeshPrimitive;
  faceTextures?: FaceTexture[];
  materialSpec?: MaterialSpec;
  animationBindings?: AnimationBinding[];
  imageSpec?: ImageSpec;
  // video
  videoUrl?: string;
  posterUrl?: string;
  // optional depth map for parallax planes
  depthMapUrl?: string | null;
  // text
  textSpec?: TextSpec;
  /** Optional still preview for the library tile. */
  thumbnailUrl?: string;
}

let artifactSeq = 0;
/** Stable-ish id; combines a base36 counter with a time component when one is
 *  available. (No reliance on Math.random.) */
export function makeArtifactEntryId(): string {
  artifactSeq += 1;
  const t = typeof Date !== 'undefined' ? Date.now().toString(36) : '0';
  return `al-${t}-${artifactSeq.toString(36)}`;
}

function nowIso(): string {
  return typeof Date !== 'undefined' ? new Date().toISOString() : '';
}

/** True when the node already has a built artifact worth retaining (i.e. it is
 *  not an empty bubble). */
export function nodeHasArtifact(node: PrismNode): boolean {
  const rm = node.renderMode;
  if (rm === 'text') return !!node.textSpec?.content;
  if (rm === 'mesh') return !!node.meshUrl || !!node.meshPrimitive;
  // image-bearing render modes (plane / sprite / parallax-plane / undefined)
  return !!node.visual?.sourceAsset || !!node.videoUrl;
}

/** Snapshot the node's CURRENT artifact into a library entry, or null if the
 *  node has nothing to retain yet. Captures only the fields the current
 *  renderMode reads. */
export function snapshotCurrentArtifact(node: PrismNode): ArtifactLibraryEntry | null {
  if (!nodeHasArtifact(node)) return null;
  const rm: RenderMode = node.renderMode ?? 'sprite';
  const base = {
    id: makeArtifactEntryId(),
    at: nowIso(),
    renderMode: rm,
    source: 'initial' as ArtifactSource,
    label: artifactLabel(node),
  };
  if (rm === 'text') {
    return { ...base, textSpec: node.textSpec };
  }
  if (rm === 'mesh') {
    return {
      ...base,
      meshUrl: node.meshUrl ?? null,
      meshPrimitive: node.meshPrimitive,
      faceTextures: node.faceTextures,
      thumbnailUrl: node.visual?.sourceAsset,
    };
  }
  return {
    ...base,
    sourceAsset: node.visual?.sourceAsset,
    videoUrl: node.videoUrl ?? null,
    depthMapUrl: node.depthMapUrl ?? null,
    thumbnailUrl: node.visual?.sourceAsset,
  };
}

/** A short plain-language label for the node's current artifact. */
function artifactLabel(node: PrismNode): string {
  const name = node.intent?.caption?.split(' · ')[0] || node.subtype || 'element';
  const rm = node.renderMode ?? 'sprite';
  if (rm === 'text') return `${name} · text`;
  if (rm === 'mesh') return node.meshPrimitive ? `${name} · shape` : `${name} · 3D model`;
  if (node.videoUrl) return `${name} · video`;
  return `${name} · image`;
}

/** Map a wizard `ArtifactKind` to the renderMode the swap should install. */
function renderModeForKind(kind: ArtifactKind): RenderMode {
  switch (kind) {
    case 'mesh-glb':
    case 'mesh-primitive':
      return 'mesh';
    case 'text':
      return 'text';
    case 'image':
    case 'video':
    default:
      return 'plane';
  }
}

/** Build the source-store patch that installs `payload` as the node's active
 *  artifact, clearing the other artifact lanes. Also returns the retained
 *  entry (the node's prior artifact) to append to `artifactLibrary` BEFORE the
 *  patch is applied — pass `retainPrior: false` to skip retention (e.g. when
 *  the node was an empty bubble). */
export function buildArtifactSwap(
  node: PrismNode,
  payload: ArtifactPayload,
  opts: { retainPrior?: boolean } = {},
): { patch: Partial<PrismNode>; retained: ArtifactLibraryEntry | null } {
  const retainPrior = opts.retainPrior ?? true;
  const retained = retainPrior ? snapshotCurrentArtifact(node) : null;

  const library = node.artifactLibrary ? [...node.artifactLibrary] : [];
  if (retained) library.push(retained);

  const rm = renderModeForKind(payload.kind);
  const patch: Partial<PrismNode> = {
    renderMode: rm,
    artifactLibrary: library.length > 0 ? library : undefined,
  };

  // Reset every artifact lane, then set the live one. visual stays an object
  // (transform/shape preserved); only sourceAsset is rewritten.
  const visual = { ...node.visual };

  if (payload.kind === 'image' || payload.kind === 'video') {
    visual.sourceAsset = payload.imageUrl ?? payload.posterUrl ?? visual.sourceAsset;
    patch.visual = visual;
    patch.videoUrl = payload.kind === 'video' ? (payload.videoUrl ?? null) : null;
    patch.depthMapUrl = payload.depthMapUrl ?? null;
    patch.meshUrl = null;
    patch.meshPrimitive = undefined;
    patch.faceTextures = undefined;
    if (payload.imageSpec) patch.imageSpec = payload.imageSpec;
  } else if (payload.kind === 'mesh-glb') {
    patch.meshUrl = payload.meshUrl ?? null;
    patch.meshPrimitive = undefined;
    patch.faceTextures = undefined;
    patch.videoUrl = null;
    if (payload.thumbnailUrl) {
      visual.sourceAsset = payload.thumbnailUrl;
      patch.visual = visual;
    }
  } else if (payload.kind === 'mesh-primitive') {
    patch.meshPrimitive = payload.meshPrimitive;
    patch.faceTextures = payload.faceTextures && payload.faceTextures.length > 0
      ? payload.faceTextures
      : undefined;
    patch.meshUrl = null;
    patch.videoUrl = null;
    if (payload.materialSpec) patch.materialSpec = payload.materialSpec;
    if (payload.animationBindings) patch.animationBindings = payload.animationBindings;
  } else if (payload.kind === 'text') {
    patch.textSpec = payload.textSpec;
  }

  return { patch, retained };
}

/** Build the patch that RESTORES a library entry as the node's active
 *  artifact. The then-current artifact is retained in turn (append-only,
 *  never lossy). */
export function buildArtifactRestore(
  node: PrismNode,
  entry: ArtifactLibraryEntry,
): { patch: Partial<PrismNode> } {
  const payload: ArtifactPayload = entryToPayload(entry);
  const { patch } = buildArtifactSwap(node, payload, { retainPrior: true });
  return { patch };
}

/** Convert a stored library entry back into a swap payload. */
export function entryToPayload(entry: ArtifactLibraryEntry): ArtifactPayload {
  if (entry.renderMode === 'text') {
    return { kind: 'text', source: entry.source, label: entry.label, prompt: entry.prompt, textSpec: entry.textSpec };
  }
  if (entry.renderMode === 'mesh') {
    if (entry.meshPrimitive) {
      return {
        kind: 'mesh-primitive',
        source: entry.source,
        label: entry.label,
        prompt: entry.prompt,
        meshPrimitive: entry.meshPrimitive,
        faceTextures: entry.faceTextures,
        thumbnailUrl: entry.thumbnailUrl,
      };
    }
    return {
      kind: 'mesh-glb',
      source: entry.source,
      label: entry.label,
      prompt: entry.prompt,
      meshUrl: entry.meshUrl ?? undefined,
      thumbnailUrl: entry.thumbnailUrl,
    };
  }
  // image-bearing
  if (entry.videoUrl) {
    return {
      kind: 'video',
      source: entry.source,
      label: entry.label,
      prompt: entry.prompt,
      videoUrl: entry.videoUrl,
      posterUrl: entry.sourceAsset,
      depthMapUrl: entry.depthMapUrl,
    };
  }
  return {
    kind: 'image',
    source: entry.source,
    label: entry.label,
    prompt: entry.prompt,
    imageUrl: entry.sourceAsset,
    depthMapUrl: entry.depthMapUrl,
  };
}
