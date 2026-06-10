// create-element-node.ts — Stage-0 "bubble" builders (canvas-spec §6 state 1;
// P2 Task C). PURE + node-testable: no React, no DOM, no store imports —
// tests/editor-build/P2-add-element.test.ts exercises these directly.
//
// Three exports:
//   - buildBubbleElementNode(opts) — valid input for
//     `useGraphSourceStore.addNode` (which runs it through
//     `applyPlanRendererDefaults`): a BLANK bubble node tethered to the
//     current hub (INV-7). Minimal Stage-0 convention mirrored from
//     create-text-node.ts + the AddNodeDialog path: `codeRef: ''`,
//     `backendRef: null`, `serviceTag: 'main'`, NO artifact data (no
//     visual.sourceAsset, no meshUrl). renderMode is left unset so the
//     plan-defaults hook applies the legacy 'sprite' default.
//   - isStage0Bubble(node) — the predicate ArtifactNode's scene path keys
//     on: an artifact-less node that should render as the §6 translucent
//     liquid sphere rather than a blank untextured factory plane.
//   - buildBubbleArtifact(nodeId) — the §6 stage-1 LOOK: one raycast-hittable
//     sphere Mesh under a Group, THREE.MeshPhysicalMaterial transmission
//     glass echoing the galaxy GlassNode shell language (GraphScene.tsx —
//     transmission ~0.9, low roughness, clearcoat, no-tint white). Carries
//     `userData.cleanup()` per the createNode contract (INV-14).

import {
  Color,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  SphereGeometry,
  type Object3D,
} from 'three';
import type { PrismNode, ScenePosition } from '@/lib/prism-graph/types';

/** §6 bubble radius (scene units). The selection-ring envelope in
 *  buildBubbleElementNode's `visual.transform` derives from this. */
export const BUBBLE_RADIUS = 0.28;

/** Canvas-spawn point for Add Element. Same clear lower band as the Add Text
 *  spawn (create-text-node.ts SPAWN_POSITION: x 0, y -0.8, z 0.2) but offset
 *  +0.9 on x so a fresh bubble and a fresh text block never stack. */
export const BUBBLE_SPAWN_POSITION: ScenePosition = {
  x: 0.9, y: -0.8, z: 0.2,
  rotationX: 0, rotationY: 0, rotationZ: 0,
  scaleX: 1, scaleY: 1, scaleZ: 1,
};

/** Default caption for a freshly-spawned blank bubble (stage 1: not yet
 *  Populated; the artifact pipeline is P3's). */
export const BUBBLE_CAPTION_DEFAULT =
  'New element — blank bubble awaiting an artifact';

/** Build the `addNode` input for a fresh Stage-0 bubble under `parentHubId`.
 *  No artifact data of any kind: the node is a graph-tethered intent slot. */
export function buildBubbleElementNode(opts: {
  parentHubId: string;
  caption?: string;
}): Partial<PrismNode> & { parentHubId: string } {
  return {
    parentHubId: opts.parentHubId,
    subtype: 'element',
    serviceTag: 'main',
    scenePosition: { ...BUBBLE_SPAWN_POSITION },
    visual: {
      // Selection-ring / marquee envelope for the bubble sphere (the ring in
      // AssembledSceneNode sizes from max(width, height) * 0.62).
      transform: {
        x: 0, y: 0, z: 0,
        width: BUBBLE_RADIUS * 2.2,
        height: BUBBLE_RADIUS * 2.2,
      },
      alpha: 1,
    },
    intent: {
      caption: opts.caption ?? BUBBLE_CAPTION_DEFAULT,
      behaviorSpec: {
        interactions: [],
        apiCalls: [],
        dataBindings: [],
        emits: [],
        listens: [],
        triggersDownstream: [],
      },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: '',
    backendRef: null,
  };
}

/** True when `node` is a Stage-0 bubble for the CANVAS scene path: it carries
 *  no artifact data (mirrors ArtifactNode.hasArtifactData: no
 *  visual.sourceAsset, no meshUrl, no codeRef), it is not a text node (the
 *  TextObject IS that node's artifact), and it has no legacy §13 runtime
 *  labels (those nodes render their textContent via the factory and must keep
 *  doing so). */
export function isStage0Bubble(node: PrismNode): boolean {
  if (node.visual?.sourceAsset) return false;
  if (node.meshUrl) return false;
  if (node.codeRef) return false;
  if ((node.renderMode ?? 'sprite') === 'text') return false;
  if ((node.intent?.visualSpec?.textContent ?? []).length > 0) return false;
  return true;
}

// Bubble pigment — SCENE DATA hexes (sanctioned exception, same rule as
// LIGHT_COLOR_DEFAULT in CanvasToolbar): a physical no-tint white surface
// with a cool glass attenuation body, echoing the GlassNode shell
// (attenuation-tinted transmission over a white base).
const BUBBLE_SURFACE = '#ffffff'; // sanctioned: physical no-tint white for transmission glass
const BUBBLE_ATTENUATION = '#aac3d2'; // cool glass body (scene data, not chrome)

/** Build the §6 stage-1 bubble artifact: a Group (createNode-contract shape:
 *  name `node:<id>`, userData.nodeId / handlers / cleanup) containing ONE
 *  raycast-hittable sphere Mesh with a translucent liquid
 *  MeshPhysicalMaterial. Classic (non-TSL) MeshPhysicalMaterial compiles fine
 *  under the unified WebGPURenderer (P1 finding) and is exactly what the
 *  galaxy GlassNode shell already uses — no new material language. */
export function buildBubbleArtifact(nodeId: string): Object3D {
  const group = new Group();
  group.name = `node:${nodeId}`;
  group.userData.nodeId = nodeId;
  group.userData.handlers = {};
  // Diagnostic marker so tests / KripVerify can recognize the stage-0 look.
  group.userData.stage0Bubble = true;

  const geo = new SphereGeometry(BUBBLE_RADIUS, 48, 48);
  const mat = new MeshPhysicalMaterial({
    transparent: true,
    opacity: 0.9,
    metalness: 0,
    roughness: 0.08,
    transmission: 0.92,
    thickness: 0.32,
    ior: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    // Subtle soap-film iridescence — a uniform-driven MeshPhysicalMaterial
    // feature (cheap: no extra textures, no extra passes).
    iridescence: 0.35,
    iridescenceIOR: 1.3,
    specularIntensity: 1,
    attenuationDistance: 1.6,
    attenuationColor: new Color(BUBBLE_ATTENUATION),
    color: new Color(BUBBLE_SURFACE),
  });
  const mesh = new Mesh(geo, mat);
  mesh.name = `bubble:${nodeId}`;
  group.add(mesh);

  group.userData.cleanup = () => {
    try { geo.dispose(); } catch { /* ignore */ }
    try { mat.dispose(); } catch { /* ignore */ }
  };
  return group;
}
