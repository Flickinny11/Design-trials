'use client';

// PRISM SHELL — MODEL SELECTOR (SHELL W1, spec §7.1/§7.2/§7.4)
//
// Config-driven: every model this control knows comes from
// src/lib/shell/model-config.ts — no model string is hardcoded here (7.4;
// the DESIGN-LAW sweep greps for exactly that). Gated entries render
// selectable-but-disabled with their status note, never as available.
// Working-surface control (decision A): clean-but-premium DOM, machined
// hairlines, mono voice — no icons, no glyphs.

import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { getModelRegistry } from '@/lib/shell/model-config';
import { useChatStore } from '@/lib/shell/chat-store';

export default function ModelSelector() {
  const activeModelId = useChatStore((s) => s.activeModelId);
  const setActiveModel = useChatStore((s) => s.setActiveModel);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const [open, setOpen] = useState(false);
  const registry = getModelRegistry();
  const active = registry.find((m) => m.id === activeModelId);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="bw1-topbtn bw1-model-trigger"
          aria-label={`Model: ${active?.label ?? 'unknown'} — change model`}
          data-open={open ? 'true' : 'false'}
        >
          <span className="bw1-topbtn-kicker">Model</span>
          <span className="bw1-topbtn-value">{active?.label ?? '—'}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="bw1-pop" sideOffset={8} align="end">
          <p className="bw1-pop-kicker">Orchestration model</p>
          <div className="bw1-model-list" role="listbox" aria-label="Available models">
            {registry.map((m) => {
              const selected = m.id === activeModelId;
              const gated = m.status === 'gated';
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={gated || isStreaming}
                  className="bw1-model-row"
                  data-selected={selected ? 'true' : 'false'}
                  onClick={() => {
                    setActiveModel(m.id);
                    setOpen(false);
                  }}
                >
                  <span className="bw1-model-bead" aria-hidden data-on={selected ? 'true' : 'false'} />
                  <span className="bw1-model-name">{m.label}</span>
                  {gated ? (
                    <span className="bw1-model-note">{m.statusNote ?? 'unavailable'}</span>
                  ) : m.default ? (
                    <span className="bw1-model-note">default</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="bw1-pop-foot">
            Availability is config-driven (spec 7.4) — enabling a new model is a data change.
            {isStreaming ? ' Locked while a turn is streaming.' : ''}
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
