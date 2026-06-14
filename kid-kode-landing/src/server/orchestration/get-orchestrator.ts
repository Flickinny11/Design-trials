// PRISM NODE-EDITOR V2 — orchestrator factory (A6 swap seam). Server-only.
// Chooses the LIVE Opus-backed orchestrator when ANTHROPIC_API_KEY is set,
// otherwise the deterministic STUB. The live path falls back to the stub on ANY
// error so production is robust (a transient model failure never blocks an edit).
import 'server-only';
import type { PromptEditOrchestrator, PromptEditRequest, PromptEditPlan } from '../../lib/prompt-edit/contract';
import { stubOrchestrator } from '../../lib/prompt-edit/stub-orchestrator';
import { LiveOrchestrator } from './live-orchestrator';

/** A resilient orchestrator: live when configured, stub otherwise / on failure. */
class ResilientOrchestrator implements PromptEditOrchestrator {
  readonly origin: 'stub' | 'live';
  private readonly live: LiveOrchestrator | null;
  constructor() {
    this.live = LiveOrchestrator.available() ? new LiveOrchestrator() : null;
    this.origin = this.live ? 'live' : 'stub';
  }
  async plan(req: PromptEditRequest): Promise<PromptEditPlan> {
    if (this.live) {
      try {
        return await this.live.plan(req);
      } catch (err) {
        const plan = await stubOrchestrator.plan(req);
        plan.warnings = [...(plan.warnings ?? []), `Live model unavailable (${(err as Error).message}); used the stub planner.`];
        return plan;
      }
    }
    return stubOrchestrator.plan(req);
  }
}

let cached: PromptEditOrchestrator | null = null;
export function getOrchestrator(): PromptEditOrchestrator {
  if (!cached) cached = new ResilientOrchestrator();
  return cached;
}
export function __resetOrchestrator(): void { cached = null; }
