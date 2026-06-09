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
import type { gsap } from 'gsap';
import { applyScenePosition, type NodeContext } from '../shared/adapter';
import {
  resolveReceivesLighting,
  buildUnlitMaterial,
  buildLitTextureMaterial,
  buildPhysicalMaterial,
  applyMaterialSpec,
  resolveMaterialSpec,
} from '../shared/material-system';
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
  // STEP7 — detachers returned by the driver dispatch (one per attached
  // primitive). Run on cleanup to unsubscribe scroll/pointer/state/event
  // wiring + unregister the per-frame onTick, WITHOUT killing the timeline
  // (the primitiveResults loop below owns kill()).
  const driverDetachers: Array<() => void> = [];

  const renderMode = node.renderMode ?? 'sprite';
  const sourceAsset = node.visual?.sourceAsset;
  const useNodeMaterials = opts.nodeMaterials !== false;
  const { width, height } = visualPlaneSize(node);

  if (renderMode === 'sprite' || renderMode === 'plane') {
    const geo = new PlaneGeometry(width, height);
    // §10 decision 7 / criterion 17: image planes are UNLIT by default so
    // lights/env never touch the baked texture. A node may opt in to lighting
    // (receivesLighting=true) to catch scene light (e.g. a metallic text fill).
    // Non-node-material (WebGL editor) path keeps the legacy MeshBasicMaterial
    // verbatim — byte-identical to before for default nodes.
    let mat: DisposableMaterial & { map?: Texture | null; needsUpdate?: boolean };
    if (useNodeMaterials) {
      const lit = resolveReceivesLighting(node);
      mat = (lit
        ? buildLitTextureMaterial({ spec: node.materialSpec })
        : buildUnlitMaterial({ transparent: true })) as unknown as DisposableMaterial & {
        map?: Texture | null;
        needsUpdate?: boolean;
      };
    } else {
      // Legacy (editor / non-node-material) path. Default image planes stay
      // MeshBasicMaterial — UNLIT and byte-identical to before. A node that opts
      // IN (receivesLighting=true) becomes MeshStandardMaterial so the editor's
      // HubLighting actually lights it (criterion 17 opt-in on the editor surface).
      const lit = resolveReceivesLighting(node);
      mat = (lit
        ? new MeshStandardMaterial({ transparent: true })
        : new MeshBasicMaterial({ transparent: true })) as unknown as DisposableMaterial & {
        map?: Texture | null;
        needsUpdate?: boolean;
      };
    }
    if (sourceAsset) {
      void ctx.textureLoader
        .loadTexture(sourceAsset)
        .then((tex) => {
          mat.map = tex;
          mat.needsUpdate = true;
        })
        .catch(() => { /* swallow — decorative */ });
    }
    const mesh = new Mesh(geo, mat as unknown as MeshBasicMaterial);
    group.add(mesh);
    disposables.push(geo);
    materialsToDispose.push(mat as unknown as DisposableMaterial);
  } else if (renderMode === 'parallax-plane') {
    // §9.C — tessellated 64x64 plane + TSL displacement node.
    // §10 decision 7 / criterion 17: an image plane is UNLIT by default, so the
    // baked texture (carried by the displacement colorNode) is shown verbatim.
    // A node may opt in to lighting (receivesLighting=true) to catch scene light.
    // The non-node-material (WebGL editor) path keeps the legacy
    // MeshStandardMaterial verbatim — byte-identical to before for default nodes.
    const geo = new PlaneGeometry(width, height, 64, 64);
    let mat: DisposableMaterial;
    if (useNodeMaterials) {
      const lit = resolveReceivesLighting(node);
      if (lit) {
        const litMat = buildLitTextureMaterial({ spec: node.materialSpec });
        litMat.transparent = true;
        mat = litMat as unknown as DisposableMaterial;
      } else {
        mat = buildUnlitMaterial({ transparent: true }) as unknown as DisposableMaterial;
      }
    } else {
      mat = new MeshStandardMaterial({ transparent: true }) as unknown as DisposableMaterial;
    }
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
    const mesh = new Mesh(geo, mat as unknown as MeshStandardMaterial);
    group.add(mesh);
    disposables.push(geo);
    materialsToDispose.push(mat);
  } else if (renderMode === 'mesh') {
    if (node.meshUrl) {
      // §10 decision 7: meshes are LIT by default. When the node carries a
      // MaterialSpec, route the mesh material through buildPhysicalMaterial
      // (full PBR). Either way, lit meshes cast + receive shadows so the
      // lighting rig's shadow path has occluders. The resolved spec is applied
      // even without an explicit materialSpec so the lit defaults are explicit.
      const lit = resolveReceivesLighting(node);
      const meshSpec = node.materialSpec
        ? resolveMaterialSpec(node.materialSpec)
        : null;
      void ctx.glbLoader
        .loadGLB(node.meshUrl)
        .then((gltf) => {
          if (!gltf?.scene) return;
          // Loader cache hands the same Object3D to every caller; clone so
          // each node owns its own subtree (THREE.add() unparents otherwise).
          const cloned = gltf.scene.clone(true);
          cloned.traverse((child) => {
            if (!(child instanceof Mesh)) return;
            if (lit) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
            if (meshSpec) {
              // Replace the GLB material (loader-cache-owned, untouched) with a
              // node-owned physical material configured from the spec; only the
              // ones we create get disposed on cleanup.
              const physical = buildPhysicalMaterial(meshSpec);
              applyMaterialSpec(physical, meshSpec);
              child.material = physical;
              materialsToDispose.push(physical as unknown as DisposableMaterial);
            }
          });
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
  // STEP7 — and wire each one to its declared DRIVER via ctx.drivers so the
  // node's own animation PLAYS under its own trigger (ScrollDriver /
  // PointerDriver / StateDriver / EventDriver). The driver only plays what the
  // primitive already built; it never authors motion or edits keyframes
  // (INV-6).
  if (opts.runPrimitives) {
    const primitives: CinematicPrimitiveRef[] = node.cinematicPrimitives ?? [];
    for (const ref of primitives) {
      const fn = ctx.primitives[ref.name];
      if (typeof fn !== 'function') continue;
      try {
        const result = fn(group, ref.params);
        if (result) {
          primitiveResults.push(result);
          if (ctx.drivers) {
            ctx.drivers.hub.registerNodeResult(node.nodeId, result);
            const detach = ctx.drivers.attach(result, ref.trigger, {
              nodeId: node.nodeId,
            });
            driverDetachers.push(detach);
          }
        }
      } catch {
        /* primitive registration error — keep node mounted */
      }
    }
  }

  // §8 — userData.cleanup. Per Amendment 0002 §A.2, do NOT dispose loader-
  // cache textures; they outlive the Object3D.
  group.userData.cleanup = () => {
    // STEP7 — detach driver wiring first (unsubscribe scroll/pointer/state/
    // event + unregister onTick) so a killed timeline can't be re-driven.
    for (const detach of driverDetachers) {
      try { detach(); } catch { /* ignore */ }
    }
    driverDetachers.length = 0;
    if (opts.runPrimitives && ctx.drivers) {
      try { ctx.drivers.hub.clearNodeResults(node.nodeId); } catch { /* ignore */ }
    }
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
