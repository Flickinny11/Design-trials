// Default render-mode factory — Plan §P8.
//
// `defaultRenderModeFactory(node, ctx, opts?)` is the per-node fallback used
// when a `PrismNode` carries no `codeRef` (or its codeRef module fails to
// load). It synthesizes the geometry/material/asset wiring implied by
// `node.renderMode`:
//
//   sprite          — PlaneGeometry(1,1) + MeshBasicNodeMaterial.map.
//   plane           — PlaneGeometry(1,1) + MeshBasicNodeMaterial.map.
//                     (Texture aspect-ratio resize lands when load resolves.)
//   parallax-plane  — Tessellated PlaneGeometry + MeshStandardNodeMaterial
//                     wired through `displacementShader` (TSL).
//   mesh            — `ctx.glbLoader.loadGLB(node.meshUrl)`; the resolved
//                     scene is reparented under the returned Group.
//
// Spec refs:
//   - PRISM-RENDERER-MIGRATION-SPEC.md §4 (RenderMode values).
//   - PRISM-RENDERER-MIGRATION-SPEC.md §6 (Asset pipeline — sprite, depth,
//     GLB).
//   - PRISM-RENDERER-MIGRATION-SPEC.md §7 (Cinematic primitives — apply via
//     `ctx.primitives[name](target, params)`; never inline).
//   - PRISM-RENDERER-MIGRATION-SPEC.md §8 (createNode contract: synchronous,
//     returns Object3D; userData.cleanup walks resources + GSAP timelines).
//   - Amendment 0002 §A.2 (loader-cache owns texture lifetime — cleanup must
//     NOT dispose textures).
//
// The exported `defaultRenderModeFactory` is the un-curried form (takes
// `opts`); HL09's per-node factory wraps it into the `CreateNodeFn`
// signature (`(node, ctx) => Object3D`) by partial-applying opts.

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Object3D,
  type Texture,
} from 'three';
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
} from 'three/webgpu';
import type { gsap } from 'gsap';
import { applyScenePosition, type NodeContext } from '../shared/adapter';
import { displacementShader } from '../shared/shaders/displacement.tsl';
import type {
  CinematicPrimitiveRef,
  PrismNode,
  PrismTextContent,
} from '@/lib/prism-graph/types';
import type { PrimitiveResult } from '../shared/primitives/types';

export interface DefaultFactoryOpts {
  /** When true, `node.cinematicPrimitives` are applied via `ctx.primitives`.
   *  Editor-side ArtifactNode passes `false` so authoring previews stay
   *  static; the live runtime passes `true`. */
  runPrimitives?: boolean;
  /** Runtime uses WebGPU NodeMaterials; editor R3F canvases use WebGL. */
  nodeMaterials?: boolean;
}

interface DisposableMaterial {
  dispose?: () => void;
  map?: Texture | null;
  displacementMap?: Texture | null;
  needsUpdate?: boolean;
  colorNode?: unknown;
}

function visualPlaneSize(node: PrismNode): { width: number; height: number } {
  const width = node.visual?.transform?.width;
  const height = node.visual?.transform?.height;
  return {
    width: typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : 1,
    height: typeof height === 'number' && Number.isFinite(height) && height > 0 ? height : 1,
  };
}

/** Spec §8: createNode is synchronous and returns Object3D. Async asset
 *  loads are kicked off here and assigned when they resolve. */
export function defaultRenderModeFactory(
  node: PrismNode,
  ctx: NodeContext,
  opts: DefaultFactoryOpts = {},
): Object3D {
  const group = new Group();
  group.name = `node:${node.nodeId}`;
  group.userData.nodeId = node.nodeId;
  group.userData.handlers = {};

  const disposables: BufferGeometry[] = [];
  const materialsToDispose: DisposableMaterial[] = [];
  const primitiveResults: PrimitiveResult[] = [];

  const renderMode = node.renderMode ?? 'sprite';
  const sourceAsset = node.visual?.sourceAsset;
  const useNodeMaterials = opts.nodeMaterials !== false;
  const { width, height } = visualPlaneSize(node);

  if (renderMode === 'sprite' || renderMode === 'plane') {
    const geo = new PlaneGeometry(width, height);
    const mat = useNodeMaterials
      ? new MeshBasicNodeMaterial({ transparent: true })
      : new MeshBasicMaterial({ transparent: true });
    if (sourceAsset) {
      void ctx.textureLoader
        .loadTexture(sourceAsset)
        .then((tex) => {
          mat.map = tex;
          mat.needsUpdate = true;
        })
        .catch(() => { /* swallow — decorative */ });
    }
    const mesh = new Mesh(geo, mat);
    group.add(mesh);
    disposables.push(geo);
    materialsToDispose.push(mat as unknown as DisposableMaterial);
  } else if (renderMode === 'parallax-plane') {
    // §9.C — tessellated 64x64 plane + TSL displacement node.
    const geo = new PlaneGeometry(width, height, 64, 64);
    const mat = useNodeMaterials
      ? new MeshStandardNodeMaterial({ transparent: true })
      : new MeshStandardMaterial({ transparent: true });
    if (sourceAsset && node.depthMapUrl) {
      const baseP = ctx.textureLoader.loadTexture(sourceAsset);
      const depthP = ctx.textureLoader.loadTexture(node.depthMapUrl);
      void Promise.all([baseP, depthP])
        .then(([baseTex, depthTex]) => {
          const m = mat as unknown as DisposableMaterial;
          m.map = baseTex;
          m.displacementMap = depthTex;
          if (useNodeMaterials) {
            m.colorNode = displacementShader({
              baseTexture: baseTex,
              displacementMap: depthTex,
              intensity: 0.05,
            });
          }
          m.needsUpdate = true;
        })
        .catch(() => { /* swallow */ });
    }
    const mesh = new Mesh(geo, mat);
    group.add(mesh);
    disposables.push(geo);
    materialsToDispose.push(mat as unknown as DisposableMaterial);
  } else if (renderMode === 'mesh') {
    if (node.meshUrl) {
      void ctx.glbLoader
        .loadGLB(node.meshUrl)
        .then((gltf) => {
          if (!gltf?.scene) return;
          // Loader cache hands the same Object3D to every caller; clone so
          // each node owns its own subtree (THREE.add() unparents otherwise).
          const cloned = gltf.scene.clone(true);
          group.add(cloned);
        })
        .catch(() => { /* swallow */ });
    }
  }

  // Spec §8 — apply scene position to the returned Group.
  applyScenePosition(group, node.scenePosition);

  // §13 — text rendering via MSDF. Path is `node.intent.visualSpec.textContent`.
  const textContent: PrismTextContent[] = node.intent?.visualSpec?.textContent ?? [];
  for (const t of textContent) {
    if (!t || !t.text) continue;
    try {
      const textObj = ctx.fontAtlas.createText(t.text, {
        fontSize: t.typography?.fontSize,
        color: t.typography?.color,
      });
      group.add(textObj);
    } catch {
      // Atlas not yet warm — surface as soft failure, not a runtime crash.
    }
  }

  // §7 — apply cinematic primitives via ctx.primitives, never inline.
  if (opts.runPrimitives) {
    const primitives: CinematicPrimitiveRef[] = node.cinematicPrimitives ?? [];
    for (const ref of primitives) {
      const fn = ctx.primitives[ref.name];
      if (typeof fn !== 'function') continue;
      try {
        const result = fn(group, ref.params);
        if (result) primitiveResults.push(result);
      } catch {
        /* primitive registration error — keep node mounted */
      }
    }
  }

  // §8 — userData.cleanup. Per Amendment 0002 §A.2, do NOT dispose loader-
  // cache textures; they outlive the Object3D.
  group.userData.cleanup = () => {
    for (const result of primitiveResults) {
      try {
        const tl = result.timeline as gsap.core.Timeline | { kill?: () => void };
        if (tl && typeof (tl as { kill?: () => void }).kill === 'function') {
          (tl as { kill: () => void }).kill();
        }
      } catch { /* ignore */ }
      try { result.cleanup?.(); } catch { /* ignore */ }
    }
    primitiveResults.length = 0;
    for (const geo of disposables) {
      try { geo.dispose(); } catch { /* ignore */ }
    }
    for (const m of materialsToDispose) {
      try { m.dispose?.(); } catch { /* ignore */ }
    }
  };

  return group;
}
