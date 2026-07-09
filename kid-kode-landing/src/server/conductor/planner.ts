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
  cascadeAvailable,
  completeWithCascade,
  type InferenceProviderId,
} from '../inference';
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
 *  stub. Never throws (fails to the stub), so a build always proceeds.
 *  Live order (W-PROD): Anthropic when keyed, else the founder-keyed provider
 *  cascade (Cerebras → Fireworks → DeepInfra → Groq) refining the SAME
 *  bounded copy over the SAME deterministic structure. */
export async function resolveBlueprint(
  brief: BuildBrief,
  direction: ResolvedDirection,
  opts: ResolveBlueprintOpts = {},
): Promise<BuildBlueprint> {
  const stub = buildDeterministicBlueprint(brief, direction);
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const copy = await planCopyLive(brief, direction, opts);
      if (copy) {
        const planned = applyCopyPlan(stub, copy);
        planned.provider = 'anthropic';
        planned.providerModel = opts.modelId || CONDUCTOR_MODEL;
        return planned;
      }
    } catch {
      /* fall through — cascade, then the proven stub */
    }
  }
  if (cascadeAvailable()) {
    try {
      const refined = await planCopyCascade(brief, direction, opts);
      if (refined) {
        const planned = applyCopyPlan(stub, refined.copy);
        planned.provider = refined.provider;
        planned.providerModel = refined.model;
        return planned;
      }
    } catch {
      /* cascade failure → the proven stub (never blocks a build) */
    }
  }
  return stub;
}

/** Cascade copy refinement — the same CopyPlan bounds as the Anthropic path,
 *  produced by the first healthy cascade provider. Prompt-engineered JSON
 *  (no vendor-specific structured-output dependency) parsed leniently and
 *  validated against the same shape; any miss → null → stub. */
async function planCopyCascade(
  brief: BuildBrief,
  direction: ResolvedDirection,
  opts: ResolveBlueprintOpts,
): Promise<{ copy: CopyPlan; provider: InferenceProviderId; model: string } | null> {
  const system =
    'You are the Prism Conductor copywriter. Given an approved build brief and a ' +
    'chosen visual Direction, write crisp, on-brand launch copy. Respond with ONLY ' +
    'a JSON object — no markdown fences, no commentary. Never emit code, secrets, or markup.';
  const payload = JSON.stringify(
    {
      title: brief.title,
      prompt: brief.prompt,
      direction: { name: direction.name, tone: direction.tone, motion: direction.motion },
      lines: brief.lines.map((l) => ({ key: l.key, value: l.value })),
    },
    null,
    0,
  );
  const prompt =
    `${payload}\n\nReturn ONLY this JSON shape: {"headline": string (max 64 chars), ` +
    `"subhead": string (max 90 chars), "ctaLabel": string (max 24 chars), ` +
    `"sectionTitles": string[] (max 4 items, each max 32 chars)}`;
  const result = await completeWithCascade(
    { system, prompt, maxTokens: 600, temperature: 0.5 },
    { signal: opts.signal },
  );
  if (!result.text || !result.provider || !result.model) return null;
  const obj = extractJsonObject(result.text) as Partial<CopyPlan> | null;
  if (!obj || typeof obj.headline !== 'string' || obj.headline.trim().length === 0) return null;
  return {
    provider: result.provider,
    model: result.model,
    copy: {
      headline: String(obj.headline).slice(0, 64),
      subhead: String(obj.subhead ?? '').slice(0, 90),
      ctaLabel: String(obj.ctaLabel ?? 'Get started').slice(0, 24),
      sectionTitles: Array.isArray(obj.sectionTitles)
        ? obj.sectionTitles.map((s) => String(s).slice(0, 32))
        : [],
    },
  };
}

/** First balanced {...} block in a completion, parsed or null (never throws). */
function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
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
