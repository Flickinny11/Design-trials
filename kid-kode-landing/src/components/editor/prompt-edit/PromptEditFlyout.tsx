'use client';

// PRISM NODE-EDITOR V2 — Prompt Edit flyout (criteria A1–A4, A7).
//
// The canvas "Prompt Edit" toolbar action. MULTI-SELECT aware (A1): describe
// virtually anything — a restyle, "make these two collide", any 3D animation,
// any function — and the orchestration endpoint (live Opus when keyed, stub
// otherwise — A6) returns a structured PLAN with the PREMIUM library visibly
// considered first (A3). "Apply to canvas" routes design+animation → the canvas
// additive fields and function/integration → the node-editor tabs (A4), then
// persists (round-trip). Design system: Observatory-Brass, no purple, Icon only.

import { Icon } from '@/components/editor/icons/Icon';
import { usePromptEdit } from './usePromptEdit';
import type { PlanStep } from '@/lib/prompt-edit/contract';

const EXAMPLES = [
  'Give it a premium holographic glass look',
  'Make these two collide',
  'Add a Stripe payment on click',
  'Animate it with an orbiting godray hero',
  'Connect RunPod to this node',
];

const KIND_LABEL: Record<PlanStep['kind'], string> = {
  design: 'Design',
  animation: 'Animation',
  collision: 'Collision',
  function: 'Function',
  integration: 'Integration',
  schema: 'Schema',
  behavior: 'Behavior',
  backend: 'Backend',
  'new-artifact': 'New element',
};

export default function PromptEditFlyout({ onToast }: { onToast?: (m: string) => void }) {
  const { prompt, setPrompt, plan, report, busy, error, selLabel, generate, apply } = usePromptEdit('canvas', onToast);

  return (
    <div data-component="prompt-edit-flyout" className="flex flex-col gap-2.5 w-[270px]" style={{ color: 'var(--ds-text)' }}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon name="zap" size={13} color="var(--ds-brass-300)" glow />
        <div className="flex flex-col">
          <span className="text-[11px] font-mono tracking-[0.04em]" style={{ color: 'var(--ds-text-hi)' }}>Prompt Edit</span>
          <span className="text-[8px] font-mono tracking-[0.14em] uppercase" style={{ color: 'var(--ds-text-low)' }}>{selLabel}</span>
        </div>
      </div>

      {/* Prompt input */}
      <textarea
        data-role="prompt-edit-input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate(); }}
        rows={3}
        placeholder="Describe a design, animation, or function…"
        className="ds-well w-full resize-none rounded-[5px] px-2 py-1.5 text-[10px] font-mono leading-relaxed outline-none"
        style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-well)', boxShadow: 'var(--ds-chamfer-soft, inset 0 1px 2px rgba(0,0,0,0.5))' }}
      />

      {/* Example chips */}
      <div className="flex flex-wrap gap-1">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setPrompt(ex)}
            className="text-[8px] font-mono px-1.5 py-0.5 rounded-[4px] transition-colors"
            style={{ color: 'var(--ds-text-low)', background: 'var(--ds-grad-ceramic, rgba(255,255,255,0.04))', border: '1px solid var(--ds-edge-shade, rgba(0,0,0,0.4))' }}
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Generate */}
      <button
        type="button"
        data-role="prompt-edit-generate"
        disabled={busy || !prompt.trim()}
        onClick={generate}
        className="flex items-center justify-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[10px] font-mono tracking-[0.04em] disabled:opacity-40 transition-opacity"
        style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-brass, linear-gradient(180deg, #b9914f, #8c6a32))', boxShadow: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,250,235,0.25)' }}
      >
        <Icon name={busy ? 'refresh' : 'sparkle'} size={11} color="var(--ds-text-hi)" />
        {busy ? 'Planning…' : 'Generate plan'}
      </button>

      {error && (
        <div className="text-[9px] font-mono px-2 py-1 rounded-[4px]" style={{ color: '#e88', background: 'rgba(180,60,60,0.12)' }} data-role="prompt-edit-error">{error}</div>
      )}

      {/* Plan result */}
      {plan && (
        <div data-role="prompt-edit-plan" data-plan-steps={plan.steps.length} data-plan-origin={plan.origin} className="flex flex-col gap-2 mt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[7.5px] font-mono tracking-[0.16em] uppercase px-1 py-0.5 rounded" style={{ color: 'var(--ds-text-hi)', background: plan.origin === 'live' ? 'rgba(80,170,120,0.18)' : 'rgba(185,145,79,0.18)' }}>
              {plan.origin === 'live' ? 'Live Opus' : 'Stub planner'}
            </span>
            <span className="text-[9px] font-mono flex-1 truncate" style={{ color: 'var(--ds-text)' }}>{plan.steps.length} step{plan.steps.length === 1 ? '' : 's'}</span>
          </div>
          <p className="text-[9px] font-mono leading-relaxed" style={{ color: 'var(--ds-text)' }}>{plan.summary}</p>

          {/* Library considered (A3 proof) */}
          <div className="ds-well rounded-[5px] px-2 py-1.5 flex flex-col gap-1" style={{ background: 'var(--ds-grad-well)', boxShadow: 'var(--ds-chamfer-soft, inset 0 1px 2px rgba(0,0,0,0.4))' }} data-role="library-considered" data-premium-first={String(plan.libraryConsidered.premiumFirst)}>
            <span className="text-[7.5px] font-mono tracking-[0.14em] uppercase" style={{ color: 'var(--ds-brass-300)' }}>Premium library considered</span>
            <div className="flex flex-wrap gap-1">
              {plan.libraryConsidered.designReferences && (
                <span className="text-[8px] font-mono px-1 py-0.5 rounded" style={{ color: 'var(--ds-text-low)', background: 'rgba(255,255,255,0.05)' }}>Observatory-Brass</span>
              )}
              {[...plan.libraryConsidered.primitiveIds, ...plan.libraryConsidered.elementIds].slice(0, 6).map((id) => (
                <span key={id} className="text-[8px] font-mono px-1 py-0.5 rounded" style={{ color: 'var(--ds-text-low)', background: 'rgba(255,255,255,0.05)' }}>{id}</span>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-1">
            {plan.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-1.5 px-1.5 py-1 rounded-[4px]" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="text-[7px] font-mono tracking-[0.1em] uppercase px-1 py-0.5 rounded mt-0.5" style={{ color: 'var(--ds-text-hi)', background: 'rgba(185,145,79,0.22)' }}>{KIND_LABEL[step.kind]}</span>
                <span className="text-[8.5px] font-mono leading-snug flex-1" style={{ color: 'var(--ds-text-low)' }}>{step.rationale}</span>
              </div>
            ))}
          </div>

          {plan.warnings?.map((w, i) => (
            <div key={i} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#d9b878', background: 'rgba(180,140,60,0.1)' }}>{w}</div>
          ))}

          {/* Apply */}
          <button
            type="button"
            data-role="prompt-edit-apply"
            disabled={busy}
            onClick={apply}
            className="flex items-center justify-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[10px] font-mono tracking-[0.04em] disabled:opacity-40"
            style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-brass, linear-gradient(180deg, #b9914f, #8c6a32))', boxShadow: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,250,235,0.25)' }}
          >
            <Icon name="check" size={11} color="var(--ds-text-hi)" />
            Apply to canvas
          </button>

          {report && (
            <div data-role="prompt-edit-report" data-applied={report.applied} className="flex flex-col gap-1 mt-0.5">
              <span className="text-[8.5px] font-mono" style={{ color: 'var(--ds-text)' }}>✓ {report.applied} applied · {report.advisory} suggestion{report.advisory === 1 ? '' : 's'}</span>
              {report.followUps.map((f, i) => (
                <div key={i} className="text-[8px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1" style={{ color: 'var(--ds-text-low)', background: 'rgba(255,255,255,0.04)' }}>
                  <Icon name="arrowRight" size={8} color="var(--ds-brass-300)" />{f.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
