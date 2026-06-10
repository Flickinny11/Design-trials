'use client';

// ControlPanel — renders ONCE from any primitive's ControlSchema (INV-5) and
// drives the live Animatable via setControl(). The same renderer handles every
// primitive's knobs/faders/dropdowns/curves/toggles/colors.
//
// Chrome: Observatory Brass machined controls (ds-slider / ds-select /
// ds-toggle), engraved labels, brass value readouts. All data-control wiring
// is unchanged — the verify harness drives these inputs directly.

import { useState } from 'react';
import type { Animatable, Control, ControlValue } from '@/lib/prism/animatable/contract';

export default function ControlPanel({ inst }: { inst: Animatable | null }) {
  // Bump to force re-read of getParams() after each setControl.
  const [, bump] = useState(0);
  if (!inst) return null;
  const schema = inst.controls();
  const params = inst.getParams();

  const set = (id: string, v: ControlValue) => {
    inst.setControl(id, v);
    bump((n) => n + 1);
  };

  return (
    <div data-component="animatable-control-panel" className="flex flex-col gap-3.5">
      {schema.map((c: Control) => {
        const val = params[c.id];
        return (
          <label key={c.id} className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className="ds-label">{c.label}</span>
              <span
                className="text-[10px] font-mono tabular-nums"
                style={{ color: 'var(--ds-brass-300)' }}
              >
                {typeof val === 'number' ? val.toFixed(2) : String(val)}
                {('unit' in c && c.unit) || ''}
              </span>
            </span>
            {(c.type === 'knob' || c.type === 'fader') && (
              <input
                type="range"
                className="ds-slider"
                data-control={c.id}
                min={c.min}
                max={c.max}
                step={c.step ?? (c.max - c.min) / 100}
                value={typeof val === 'number' ? val : c.default}
                onChange={(e) => set(c.id, parseFloat(e.target.value))}
              />
            )}
            {(c.type === 'dropdown' || c.type === 'curve') && (
              <select
                className="ds-select"
                data-control={c.id}
                value={String(val)}
                onChange={(e) => set(c.id, e.target.value)}
              >
                {(c.type === 'dropdown'
                  ? c.options.map((o) => ({ value: o.value, label: o.label }))
                  : (c.options ?? []).map((o) => ({ value: o, label: o }))
                ).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {c.type === 'toggle' && (
              <input
                type="checkbox"
                className="ds-toggle"
                data-control={c.id}
                checked={Boolean(val)}
                onChange={(e) => set(c.id, e.target.checked)}
              />
            )}
            {c.type === 'color' && (
              <span className="ds-well inline-flex w-fit items-center p-1 rounded-ds-sm">
                <input
                  type="color"
                  data-control={c.id}
                  value={typeof val === 'string' ? val : c.default}
                  onChange={(e) => set(c.id, e.target.value)}
                  className="h-6 w-10 cursor-pointer rounded-[5px] border-none bg-transparent"
                />
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
