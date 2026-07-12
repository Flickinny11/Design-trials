// Codegen prompts — L1 base template per spec §9 of the (archived)
// PRISM-RENDERER-MIGRATION-SPEC.md (L248-L355), extended by the W-PCP
// Prism Crash-Course Package (docs/prism/pcp/, authority:
// docs/prism/RATIFICATION-2026-07-09.md + the W-PCP wave prompt). The shared
// system prompt is byte-stable across calls so that RadixAttention
// prefix-cache hits (§9.A L275; OD7 byte-stability requirement). Per-node
// prompts are not cacheable; render-mode sub-prompts are appended only for
// the matching mode.
//
// L1 v2 composition (W-PCP D5): the original §9.A constraint block +
// RUNTIME_SURFACE_L1_BLOCK (GENERATED from the runtime source — see
// scripts/pcp/extract-runtime-surface.mjs, I-P2) + the dependency and design
// doctrine distillations (pcp-blocks.ts). The pre-PCP L1 is preserved
// byte-frozen as SHARED_SYSTEM_PROMPT_V1 (probe baseline + traceability).
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
import { RUNTIME_SURFACE_L1_BLOCK } from './runtime-surface.generated';
import { DESIGN_DOCTRINE_L1_BLOCK, DEPENDENCY_L1_BLOCK } from './pcp-blocks';
import { extractSpecElements, buildSpecManifestPromptBlock } from './spec-manifest';

/** Spec §9.A L250-L276 — the pre-PCP L1, byte-frozen (W-BAKE ran on exactly
 *  these bytes; the W-PCP probe's "old" arm re-uses them verbatim). */
export const SHARED_SYSTEM_PROMPT_V1: string = [
  'You are a code generator for Kriptik Prism. Generate a self-contained Three.js v184+',
  'node module for a UI element that will be mounted into a 3D scene.',
  '',
  'CONSTRAINTS:',
  "- Import only from: 'three/webgpu', 'three/tsl', 'gsap', '@/primitives' (alias for the",
  "  cinematic primitives library), '@/text' (alias for MSDF text utilities).",
  // P5 follow-up (runtime-spec §9 "Shaders: TSL only") — cage-free restatement
  // after the 876d603 rescission removed the whole shader line. Authoring
  // bespoke shaders is allowed; raw GLSL/WGSL strings are not how.
  '- Shaders are written with three/tsl nodes only — never raw GLSL/WGSL strings and never ShaderMaterial/RawShaderMaterial.',
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
  '',
  'OUTPUT: Only the JavaScript code. No explanation. No markdown fences.',
].join('\n');

const OUTPUT_LINE = 'OUTPUT: Only the JavaScript code. No explanation. No markdown fences.';

/** L1 v2 — the LIVE shared system prompt (W-PCP D5). Composition: the V1
 *  constraint body (byte-identical head, minus its trailing OUTPUT line) +
 *  the generated runtime surface + the dependency gate + the design
 *  doctrine, with the OUTPUT contract restated last. Byte-stable: every
 *  part is a module constant (OD7). */
export const SHARED_SYSTEM_PROMPT: string = [
  SHARED_SYSTEM_PROMPT_V1.replace(/\n\nOUTPUT:[^\n]*$/, ''),
  '',
  RUNTIME_SURFACE_L1_BLOCK,
  '',
  DEPENDENCY_L1_BLOCK,
  '',
  DESIGN_DOCTRINE_L1_BLOCK,
  '',
  OUTPUT_LINE,
].join('\n');

// ---------------------------------------------------------------------------
// L2 — the WORLD block template (W-PCP D5 item 11).
//
// One WORLD block is compiled per BUILD (never per node) and rides between
// L1 and L3 on every codegen call of that build — byte-identical across all
// nodes so provider prefix caches hold (OD7; ratified budget 2-3K typical /
// 5K hard cap). Exactly the five permitted content classes of swarm-dispatch
// §3.1: design tokens / navigation map / shared contract types / animation
// vocabulary / capability REFERENCES (never secrets). The shape below
// reproduces the W-BAKE frozen corpus L2 byte-for-byte given the same input
// (proven by tests/unit/wpcp-prompt-compiler.test.ts) — the corpus block IS
// this template instantiated for Nova Atelier.
//
// The optional `skillIndex` section (Amendment A E2, "6. SKILL INDEX") is
// OFF unless the caller passes one — Amendment A is seeded, not yet ratified
// canon, so the default output keeps the five-class rule intact.
// ---------------------------------------------------------------------------

export interface WorldBlockInput {
  appName: string;
  /** One-line app summary for the navigation map header. */
  summary: string;
  /** Design-token lines (section 1), WITHOUT the leading "- ". */
  designTokens: string[];
  hubs: Array<{ hubId: string; title: string; role: string }>;
  edges: Array<{ from: string; to: string; type: string; event?: string }>;
  /** Shared contract lines (section 3), WITHOUT the leading "- ". */
  contracts: string[];
  /** Animation vocabulary lines (section 4), WITHOUT the leading "- ". */
  animationVocabulary: string[];
  /** Capability REFERENCES (section 5): ref + short note. Never secrets. */
  capabilityRefs: Array<{ ref: string; note: string }>;
  /** Optional Amendment-A skill index block (see skill-registry.ts
   *  buildSkillIndexBlock). Appended verbatim as its own section. */
  skillIndex?: string;
}

/** Compile the per-build L2 WORLD block. Pure string composition —
 *  deterministic for a given input; hashing (worldHash) happens in the
 *  server-side callers, not here (this module stays client-safe). */
export function buildWorldBlock(input: WorldBlockInput): string {
  const lines: string[] = [
    `${input.appName.toUpperCase().replace(/\s+/g, '_')}_WORLD`,
    '',
    '1. DESIGN TOKENS',
    ...input.designTokens.map((t) => `- ${t}`),
    '',
    '2. NAVIGATION MAP',
    `- App: ${input.appName} — ${input.summary}`,
    ...input.hubs.map((h) => `- Hub ${h.hubId} ("${h.title}", ${h.role})`),
    ...input.edges.map(
      (e) => `- Edge ${e.from} -> ${e.to} (${e.type}${e.event ? `, event: ${e.event}` : ''})`,
    ),
    '',
    '3. SHARED CONTRACT TYPES (tRPC route + Zod signature)',
    ...input.contracts.map((c) => `- ${c}`),
    '',
    '4. ANIMATION VOCABULARY',
    ...input.animationVocabulary.map((a) => `- ${a}`),
    '',
    '5. INTEGRATION CAPABILITY REFERENCES (references ONLY — never tokens, keys, or secrets)',
    ...input.capabilityRefs.map((c) => `- ${c.ref} (${c.note})`),
  ];
  if (input.skillIndex) {
    lines.push('', input.skillIndex);
  }
  return lines.join('\n');
}

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

// Canvas-spec §7 / INV-11 — text nodes need NO generated code: the default
// render-mode factory builds real MSDF glyphs from node.textSpec via the
// Prism TextObject. Letterforms must never be hand-rendered or baked.
const SUB_PROMPT_TEXT = [
  "Do not generate a code module for renderMode 'text'. The runtime's default factory renders",
  'real MSDF font glyphs from node.textSpec (Prism TextObject). Never synthesize letterforms,',
  'never use THREE.TextGeometry, never bake text into images (INV-11).',
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
    case 'text':
      return SUB_PROMPT_TEXT;
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
  // W-VIS D2 (additive): visual nodes carry a required spec-manifest block —
  // the generator maps every L3 spec element to a code location; the
  // deterministic gate (spec-manifest.ts + verifier SPEC_MANIFEST_INCOMPLETE)
  // rejects unmapped elements pre-render. Nodes with no extractable spec
  // elements get no block (byte-identical prompt to pre-D2 for those nodes).
  const specElements = extractSpecElements(node);
  const manifestBlock = buildSpecManifestPromptBlock(specElements);
  const manifestSection = manifestBlock ? `\n\n--- SPEC MANIFEST ---\n${manifestBlock}` : '';
  return {
    system: SHARED_SYSTEM_PROMPT,
    user: `${perNode}\n\n--- RENDER MODE GUIDANCE ---\n${sub}${manifestSection}`,
  };
}
