// PRISM NODE-EDITOR V2 — STUB orchestrator (A6 / D5).
//
// The DEFAULT prompt-edit planner. Deterministic, offline, dependency-free. It
// reads the prompt + selection + injected catalogs and emits a VALID, structured
// PromptEditPlan against the contract — the SAME shape the live Opus-backed
// service returns. Swapping in the live service (server/orchestration) is a
// config change; the UI + apply-plan are unchanged.
//
// This is NOT a toy: it does real intent detection, picks REAL premium catalog
// primitives/elements first (A3), and routes design+animation → canvas fields,
// function/integration → node tabs (A4). What the live model adds is breadth +
// nuance, not a different contract.

import type {
  PromptEditOrchestrator,
  PromptEditRequest,
  PromptEditPlan,
  PlanStep,
  DesignPlanStep,
  AnimationPlanStep,
  CollisionPlanStep,
  FunctionPlanStep,
  IntegrationPlanStep,
  NewArtifactPlanStep,
} from './contract.ts';
import { PREMIUM_PRIMITIVES, PREMIUM_ELEMENTS } from './catalog-context.ts';
import type { MaterialSpec } from '../prism-graph/types.ts';

function hash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// Pick the best premium primitive(s) for an intent by tag overlap (premium-first).
function pickPrimitives(intentTags: string[], n = 1): string[] {
  const scored = PREMIUM_PRIMITIVES.map((p) => ({
    id: p.id,
    score: p.tags.filter((t) => intentTags.includes(t)).length + (p.tags.includes('premium') ? 0.25 : 0),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return [PREMIUM_PRIMITIVES[0].id]; // always consider the premium library
  return scored.slice(0, n).map((x) => x.id);
}

function pickElements(intentTags: string[], n = 1): string[] {
  const scored = PREMIUM_ELEMENTS.map((e) => ({
    id: e.id,
    score: e.tags.filter((t) => intentTags.includes(t)).length,
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.id);
}

// Premium material presets keyed by look word.
function materialFor(words: string[]): { spec: MaterialSpec; label: string } {
  if (words.some((w) => /glass|crystal|transparen|prism|refract/.test(w)))
    return { spec: { baseColor: '#dfeaf2', metalness: 0, roughness: 0.04, transmission: 0.92, ior: 1.5, dispersion: 0.4, clearcoat: 1, thickness: 1.2, envMapIntensity: 1.4 }, label: 'premium glass (transmission + dispersion)' };
  if (words.some((w) => /holo|iridesc|oil|soap|rainbow/.test(w)))
    return { spec: { baseColor: '#101820', metalness: 0.2, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1, envMapIntensity: 1.6 }, label: 'holographic iridescence' };
  if (words.some((w) => /gold|brass|bronze|amber/.test(w)))
    return { spec: { baseColor: '#c9a86a', metalness: 1, roughness: 0.22, clearcoat: 0.6, envMapIntensity: 1.5 }, label: 'aged brass PBR' };
  // default premium metal
  return { spec: { baseColor: '#c9cdd4', metalness: 1, roughness: 0.18, clearcoat: 0.5, envMapIntensity: 1.5 }, label: 'brushed metal PBR' };
}

const PROVIDER_WORDS: Record<string, { platformId: string; platform: string; brandKey: string; actionId: string; label: string }> = {
  stripe: { platformId: 'stripe', platform: 'Stripe', brandKey: 'stripe', actionId: 'stripe-create-payment-intent', label: 'Create payment intent' },
  payment: { platformId: 'stripe', platform: 'Stripe', brandKey: 'stripe', actionId: 'stripe-create-payment-intent', label: 'Create payment intent' },
  checkout: { platformId: 'stripe', platform: 'Stripe', brandKey: 'stripe', actionId: 'stripe-create-checkout-session', label: 'Create checkout session' },
  email: { platformId: 'resend', platform: 'Resend', brandKey: 'resend', actionId: 'resend-send-email', label: 'Send email' },
  sms: { platformId: 'twilio', platform: 'Twilio', brandKey: 'twilio', actionId: 'twilio-send-sms', label: 'Send SMS' },
  slack: { platformId: 'slack', platform: 'Slack', brandKey: 'slack', actionId: 'slack-post-message', label: 'Post message' },
  github: { platformId: 'github', platform: 'GitHub', brandKey: 'github', actionId: 'github-create-issue', label: 'Create issue' },
  issue: { platformId: 'github', platform: 'GitHub', brandKey: 'github', actionId: 'github-create-issue', label: 'Create issue' },
  notion: { platformId: 'notion', platform: 'Notion', brandKey: 'notion', actionId: 'notion-create-page', label: 'Create page' },
  supabase: { platformId: 'supabase', platform: 'Supabase', brandKey: 'supabase', actionId: 'supabase-insert-row', label: 'Insert row' },
  database: { platformId: 'supabase', platform: 'Supabase', brandKey: 'supabase', actionId: 'supabase-insert-row', label: 'Insert row' },
};

const INTEGRATION_WORDS: Record<string, { platformId: string; platform: string }> = {
  runpod: { platformId: 'runpod', platform: 'RunPod' },
  gpu: { platformId: 'runpod', platform: 'RunPod' },
  modal: { platformId: 'modal', platform: 'Modal' },
  supabase: { platformId: 'supabase', platform: 'Supabase' },
  cloudflare: { platformId: 'cloudflare', platform: 'Cloudflare' },
};

export class StubOrchestrator implements PromptEditOrchestrator {
  readonly origin = 'stub' as const;

  async plan(req: PromptEditRequest): Promise<PromptEditPlan> {
    const prompt = req.prompt.trim();
    const lower = prompt.toLowerCase();
    const words = lower.split(/[^a-z0-9@]+/).filter(Boolean);
    const atTags = req.context.atTags ?? [];
    const nodeIds = req.selection.nodeIds.length ? req.selection.nodeIds : ['__none__'];
    const planId = `plan-${hash(prompt + nodeIds.join(',') + req.scope)}`;
    const steps: PlanStep[] = [];
    const usedPrimitives = new Set<string>();
    const usedElements = new Set<string>();
    const warnings: string[] = [];

    const has = (...keys: string[]) => keys.some((k) => lower.includes(k));
    const scopeIsFn = req.scope === 'node-function';
    const scopeIsInt = req.scope === 'node-integration';
    const scopeAllowsVisual = req.scope === 'canvas';

    // 1) Collision ("make these two collide")
    if (has('collide', 'collision', 'crash', 'smash', 'bounce off', 'slam') && scopeAllowsVisual) {
      const prim = pickPrimitives(['collide', 'physics', 'impact'], 1)[0];
      usedPrimitives.add(prim);
      const targets = req.selection.nodeIds.length >= 2 ? req.selection.nodeIds : nodeIds;
      if (req.selection.nodeIds.length < 2) warnings.push('Collision works best with 2+ selected elements; applied a collision animation to the selection.');
      const patches: Record<string, Partial<import('../prism-graph/types.ts').PrismNode>> = {};
      targets.forEach((id, i) => {
        patches[id] = {
          animationBindings: [{ id: `ab-${hash(prim + id + i)}`, primitive: prim, driver: 'event', params: { strength: 1, restitution: 0.7 }, order: 0 }],
        };
      });
      const step: CollisionPlanStep = { kind: 'collision', nodeIds: targets, patches, primitiveIds: [prim], rationale: `Premium physics primitive "${prim}" drives a real soft-body/impact collision on the selected elements.` };
      steps.push(step);
    }

    // 2) Design / material restyle
    if ((has('glass', 'metal', 'brass', 'gold', 'holographic', 'holo', 'iridescent', 'shiny', 'reflective', 'material', 'restyle', 'style', 'premium', 'color', 'crystal', 'chrome') || atTags.length) && scopeAllowsVisual) {
      const { spec, label } = materialFor(words.concat(atTags));
      const elements = pickElements(['premium', 'glass', 'hero', 'cta'], 1);
      elements.forEach((e) => usedElements.add(e));
      for (const id of nodeIds) {
        const step: DesignPlanStep = { kind: 'design', nodeId: id, nodePatch: { materialSpec: spec, receivesLighting: true }, rationale: `Applied ${label} from the premium material system (Observatory-Brass), lit by the IBL rig.` };
        steps.push(step);
      }
    }

    // 3) Animation (motion words)
    if (has('animate', 'spin', 'float', 'orbit', 'reveal', 'pulse', 'shimmer', 'glow', 'rotate', 'hover', 'motion', 'kinetic', 'aurora', 'godray') && scopeAllowsVisual) {
      const intent: string[] = [];
      if (has('orbit')) intent.push('orbit', 'space');
      if (has('glow', 'aurora', 'godray')) intent.push('volumetric', 'glow');
      if (has('text', 'kinetic', 'reveal')) intent.push('text');
      if (has('shimmer', 'holo')) intent.push('holographic');
      if (intent.length === 0) intent.push('premium', 'motion');
      const prim = pickPrimitives(intent, 1)[0];
      usedPrimitives.add(prim);
      for (const id of nodeIds) {
        const step: AnimationPlanStep = { kind: 'animation', nodeId: id, nodePatch: { animationBindings: [{ id: `ab-${hash(prim + id)}`, primitive: prim, driver: has('hover') ? 'pointer' : 'time', order: 0 }] }, primitiveIds: [prim], rationale: `Premium animation primitive "${prim}" (catalog) plays on a ${has('hover') ? 'pointer' : 'time'} driver.` };
        steps.push(step);
      }
    }

    // 4) Function capability
    const fnHit = Object.keys(PROVIDER_WORDS).find((k) => lower.includes(k));
    if ((fnHit || scopeIsFn) && !scopeIsInt) {
      const pick = PROVIDER_WORDS[fnHit ?? 'payment'];
      for (const id of nodeIds) {
        const step: FunctionPlanStep = { kind: 'function', nodeId: id, functionTiles: [{ providerId: 'mcp', actionId: pick.actionId, brandKey: pick.brandKey, label: pick.label, platform: pick.platform, source: 'catalog' }], rationale: `Wired the "${pick.label}" action from ${pick.platform} as a function tile (validate-on-select in the Functions tab).` };
        steps.push(step);
      }
    }

    // 5) Integration hookup
    const intHit = Object.keys(INTEGRATION_WORDS).find((k) => lower.includes(k));
    if ((intHit || scopeIsInt) && (has('connect', 'integrate', 'integration', 'auth', 'link') || scopeIsInt || intHit)) {
      const pick = INTEGRATION_WORDS[intHit ?? 'runpod'];
      const step: IntegrationPlanStep = { kind: 'integration', nodeId: nodeIds[0], platformId: pick.platformId, platform: pick.platform, rationale: `Suggested connecting ${pick.platform} — complete one-click auth in the Integrations tab to store a capability reference and pull your saved assets.` };
      steps.push(step);
    }

    // 6) New artifact
    if (has('add a', 'add an', 'create a', 'create an', 'new ', 'generate a') && (has('banner', 'hero', 'card', 'button', 'section', 'nav', 'header', 'footer', 'gallery', 'pricing'))) {
      const el = pickElements(['hero', 'cta', 'pricing', 'premium'], 1)[0];
      if (el) usedElements.add(el);
      const step: NewArtifactPlanStep = { kind: 'new-artifact', hubId: req.selection.hubId, caption: prompt, renderModeHint: 'mesh', primitiveIds: el ? [el] : [], rationale: `New element captioned from the prompt; the future builder seeds it from premium element "${el ?? PREMIUM_ELEMENTS[0].id}".` };
      steps.push(step);
    }

    // Always-on: if nothing matched, fall back to a premium restyle (so the
    // user always gets a valid plan + the library is visibly considered).
    if (steps.length === 0) {
      const { spec, label } = materialFor(words);
      usedElements.add(PREMIUM_ELEMENTS[0].id);
      for (const id of nodeIds) {
        steps.push({ kind: 'design', nodeId: id, nodePatch: { materialSpec: spec, receivesLighting: true }, rationale: `Interpreted as a premium restyle (${label}); refine with a more specific prompt or @tag.` });
      }
      warnings.push('No explicit design/animation/function intent detected — applied a premium restyle by default.');
    }

    const summary = summarize(steps, prompt);
    return {
      id: planId,
      summary,
      steps,
      libraryConsidered: {
        designReferences: true,
        primitiveIds: Array.from(usedPrimitives),
        elementIds: Array.from(usedElements),
        premiumFirst: true,
      },
      warnings: warnings.length ? warnings : undefined,
      origin: 'stub',
    };
  }
}

function summarize(steps: PlanStep[], prompt: string): string {
  const kinds = steps.map((s) => s.kind);
  const counts: Record<string, number> = {};
  for (const k of kinds) counts[k] = (counts[k] ?? 0) + 1;
  const parts = Object.entries(counts).map(([k, n]) => `${n} ${k}`);
  return `Plan for “${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}”: ${parts.join(', ')}.`;
}

export const stubOrchestrator = new StubOrchestrator();
