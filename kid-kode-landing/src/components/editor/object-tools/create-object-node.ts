// create-object-node.ts — buildMeshPrimitiveNode, the FROZEN node-creation
// seam for P4 3D objects (canvas-spec §5 3D object tools). Parallel agents
// code against this exact signature — do not change it.
//
// Returns valid input for `useGraphSourceStore.addNode` (which runs the
// result through `applyPlanRendererDefaults` — renderMode 'mesh' resolves
// `receivesLighting` LIT via `receivesLightingDefault`, §10 decision 7).
//
// Unlike the Add Element bubble (Stage 0, artifact-less), a 3D-object node is
// BORN Populated: `meshPrimitive` IS its artifact — the default factory's
// mesh branch generates the geometry synchronously and routes the surface
// through the existing material system. NO `meshUrl` (that stays the GLB
// lane; a node carrying meshPrimitive renders the primitive).
//
// Conventions mirrored from create-text-node.ts / create-element-node.ts /
// image-helpers.ts: `codeRef: ''`, `backendRef: null`, `serviceTag: 'main'`,
// empty behavior/visual specs, plain-language caption ('New Cube' — never a
// machine id; `subtype` carries the kind so the getNodeName fallback agrees).
//
// PURE + node-testable: no React, no DOM, no store imports.

import {
  MESH_PRIMITIVE_DEFAULTS,
  type MeshPrimitiveKind,
  type PrismNode,
  type ScenePosition,
} from '@/lib/prism-graph/types';

/** Canvas-spawn point for Add Object. Distinct from the other fresh-node
 *  flows — Add Text (0, -0.8, 0.2), Add Element (+0.9, -0.8, 0.2), Add Image
 *  (−0.9, -0.8, 0.2) — lifted to the mid band so a fresh 3D object never
 *  stacks on a fresh bubble below it. */
export const OBJECT_SPAWN_POSITION: ScenePosition = {
  x: 0.9, y: -0.2, z: 0.2,
  rotationX: 0, rotationY: 0, rotationZ: 0,
  scaleX: 1, scaleY: 1, scaleZ: 1,
};

/** Plain-language display name for a primitive kind: 'cube' → 'Cube'. */
export function meshPrimitiveDisplayName(kind: MeshPrimitiveKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** The fresh-object caption convention: 'New Cube', 'New Sphere', … Plain
 *  language, never a machine id (advocate MUST-FIX lineage, 2026-06-10). */
export function objectNodeCaption(kind: MeshPrimitiveKind): string {
  return `New ${meshPrimitiveDisplayName(kind)}`;
}

/** Scene-unit selection-ring / marquee envelope for a kind's DEFAULT
 *  dimensions (MESH_PRIMITIVE_DEFAULTS): the primitive's projected
 *  width/height bounding extent. The geometry defines its own true 3D
 *  extent; this is the editor's 2D envelope, same role as the text-block /
 *  image-plane envelopes. */
export function meshPrimitiveEnvelope(
  kind: MeshPrimitiveKind,
): { width: number; height: number } {
  const d = MESH_PRIMITIVE_DEFAULTS[kind];
  switch (kind) {
    case 'cube':
      return { width: d.width, height: d.height };
    case 'sphere':
      return { width: d.radius * 2, height: d.radius * 2 };
    case 'plane':
      return { width: d.width, height: d.height };
    case 'cylinder':
      return { width: d.radius * 2, height: d.height };
    case 'cone':
      return { width: d.radius * 2, height: d.height };
    case 'torus':
      return { width: (d.radius + d.tube) * 2, height: (d.radius + d.tube) * 2 };
    case 'capsule':
      // `length` is the cylindrical mid-section; the hemispherical caps add a
      // radius at each end.
      return { width: d.radius * 2, height: d.length + d.radius * 2 };
  }
}

/** Build the `addNode` input for a fresh born-Populated 3D-object node under
 *  `parentHubId`: renderMode 'mesh', `meshPrimitive: { kind }` (params resolve
 *  to the kind's defaults at build time), NO meshUrl. FROZEN cross-agent
 *  seam — signature and field shape must not change. */
export function buildMeshPrimitiveNode(opts: {
  parentHubId: string;
  kind: MeshPrimitiveKind;
}): Partial<PrismNode> & { parentHubId: string } {
  const envelope = meshPrimitiveEnvelope(opts.kind);
  return {
    parentHubId: opts.parentHubId,
    subtype: opts.kind,
    serviceTag: 'main',
    renderMode: 'mesh',
    meshPrimitive: { kind: opts.kind },
    scenePosition: { ...OBJECT_SPAWN_POSITION },
    visual: {
      transform: {
        x: 0, y: 0, z: 0,
        width: envelope.width,
        height: envelope.height,
      },
      alpha: 1,
    },
    intent: {
      caption: objectNodeCaption(opts.kind),
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
