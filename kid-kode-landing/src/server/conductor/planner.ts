// PRISM SHELL — CONDUCTOR PLANNER (stub + live gate) (SHELL W5, 2026-07-04)
//
// The planner resolves an approved Build Brief into a BuildBlueprint. Two
// providers behind one interface, mirroring the prompt-edit ResilientOrchestrator:
//   • STUB (default / dry-run) — the deterministic planner (blueprint.ts). No
//     API key required; the seeded fixture build proves the whole pipeline
//     headlessly (W5 prompt Task 1). This is what CI verifies.
//   • LIVE — when ANTHROPIC_API_KEY is set, a bounded model call REFINES the
//     COPY (headline, subhead, CTA, section titles) over the SAME deterministic
//     structure; the layout, node ids, and config bounds are unchanged (config-
//     bounded generation, lock H). Any error → the stub, exactly like the
//     prompt-edit path. The SDKs are optional-imported so this compiles + runs
//     with the deps absent (offline harness). origin is honest: 'live' only
//     when the model actually shaped the copy.
//
// The Conductor is planner-AGNOSTIC (it consumes a BuildBlueprint), so the
// swarm-dispatch upgrade slots in behind this same interface without touching
// the node factory or verify latch (lock H).

import 'server-only';
import type { BuildBrief } from '../../../packages/shared-interfaces/src/prism-intake';
import type { ResolvedDirection } from './directions';
import { optionalImport } from '../optional-import';
import {
  buildDeterministicBlueprint,
  type BuildBlueprint,
  type BlueprintNode,
} from './blueprint';

/** The newest Opus id (Fable when its access is live) — from config, never a
 *  component literal (spec 7.4). Overridable per env for the harness. */
export const CONDUCTOR_MODEL = process.env.PRISM_CONDUCTOR_MODEL || 'claude-opus-4-8';

export interface ResolveBlueprintOpts {
  /** Resolved model id (spec 7.4) — carried for the live provider. */
  modelId?: string;
  signal?: AbortSignal;
}

/** The bounded copy the live provider may refine — nothing structural. */
interface CopyPlan {
  headline: string;
  subhead: string;
  ctaLabel: string;
  /** One title per section hub, in order (extra entries ignored). */
  sectionTitles: string[];
}

const COPY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'subhead', 'ctaLabel', 'sectionTitles'],
  properties: {
    headline: { type: 'string', maxLength: 64 },
    subhead: { type: 'string', maxLength: 90 },
    ctaLabel: { type: 'string', maxLength: 24 },
    sectionTitles: { type: 'array', items: { type: 'string', maxLength: 32 }, maxItems: 4 },
  },
} as const;

/** Resolve the blueprint — live when keyed + reachable, else the deterministic
 *  stub. Never throws (fails to the stub), so a build always proceeds. */
export async function resolveBlueprint(
  brief: BuildBrief,
  direction: ResolvedDirection,
  opts: ResolveBlueprintOpts = {},
): Promise<BuildBlueprint> {
  const stub = buildDeterministicBlueprint(brief, direction);
  if (!process.env.ANTHROPIC_API_KEY) return stub;
  try {
    const copy = await planCopyLive(brief, direction, opts);
    if (!copy) return stub;
    return applyCopyPlan(stub, copy);
  } catch {
    return stub; // live failure → the proven stub (never blocks a build)
  }
}

/** Live copy refinement. Returns null (→ stub) when the deps/key are absent or
 *  the call fails. Structure is untouched — only copy is refined. */
async function planCopyLive(
  brief: BuildBrief,
  direction: ResolvedDirection,
  opts: ResolveBlueprintOpts,
): Promise<CopyPlan | null> {
  const ai = await optionalImport<any>('ai');
  const anthropicMod = await optionalImport<any>('@ai-sdk/anthropic');
  if (!ai?.generateObject || !anthropicMod?.createAnthropic) return null;

  const anthropic = anthropicMod.createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = opts.modelId || CONDUCTOR_MODEL;
  const system =
    'You are the Prism Conductor copywriter. Given an approved build brief and a ' +
    'chosen visual Direction, write crisp, on-brand launch copy. Return ONLY the ' +
    'structured object. Never emit code, secrets, or markup.';
  const prompt = JSON.stringify(
    {
      title: brief.title,
      prompt: brief.prompt,
      direction: { name: direction.name, tone: direction.tone, motion: direction.motion },
      lines: brief.lines.map((l) => ({ key: l.key, value: l.value })),
    },
    null,
    0,
  );
  const result = await ai.generateObject({
    model: anthropic(model),
    schema: ai.jsonSchema(COPY_JSON_SCHEMA),
    system,
    prompt,
    maxRetries: 2,
    abortSignal: opts.signal,
  });
  const obj = result?.object as Partial<CopyPlan> | undefined;
  if (!obj || typeof obj.headline !== 'string') return null;
  return {
    headline: String(obj.headline).slice(0, 64),
    subhead: String(obj.subhead ?? '').slice(0, 90),
    ctaLabel: String(obj.ctaLabel ?? 'Get started').slice(0, 24),
    sectionTitles: Array.isArray(obj.sectionTitles)
      ? obj.sectionTitles.map((s) => String(s).slice(0, 32))
      : [],
  };
}

function setTextContent(node: BlueprintNode | undefined, content: string): void {
  if (node && node.render.kind === 'text' && content.trim().length > 0) {
    node.render.content = content;
  }
}

/** Map refined copy onto the deterministic structure (stable node ids). The
 *  layout, hub count, and node graph are UNCHANGED — only display copy. */
function applyCopyPlan(base: BuildBlueprint, copy: CopyPlan): BuildBlueprint {
  const byId = new Map<string, BlueprintNode>();
  for (const h of base.hubs) for (const n of h.nodes) byId.set(n.id, n);

  setTextContent(byId.get('home-headline'), copy.headline);
  setTextContent(byId.get('home-subhead'), copy.subhead);
  setTextContent(byId.get('home-cta-label'), copy.ctaLabel);

  const sectionHubs = base.hubs.filter((h) => h.role === 'section');
  sectionHubs.forEach((hub, i) => {
    const title = copy.sectionTitles[i];
    if (!title || title.trim().length === 0) return;
    hub.title = title;
    setTextContent(byId.get(`${hub.hubId}-title`), title);
    for (let c = 0; c < 3; c++) {
      setTextContent(byId.get(`${hub.hubId}-card-${c}-label`), `${title} ${c + 1}`);
    }
  });

  return { ...base, hubs: base.hubs, origin: 'live' };
}
