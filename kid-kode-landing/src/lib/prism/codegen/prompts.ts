// Codegen prompts — verbatim per spec §9 of PRISM-RENDERER-MIGRATION-SPEC.md
// (L248-L355). The shared system prompt is byte-stable across calls so that
// RadixAttention prefix-cache hits (§9.A L275). Per-node prompts are not
// cacheable; render-mode sub-prompts are appended only for the matching mode.
//
// All field references and ordering follow the spec template — do not reorder
// without updating the spec first; downstream codegen agents rely on this
// structure.

import type {
  CinematicPrimitiveRef,
  PrismNode,
  PrismTextContent,
  RenderMode,
  ScenePosition,
} from '@/lib/prism-graph/types';

/** Spec §9.A L250-L276. RadixAttention-cacheable. Byte-stable. */
export const SHARED_SYSTEM_PROMPT: string = [
  'You are a code generator for Kriptik Prism. Generate a self-contained Three.js v184+',
  'node module for a UI element that will be mounted into a 3D scene.',
  '',
  'CONSTRAINTS:',
  "- Import only from: 'three/webgpu', 'three/tsl', 'gsap', '@/primitives' (alias for the",
  "  cinematic primitives library), '@/text' (alias for MSDF text utilities).",
  '- Export default a single function: createNode(config: NodeConfig, ctx: NodeContext): THREE.Object3D',
  '- The function MUST be synchronous. All async loading uses ctx.textureLoader / ctx.glbLoader',
  '  which return cached resources.',
  '- Apply EVERY primitive listed in config.cinematicPrimitives by calling',
  '  ctx.primitives[primitive.name](targetObject, primitive.params). DO NOT inline primitive logic.',
  '- Render text content from config.textContent via ctx.fontAtlas —',
  '  never render text into Three.js TextGeometry or HTML overlays.',
  '- Attach event handlers to returned object\'s userData.handlers.* — never call',
  '  renderer.domElement.addEventListener.',
  '- The returned object MUST have userData.cleanup() that disposes resources and kills',
  '  GSAP timelines.',
  '- DO NOT use HTML, CSS, the DOM, document.*, or window.* — except window.devicePixelRatio.',
  '- DO NOT author bespoke shader code — use TSL through ctx.primitives or three/tsl built-ins.',
  '',
  'OUTPUT: Only the JavaScript code. No explanation. No markdown fences.',
].join('\n');

/** Per-node user prompt template (spec §9.B L278-L322). */
export interface CodegenNeighbor {
  id: string;
  type: string;
}

export interface CodegenNeighbors {
  parent: CodegenNeighbor | null;
  siblings: CodegenNeighbor[];
  children: CodegenNeighbor[];
}

export interface CodegenAtlasRegion {
  atlasIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CodegenPrompt {
  system: string;
  user: string;
}

function fmtScenePos(sp: ScenePosition | undefined): {
  position: string;
  rotation: string;
  scale: string;
} {
  const p = sp ?? {
    x: 0, y: 0, z: 0,
    rotationX: 0, rotationY: 0, rotationZ: 0,
    scaleX: 1, scaleY: 1, scaleZ: 1,
  };
  return {
    position: `(${p.x}, ${p.y}, ${p.z})`,
    rotation: `(${p.rotationX}, ${p.rotationY}, ${p.rotationZ})`,
    scale: `(${p.scaleX}, ${p.scaleY}, ${p.scaleZ})`,
  };
}

function fmtTextContent(items: PrismTextContent[] | undefined): string {
  if (!items || items.length === 0) return '(none)';
  return items
    .map((t) => {
      const ty = (t as PrismTextContent & {
        typography?: { fontSize?: number; fontWeight?: number };
      }).typography ?? {};
      const size = ty.fontSize ?? 16;
      const weight = ty.fontWeight ?? 400;
      return `- "${t.text}" (${t.role}, ${size}px ${weight})`;
    })
    .join('\n');
}

function fmtPrimitives(items: CinematicPrimitiveRef[] | undefined): string {
  if (!items || items.length === 0) return '(none — node ships without primitive)';
  return items
    .map(
      (p) =>
        `- ${p.name} (trigger: ${p.trigger}, params: ${JSON.stringify(p.params)})`,
    )
    .join('\n');
}

function fmtNeighbors(n: CodegenNeighbors): string {
  const parent = n.parent ? `${n.parent.id} (${n.parent.type})` : '(none)';
  const siblings =
    n.siblings.length === 0
      ? '(none)'
      : n.siblings.map((s) => `${s.id} (${s.type})`).join(', ');
  const children =
    n.children.length === 0
      ? '(none)'
      : n.children.map((c) => `${c.id} (${c.type})`).join(', ');
  return [
    `- Parent: ${parent}`,
    `- Siblings: ${siblings}`,
    `- Children: ${children}`,
  ].join('\n');
}

function getImageUrl(node: PrismNode): string {
  // The spec template embeds `{node.imageUrl}` (§9.B L287). In this repo the
  // analogous field is `node.visual.sourceAsset` (the atlas-source filename
  // path); fall back to that. Codegen consumers can override by adding an
  // `imageUrl` property at plan time if needed.
  const overlaid = (node as PrismNode & { imageUrl?: string }).imageUrl;
  if (overlaid) return overlaid;
  return node.visual?.sourceAsset ?? '(none)';
}

function fmtVisualSpec(node: PrismNode): {
  colors: string;
  typography: string;
  effects: string;
} {
  const vs = (node.intent?.visualSpec ?? {}) as Record<string, unknown>;
  const colors = vs.colors ? JSON.stringify(vs.colors) : '(default)';
  const typography = vs.typography
    ? JSON.stringify(vs.typography)
    : '(default)';
  const effects = vs.effects ? JSON.stringify(vs.effects) : '(default)';
  return { colors, typography, effects };
}

export function buildPerNodePrompt(
  node: PrismNode,
  neighbors: CodegenNeighbors,
  atlas: CodegenAtlasRegion,
): string {
  const sp = fmtScenePos(node.scenePosition);
  const renderMode = node.renderMode ?? 'sprite';
  const depthMapUrl = node.depthMapUrl ?? '(none)';
  const meshUrl = node.meshUrl ?? '(none)';
  const imageUrl = getImageUrl(node);
  const vs = fmtVisualSpec(node);
  const interactions = JSON.stringify(
    node.intent?.behaviorSpec?.interactions ?? [],
  );
  const dataBindings = JSON.stringify(
    node.intent?.behaviorSpec?.dataBindings ?? [],
  );
  const text = fmtTextContent(node.intent?.visualSpec?.textContent);
  const primitives = fmtPrimitives(node.cinematicPrimitives);
  const neighborsBlock = fmtNeighbors(neighbors);

  return [
    'ELEMENT SPECIFICATION:',
    node.intent?.caption ?? `(node ${node.nodeId})`,
    '',
    `RENDER MODE: ${renderMode}`,
    'ASSETS:',
    `- imageUrl: ${imageUrl}`,
    `- depthMapUrl: ${depthMapUrl}`,
    `- meshUrl: ${meshUrl}`,
    '',
    'VISUAL:',
    `- Colors: ${vs.colors}`,
    `- Typography: ${vs.typography}`,
    `- Effects: ${vs.effects}`,
    '',
    'TEXT CONTENT:',
    text,
    '',
    'BEHAVIOR:',
    `- Interactions: ${interactions}`,
    `- Data bindings: ${dataBindings}`,
    '',
    'SCENE PLACEMENT:',
    `- Position: ${sp.position}`,
    `- Rotation: ${sp.rotation}`,
    `- Scale: ${sp.scale}`,
    '',
    'CINEMATIC PRIMITIVES TO APPLY:',
    primitives,
    '',
    'NEIGHBORS:',
    neighborsBlock,
    '',
    'ATLAS REGION:',
    `- Atlas: ${atlas.atlasIndex}`,
    `- Source rect: ${atlas.x}, ${atlas.y}, ${atlas.width}, ${atlas.height}`,
  ].join('\n');
}

const SUB_PROMPT_SPRITE = [
  'Create a textured plane that billboards toward the camera. Use THREE.PlaneGeometry sized',
  "to the atlas region's aspect ratio. Apply texture with proper UV offsets for atlas region.",
  'Use MeshBasicNodeMaterial with .map node.',
].join('\n');

const SUB_PROMPT_PLANE = [
  'Create a textured plane with explicit position/rotation from scenePosition. Use',
  'MeshBasicNodeMaterial unless behaviorSpec.effects requests lighting (then MeshStandardNodeMaterial).',
].join('\n');

const SUB_PROMPT_PARALLAX = [
  'Create a textured plane with displacement-mapped vertices using depthMapUrl as displacement source.',
  'Use a tessellated PlaneGeometry (64x64 segments) and TSL displacement node. Subtle parallax effect',
  'on cursor or camera movement is REQUIRED — apply via cinematicPrimitives if not already present.',
].join('\n');

const SUB_PROMPT_MESH = [
  'Load the GLB from meshUrl via ctx.glbLoader. Apply scenePosition transform. Texture and PBR',
  "materials come from the GLB itself. If imageUrl is also present, that's the reference image —",
  'do NOT apply it as a texture override; the mesh has correct textures from generation.',
].join('\n');

export function buildRenderModeSubPrompt(mode: RenderMode): string {
  switch (mode) {
    case 'sprite':
      return SUB_PROMPT_SPRITE;
    case 'plane':
      return SUB_PROMPT_PLANE;
    case 'parallax-plane':
      return SUB_PROMPT_PARALLAX;
    case 'mesh':
      return SUB_PROMPT_MESH;
    default: {
      const exhaustive: never = mode;
      throw new Error(`Unknown render mode: ${exhaustive as string}`);
    }
  }
}

export function buildCodegenPrompt(
  node: PrismNode,
  neighbors: CodegenNeighbors,
  atlas: CodegenAtlasRegion,
): CodegenPrompt {
  const perNode = buildPerNodePrompt(node, neighbors, atlas);
  const sub = buildRenderModeSubPrompt(node.renderMode ?? 'sprite');
  return {
    system: SHARED_SYSTEM_PROMPT,
    user: `${perNode}\n\n--- RENDER MODE GUIDANCE ---\n${sub}`,
  };
}
