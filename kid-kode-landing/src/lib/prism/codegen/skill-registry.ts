// W-PCP D4 — Skill Registry skeleton (PRISM-SWARM-DISPATCH-AMENDMENT-A,
// Subsystem E). Seeds the registry format + the retrieval hook keyed by node
// class. PCP core stays inline in L1/L2; DEEP guides live as files under
// docs/prism/pcp/skills/ and are HYDRATED per node (E2 two-stage disclosure:
// L2 carries the index — names + affordances + signatures; L3 carries bodies
// only for skills the node invokes, under the E4 budget).
//
// This module is CLIENT-SAFE (no fs): body hydration takes an injected
// reader so server callers pass `fs.readFileSync` and the client bundle
// never grows a node dependency.

import type { PrismNode } from '@/lib/prism-graph/types';

/** Amendment A E1 entry shape (embedding omitted at skeleton stage —
 *  retrieval below is rule-keyed by node class; the embedding field lands
 *  with the retriever). */
export interface SkillRegistryEntry {
  id: string;
  name: string;
  /** One-line affordance (what reaching for this skill buys). */
  affordance: string;
  /** Call-shape summary shown in the L2 index. */
  signature: string;
  /** Node classes this skill serves (retrieval key). */
  nodeClasses: SkillNodeClass[];
  /** Same-capability family (E6 representative-selection key). */
  family: string;
  /** Repo-relative path of the deep-guide body. */
  bodyPath: string;
  dependencyEdges: string[];
  version: string;
}

export type SkillNodeClass =
  | 'hero-3d'
  | 'editorial-type'
  | 'card-panel'
  | 'gallery'
  | 'nav-cta'
  | 'ambient-stage'
  | 'any';

/** Registry version — an input to worldHash (E1: registry changes must
 *  invalidate exactly the right caches). Bump on ANY entry change. */
export const SKILL_REGISTRY_VERSION = 'pcp-skills-v1';

export const SKILL_REGISTRY: readonly SkillRegistryEntry[] = [
  {
    id: 'tsl-layer-renderers',
    name: 'TSL layer renderers',
    affordance: 'Build lit, graded, animated surfaces (stage gradients, emissive cores, glass, displacement) with three/tsl nodes — kills FLAT_VOID/DEAD_LIGHTING.',
    signature: "MeshStandard/Basic/PhysicalNodeMaterial from 'three/webgpu' + { uv, vec3, mix, smoothstep, time, uniform } from 'three/tsl' → material.colorNode/emissiveNode/opacityNode",
    nodeClasses: ['hero-3d', 'card-panel', 'ambient-stage', 'gallery'],
    family: 'surface-rendering',
    bodyPath: 'docs/prism/pcp/skills/tsl-layer-renderers.md',
    dependencyEdges: [],
    version: '1.0.0',
  },
  {
    id: 'postprocessing-chain',
    name: 'Postprocessing chain (host-owned) + no-bloom glow recipes',
    affordance: 'Look post-graded WITHOUT owning post: emissive budgets under AgX (cap 2.3), additive-halo glow, baked vignettes; what the host composer does and does not provide.',
    signature: 'emissiveNode.mul(<=2.3) + AdditiveBlending halo shells + uv()-radial vignette on the stage backdrop',
    nodeClasses: ['hero-3d', 'ambient-stage'],
    family: 'post-and-grade',
    bodyPath: 'docs/prism/pcp/skills/postprocessing-chain.md',
    dependencyEdges: ['tsl-layer-renderers'],
    version: '1.0.0',
  },
  {
    id: 'gsap-motion-doctrine',
    name: 'GSAP motion doctrine',
    affordance: 'Motion with weight inside the createNode lifecycle: entrance/settle/press/hover/idle numeric recipes, trigger wiring that exists at runtime, cleanup contract.',
    signature: 'gsap.timeline() in createNode; userData.handlers.onPointer*; config.cinematicPrimitives[].trigger; ALL timelines killed in userData.cleanup()',
    nodeClasses: ['any'],
    family: 'motion',
    bodyPath: 'docs/prism/pcp/skills/gsap-motion-doctrine.md',
    dependencyEdges: [],
    version: '1.0.0',
  },
];

/** Classify a node into skill node-classes (rule-keyed retrieval; the
 *  embedding retriever supersedes this, additively, when Subsystem E lands
 *  in full). */
export function classifyNode(node: PrismNode): SkillNodeClass[] {
  const out = new Set<SkillNodeClass>();
  const subtype = (node.subtype ?? '').toLowerCase();
  const caption = (node.intent?.caption ?? '').toLowerCase();
  const mode = node.renderMode ?? 'sprite';

  if (mode === 'mesh' || /hero|product|showpiece|prism|orrery|watch/.test(subtype + ' ' + caption)) {
    out.add('hero-3d');
  }
  if (/head(line)?|type|editorial|title/.test(subtype + ' ' + caption)) out.add('editorial-type');
  if (/card|panel|pricing|tier|metric|bento|testimonial/.test(subtype + ' ' + caption)) out.add('card-panel');
  if (/gallery|carousel|filmstrip|column|wall|grid/.test(subtype + ' ' + caption)) out.add('gallery');
  if (/nav|dock|cta|button|footer/.test(subtype + ' ' + caption)) out.add('nav-cta');
  if (/background|stage|particle|field|empty/.test(subtype + ' ' + caption)) out.add('ambient-stage');
  if (out.size === 0) out.add('card-panel');
  return [...out];
}

/** Retrieval hook: node → registry entries. E6 same-family rule: when ≥2
 *  skills of one family match, keep the first (representative) only. */
export function selectSkillsForNode(node: PrismNode): SkillRegistryEntry[] {
  const classes = new Set(classifyNode(node));
  const byFamily = new Map<string, SkillRegistryEntry>();
  for (const entry of SKILL_REGISTRY) {
    const matches =
      entry.nodeClasses.includes('any') ||
      entry.nodeClasses.some((c) => classes.has(c));
    if (matches && !byFamily.has(entry.family)) byFamily.set(entry.family, entry);
  }
  return [...byFamily.values()];
}

/** E2 — the L2-side skill INDEX (names + affordances + signatures ONLY;
 *  bodies never ride L2). Deterministic: registry order. */
export function buildSkillIndexBlock(
  entries: readonly SkillRegistryEntry[] = SKILL_REGISTRY,
): string {
  const lines = ['6. SKILL INDEX (deep guides retrieved per node — bodies ride L3, never this block)'];
  for (const e of entries) {
    lines.push(`- ${e.id}: ${e.affordance}`);
    lines.push(`  call shape: ${e.signature}`);
  }
  return lines.join('\n');
}

/** Per-node hydrated-skill budget, tokens (Amendment A E4 draft value). */
export const HYDRATION_BUDGET_TOKENS = 800;

export interface HydratedSkills {
  /** L3-ready block ('' when nothing hydrated). */
  block: string;
  hydrated: string[];
  /** Skills dropped by the E4 budget (Graph-of-Skills discipline: truncation
   *  is logged, never silent). */
  truncated: string[];
}

/** E4 — hydrate skill BODIES for one node under the token budget. `read`
 *  is injected (server passes fs.readFileSync-based reader) so this module
 *  stays client-safe. Ranking = selectSkillsForNode order (dependency-aware
 *  families first by registry order). Token estimate: bytes/4. */
export function hydrateSkillBodies(
  node: PrismNode,
  read: (repoRelativePath: string) => string,
): HydratedSkills {
  const entries = selectSkillsForNode(node);
  const hydrated: string[] = [];
  const truncated: string[] = [];
  const parts: string[] = [];
  let budget = HYDRATION_BUDGET_TOKENS * 4; // bytes
  for (const e of entries) {
    let body: string;
    try {
      body = read(e.bodyPath);
    } catch {
      truncated.push(e.id);
      continue;
    }
    if (body.length <= budget) {
      parts.push(`--- SKILL: ${e.id} (v${e.version}) ---\n${body.trim()}`);
      hydrated.push(e.id);
      budget -= body.length;
    } else {
      truncated.push(e.id);
    }
  }
  return { block: parts.join('\n\n'), hydrated, truncated };
}
