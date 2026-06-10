'use client';

import { useState, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DS } from '@/components/editor/design-system';

// Simple HSV-like picker. Click to open; live-updates.
// Chrome: Observatory Brass — swatches sit in carved ds-well frames, the
// popover is a heavy-frost glass palette, the hex field is a ds-input.
// The hue/sat/lum/alpha track gradients and the checkerboard alpha map are
// functional color-science data, not chrome accents — they stay literal.

interface ColorPickerProps {
  value: string; // #rrggbb or #rrggbbaa
  onChange: (hex: string) => void;
  label?: string;
  disabled?: boolean;
}

function parseHex(hex: string): { r: number; g: number; b: number; a: number } {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 6) h += 'ff';
  if (h.length !== 8) return { r: 205, g: 159, b: 85, a: 255 }; // DS.brass400 fallback
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: parseInt(h.slice(6, 8), 16),
  };
}

function toHex({ r, g, b, a }: { r: number; g: number; b: number; a: number }): string {
  const to2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  if (a === 255) return `#${to2(r)}${to2(g)}${to2(b)}`;
  return `#${to2(r)}${to2(g)}${to2(b)}${to2(a)}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

export function ColorPicker({ value, onChange, label, disabled }: ColorPickerProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  const { r, g, b, a } = parseHex(local);
  const { h, s, l } = rgbToHsl(r, g, b);

  const update = (next: string) => { setLocal(next); onChange(next); };

  const setHue = (newH: number) => {
    const { r: nr, g: ng, b: nb } = hslToRgb(newH, s, l);
    update(toHex({ r: nr, g: ng, b: nb, a }));
  };
  const setSat = (newS: number) => {
    const { r: nr, g: ng, b: nb } = hslToRgb(h, newS, l);
    update(toHex({ r: nr, g: ng, b: nb, a }));
  };
  const setLum = (newL: number) => {
    const { r: nr, g: ng, b: nb } = hslToRgb(h, s, newL);
    update(toHex({ r: nr, g: ng, b: nb, a }));
  };
  const setAlpha = (newA: number) => update(toHex({ r, g, b, a: newA }));

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          disabled={disabled}
          className="ds-press flex items-center gap-2 rounded-ds-xs px-1.5 py-1 transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed group"
          type="button"
        >
          {/* Swatch carved into a ds-well frame */}
          <span className="ds-well inline-flex rounded-[6px] p-[2px]">
            <span
              className="block w-4 h-4 rounded-[4px] group-hover:scale-110 transition-transform"
              style={{
                boxShadow: 'inset 0 1px 1px rgba(255,252,242,0.18), inset 0 -1px 1px rgba(0,0,0,0.35)',
                background: `linear-gradient(135deg, ${local}, ${local})`,
                backgroundImage: `
                  linear-gradient(45deg, #333 25%, transparent 25%),
                  linear-gradient(-45deg, #333 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #333 75%),
                  linear-gradient(-45deg, transparent 75%, #333 75%),
                  linear-gradient(${local}, ${local})
                `,
                backgroundSize: '6px 6px, 6px 6px, 6px 6px, 6px 6px, cover',
                backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px, 0 0',
              }}
            />
          </span>
          <span className="text-[11px] font-mono tabular-nums text-ds-brass-300">{local}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={8}
          className="ds-glass ds-glass--heavy ds-edge w-64 rounded-ds-lg p-4 z-50 ds-reveal"
        >
          {label && (
            <div className="ds-kicker mb-2.5">
              {label.toUpperCase()}
            </div>
          )}

          {/* Preview swatch in a carved well frame */}
          <div className="ds-well rounded-ds-md p-1 mb-3">
            <div
              className="h-12 rounded-ds-sm"
              style={{
                boxShadow: 'inset 0 1px 1px rgba(255,252,242,0.14), inset 0 -1px 2px rgba(0,0,0,0.4)',
                background: `
                  linear-gradient(45deg, #333 25%, transparent 25%),
                  linear-gradient(-45deg, #333 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #333 75%),
                  linear-gradient(-45deg, transparent 75%, #333 75%),
                  ${local}
                `,
                backgroundSize: '10px 10px, 10px 10px, 10px 10px, 10px 10px, cover',
                backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px, 0 0',
              }}
            />
          </div>

          <Slider label="Hue"        value={h} min={0}   max={360} onChange={setHue}   track={`linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`} />
          <Slider label="Saturation" value={s * 100} min={0} max={100} onChange={(v) => setSat(v / 100)} track={`linear-gradient(to right, #808080, ${toHex({ ...hslToRgb(h, 1, l), a: 255 })})`} />
          <Slider label="Lightness"  value={l * 100} min={0} max={100} onChange={(v) => setLum(v / 100)} track={`linear-gradient(to right, #000, ${toHex({ ...hslToRgb(h, s, 0.5), a: 255 })}, #fff)`} />
          <Slider label="Alpha"      value={(a / 255) * 100} min={0} max={100} onChange={(v) => setAlpha(Math.round((v / 100) * 255))} track={`linear-gradient(to right, transparent, ${toHex({ r, g, b, a: 255 })})`} />

          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={local}
              onChange={(e) => {
                setLocal(e.target.value);
                if (/^#([0-9a-fA-F]{3,8})$/.test(e.target.value)) onChange(e.target.value);
              }}
              className="ds-input flex-1 w-full text-[11px]"
            />
          </div>

          <Popover.Arrow style={{ fill: 'rgba(255,252,242,0.12)' }} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Slider({
  label, value, min, max, onChange, track,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; track: string }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[9px] font-mono mb-1">
        <span className="text-ds-text-mid">{label}</span>
        <span className="text-ds-brass-300 tabular-nums">{Math.round(value)}</span>
      </div>
      {/* The track gradient is functional color data; the groove framing and
          thumb are machined chrome. */}
      <div
        className="relative h-3 rounded-full"
        style={{
          background: track,
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,252,242,0.08)',
        }}
      >
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={max > 100 ? 1 : 0.5}
          onChange={(e) => onChange(+e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full pointer-events-none"
          style={{
            left: `${((value - min) / (max - min)) * 100}%`,
            background: `radial-gradient(circle at 32% 28%, ${DS.brass100} 0%, ${DS.brass300} 38%, ${DS.brass500} 74%, ${DS.brass700} 100%)`,
            boxShadow:
              '0 1px 3px rgba(0,0,0,0.65), 0 0 10px rgba(var(--ds-brass-400-rgb), 0.3), inset 0 -1px 1px rgba(0,0,0,0.4)',
          }}
        />
      </div>
    </div>
  );
}
