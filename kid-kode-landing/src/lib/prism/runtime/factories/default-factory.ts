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
//   mesh            — `node.meshPrimitive` (P4): synchronous generated
//                     geometry (cube/sphere/…) + MeshPhysicalNodeMaterial,
//                     with the live setPrimitive/setMaterialSpec handle.
//                     Otherwise `ctx.glbLoader.loadGLB(node.meshUrl)`; the
//                     resolved scene is reparented under the returned Group.
//                     A node carrying BOTH renders the primitive (precedence).
//   text            — Prism TextObject (real MSDF glyphs, canvas-spec §7 /
//                     criterion 26) styled by `node.textSpec`; atlas via the
//                     shared font-registry cache (criterion 27).
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
  Box3,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type BufferGeometry,
  type Object3D,
  type Texture,
} from 'three';
import type { gsap } from 'gsap';
import { applyScenePosition, type NodeContext } from '../shared/adapter';
import {
  peekTextAtlas,
  resolveTextAtlas,
  peekTextOutlines,
  resolveTextOutlines,
} from '../shared/text-atlas';
import { createTextObject } from '../../text/text-object';
import { createTextObject3D } from '../../text/text-object-3d';
import type { LoadedFontAtlas, TextObjectHandle } from '../../text/contract';
import type { LoadedFontOutlines } from '../../text/contract-3d';
import { TEXT_SPEC_DEFAULT, type TextSpec } from '../../../prism-graph/types';
import {
  resolveReceivesLighting,
  buildUnlitMaterial,
  buildLitTextureMaterial,
  buildPhysicalMaterial,
  applyMaterialSpec,
  resolveMaterialSpec,
  tagUnlitObject,
} from '../shared/material-system';
import { displacementShader } from '../shared/shaders/displacement.tsl';
// P3 IMAGE (canvas-spec §5) — per-node ImageSpec presentation (fit/crop via a
// per-node texture-clone window, TSL corner mask, opacity multiply). All
// in-place; the texture is never re-rendered. See image-spec.ts header.
import {
  applyImageSpec,
  disposeImageSpec,
  isIdentityUvWindow,
  readImageSpecTexture,
  readImageSpecWindow,
} from '../shared/image-spec';
// P4 3D-OBJECT (canvas-spec §5) — primitive geometry from `node.meshPrimitive`
// (kind + params over MESH_PRIMITIVE_DEFAULTS) with the live reshaping +
// material handle. See mesh-primitive.ts header.
import {
  buildFaceMaterials,
  buildPrimitiveGeometry,
  createMeshPrimitiveHandle,
} from '../shared/mesh-primitive';
// Transmission budget (spec §4 / SC-O10, risk #2) — admit ≤2 live Path-B
// transmission surfaces; over budget, downgrade to a cheaper Path-C glass look.
import {
  requestTransmission,
  releaseTransmission,
} from '../shared/transmission-budget';
import type {
  CinematicPrimitiveRef,
  ImageSpec,
  PrismNode,
  PrismTextContent,
} from '../../../prism-graph/types';
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
  if (typeof node.textSpec?.content === 'string') {
    group.userData.authoredTextContent = node.textSpec.content;
  }
  group.userData.handlers = {};

  const disposables: BufferGeometry[] = [];
  const materialsToDispose: DisposableMaterial[] = [];
  const primitiveResults: PrimitiveResult[] = [];
  // STEP7 — detachers returned by the driver dispatch (one per attached
  // primitive). Run on cleanup to unsubscribe scroll/pointer/state/event
  // wiring + unregister the per-frame onTick, WITHOUT killing the timeline
  // (the primitiveResults loop below owns kill()).
  const driverDetachers: Array<() => void> = [];
  // Canvas-spec §7 — TextObject handles built by the 'text' branch. Disposed
  // on cleanup (unit geometries + materials only; the registry-owned atlas
  // texture is SHARED and never disposed here). `textState.disposed` guards
  // the async atlas-resolve callback against mounting into a cleaned group.
  const textHandles: TextObjectHandle[] = [];
  const textState = { disposed: false };
  // P3 IMAGE — meshes carrying a per-node ImageSpec texture clone. Cleanup
  // disposes the clone (node-owned) but NEVER the loader-cache source
  // (Amendment 0002 §A.2 — disposeImageSpec enforces the split).
  const imageSpecMeshes: Mesh[] = [];
  // P4 3D-OBJECT — the primitive Mesh, tracked separately from `disposables`
  // because setPrimitive swaps mesh.geometry in place (disposing the old one
  // at swap time); cleanup must dispose whatever geometry is CURRENT.
  const meshPrimitiveMeshes: Mesh[] = [];
  // Transmission budget (spec §4 / SC-O10) — release fns for admitted Path-B
  // surfaces. Run on cleanup so navigating away frees the ≤2 slots.
  const transmissionReleasers: Array<() => void> = [];
  // Admit a just-built physical material into the transmission budget when its
  // resolved spec actually refracts (transmission > 0). Over budget → strip the
  // transmission pass and fall back to a cheaper clearcoat/translucency glass
  // read (Path C), so the surface still looks like glass without a 3rd render.
  const admitTransmission = (mat: object, transmission: number): void => {
    if (!(transmission > 0)) return;
    if (requestTransmission(mat)) {
      transmissionReleasers.push(() => releaseTransmission(mat));
      return;
    }
    const m = mat as {
      transmission: number; roughness: number; clearcoat: number;
      opacity: number; transparent: boolean;
    };
    m.transmission = 0;
    m.clearcoat = 1;
    m.roughness = Math.max(0.06, m.roughness);
    m.opacity = Math.min(0.9, m.opacity || 1);
    m.transparent = true;
  };

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
    const lit = resolveReceivesLighting(node);
    // POLISH PC (matte) — an OPAQUE photo plane (visual.opaque=true; alpha=1, no
    // alpha channel) renders with transparent:false so its antialiased quad edge
    // does not composite a faint straight-alpha rectangular seam against the dark
    // backdrop. Absent/false keeps the legacy transparent:true path verbatim, so
    // alpha-bearing fx planes (dust, starfields, cutouts) are unaffected.
    const planeTransparent = !node.visual?.opaque;
    let mat: DisposableMaterial & { map?: Texture | null; needsUpdate?: boolean };
    if (useNodeMaterials) {
      mat = (lit
        ? buildLitTextureMaterial({ spec: node.materialSpec })
        : buildUnlitMaterial({ transparent: planeTransparent })) as unknown as DisposableMaterial & {
        map?: Texture | null;
        needsUpdate?: boolean;
      };
    } else {
      // Legacy (editor / non-node-material) path. Default image planes stay
      // MeshBasicMaterial — UNLIT and byte-identical to before. A node that opts
      // IN (receivesLighting=true) becomes MeshStandardMaterial so the editor's
      // HubLighting actually lights it (criterion 17 opt-in on the editor surface).
      mat = (lit
        ? new MeshStandardMaterial({ transparent: planeTransparent })
        : new MeshBasicMaterial({ transparent: planeTransparent })) as unknown as DisposableMaterial & {
        map?: Texture | null;
        needsUpdate?: boolean;
      };
    }
    const mesh = new Mesh(geo, mat as unknown as MeshBasicMaterial);
    // criterion 17 @ T2: tag UNLIT image planes onto the unlit layer so the
    // rig's screen-space GI/AO post pass excludes them (baked look stays exact).
    if (!lit) tagUnlitObject(mesh);
    group.add(mesh);
    disposables.push(geo);
    materialsToDispose.push(mat as unknown as DisposableMaterial);

    // P3 IMAGE (canvas-spec §5) — apply the node's ImageSpec at build time and
    // expose an in-place updater so the editor restyles INSTANTLY (no artifact
    // re-render, no rebuild). A default node (no imageSpec, no setSpec call)
    // takes none of this path: the shared cache texture lands on the material
    // untouched, byte-identical to before. applyImageSpec may upgrade a plain
    // legacy material to its node-material twin when a cornerRadius first
    // arrives (safe: every call path renders via WebGPURenderer — see the
    // text-branch renderer note below); track the swap for disposal.
    const imageState: { spec: ImageSpec | null } = {
      spec: node.imageSpec ? { ...node.imageSpec } : null,
    };
    const applyCurrentImageSpec = () => {
      if (!imageState.spec) return;
      const prevMat = mesh.material;
      applyImageSpec(mesh, imageState.spec, { nodeMaterials: useNodeMaterials });
      if (mesh.material !== prevMat) {
        materialsToDispose.push(mesh.material as unknown as DisposableMaterial);
      }
    };
    group.userData.imageHandle = {
      setSpec: (next: ImageSpec) => {
        imageState.spec = { ...next };
        applyCurrentImageSpec();
      },
    };
    imageSpecMeshes.push(mesh);

    // FIDELITY-2 W3 — video texture lane (audit item 3, additive). When the
    // node carries `videoUrl` AND the context wires a video loader, the
    // VideoTexture takes precedence over the still image: the image (if any)
    // loads as a placeholder, then the video replaces it once its first
    // frame is decodable. `videoState.applied` guards the race where a
    // slower image load would otherwise stomp the already-applied video map.
    // ImageSpec note: `videoUrl` BYPASSES the imageSpec fit/crop window —
    // applyImageSpec clones + windows still textures, and cloning a
    // VideoTexture would double-drive the backing element. Texture-
    // independent imageSpec effects applied at build time (corner radius,
    // opacity) still hold; only the fit/crop window is skipped for video.
    const videoState = { applied: false };
    if (sourceAsset) {
      void ctx.textureLoader
        .loadTexture(sourceAsset)
        .then((tex) => {
          // FIDELITY-2 W3 — the video already landed; keep it (the image is
          // only the placeholder in the video lane).
          if (videoState.applied) return;
          // Read the material off the mesh (a radius upgrade may have swapped
          // it); identical to the old captured-`mat` write for default nodes.
          const m = mesh.material as unknown as DisposableMaterial;
          m.map = tex;
          m.needsUpdate = true;
          // Re-apply with real image dims (clones the cache texture before
          // any repeat/offset mutation). No-op when no spec is set.
          applyCurrentImageSpec();
        })
        .catch(() => { /* swallow — decorative */ });
    }
    if (node.videoUrl && ctx.videoLoader) {
      void ctx.videoLoader
        .loadVideo(node.videoUrl)
        .then((tex) => {
          videoState.applied = true;
          const m = mesh.material as unknown as DisposableMaterial;
          m.map = tex;
          m.needsUpdate = true;
          // The video texture is loader-cache-owned (Amendment 0002 §A.2):
          // cleanup below must NOT dispose it — the cache's dispose() pauses
          // the element, clears src, and disposes the texture.
        })
        .catch(() => { /* swallow — the image placeholder (if any) stays */ });
    }
    // Build-time apply: radius/opacity are live even before the texture
    // resolves; the fit/crop window lands in the then() above.
    applyCurrentImageSpec();
  } else if (renderMode === 'parallax-plane') {
    // §9.C — tessellated 64x64 plane + TSL displacement node.
    // §10 decision 7 / criterion 17: an image plane is UNLIT by default, so the
    // baked texture (carried by the displacement colorNode) is shown verbatim.
    // A node may opt in to lighting (receivesLighting=true) to catch scene light.
    // The non-node-material (WebGL editor) path keeps the legacy
    // MeshStandardMaterial verbatim — byte-identical to before for default nodes.
    const geo = new PlaneGeometry(width, height, 64, 64);
    const lit = resolveReceivesLighting(node);
    let mat: DisposableMaterial;
    if (useNodeMaterials) {
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
    const mesh = new Mesh(geo, mat as unknown as MeshStandardMaterial);
    // criterion 17 @ T2: exclude the UNLIT parallax plane from the SSGI/GTAO pass.
    if (!lit) tagUnlitObject(mesh);
    group.add(mesh);
    disposables.push(geo);
    materialsToDispose.push(mat);

    // P3 IMAGE (canvas-spec §5) — ImageSpec on the parallax plane. Same
    // handle/clone mechanics as sprite/plane, plus one renderer honesty rule:
    // the displacement colorNode samples with an EXPLICIT uv
    // (displacement.tsl), which bypasses the texture matrix
    // (TextureNode.setUpdateMatrix(uvNode === null)). So the UV-distortion
    // colorNode is only mounted while the fit/crop window is identity; a
    // non-identity window routes color through the matrix-respecting `.map`
    // path instead — the crop renders correctly and the displacementMap keeps
    // the vertex relief; only the UV-distortion flourish is traded. Default
    // nodes (no imageSpec) keep the colorNode exactly as before.
    const imageState: { spec: ImageSpec | null } = {
      spec: node.imageSpec ? { ...node.imageSpec } : null,
    };
    const parallaxMaps: { base: Texture | null; depth: Texture | null } = {
      base: null,
      depth: null,
    };
    const refreshDisplacementColorNode = () => {
      const m = mesh.material as unknown as DisposableMaterial & {
        isNodeMaterial?: boolean;
      };
      // Legacy plain material: no colorNode lane (map matrix applies natively).
      if (m.isNodeMaterial !== true) return;
      if (!parallaxMaps.base || !parallaxMaps.depth) return;
      if (isIdentityUvWindow(readImageSpecWindow(mesh))) {
        m.colorNode = displacementShader({
          // Prefer the per-node clone when one exists (same shared GPU image).
          baseTexture: readImageSpecTexture(mesh) ?? parallaxMaps.base,
          displacementMap: parallaxMaps.depth,
          intensity: 0.05,
        });
      } else {
        m.colorNode = null;
      }
      m.needsUpdate = true;
    };
    const applyCurrentImageSpec = () => {
      if (!imageState.spec) return;
      const prevMat = mesh.material;
      applyImageSpec(mesh, imageState.spec, { nodeMaterials: useNodeMaterials });
      if (mesh.material !== prevMat) {
        materialsToDispose.push(mesh.material as unknown as DisposableMaterial);
      }
      refreshDisplacementColorNode();
    };
    group.userData.imageHandle = {
      setSpec: (next: ImageSpec) => {
        imageState.spec = { ...next };
        applyCurrentImageSpec();
      },
    };
    imageSpecMeshes.push(mesh);

    if (sourceAsset && node.depthMapUrl) {
      const baseP = ctx.textureLoader.loadTexture(sourceAsset);
      const depthP = ctx.textureLoader.loadTexture(node.depthMapUrl);
      void Promise.all([baseP, depthP])
        .then(([baseTex, depthTex]) => {
          parallaxMaps.base = baseTex;
          parallaxMaps.depth = depthTex;
          // Read the material off the mesh (a radius upgrade may have swapped
          // it); identical to the old captured-`mat` write for default nodes.
          const m = mesh.material as unknown as DisposableMaterial;
          m.map = baseTex;
          m.displacementMap = depthTex;
          // Re-apply with real image dims (clones before any matrix mutation),
          // then mount/skip the displacement colorNode per the window rule
          // above. Defaults (no spec → identity window) keep the old wiring.
          applyCurrentImageSpec();
          refreshDisplacementColorNode();
          m.needsUpdate = true;
        })
        .catch(() => { /* swallow */ });
    }
    // Build-time apply: radius/opacity live pre-resolve; window lands above.
    applyCurrentImageSpec();
  } else if (renderMode === 'mesh') {
    if (node.meshPrimitive) {
      // P4 3D-OBJECT (canvas-spec §5) — PRECEDENCE: a node carrying
      // `meshPrimitive` renders the primitive; `meshUrl` stays the GLB lane
      // for nodes without one (the GLB load below is skipped entirely).
      //
      // Material route is EXACTLY the meshUrl/GLB path's: §10 decision 7 —
      // meshes are LIT by default (resolveReceivesLighting), the surface is a
      // node-owned MeshPhysicalNodeMaterial built from the resolved spec via
      // buildPhysicalMaterial + applyMaterialSpec, and lit meshes cast +
      // receive shadows so the lighting rig's shadow path has occluders.
      // Unlike the GLB lane this is fully synchronous: geometry is generated,
      // so the artifact exists the moment createNode returns (spec §8).
      const lit = resolveReceivesLighting(node);
      // CANVAS-FINAL §12.1 (criterion 19) — per-face image mapping. With no
      // faceTextures this returns the single base material (existing behavior);
      // with face textures it returns a per-group material ARRAY (Box=6,
      // Cone=2, Cylinder=3) so each face wears its assigned image. The base
      // material remains the un-textured-slot surface + baseColorMap target.
      const faceBuild = buildFaceMaterials(
        node.meshPrimitive,
        node.faceTextures,
        node.materialSpec,
        ctx.textureLoader,
      );
      const physical = faceBuild.base;
      // Transmission budget (spec §4 / SC-O10): a primitive whose spec refracts
      // (e.g. the sapphire crystal) claims a Path-B slot or downgrades to glassy
      // clearcoat when the ≤2 budget is full.
      admitTransmission(physical, resolveMaterialSpec(node.materialSpec).transmission);
      // W3 (INV-18 additive) — pour a base-color map onto the base material
      // when the spec carries one (async; only when faces aren't already
      // mapping their own textures onto every slot).
      const baseMapUrl = node.materialSpec?.baseColorMapUrl;
      if (baseMapUrl && (!node.faceTextures || node.faceTextures.length === 0)) {
        ctx.textureLoader
          .loadTexture(baseMapUrl)
          .then((tex) => {
            (tex as { colorSpace?: string }).colorSpace = 'srgb';
            (physical as unknown as { map: unknown; needsUpdate: boolean }).map = tex;
            (physical as unknown as { needsUpdate: boolean }).needsUpdate = true;
          })
          .catch(() => {
            /* missing map → resolved baseColor stands */
          });
      }
      // PHASE1 (INV-18 additive) — pour normal + roughness maps (linear color
      // space) for photoreal micro-surface that catches the studio IBL as the
      // watch orbits (SC-V-A3). normalScale drives relief depth.
      {
        const spec = node.materialSpec;
        const nrmUrl = spec?.normalMapUrl;
        const rghUrl = spec?.roughnessMapUrl;
        const nScale = typeof spec?.normalScale === 'number' ? spec.normalScale : 1;
        if (nrmUrl) {
          ctx.textureLoader
            .loadTexture(nrmUrl)
            .then((tex) => {
              const p = physical as unknown as {
                normalMap: unknown; normalScale?: { set: (x: number, y: number) => void }; needsUpdate: boolean;
              };
              p.normalMap = tex;
              p.normalScale?.set(nScale, nScale);
              p.needsUpdate = true;
            })
            .catch(() => { /* missing → flat normal */ });
        }
        if (rghUrl) {
          ctx.textureLoader
            .loadTexture(rghUrl)
            .then((tex) => {
              const p = physical as unknown as { roughnessMap: unknown; needsUpdate: boolean };
              p.roughnessMap = tex;
              p.needsUpdate = true;
            })
            .catch(() => { /* missing → scalar roughness */ });
        }
      }
      const geo = buildPrimitiveGeometry(node.meshPrimitive);
      const mesh = new Mesh(geo, faceBuild.material);
      mesh.name = `mesh-primitive:${node.nodeId}`;
      if (lit) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      group.add(mesh);
      for (const m of faceBuild.dispose) {
        materialsToDispose.push(m as unknown as DisposableMaterial);
      }
      meshPrimitiveMeshes.push(mesh);
      // Live-edit surface (instant, in-place — never a rebuild): dimension
      // edits swap the geometry on the SAME Mesh; Material-tab writes land on
      // the SAME physical material instance. The editor's AssembledSceneNode
      // effect drives this exactly like textHandle / imageHandle.
      group.userData.meshPrimitiveHandle = createMeshPrimitiveHandle(
        mesh,
        node.meshPrimitive,
      );
    } else if (node.meshUrl) {
      // §10 decision 7: meshes are LIT by default. When the node carries a
      // MaterialSpec, route the mesh material through buildPhysicalMaterial
      // (full PBR). Either way, lit meshes cast + receive shadows so the
      // lighting rig's shadow path has occluders. The resolved spec is applied
      // even without an explicit materialSpec so the lit defaults are explicit.
      const lit = resolveReceivesLighting(node);
      const meshSpec = node.materialSpec
        ? resolveMaterialSpec(node.materialSpec)
        : null;
      // F5.5 — graceful cold-load affordance. The GLB lane is async, so until
      // loadGLB resolves the group would be EMPTY: on a landing hub the hero
      // spot reads as a hole (and a prior build flashed a bright white plane
      // here). Mount a dark, backdrop-matched disc synchronously so the watch
      // position settles into the brass-nebula backdrop instead of popping
      // from nothing. MeshBasicMaterial is UNLIT, so it can never catch the
      // key light and flash white — it stays a quiet warm-black puck under any
      // rig. It is removed + disposed the instant the GLB resolves (a swap,
      // never a persistent stand-in artifact — FP-R3 is about empty-Group
      // placeholders that survive into the built scene; this does not).
      const proxyGeo = new CircleGeometry(0.5, 48);
      const proxyMat = new MeshBasicMaterial({
        color: 0x0d0a07,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
      const loadingProxy = new Mesh(proxyGeo, proxyMat);
      loadingProxy.name = `mesh-loading-proxy:${node.nodeId}`;
      loadingProxy.renderOrder = -1;
      group.add(loadingProxy);
      const removeLoadingProxy = () => {
        group.remove(loadingProxy);
        proxyGeo.dispose();
        proxyMat.dispose();
      };
      void ctx.glbLoader
        .loadGLB(node.meshUrl)
        .then((gltf) => {
          if (!gltf?.scene) {
            removeLoadingProxy();
            return;
          }
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
              // Transmission budget (spec §4 / SC-O10) — admit/downgrade per
              // GLB submesh material that refracts.
              admitTransmission(physical, meshSpec.transmission);
              child.material = physical;
              materialsToDispose.push(physical as unknown as DisposableMaterial);
            }
          });
          group.add(cloned);
          // Swap: the photoreal mesh is in; retire the loading disc.
          removeLoadingProxy();
        })
        .catch(() => {
          removeLoadingProxy();
        });
    }
  } else if (renderMode === 'text') {
    // Canvas-spec §7 / criterion 26 — REAL MSDF glyphs via the Prism
    // TextObject (src/lib/prism/text/). Spec resolves over TEXT_SPEC_DEFAULT;
    // the atlas comes from the shared font-registry cache (criterion 27).
    //
    // Sync-first, async-fallback — the same shape as the textureLoader
    // pattern above: when the (family, weight) atlas is already cached the
    // glyph meshes exist synchronously; on a cold cache the group populates
    // when the resolve lands (spec §8: createNode stays synchronous).
    //
    // Renderer note (deliberate): the unit material is the frozen contract's
    // TSL MeshStandardNodeMaterial (msdf-material.ts) REGARDLESS of
    // opts.nodeMaterials. Both call paths that pass nodeMaterials:false —
    // the editor (ArtifactNode → GraphScene's createUnifiedRenderer) and the
    // runtime player (mount-graph → createSceneRoot) — render exclusively
    // through `WebGPURenderer` from three/webgpu, whose WebGL2 *backend*
    // fallback still compiles TSL node materials (it is not the classic
    // WebGLRenderer). No classic-WebGL call path invokes this factory, so
    // there is no path that could crash on the node material. The
    // nodeMaterials flag continues to mean what it always meant here:
    // "keep legacy plain materials for default image planes" — it is not a
    // statement about renderer capability.
    //
    // Lighting (P1 hue-fidelity): receivesLightingDefault('text') === false,
    // and the DEFAULT-unlit node renders hue-faithful — the TextObject gets
    // `lit: false`, which routes the fill pigment through emissiveNode with
    // zero lit response, so the authored fill color is exactly what renders
    // (the editor's night HDRI was tinting every lit fill blue). A node that
    // opts IN (receivesLighting: true) keeps the standard-lit glyph surface
    // (catalog-rig tuned constants). Units are still NOT tagged onto the
    // unlit GI-mask layer (per-unit tags would not survive setSpec rebuilds).
    const spec: TextSpec = { ...TEXT_SPEC_DEFAULT, ...(node.textSpec ?? {}) };
    const family = spec.fontFamily ?? TEXT_SPEC_DEFAULT.fontFamily ?? 'Inter';
    const baseWeight = spec.fontWeight ?? TEXT_SPEC_DEFAULT.fontWeight ?? 400;
    // Bold maps to a heavier REAL weight face (real font styles where available,
    // §7). Both the flat atlas and the 3D outline source key by this weight.
    const fontWeight = spec.bold ? Math.max(baseWeight, 700) : baseWeight;
    const textLit = resolveReceivesLighting(node);

    const mountText = (atlas: LoadedFontAtlas) => {
      if (textState.disposed) return;
      const handle = createTextObject(spec, atlas, {
        lit: textLit,
        // texture / ai-texture fills load their pigment through the runtime's
        // cached loader (Amendment 0002 §A.2: loader-cache owns the texture
        // lifetime — TextObject never disposes it).
        resolveFillTexture: (url) => ctx.textureLoader.loadTexture(url),
      });
      group.add(handle.object);
      // Editor surface for criterion 26: instant re-font/resize/restyle via
      // handle.setSpec(next[, atlas]) — geometry rebuilds from cached atlas
      // metrics in place (same Group identity), no artifact re-render.
      group.userData.textHandle = handle;
      textHandles.push(handle);
    };
    const mountFlatAsync = () => {
      const cached = peekTextAtlas(family, fontWeight);
      if (cached) {
        mountText(cached);
      } else {
        void resolveTextAtlas(family, fontWeight)
          .then(mountText)
          .catch(() => { /* swallow — soft-fail like a missing texture asset */ });
      }
    };

    // TRUE 3D EXTRUDED TEXT (canvas-spec §7 / INV-11), tier-gated (INV-9). When
    // `extrude.enabled` and the device tier permits (T1+), build REAL extruded
    // geometry from the font's vector outlines — lit + shadow-casting. T0 (or an
    // outline-resolve failure) falls back to the flat MSDF path. The 3D handle
    // satisfies the SAME TextObjectHandle contract, so cleanup + restyle work.
    const tier = ctx.tier ?? 'T1';
    const want3D = spec.extrude?.enabled === true && tier !== 'T0';
    if (want3D) {
      const chars = spec.content ?? TEXT_SPEC_DEFAULT.content ?? '';
      const italic = spec.italic === true;
      const mount3D = (outlines: LoadedFontOutlines) => {
        if (textState.disposed) return;
        const handle = createTextObject3D(spec, outlines, {
          tier,
          resolveFillTexture: (url) => ctx.textureLoader.loadTexture(url),
        });
        group.add(handle.object);
        group.userData.textHandle = handle;
        textHandles.push(handle);
      };
      const cachedOutlines = peekTextOutlines(family, fontWeight, chars, italic);
      if (cachedOutlines) {
        mount3D(cachedOutlines);
      } else {
        void resolveTextOutlines(family, fontWeight, chars, italic)
          .then(mount3D)
          .catch(mountFlatAsync); // graceful: outline source unavailable → flat
      }
    } else {
      mountFlatAsync();
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
        // No wrapping: §13 labels are single-phrase captions; the package's
        // default wrap width split them mid-phrase and overprinted lines
        // (P6 capstone). Bound the box by the text's own worst-case width
        // (per-glyph advance < fontSize) so the line never wraps while the
        // bbox stays glyph-sized — a huge constant here inflates the bbox
        // and the scale-to-fit below would shrink the text to invisibility.
        maxWidthPx: (t.typography?.fontSize ?? 32) * (t.text.length + 2),
      });
      // P6 capstone MUST-FIX (2026-06-11): typography.fontSize is authored in
      // DESIGN PX (the .prism player's pixel world), but this factory's plane
      // sizes are SCENE UNITS — un-scaled, a real MSDFText renders hundreds of
      // units wide (the giant slab the capstone caught once the editor warmed
      // the factory). Scale-to-fit the node's visual envelope and center over
      // the plane face. Empty placeholder Groups (cold factory) are size 0 and
      // skip untouched.
      const bbox = new Box3().setFromObject(textObj);
      const size = new Vector3();
      bbox.getSize(size);
      if (size.x > 0 && size.y > 0) {
        const s = Math.min((width * 0.86) / size.x, (height * 0.6) / size.y);
        if (Number.isFinite(s) && s > 0 && s < 1) {
          textObj.scale.setScalar(s);
          const center = new Vector3();
          bbox.getCenter(center);
          textObj.position.set(-center.x * s, -center.y * s, 0.012);
        }
      }
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
    // Canvas-spec §7 — dispose TextObject units (geometries + materials).
    // TextObjectHandle.dispose() never touches the registry-owned shared
    // atlas texture. The disposed flag also cancels a still-pending async
    // atlas mount for this group.
    textState.disposed = true;
    for (const h of textHandles) {
      try { h.dispose(); } catch { /* ignore */ }
    }
    textHandles.length = 0;
    // P3 IMAGE — release each mesh's node-owned texture clone. The loader-
    // cache SOURCE texture is never disposed (Amendment 0002 §A.2);
    // disposeImageSpec only touches the per-node clone + state.
    for (const m of imageSpecMeshes) {
      try { disposeImageSpec(m); } catch { /* ignore */ }
    }
    imageSpecMeshes.length = 0;
    // P4 3D-OBJECT — dispose whatever geometry is CURRENTLY mounted on the
    // primitive Mesh (setPrimitive disposes superseded geometries at swap
    // time; the material rides materialsToDispose below).
    for (const m of meshPrimitiveMeshes) {
      try { m.geometry.dispose(); } catch { /* ignore */ }
    }
    meshPrimitiveMeshes.length = 0;
    for (const geo of disposables) {
      try { geo.dispose(); } catch { /* ignore */ }
    }
    for (const m of materialsToDispose) {
      try { m.dispose?.(); } catch { /* ignore */ }
    }
    // Transmission budget — free this node's admitted Path-B slot(s).
    for (const release of transmissionReleasers) {
      try { release(); } catch { /* ignore */ }
    }
    transmissionReleasers.length = 0;
  };

  return group;
}
