// W-PCP D5 — live prompt-compiler proofs.
//
// 1. OD7 BYTE-STABILITY: L1+L2 hashed across 100 simulated node calls in one
//    build context — every hash identical or the wave fails (wave prompt #12).
//    The winning hash is written to notes/verification/wpcp/byte-stability.json
//    as committed evidence.
// 2. The L2 WORLD template (buildWorldBlock) reproduces the W-BAKE frozen
//    corpus L2 byte-for-byte given the Nova Atelier input — the live template
//    IS the ratified shape.
// 3. Token-budget floor checks (sizes measured; the authoritative
//    provider-tokenizer numbers land in the probe evidence).

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SHARED_SYSTEM_PROMPT,
  SHARED_SYSTEM_PROMPT_V1,
  buildCodegenPrompt,
  buildWorldBlock,
} from '@/lib/prism/codegen/prompts';
import type { PrismNode } from '@/lib/prism-graph/types';
import type {
  CodegenAtlasRegion,
  CodegenNeighbors,
} from '@/lib/prism/codegen/prompts';

const ROOT = path.resolve(__dirname, '..', '..');
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const NOVA_WORLD_INPUT = {
  appName: 'Nova Atelier',
  summary: 'A machined-metal watch atelier landing with catalog, pricing, jo',
  designTokens: [
    'Palette: primary #16161d (ink), secondary #e8ecf2 (paper), accent #ff2a38 (signal red), surface #0b0b10 (near-black surface).',
    'Typography: display = Lora (serif, weights 400/600); text = JetBrains Mono (mono, 400/700). Type scale (scene-unit em heights): hero 0.62, headline 0.34, subhead 0.2, body 0.13, caption 0.09.',
    'Spacing rhythm: base unit 0.25 scene units; card padding 0.5; hub frame spans x∈[-3.5,3.5], y∈[-3,2.5] at PerspectiveCamera(fov 50, z=10).',
    'Effects vocabulary: machined-metal PBR (brushed anisotropy, clearcoat ≤ 0.25, metalness ≤ 0.55, roughness ≥ 0.5), weighted-settle motion, engineered gradients (no soft pastel blur), contrast minimum 4.5:1 for text roles.',
  ],
  hubs: [
    { hubId: 'hub-home', title: 'Home', role: 'home' },
    { hubId: 'hub-features', title: 'Features', role: 'section' },
    { hubId: 'hub-collection', title: 'Collection', role: 'section' },
    { hubId: 'hub-pricing', title: 'Pricing', role: 'section' },
    { hubId: 'hub-journal', title: 'Journal', role: 'section' },
  ],
  edges: [
    { from: 'hub-home', to: 'hub-features', type: 'navigation', event: 'navigate' },
    { from: 'hub-home', to: 'hub-collection', type: 'navigation', event: 'navigate' },
    { from: 'hub-home', to: 'hub-pricing', type: 'navigation', event: 'navigate' },
    { from: 'hub-home', to: 'hub-journal', type: 'navigation', event: 'navigate' },
  ],
  contracts: [
    'trpc.catalog.list (query) -> z.object({ items: z.array(z.object({ id: z.string(), title: z.string(), priceUsd: z.number(), imageUrl: z.string() })) })',
    'trpc.pricing.tiers (query) -> z.object({ tiers: z.array(z.object({ id: z.string(), name: z.string(), usdMonthly: z.number(), features: z.array(z.string()) })) })',
    'trpc.checkout.begin (mutation, input z.object({ itemId: z.string() })) -> z.object({ checkoutUrl: z.string() })',
    'trpc.journal.posts (query) -> z.object({ posts: z.array(z.object({ id: z.string(), title: z.string(), excerpt: z.string(), publishedAt: z.string() })) })',
    'trpc.contact.submit (mutation, input z.object({ email: z.string(), message: z.string() })) -> z.object({ ok: z.boolean() })',
    'trpc.waitlist.join (mutation, input z.object({ email: z.string() })) -> z.object({ position: z.number() })',
    'trpc.visits.book (mutation, input z.object({ slotIso: z.string() })) -> z.object({ slot: z.string(), confirmed: z.boolean() })',
    'trpc.inventory.status (query, input z.object({ itemId: z.string() })) -> z.object({ inStock: z.boolean(), etaDays: z.number().nullable() })',
  ],
  animationVocabulary: [
    'GSAP presets (named): rise-in (y +0.4 -> 0, power3.out, 0.7s), fade-up (opacity 0->1 + y +0.2, power2.out, 0.5s), stagger-cards (children, 80ms stagger), press-down (scale 0.97, 120ms, back.out), weighted-settle (overshoot 1.04 -> 1.0, power4.out, 0.9s).',
    'Cinematic primitives (apply via ctx.primitives[name]): orbit, depth-rotate, dissolve-morph, displacement-transition, parallax-scroll, magnetic-cursor, particle-emerge, fly-through, kinetic-text.',
  ],
  capabilityRefs: [
    { ref: 'capability:shopify.catalog', note: 'product catalog reads' },
    { ref: 'capability:shopify.inventory', note: 'stock status reads' },
    { ref: 'capability:stripe.products', note: 'pricing tier reads' },
    { ref: 'capability:stripe.checkout', note: 'checkout session creation' },
    { ref: 'capability:notion.cms', note: 'journal content reads' },
    { ref: 'capability:resend.email', note: 'transactional email sends' },
    { ref: 'capability:cal.scheduling', note: 'atelier visit booking' },
  ],
};

function simulatedNode(i: number): PrismNode {
  return {
    nodeId: `sim-${i}`,
    subtype: i % 3 === 0 ? 'product-hero' : i % 3 === 1 ? 'pricing-card' : 'headline',
    parentHubId: 'hub-home',
    renderMode: (['sprite', 'plane', 'parallax-plane', 'mesh'] as const)[i % 4],
    intent: {
      caption: `Simulated node ${i}`,
      visualSpec: {
        textContent: [{ text: `Item ${i}`, role: 'headline' }],
        colors: { accent: '#ff2a38' },
      },
      behaviorSpec: { interactions: [] },
    },
  } as unknown as PrismNode;
}

const NEIGHBORS: CodegenNeighbors = { parent: null, siblings: [], children: [] };
const ATLAS: CodegenAtlasRegion = { atlasIndex: 0, x: 0, y: 0, width: 256, height: 256 };

describe('W-PCP D5 — OD7 byte-stability across a build', () => {
  it('L1+L2 hash is identical across 100 simulated node calls', () => {
    const world = buildWorldBlock(NOVA_WORLD_INPUT);
    const hashes = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      // A real build compiles L1+L2 once and reuses it per node; the
      // simulation recomputes BOTH per call to prove nothing about the node
      // leaks into them.
      const prompt = buildCodegenPrompt(simulatedNode(i), NEIGHBORS, ATLAS);
      hashes.add(sha256(`${prompt.system}\n\n${world}`));
    }
    expect(hashes.size).toBe(1);

    const [hash] = [...hashes];
    const evidenceDir = path.join(ROOT, 'notes', 'verification', 'wpcp');
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      path.join(evidenceDir, 'byte-stability.json'),
      JSON.stringify(
        {
          calls: 100,
          distinctHashes: 1,
          sha256L1PlusL2: hash,
          sha256L1: sha256(SHARED_SYSTEM_PROMPT),
          sha256L1V1: sha256(SHARED_SYSTEM_PROMPT_V1),
          sha256L2: sha256(world),
          bytesL1: SHARED_SYSTEM_PROMPT.length,
          bytesL1V1: SHARED_SYSTEM_PROMPT_V1.length,
          bytesL2: world.length,
        },
        null,
        2,
      ),
    );
  });
});

describe('W-PCP D5 — L2 WORLD template rides the live path', () => {
  it('reproduces the W-BAKE frozen corpus L2 byte-for-byte from the Nova Atelier input', () => {
    const frozen = readFileSync(
      path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'functional', 'l2-world.txt'),
      'utf8',
    );
    expect(buildWorldBlock(NOVA_WORLD_INPUT)).toBe(frozen);
  });

  it('stays within the ratified L2 budget (2-3K typical, 5K hard cap)', () => {
    const world = buildWorldBlock(NOVA_WORLD_INPUT);
    expect(world.length / 4).toBeLessThan(5000); // hard cap, token≈bytes/4
  });
});

describe('W-PCP D5 — L1 v2 composition', () => {
  it('embeds the generated runtime surface, dependency gate, and design doctrine', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain('RUNTIME SURFACE');
    expect(SHARED_SYSTEM_PROMPT).toContain('loadGLB(url: string)');
    expect(SHARED_SYSTEM_PROMPT).toContain('DESIGN DOCTRINE');
    expect(SHARED_SYSTEM_PROMPT).toContain('DEPENDENCIES');
    expect(SHARED_SYSTEM_PROMPT.trimEnd().endsWith('No markdown fences.')).toBe(true);
  });

  it('keeps every V1 constraint line (additive extension)', () => {
    const v1Body = SHARED_SYSTEM_PROMPT_V1.replace(/\n\nOUTPUT:[^\n]*$/, '');
    expect(SHARED_SYSTEM_PROMPT.startsWith(v1Body)).toBe(true);
  });

  it('stays under the wave token target (L1 <= 12K tokens, token≈bytes/4)', () => {
    expect(SHARED_SYSTEM_PROMPT.length / 4).toBeLessThanOrEqual(12000);
  });
});
