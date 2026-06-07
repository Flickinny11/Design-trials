'use client';

// ControlPanel — renders ONCE from any primitive's ControlSchema (INV-5) and
// drives the live Animatable via setControl(). The same renderer handles every
// primitive's knobs/faders/dropdowns/curves/toggles/colors.

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
    <div data-component="animatable-control-panel" className="flex flex-col gap-3">
      {schema.map((c: Control) => {
        const val = params[c.id];
        return (
          <label key={c.id} className="flex flex-col gap-1 text-[11px] text-white/70">
            <span className="flex items-center justify-between">
              <span>{c.label}</span>
              <span className="text-white/40 tabular-nums">
                {typeof val === 'number' ? val.toFixed(2) : String(val)}
                {('unit' in c && c.unit) || ''}
              </span>
            </span>
            {(c.type === 'knob' || c.type === 'fader') && (
              <input
                type="range"
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
                data-control={c.id}
                value={String(val)}
                onChange={(e) => set(c.id, e.target.value)}
                className="bg-white/10 rounded px-1 py-0.5 text-white"
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
                data-control={c.id}
                checked={Boolean(val)}
                onChange={(e) => set(c.id, e.target.checked)}
              />
            )}
            {c.type === 'color' && (
              <input
                type="color"
                data-control={c.id}
                value={typeof val === 'string' ? val : c.default}
                onChange={(e) => set(c.id, e.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
