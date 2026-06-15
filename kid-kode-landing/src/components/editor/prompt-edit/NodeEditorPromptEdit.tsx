'use client';

// PRISM NODE-EDITOR V2 — the node editor's OWN prompt-edit (criteria A5).
// A compact, collapsible bar inside the Inspector, scoped to the active PURPOSE
// (function / integration / schema / behavior / backend). Same orchestration +
// apply path as the canvas Prompt Edit action (usePromptEdit), so describing a
// capability here proposes the right node-tab changes against the additive schema.

import { useState } from 'react';
import { Icon } from '@/components/editor/icons/Icon';
import { usePromptEdit } from './usePromptEdit';
import type { PromptEditScope } from '@/lib/prompt-edit/contract';

const SCOPE_LABEL: Record<PromptEditScope, string> = {
  canvas: 'this element',
  'node-function': 'a function',
  'node-integration': 'an integration',
  'node-schema': 'the schema',
  'node-behavior': 'the behavior',
  'node-backend': 'the backend',
};

export default function NodeEditorPromptEdit({ scope, onToast }: { scope: PromptEditScope; onToast?: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const { prompt, setPrompt, plan, report, busy, error, generate, apply } = usePromptEdit(scope, onToast);

  return (
    <div data-component="node-editor-prompt-edit" data-scope={scope} className="mx-3 mt-2 rounded-[6px] overflow-hidden" style={{ border: '1px solid var(--ds-edge-shade, rgba(0,0,0,0.4))', background: 'rgba(255,255,255,0.02)' }}>
      <button
        type="button"
        data-role="node-prompt-toggle"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        <Icon name="zap" size={11} color="var(--ds-brass-300)" glow />
        <span className="text-[10px] font-mono tracking-[0.03em] flex-1" style={{ color: 'var(--ds-text-hi)' }}>Describe {SCOPE_LABEL[scope]}…</span>
        <Icon name="chevron" size={10} color="var(--ds-text-low)" />
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 flex flex-col gap-2">
          <textarea
            data-role="node-prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate(); }}
            rows={2}
            placeholder="e.g. add a Stripe payment on submit"
            className="ds-well w-full resize-none rounded-[5px] px-2 py-1.5 text-[10px] font-mono leading-relaxed outline-none"
            style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-well)', boxShadow: 'var(--ds-chamfer-soft, inset 0 1px 2px rgba(0,0,0,0.5))' }}
          />
          <button
            type="button"
            data-role="node-prompt-generate"
            disabled={busy || !prompt.trim()}
            onClick={generate}
            className="flex items-center justify-center gap-1.5 rounded-[5px] px-2 py-1 text-[9.5px] font-mono disabled:opacity-40"
            style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-brass, linear-gradient(180deg, #b9914f, #8c6a32))', boxShadow: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,250,235,0.25)' }}
          >
            <Icon name={busy ? 'refresh' : 'sparkle'} size={10} color="var(--ds-text-hi)" />
            {busy ? 'Planning…' : 'Generate'}
          </button>

          {error && <div className="text-[8.5px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#e88', background: 'rgba(180,60,60,0.12)' }}>{error}</div>}

          {plan && (
            <div data-role="node-prompt-plan" data-plan-origin={plan.origin} data-plan-steps={plan.steps.length} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[7px] font-mono tracking-[0.14em] uppercase px-1 py-0.5 rounded" style={{ color: 'var(--ds-text-hi)', background: plan.origin === 'live' ? 'rgba(80,170,120,0.18)' : 'rgba(185,145,79,0.18)' }}>{plan.origin === 'live' ? 'Live Opus' : 'Stub'}</span>
                <span className="text-[8.5px] font-mono flex-1 truncate" style={{ color: 'var(--ds-text)' }}>{plan.summary}</span>
              </div>
              {plan.steps.slice(0, 4).map((s, i) => (
                <div key={i} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--ds-text-low)', background: 'rgba(255,255,255,0.03)' }}>{s.rationale}</div>
              ))}
              <button
                type="button"
                data-role="node-prompt-apply"
                disabled={busy}
                onClick={apply}
                className="flex items-center justify-center gap-1.5 rounded-[5px] px-2 py-1 text-[9.5px] font-mono disabled:opacity-40"
                style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-brass, linear-gradient(180deg, #b9914f, #8c6a32))', boxShadow: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,250,235,0.25)' }}
              >
                <Icon name="check" size={10} color="var(--ds-text-hi)" />Apply
              </button>
              {report && <span data-role="node-prompt-report" data-applied={report.applied} className="text-[8px] font-mono" style={{ color: 'var(--ds-text)' }}>✓ {report.applied} applied · {report.advisory} suggestion{report.advisory === 1 ? '' : 's'}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
