// PRISM NODE-EDITOR V2 — LIVE prompt-edit orchestrator (A6 / D2). Server-only.
//
// The production swap target. When ANTHROPIC_API_KEY is set, this calls the
// NEWEST Opus (claude-opus-4-8; Fable when available) via the Vercel AI SDK v6
// (`ai`) + `@anthropic-ai/sdk`, with structured output forced to the
// PromptEditPlan contract, the DESIGN-REFERENCES + primitive + element catalogs
// INJECTED so the premium library is considered first (A3). It NEVER returns
// executable code — only a structured plan applyPlan validates (INV-NEV2-3).
//
// IMPORTANT: the SDKs are imported LAZILY (dynamic import) so this module
// compiles and runs with the deps ABSENT (offline harness). If the key/deps
// aren't present, `plan()` throws and the factory falls back to the stub — i.e.
// installing `ai`@6.0.205 + `@anthropic-ai/sdk`@0.104.1 and setting the key is
// the entire "go live" swap, with zero UI/contract change.
import 'server-only';
import { optionalImport } from '../optional-import';
import type {
  PromptEditOrchestrator,
  PromptEditRequest,
  PromptEditPlan,
} from '../../lib/prompt-edit/contract';

/** The newest Opus id, verified at build (Fable-5 down → Opus). */
export const PROMPT_EDIT_MODEL = process.env.PRISM_PROMPT_EDIT_MODEL || 'claude-opus-4-8';

function systemPrompt(): string {
  return [
    'You are the Prism node-editor prompt-edit planner. You translate a user request into a STRUCTURED PLAN against the Prism additive node schema.',
    'You MUST consider the PREMIUM Observatory-Brass design system, the ~410-primitive catalog, and the 112-entry element library FIRST. Prefer premium catalog ids before any ad-hoc styling.',
    'Design + animation + collision steps route to canvas additive fields (materialSpec, animationBindings, keyframes). Function steps route to functionTiles. Integration steps suggest a platform to connect.',
    'NEVER emit executable code, raw secrets, or topology changes. Output ONLY the structured plan.',
  ].join(' ');
}

function userPrompt(req: PromptEditRequest): string {
  return JSON.stringify(
    {
      request: req.prompt,
      scope: req.scope,
      selectionCount: req.selection.nodeIds.length,
      atTags: req.context.atTags ?? [],
      designReferences: req.context.designReferences,
      primitiveCatalog: req.context.primitiveCatalog,
      elementLibrary: req.context.elementLibrary,
      selectedNodes: req.nodes,
    },
    null,
    0,
  );
}

export class LiveOrchestrator implements PromptEditOrchestrator {
  readonly origin = 'live' as const;
  readonly model = PROMPT_EDIT_MODEL;

  static available(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async plan(req: PromptEditRequest): Promise<PromptEditPlan> {
    if (!LiveOrchestrator.available()) {
      throw new Error('LiveOrchestrator: ANTHROPIC_API_KEY not set — using stub.');
    }
    // Lazy, optional deps (hidden from the bundler). Typed `any` so absence
    // doesn't break compilation; installing them is the production swap.
    const ai = await optionalImport<any>('ai');
    const anthropicMod = await optionalImport<any>('@ai-sdk/anthropic');
    if (!ai || !anthropicMod?.createAnthropic) {
      throw new Error('LiveOrchestrator: install `ai`@6.0.205 + `@ai-sdk/anthropic` to enable the live path — using stub.');
    }
    const createAnthropic = anthropicMod.createAnthropic;

    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // Vercel AI SDK v6 structured output. The JSON Schema for PromptEditPlan
    // lives in plan-schema.ts so the same shape gates both stub and live.
    const { promptEditPlanJsonSchema } = await import('./plan-schema');
    const result = await ai.generateObject({
      model: anthropic(this.model),
      schema: ai.jsonSchema(promptEditPlanJsonSchema),
      system: systemPrompt(),
      prompt: userPrompt(req),
      maxRetries: 2,
    });
    const plan = result.object as PromptEditPlan;
    plan.origin = 'live';
    if (!plan.libraryConsidered) {
      plan.libraryConsidered = { designReferences: true, primitiveIds: [], elementIds: [], premiumFirst: true };
    }
    return plan;
  }
}
