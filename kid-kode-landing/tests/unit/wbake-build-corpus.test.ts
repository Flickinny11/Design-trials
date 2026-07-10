// W-BAKE — FROZEN CORPUS BUILDER (D1; spec §11.1 + OD12).
//
// Env-gated generator (the FR_DEMO-gated-vitest precedent from W-FR): runs
// ONLY with WBAKE_BUILD_CORPUS=1 (functional corpus) or WBAKE_BUILD_VISUAL=1
// (visual corpus merge — requires the design-director output on disk).
// In normal suites both describe blocks are skipped and this file is inert.
//
// FUNCTIONAL CORPUS (50 cases; 30 simple / 15 moderate, ≥8 integration-
// bearing / 5 complex): derived from THE REFERENCE PLAN — the deterministic
// Conductor blueprint (`buildDeterministicBlueprint`) for the Nova Atelier
// reference brief (the same fixture family the W5 pipeline proof uses),
// extended to five sections so the plan spans a realistic app. Each blueprint
// node is authored through the REAL certified node path (`authorNode`) and
// then receives a corpus-authored codegen mapping:
//   - renderMode assignment (the codegen harness generates modules for
//     sprite/plane/parallax-plane/mesh — renderMode 'text' nodes need no
//     generated code per prompts.ts SUB_PROMPT_TEXT, so text CONTENT rides
//     inside plane/sprite cases as intent.visualSpec.textContent instead),
//   - real committed asset URLs (textures / depth map / GLBs),
//   - tier enrichment: interactions, capability-referenced apiCalls (I3:
//     references only, never secrets), dataBindings, cinematic primitives.
//
// L1 = SHARED_SYSTEM_PROMPT verbatim (byte-stable; spec §3.1).
// L2 = the compiled WORLD block (this builder compiles it ONCE; §3.1's five
//      permitted content classes; byte-identical across every case).
// L3 = buildPerNodePrompt(node, neighbors, atlas) + render-mode guidance —
//      the exact per-case payload string is FROZEN into the case file.
//
// FREEZE (I-B2): manifest.json carries sha256 of every emitted file plus the
// worldHash/l1Hash. Committed before any contestant call; any post-freeze
// edit invalidates completed runs for the affected nodes.

import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

import type { BuildBrief } from '@/../packages/shared-interfaces/src/prism-intake';
import { buildDeterministicBlueprint } from '@/server/conductor/blueprint';
import { resolveDirection } from '@/server/conductor/directions';
import { authorNode } from '@/server/conductor/node-factory';
import {
  SHARED_SYSTEM_PROMPT,
  buildPerNodePrompt,
  buildRenderModeSubPrompt,
  type CodegenNeighbors,
  type CodegenAtlasRegion,
} from '@/lib/prism/codegen/prompts';
import type { PrismNode, RenderMode } from '@/lib/prism-graph/types';

const CORPUS_ROOT = path.resolve(__dirname, '..', '..', 'notes', 'bakeoff', 'corpus');
const FUNCTIONAL_DIR = path.join(CORPUS_ROOT, 'functional');
const VISUAL_DIR = path.join(CORPUS_ROOT, 'visual');

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// ── The reference brief (Nova Atelier, five sections) ────────────────────────

function referenceBrief(): BuildBrief {
  return {
    v: 1,
    title: 'Nova Atelier',
    prompt:
      'A premium landing page for a machined-metal watch atelier. Confident, precise, luxury.',
    brandProfile: {
      v: 1,
      name: 'Nova Atelier',
      palette: { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38' },
      toneDescriptors: ['precise', 'luxury'],
    },
    chosenDirectionId: 'atelier-noir',
    lines: [
      {
        id: 'l-summary',
        key: 'summary',
        label: 'Summary',
        value: 'A machined-metal watch atelier landing with catalog, pricing, journal, and contact.',
      },
      { id: 'l-archetype', key: 'archetype', label: 'Archetype', value: 'landing page' },
      {
        id: 'l-sections',
        key: 'sections',
        label: 'Sections',
        value: 'Features, Collection, Pricing, Journal, Contact',
      },
    ],
    integrations: [],
    deployTarget: 'prism-cloud',
    seedsUsed: [{ kind: 'prompt', detail: 'W-BAKE reference plan' }],
    answers: [],
    branchCount: 0,
    fastPath: false,
  } as unknown as BuildBrief;
}

// ── Committed real assets used by corpus cases ───────────────────────────────

const IMG = [
  '/prism-mock/home/nodes/feature-card.png',
  '/prism-mock/home/nodes/cta-hero-isolated.png',
  '/prism-mock/home/nodes/floating-accent.png',
  '/prism-mock/home/nodes/orb-decor.png',
  '/prism-assets/chrome/brushed-metal.map.png',
  '/prism-assets/chrome/ceramic-grain.map.png',
] as const;
const PARALLAX_IMG = '/prism-mock/home/nodes/parallax-stack.png';
const PARALLAX_DEPTH = '/prism-mock/home/nodes/parallax-stack.depth.png';
const GLB = ['/prism-mock/home/nodes/cta-hero.glb', '/prism-mock/orrery/meshes/gear-a.glb'] as const;

const ATLAS: CodegenAtlasRegion = { atlasIndex: 0, x: 0, y: 0, width: 512, height: 320 };

// ── Corpus vocabulary (capability REFERENCES only — I3/I-B6) ─────────────────

const CONTRACTS: Record<string, { call: { endpoint: string; method: string; capability: string }; binding: { source: string; target: string } }> = {
  catalog: {
    call: { endpoint: 'trpc.catalog.list', method: 'query', capability: 'capability:shopify.catalog' },
    binding: { source: 'trpc.catalog.list.items[]', target: 'cards[]' },
  },
  pricing: {
    call: { endpoint: 'trpc.pricing.tiers', method: 'query', capability: 'capability:stripe.products' },
    binding: { source: 'trpc.pricing.tiers.tiers[]', target: 'tierPanels[]' },
  },
  checkout: {
    call: { endpoint: 'trpc.checkout.begin', method: 'mutation', capability: 'capability:stripe.checkout' },
    binding: { source: 'trpc.checkout.begin.checkoutUrl', target: 'onClick.navigate' },
  },
  journal: {
    call: { endpoint: 'trpc.journal.posts', method: 'query', capability: 'capability:notion.cms' },
    binding: { source: 'trpc.journal.posts.posts[]', target: 'rows[]' },
  },
  contact: {
    call: { endpoint: 'trpc.contact.submit', method: 'mutation', capability: 'capability:resend.email' },
    binding: { source: 'form.fields', target: 'trpc.contact.submit.input' },
  },
  waitlist: {
    call: { endpoint: 'trpc.waitlist.join', method: 'mutation', capability: 'capability:resend.email' },
    binding: { source: 'form.email', target: 'trpc.waitlist.join.input.email' },
  },
  scheduling: {
    call: { endpoint: 'trpc.visits.book', method: 'mutation', capability: 'capability:cal.scheduling' },
    binding: { source: 'trpc.visits.book.slot', target: 'confirmPanel' },
  },
  inventory: {
    call: { endpoint: 'trpc.inventory.status', method: 'query', capability: 'capability:shopify.inventory' },
    binding: { source: 'trpc.inventory.status.inStock', target: 'stockBadge' },
  },
};

// ── The L2 WORLD block (compiled ONCE; §3.1 items 1–5, nothing else) ─────────

function compileWorldBlock(args: {
  appName: string;
  summary: string;
  hubs: Array<{ hubId: string; title: string; role: string }>;
  edges: Array<{ from: string; to: string; type: string; event?: string }>;
  palette: Record<string, string>;
}): string {
  const { appName, summary, hubs, edges, palette } = args;
  return [
    `${appName.toUpperCase().replace(/\s+/g, '_')}_WORLD`,
    '',
    '1. DESIGN TOKENS',
    `- Palette: primary ${palette.primary} (ink), secondary ${palette.secondary} (paper), accent ${palette.accent} (signal red), surface ${palette.surface} (near-black surface).`,
    '- Typography: display = Lora (serif, weights 400/600); text = JetBrains Mono (mono, 400/700). Type scale (scene-unit em heights): hero 0.62, headline 0.34, subhead 0.2, body 0.13, caption 0.09.',
    '- Spacing rhythm: base unit 0.25 scene units; card padding 0.5; hub frame spans x∈[-3.5,3.5], y∈[-3,2.5] at PerspectiveCamera(fov 50, z=10).',
    '- Effects vocabulary: machined-metal PBR (brushed anisotropy, clearcoat ≤ 0.25, metalness ≤ 0.55, roughness ≥ 0.5), weighted-settle motion, engineered gradients (no soft pastel blur), contrast minimum 4.5:1 for text roles.',
    '',
    '2. NAVIGATION MAP',
    `- App: ${appName} — ${summary}`,
    ...hubs.map((h) => `- Hub ${h.hubId} ("${h.title}", ${h.role})`),
    ...edges.map((e) => `- Edge ${e.from} -> ${e.to} (${e.type}${e.event ? `, event: ${e.event}` : ''})`),
    '',
    '3. SHARED CONTRACT TYPES (tRPC route + Zod signature)',
    '- trpc.catalog.list (query) -> z.object({ items: z.array(z.object({ id: z.string(), title: z.string(), priceUsd: z.number(), imageUrl: z.string() })) })',
    '- trpc.pricing.tiers (query) -> z.object({ tiers: z.array(z.object({ id: z.string(), name: z.string(), usdMonthly: z.number(), features: z.array(z.string()) })) })',
    '- trpc.checkout.begin (mutation, input z.object({ itemId: z.string() })) -> z.object({ checkoutUrl: z.string() })',
    '- trpc.journal.posts (query) -> z.object({ posts: z.array(z.object({ id: z.string(), title: z.string(), excerpt: z.string(), publishedAt: z.string() })) })',
    '- trpc.contact.submit (mutation, input z.object({ email: z.string(), message: z.string() })) -> z.object({ ok: z.boolean() })',
    '- trpc.waitlist.join (mutation, input z.object({ email: z.string() })) -> z.object({ position: z.number() })',
    '- trpc.visits.book (mutation, input z.object({ slotIso: z.string() })) -> z.object({ slot: z.string(), confirmed: z.boolean() })',
    '- trpc.inventory.status (query, input z.object({ itemId: z.string() })) -> z.object({ inStock: z.boolean(), etaDays: z.number().nullable() })',
    '',
    '4. ANIMATION VOCABULARY',
    '- GSAP presets (named): rise-in (y +0.4 -> 0, power3.out, 0.7s), fade-up (opacity 0->1 + y +0.2, power2.out, 0.5s), stagger-cards (children, 80ms stagger), press-down (scale 0.97, 120ms, back.out), weighted-settle (overshoot 1.04 -> 1.0, power4.out, 0.9s).',
    '- Cinematic primitives (apply via ctx.primitives[name]): orbit, depth-rotate, dissolve-morph, displacement-transition, parallax-scroll, magnetic-cursor, particle-emerge, fly-through, kinetic-text.',
    '',
    '5. INTEGRATION CAPABILITY REFERENCES (references ONLY — never tokens, keys, or secrets)',
    '- capability:shopify.catalog (product catalog reads)',
    '- capability:shopify.inventory (stock status reads)',
    '- capability:stripe.products (pricing tier reads)',
    '- capability:stripe.checkout (checkout session creation)',
    '- capability:notion.cms (journal content reads)',
    '- capability:resend.email (transactional email sends)',
    '- capability:cal.scheduling (atelier visit booking)',
  ].join('\n');
}

// ── Case slotting ────────────────────────────────────────────────────────────

type Tier = 'simple' | 'moderate' | 'complex';

interface CorpusCase {
  caseId: string;
  tier: Tier;
  integrationBearing: boolean;
  sourceNodeId: string | null;
  node: PrismNode;
  neighbors: CodegenNeighbors;
  atlas: CodegenAtlasRegion;
  verifierCtx: { renderMode: RenderMode; hasTextContent: boolean };
  l3: string;
}

function baseVisualSpec(palette: Record<string, string>, effects: string) {
  return {
    colors: {
      ink: palette.primary,
      paper: palette.secondary,
      accent: palette.accent,
      surface: palette.surface,
    },
    typography: { display: 'Lora serif 400/600', text: 'JetBrains Mono 400/700' },
    effects,
  };
}

function textContentOf(node: PrismNode): Array<{ text: string; role: string; typography: { fontSize: number; fontWeight: number } }> {
  // Carry the blueprint's real copy into the codegen case as visualSpec
  // textContent (rendered via ctx.fontAtlas — INV-R11).
  const ts = (node as PrismNode & { textSpec?: { content?: string; fontSize?: number; fontWeight?: number } }).textSpec;
  if (ts?.content) {
    return [
      {
        text: ts.content,
        role: (ts.fontSize ?? 0.2) >= 0.3 ? 'headline' : 'body',
        typography: { fontSize: Math.round(((ts.fontSize ?? 0.2) / 0.13) * 16), fontWeight: ts.fontWeight ?? 400 },
      },
    ];
  }
  return [];
}

describe.skipIf(process.env.WBAKE_BUILD_CORPUS !== '1')('W-BAKE functional corpus builder', () => {
  it('derives, stratifies, and freezes 50 functional cases from the reference plan', () => {
    const brief = referenceBrief();
    const direction = resolveDirection(brief);
    const blueprint = buildDeterministicBlueprint(brief, direction);
    const palette = direction.palette as unknown as Record<string, string>;

    // 1) Author every blueprint node through the certified path.
    const authored: Array<{ hubId: string; hubTitle: string; node: PrismNode }> = [];
    for (const hub of blueprint.hubs) {
      for (const bn of hub.nodes) {
        const a = authorNode(bn, hub.hubId, direction);
        authored.push({ hubId: hub.hubId, hubTitle: hub.title, node: a.node });
      }
    }
    expect(authored.length).toBeGreaterThan(10);

    // 2) Deterministic case derivation to exactly 50 (30/15/5, ≥8 integration).
    //    Order: authored nodes in blueprint order, then synthesized extras
    //    cycling hubs with fixed archetypes.
    const EXTRA_ARCHETYPES = [
      { subtype: 'stat-tile', caption: (t: string) => `Stat tile for ${t}: a compact metric card (value + label) on a machined surface.` },
      { subtype: 'list-row', caption: (t: string) => `List row for ${t}: a horizontal row with title, meta text, and a subtle divider.` },
      { subtype: 'badge', caption: (t: string) => `Badge for ${t}: a small capsule label with accent edge light.` },
      { subtype: 'quote-panel', caption: (t: string) => `Quote panel for ${t}: a client quote with attribution line.` },
      { subtype: 'thumb-card', caption: (t: string) => `Thumbnail card for ${t}: an image card with caption strip.` },
      { subtype: 'divider-orn', caption: (t: string) => `Ornamental divider for ${t}: a thin machined rule with center jewel.` },
    ] as const;

    interface Slot { tier: Tier; integration: boolean; renderMode: RenderMode }
    const slots: Slot[] = [
      // 30 simple — sprite/plane, no behavior.
      ...Array.from({ length: 30 }, (_, i): Slot => ({
        tier: 'simple',
        integration: false,
        renderMode: (i % 3 === 2 ? 'sprite' : 'plane') as RenderMode,
      })),
      // 15 moderate — 9 integration-bearing (≥8 required), mixed modes.
      ...Array.from({ length: 15 }, (_, i): Slot => ({
        tier: 'moderate',
        integration: i < 9,
        renderMode: (i % 5 === 4 ? 'parallax-plane' : i % 5 === 3 ? 'mesh' : 'plane') as RenderMode,
      })),
      // 5 complex — hero-grade, 2 primitives each.
      ...Array.from({ length: 5 }, (_, i): Slot => ({
        tier: 'complex',
        integration: i < 2,
        renderMode: (i % 2 === 0 ? 'mesh' : 'parallax-plane') as RenderMode,
      })),
    ];

    // Source pool: authored nodes first, then synthesized extras.
    const pool: Array<{ hubId: string; hubTitle: string; node: PrismNode; sourceNodeId: string | null }> = authored.map(
      (a) => ({ ...a, sourceNodeId: a.node.nodeId }),
    );
    let extraIdx = 0;
    while (pool.length < slots.length) {
      const hub = blueprint.hubs[extraIdx % blueprint.hubs.length];
      const arch = EXTRA_ARCHETYPES[extraIdx % EXTRA_ARCHETYPES.length];
      const nodeId = `wb-extra-${hub.hubId}-${String(extraIdx + 1).padStart(2, '0')}`;
      const synth: PrismNode = {
        nodeId,
        subtype: arch.subtype,
        parentHubId: hub.hubId,
        serviceTag: 'wbake-corpus',
        visual: { sourceAsset: null } as unknown as PrismNode['visual'],
        intent: {
          caption: arch.caption(hub.title),
          behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
          stateEffects: [],
          visualSpec: { textContent: [], layers: [] },
          contracts: { inputs: {}, outputs: {} },
        },
        codeRef: '',
        backendRef: null,
        scenePosition: {
          x: -2.5 + (extraIdx % 5) * 1.25,
          y: 1.6 - Math.floor(extraIdx / 5) * 0.9,
          z: 0,
          rotationX: 0, rotationY: 0, rotationZ: 0,
          scaleX: 1, scaleY: 1, scaleZ: 1,
        },
      } as unknown as PrismNode;
      pool.push({ hubId: hub.hubId, hubTitle: hub.title, node: synth, sourceNodeId: null });
      extraIdx += 1;
    }

    // 3) Build the cases.
    const contractKeys = Object.keys(CONTRACTS);
    const cases: CorpusCase[] = slots.map((slot, i) => {
      const src = pool[i];
      const n: PrismNode = JSON.parse(JSON.stringify(src.node)) as PrismNode;
      const caseId = `f-${String(i + 1).padStart(2, '0')}-${slot.tier}${slot.integration ? '-int' : ''}`;

      n.renderMode = slot.renderMode;
      const vis = n.visual as unknown as Record<string, unknown>;
      if (slot.renderMode === 'sprite' || slot.renderMode === 'plane') {
        vis.sourceAsset = IMG[i % IMG.length];
        n.depthMapUrl = null;
        n.meshUrl = null;
      } else if (slot.renderMode === 'parallax-plane') {
        vis.sourceAsset = PARALLAX_IMG;
        n.depthMapUrl = PARALLAX_DEPTH;
        n.meshUrl = null;
      } else {
        vis.sourceAsset = null;
        n.depthMapUrl = null;
        n.meshUrl = GLB[i % GLB.length];
      }

      const text = textContentOf(src.node);
      const effects =
        slot.tier === 'complex'
          ? 'hero-grade: layered depth, accent rim light, weighted-settle entrance, machined-metal PBR'
          : slot.tier === 'moderate'
            ? 'interactive card: hover lift (rise-in), press-down on click, accent edge on focus'
            : 'static composition: engineered gradient surface, subtle grain, no interactivity';
      n.intent.visualSpec = {
        ...n.intent.visualSpec,
        textContent: text,
        layers: n.intent.visualSpec?.layers ?? [],
        ...baseVisualSpec(palette, effects),
      };

      const behavior = n.intent.behaviorSpec ?? {
        interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [],
      };
      if (slot.tier !== 'simple') {
        behavior.interactions = [
          { event: 'hover', effect: 'preset:rise-in (subtle, 0.15 scene units)' },
          { event: 'click', effect: `emit:${src.hubId}.select` },
        ];
      }
      if (slot.integration) {
        const c = CONTRACTS[contractKeys[i % contractKeys.length]];
        behavior.apiCalls = [c.call];
        behavior.dataBindings = [c.binding];
      }
      if (slot.tier === 'complex') {
        behavior.emits = [...(behavior.emits ?? []), `${src.hubId}.hero.engaged`];
        n.cinematicPrimitives = [
          { name: 'parallax-scroll', trigger: 'scroll', params: { intensity: 0.4 } },
          i % 2 === 0
            ? { name: 'depth-rotate', trigger: 'hover', params: { maxDeg: 8 } }
            : { name: 'magnetic-cursor', trigger: 'hover', params: { radius: 1.2, strength: 0.35 } },
        ];
      } else if (slot.tier === 'moderate' && i % 3 === 0) {
        n.cinematicPrimitives = [{ name: 'parallax-scroll', trigger: 'scroll', params: { intensity: 0.25 } }];
      } else {
        n.cinematicPrimitives = [];
      }
      n.intent.behaviorSpec = behavior;

      // Neighbors: hub as parent; up to 3 same-hub pool siblings.
      const siblings = pool
        .filter((p, j) => j !== i && p.hubId === src.hubId)
        .slice(0, 3)
        .map((p) => ({ id: p.node.nodeId, type: p.node.subtype }));
      const neighbors: CodegenNeighbors = {
        parent: { id: src.hubId, type: 'hub' },
        siblings,
        children: [],
      };

      const l3 = `${buildPerNodePrompt(n, neighbors, ATLAS)}\n\n--- RENDER MODE GUIDANCE ---\n${buildRenderModeSubPrompt(slot.renderMode)}`;

      return {
        caseId,
        tier: slot.tier,
        integrationBearing: slot.integration,
        sourceNodeId: src.sourceNodeId,
        node: n,
        neighbors,
        atlas: ATLAS,
        verifierCtx: { renderMode: slot.renderMode, hasTextContent: text.length > 0 },
        l3,
      };
    });

    // 4) Stratification assertions (spec §11.1).
    expect(cases.length).toBe(50);
    expect(cases.filter((c) => c.tier === 'simple').length).toBe(30);
    expect(cases.filter((c) => c.tier === 'moderate').length).toBe(15);
    expect(cases.filter((c) => c.tier === 'complex').length).toBe(5);
    expect(cases.filter((c) => c.tier === 'moderate' && c.integrationBearing).length).toBeGreaterThanOrEqual(8);

    // 5) Compile L1 + L2 and write everything.
    const world = compileWorldBlock({
      appName: blueprint.appName,
      summary: blueprint.summary,
      hubs: blueprint.hubs.map((h) => ({ hubId: h.hubId, title: h.title, role: h.role })),
      edges: blueprint.edges,
      palette,
    });
    // A3: L2 hard cap 5000 tokens — assert with the coarse 4-chars/token rule.
    expect(world.length / 4).toBeLessThan(5000);

    mkdirSync(path.join(FUNCTIONAL_DIR, 'cases'), { recursive: true });
    writeFileSync(path.join(FUNCTIONAL_DIR, 'l1-system.txt'), SHARED_SYSTEM_PROMPT);
    writeFileSync(path.join(FUNCTIONAL_DIR, 'l2-world.txt'), world);

    const files: Record<string, string> = {
      'l1-system.txt': sha256(SHARED_SYSTEM_PROMPT),
      'l2-world.txt': sha256(world),
    };
    for (const c of cases) {
      const rel = `cases/${c.caseId}.json`;
      const body = JSON.stringify(c, null, 2);
      writeFileSync(path.join(FUNCTIONAL_DIR, rel), body);
      files[rel] = sha256(body);
    }
    const manifest = {
      corpus: 'wbake-functional-v1',
      generator: 'tests/unit/wbake-build-corpus.test.ts (WBAKE_BUILD_CORPUS=1)',
      referencePlan: {
        brief: 'Nova Atelier (W5 fixture family, five sections)',
        planner: 'buildDeterministicBlueprint (stub origin)',
        blueprintOrigin: blueprint.origin,
        authoredNodeCount: authored.length,
        synthesizedExtras: pool.filter((p) => p.sourceNodeId === null).length,
      },
      stratification: {
        simple: 30,
        moderate: 15,
        moderateIntegrationBearing: cases.filter((c) => c.tier === 'moderate' && c.integrationBearing).length,
        complex: 5,
      },
      l1Hash: files['l1-system.txt'],
      worldHash: files['l2-world.txt'],
      frozen: true,
      files,
    };
    writeFileSync(path.join(FUNCTIONAL_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  });
});

// ── Visual corpus merge (WBAKE_BUILD_VISUAL=1) ───────────────────────────────
//
// Inputs: notes/bakeoff/corpus/visual/skeletons.json (20 case skeletons) and
// notes/bakeoff/corpus/visual/design-director-output.json (the Fable 5
// design-director pass — authored visualSpecs with concrete values; the raw
// transcript is committed alongside). This block merges them into full case
// files with frozen L3 payloads and a scene spec for the render harness.

interface VisualSkeleton {
  caseId: string;
  title: string;
  category: '3d' | '2d';
  archetype: string;
  intentLine: string;
  imageUrl?: string;
  depthMapUrl?: string;
  meshUrl?: string;
  renderMode: RenderMode;
  primitives?: Array<{ name: string; trigger: string; params: Record<string, number | string | boolean> }>;
}

interface DirectorCase {
  caseId: string;
  visualSpec: {
    colors: Record<string, unknown>;
    typography: Record<string, unknown>;
    effects: string | Record<string, unknown>;
    textContent?: Array<{ text: string; role: string; typography: { fontSize: number; fontWeight: number } }>;
  };
  sceneSpec: {
    camera: { position: [number, number, number]; lookAt: [number, number, number]; fov: number };
    lights: Array<Record<string, unknown>>;
    background: string;
    motionNote?: string;
  };
  contrastMinimum?: string;
}

// A corpus-authored render-mode guidance used ONLY for visual hero cases whose
// construction is procedural 3D (no GLB exists). Frozen; identical for every
// contestant (the identical-prompt rule is per NODE, and every contestant of a
// node receives this same text).
const VISUAL_HERO_SUBPROMPT = [
  'Construct the element procedurally from three/webgpu geometries and three/tsl node materials',
  'per the VISUAL spec. Real 3D construction is expected: multiple meshes, explicit material',
  'parameters (color/roughness/metalness/emissive) and any lights the VISUAL spec requests as',
  'child lights of the returned group. Use ctx.fontAtlas for ALL text content. No GLB asset is',
  'available for this node — do NOT call ctx.glbLoader. Load image textures only from the ASSETS',
  'imageUrl via ctx.textureLoader when the VISUAL spec calls for a textured surface.',
].join('\n');

describe.skipIf(process.env.WBAKE_BUILD_VISUAL !== '1')('W-BAKE visual corpus merge', () => {
  it('merges design-director visualSpecs into 20 frozen visual cases (≥6 genuinely 3D)', () => {
    const skeletons = JSON.parse(
      readFileSync(path.join(VISUAL_DIR, 'skeletons.json'), 'utf8'),
    ) as VisualSkeleton[];
    const director = JSON.parse(
      readFileSync(path.join(VISUAL_DIR, 'design-director-output.json'), 'utf8'),
    ) as { cases: DirectorCase[] };

    expect(skeletons.length).toBe(20);
    expect(skeletons.filter((s) => s.category === '3d').length).toBeGreaterThanOrEqual(6);

    const byId = new Map(director.cases.map((c) => [c.caseId, c]));
    mkdirSync(path.join(VISUAL_DIR, 'cases'), { recursive: true });

    const files: Record<string, string> = {};
    // Reuse the frozen functional L2 (one build, one WORLD — spec A2).
    const world = readFileSync(path.join(FUNCTIONAL_DIR, 'l2-world.txt'), 'utf8');
    files['../functional/l2-world.txt'] = sha256(world);

    for (const sk of skeletons) {
      const d = byId.get(sk.caseId);
      expect(d, `design-director output missing for ${sk.caseId}`).toBeTruthy();
      const node: PrismNode = {
        nodeId: sk.caseId,
        subtype: sk.archetype,
        parentHubId: 'hub-visual-stage',
        serviceTag: 'wbake-visual-corpus',
        visual: { sourceAsset: sk.imageUrl ?? null } as unknown as PrismNode['visual'],
        intent: {
          caption: `${sk.title} — ${sk.intentLine}`,
          behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
          stateEffects: [],
          visualSpec: {
            textContent: d!.visualSpec.textContent ?? [],
            layers: [],
            colors: d!.visualSpec.colors,
            typography: d!.visualSpec.typography,
            effects: d!.visualSpec.effects,
          },
          contracts: { inputs: {}, outputs: {} },
        },
        codeRef: '',
        backendRef: null,
        renderMode: sk.renderMode,
        depthMapUrl: sk.depthMapUrl ?? null,
        meshUrl: sk.meshUrl ?? null,
        cinematicPrimitives: (sk.primitives ?? []) as PrismNode['cinematicPrimitives'],
        scenePosition: {
          x: 0, y: 0, z: 0,
          rotationX: 0, rotationY: 0, rotationZ: 0,
          scaleX: 1, scaleY: 1, scaleZ: 1,
        },
      } as unknown as PrismNode;

      const neighbors: CodegenNeighbors = {
        parent: { id: 'hub-visual-stage', type: 'hub' },
        siblings: [],
        children: [],
      };
      const guidance =
        sk.category === '3d' && !sk.meshUrl
          ? VISUAL_HERO_SUBPROMPT
          : buildRenderModeSubPrompt(sk.renderMode);
      const l3 = `${buildPerNodePrompt(node, neighbors, ATLAS)}\n\n--- RENDER MODE GUIDANCE ---\n${guidance}`;

      const full = {
        caseId: sk.caseId,
        category: sk.category,
        title: sk.title,
        node,
        neighbors,
        atlas: ATLAS,
        sceneSpec: d!.sceneSpec,
        contrastMinimum: d!.contrastMinimum ?? '4.5:1 for text roles',
        verifierCtx: { renderMode: sk.renderMode, hasTextContent: (d!.visualSpec.textContent ?? []).length > 0 },
        l3,
      };
      const rel = `cases/${sk.caseId}.json`;
      const body = JSON.stringify(full, null, 2);
      writeFileSync(path.join(VISUAL_DIR, rel), body);
      files[rel] = sha256(body);
    }

    const manifest = {
      corpus: 'wbake-visual-v1',
      generator: 'tests/unit/wbake-build-corpus.test.ts (WBAKE_BUILD_VISUAL=1)',
      designDirector: 'Fable 5 (claude CLI print pass; transcript committed as design-director-transcript.json)',
      counts: {
        total: skeletons.length,
        threeD: skeletons.filter((s) => s.category === '3d').length,
        twoD: skeletons.filter((s) => s.category === '2d').length,
      },
      frozen: true,
      files,
    };
    writeFileSync(path.join(VISUAL_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  });
});
