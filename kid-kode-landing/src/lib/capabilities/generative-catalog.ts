// PRISM SHELL-W10 — Generative capability CATALOG (client-safe descriptors).
//
// The Generate section of the Functions tab renders TILES from this catalog.
// Descriptors carry NO secrets and NO vendor endpoints — only the MODEL + FUNCTION
// naming (founder law), the DL14 glyph key, the declared non-secret params that
// drive the invoke form, and a cost-basis estimate for the tile + metering.
//
// `live` is NOT decided here — it depends on server-side key presence and is
// stamped by the server registry when the client calls listCapabilities. The
// static catalog is the single source of tile identity for BOTH the client (to
// render) and the server (to dispatch to the owning adapter).
//
// Naming law (W10-D3): every tile label is `${model} — ${fn}`. AI generation is
// named by MODEL + CAPABILITY, never as a vendor platform tile ("Tripo
// integration" is forbidden in this family). Icons are DL14 custom glyphs keyed
// by `GenerativeCapabilityKind`; never a stock icon or brand mark.

import type {
  GenerativeCapabilityDescriptor,
  GenerativeParamSpec,
} from './generative';

const QUALITY: GenerativeParamSpec = {
  name: 'quality',
  label: 'Quality',
  type: 'select',
  options: ['standard', 'detailed'],
  default: 'standard',
};

/** A prior succeeded job that yields a mesh — the input to texture/rig/segment/mesh-ops. */
function sourceMeshParam(sourceAdapter?: string): GenerativeParamSpec {
  return {
    name: 'sourceJobId',
    label: 'Source mesh',
    type: 'sourceJob',
    required: true,
    sourceAdapter,
    placeholder: 'Pick a generated mesh',
  };
}

/**
 * The fixed W10 catalog. Order is the render order inside the Generate section,
 * grouped by kind. Live adapters first, stubs last.
 */
export const GENERATIVE_CATALOG: GenerativeCapabilityDescriptor[] = [
  // ── Object generation (generate3D) ────────────────────────────────────────
  {
    capabilityId: 'tripo.text-3d',
    kind: 'generate3D',
    model: 'Tripo 3.1',
    fn: 'text to 3D',
    label: 'Tripo 3.1 — text to 3D',
    glyph: 'generate3D',
    description: 'Describe an object in words → a clean PBR mesh (GLB), quad-ish topology.',
    live: false,
    costBasis: { unit: 'credits', estimate: 10, note: 'standard; detailed ~20' },
    adapterId: 'tripo',
    params: [
      { name: 'prompt', label: 'Prompt', type: 'text', required: true, placeholder: 'a brass astrolabe on a walnut base' },
      QUALITY,
    ],
  },
  {
    capabilityId: 'tripo.image-3d',
    kind: 'generate3D',
    model: 'Smart Mesh P1',
    fn: 'image to 3D',
    label: 'Smart Mesh P1 — image to 3D',
    glyph: 'generate3D',
    description: 'Turn a reference image (URL) into a textured 3D object with P1 topology.',
    live: false,
    costBasis: { unit: 'credits', estimate: 50, note: 'textured image→3D' },
    adapterId: 'tripo',
    params: [
      { name: 'imageUrl', label: 'Image URL', type: 'text', required: true, placeholder: 'https://…/reference.png' },
    ],
  },
  {
    capabilityId: 'replicate.hunyuan-3d',
    kind: 'generate3D',
    model: 'Hunyuan 3D 3.1',
    fn: 'image to 3D',
    label: 'Hunyuan 3D 3.1 — image to 3D',
    glyph: 'generate3D',
    description: 'Tencent Hunyuan 3D — image or prompt to a PBR mesh, run on Replicate.',
    live: false,
    costBasis: { unit: 'usd', estimate: 0.3, note: 'per run, est.' },
    adapterId: 'replicate',
    params: [
      { name: 'imageUrl', label: 'Image URL', type: 'text', required: false, placeholder: 'https://…/reference.png' },
      { name: 'prompt', label: 'Prompt (if no image)', type: 'text', required: false, placeholder: 'a ceramic teapot' },
      { name: 'enablePbr', label: 'PBR maps', type: 'boolean', default: true },
    ],
  },
  {
    capabilityId: 'replicate.rodin-gen2',
    kind: 'generate3D',
    model: 'Rodin Gen-2',
    fn: 'image to 3D',
    label: 'Rodin Gen-2 — image to 3D',
    glyph: 'generate3D',
    description: 'Hyper3D Rodin Gen-2 — complex 3D models from images, run on Replicate.',
    live: false,
    costBasis: { unit: 'usd', estimate: 0.4, note: 'per run, est.' },
    adapterId: 'replicate',
    params: [
      { name: 'imageUrl', label: 'Image URL', type: 'text', required: true, placeholder: 'https://…/reference.png' },
    ],
  },

  // ── PBR material (generateMaterial) ───────────────────────────────────────
  {
    capabilityId: 'flux.pbr-material',
    kind: 'generateMaterial',
    model: 'FLUX 2 Pro',
    fn: 'PBR material',
    label: 'FLUX 2 Pro — PBR material',
    glyph: 'generateMaterial',
    description: 'Describe a surface → a tileable, matched-latent, de-lit PBR material set.',
    live: false,
    costBasis: { unit: 'usd', estimate: 0.05, note: 'per plate, est.' },
    adapterId: 'flux',
    params: [
      { name: 'prompt', label: 'Surface', type: 'text', required: true, placeholder: 'hammered antique brass' },
      { name: 'kind', label: 'Family', type: 'select', options: ['metal', 'stone', 'wood', 'ceramic', 'fabric', 'generic'], default: 'generic' },
    ],
  },

  // ── Texturing (textureMesh) ───────────────────────────────────────────────
  {
    capabilityId: 'tripo.texture',
    kind: 'textureMesh',
    model: 'Smart Mesh P1',
    fn: '8K PBR texturing',
    label: 'Smart Mesh P1 — 8K PBR texturing',
    glyph: 'textureMesh',
    description: 'Re-texture an existing mesh with high-resolution PBR maps.',
    live: false,
    costBasis: { unit: 'credits', estimate: 20, note: 'detailed; base ~10' },
    adapterId: 'tripo',
    params: [sourceMeshParam('tripo'), QUALITY],
  },
  {
    capabilityId: 'meshy.texture',
    kind: 'textureMesh',
    model: 'Meshy 5',
    fn: 'texture + animate',
    label: 'Meshy 5 — texture + animate',
    glyph: 'textureMesh',
    description: 'Meshy AI texturing with animation presets (documented live SDK; stub until keyed).',
    live: false,
    costBasis: { unit: 'usd', estimate: 0.2, note: 'per run, est.' },
    adapterId: 'meshy',
    params: [sourceMeshParam(), { name: 'style', label: 'Style', type: 'text', required: false, placeholder: 'weathered bronze' }],
  },

  // ── Auto-rig (rigMesh) ────────────────────────────────────────────────────
  {
    capabilityId: 'tripo.rig',
    kind: 'rigMesh',
    model: 'Tripo Rig',
    fn: 'universal auto-rig',
    label: 'Tripo Rig — universal auto-rig',
    glyph: 'rigMesh',
    description: 'Auto-rig a mesh (biped / quadruped / creature) into an animatable skeleton.',
    live: false,
    costBasis: { unit: 'credits', estimate: 25, note: 'pre-rig check free' },
    adapterId: 'tripo',
    params: [
      sourceMeshParam('tripo'),
      { name: 'skeleton', label: 'Skeleton', type: 'select', options: ['biped', 'quadruped', 'creature'], default: 'biped' },
    ],
  },

  // ── Part segmentation (segmentMesh) ───────────────────────────────────────
  {
    capabilityId: 'tripo.segment',
    kind: 'segmentMesh',
    model: 'Smart Mesh P1',
    fn: 'part segmentation',
    label: 'Smart Mesh P1 — part segmentation',
    glyph: 'segmentMesh',
    description: 'Split a mesh into named semantic parts you can address individually.',
    live: false,
    costBasis: { unit: 'credits', estimate: 40, note: 'smart part split' },
    adapterId: 'tripo',
    params: [sourceMeshParam('tripo')],
  },

  // ── Explorable world (generateWorld) — typed stub ─────────────────────────
  {
    capabilityId: 'marble.world',
    kind: 'generateWorld',
    model: 'Marble',
    fn: 'explorable world',
    label: 'Marble — explorable world',
    glyph: 'generateWorld',
    description: 'World Labs Marble — text/image → a navigable 3D world (documented live SDK; stub until keyed).',
    live: false,
    costBasis: { unit: 'usd', estimate: 1.0, note: 'per world, est.' },
    adapterId: 'marble',
    params: [
      { name: 'prompt', label: 'World prompt', type: 'text', required: false, placeholder: 'a misty alpine valley at dawn' },
      { name: 'imageUrl', label: 'Seed image (optional)', type: 'text', required: false, placeholder: 'https://…/scene.png' },
    ],
  },

  // ── Mesh ops (meshOps) — typed stub ───────────────────────────────────────
  {
    capabilityId: 'meshops.mesh',
    kind: 'meshOps',
    model: 'Mesh Ops',
    fn: 'retopo · repair · convert',
    label: 'Mesh Ops — retopo · repair · convert',
    glyph: 'meshOps',
    description: 'Aggregator mesh utilities: retopologize, repair, and format-convert (stub until keyed).',
    live: false,
    costBasis: { unit: 'usd', estimate: 0.1, note: 'per op, est.' },
    adapterId: 'meshops',
    params: [
      sourceMeshParam(),
      { name: 'operation', label: 'Operation', type: 'select', options: ['retopo', 'repair', 'convert'], default: 'retopo' },
      { name: 'format', label: 'Target format', type: 'select', options: ['glb', 'obj', 'fbx', 'usdz'], default: 'glb' },
    ],
  },
];

/** Fast lookup by capabilityId (used by the server dispatch + the UI). */
export const GENERATIVE_BY_ID: Record<string, GenerativeCapabilityDescriptor> =
  Object.fromEntries(GENERATIVE_CATALOG.map((c) => [c.capabilityId, c]));

/** Display grouping for the Generate section, in render order. */
export const GENERATIVE_GROUPS: Array<{ kind: GenerativeCapabilityDescriptor['kind']; label: string }> = [
  { kind: 'generate3D', label: 'Object generation' },
  { kind: 'generateMaterial', label: 'PBR material' },
  { kind: 'textureMesh', label: 'Texturing' },
  { kind: 'rigMesh', label: 'Auto-rig' },
  { kind: 'segmentMesh', label: 'Part segmentation' },
  { kind: 'generateWorld', label: 'Explorable world' },
  { kind: 'meshOps', label: 'Mesh ops' },
];
