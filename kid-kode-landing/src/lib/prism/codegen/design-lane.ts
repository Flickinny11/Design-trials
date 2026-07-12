// W-VIS D5 — the design-critical lane contract: SEE-THEN-REVISE is the
// DEFAULT. The lane is: generate -> mount+capture -> the SAME model reads its
// own frame -> revise -> final, with best-of-2 selection where the iteration
// budget allows. Config-gated per the OD11 ratified budgets (hard cap 1-2
// seen iterations by criticality); repair stays same-model per the signed
// table (BAKEOFF-TABLE-SIGNED.md — third-party delta executors rejected on
// D5 W-BAKEB evidence, 5-10% fix success).
//
// This module is the TYPED CONTRACT (config + budget math + revision prompt).
// Lane execution lives in the harness today (scripts/wvis/d7-lane.mjs) and is
// what W-DISPATCH inherits when it lands PrismDispatchConfig.

import type { PrismNode } from '@/lib/prism-graph/types';

export type DesignCriticality = 'hero' | 'standard';

export interface DesignLaneBudget {
  /** Max SEEN iterations (mount+capture+self-review cycles) after the first
   *  pass. OD11 hard cap: hero <= 2, standard <= 1. */
  maxSeenIterations: number;
  /** Best-of sampling width when the budget allows (1 = single sample). */
  bestOf: number;
}

export interface DesignLaneConfig {
  /** See-then-revise is the DEFAULT for design-critical nodes (D5). */
  seeThenRevise: boolean;
  budgets: Record<DesignCriticality, DesignLaneBudget>;
  /** SLO the lane is graded against: >=80% of visual nodes reach >=85/100
   *  within budget. */
  slo: { targetScore: number; targetRate: number };
}

export const DESIGN_LANE_DEFAULT: DesignLaneConfig = {
  seeThenRevise: true,
  budgets: {
    hero: { maxSeenIterations: 2, bestOf: 2 },
    standard: { maxSeenIterations: 1, bestOf: 1 },
  },
  slo: { targetScore: 85, targetRate: 0.8 },
};

/** Deterministic criticality classifier: hero = 3D showcase / explicit hero
 *  subtypes; everything else standard. Plans may override via
 *  node.intent.designCriticality (additive, untyped passthrough). */
export function classifyDesignCriticality(node: PrismNode, is3d?: boolean): DesignCriticality {
  const overlaid = (node.intent as unknown as { designCriticality?: string } | undefined)?.designCriticality;
  if (overlaid === 'hero' || overlaid === 'standard') return overlaid;
  const hay = `${node.subtype ?? ''} ${node.intent?.caption ?? ''}`.toLowerCase();
  if (/hero|showcase|flagship|orrery|mechanism|constellation|refraction|pedestal|material.study/.test(hay)) return 'hero';
  if (is3d && node.renderMode === 'mesh') return 'hero';
  return 'standard';
}

/** The see-then-revise self-review prompt (iteration N). The model receives
 *  its OWN captured frame (image part on multimodal routes; the D4 structured
 *  fallback rides text-only routes) + the critique when one exists. */
export function buildSelfRevisionPrompt(args: {
  iteration: number;
  maxIterations: number;
  critique?: { score?: number; mustFix?: Array<{ defect: string; region: string }>; notes?: string } | null;
  hasFrame: boolean;
  l3: string;
  previousModule: string;
}): string {
  const lines: string[] = [];
  lines.push(`SEE-THEN-REVISE — iteration ${args.iteration} of ${args.maxIterations}.`);
  lines.push('');
  if (args.hasFrame) {
    lines.push('The attached image is the captured render of YOUR module. Study it region by region');
    lines.push('against the spec and the Design Law before writing any code.');
  } else {
    lines.push('(No render image is available on this channel — work from the critique and spec alone.)');
  }
  if (args.critique) {
    if (args.critique.score != null) lines.push(`A blind design judge scored it ${args.critique.score}/100 (85+ = founder-shippable).`);
    const mf = args.critique.mustFix ?? [];
    if (mf.length) {
      lines.push('MUST-FIX defects, region-anchored:');
      for (const d of mf) lines.push(`- ${d.defect} — ${d.region}`);
    }
    if (args.critique.notes) lines.push(`Judge notes: ${args.critique.notes}`);
  } else {
    lines.push('Self-review: find every Design-Law defect in your own render (flat voids, dead lighting,');
    lines.push('missing spec elements, off-palette drift, broken composition) and fix ALL of them.');
  }
  lines.push('');
  lines.push('Revise the module to fix every defect while preserving what already works. Same technical');
  lines.push('contract: identical import allowlist, export default createNode(config, ctx), TSL-only');
  lines.push('shaders, full cleanup. Return ONLY the complete revised module.');
  lines.push('');
  lines.push('=== ORIGINAL SPEC (unchanged) ===');
  lines.push(args.l3);
  lines.push('');
  lines.push('=== YOUR PREVIOUS MODULE ===');
  lines.push(args.previousModule);
  return lines.join('\n');
}

/** Iteration-budget check: true when another seen iteration may run. */
export function mayIterate(config: DesignLaneConfig, criticality: DesignCriticality, seenIterationsUsed: number): boolean {
  if (!config.seeThenRevise) return false;
  return seenIterationsUsed < config.budgets[criticality].maxSeenIterations;
}
