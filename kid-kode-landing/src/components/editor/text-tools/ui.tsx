'use client';

// P1 TEXT SYSTEM (Task B) — Chrome-Arc building blocks for the Text
// tools flyout. These mirror the CanvasToolbar treatments 1:1 (machined KEY
// faces, recessed WELL troughs, engraved SectionLabel grooves, brass
// active-key state) so the Text group reads as the same instrument. Kept
// local to text-tools rather than imported from CanvasToolbar.tsx to avoid a
// circular module edge (CanvasToolbar mounts TextToolsFlyout).
//
// Styling is design-system tokens/materials ONLY. The rgba black/bone values
// below are the same shading constants the toolbar uses (shadows/catch-lights,
// not hues) — no component-local colors, no purple.

import { DS_ACCENT, dsAlpha } from '@/components/editor/design-system';

// Machined key — a raised button face cut into the flyout plate.
export const KEY_BG =
  'linear-gradient(178deg, var(--ds-slate), var(--ds-charcoal))';
export const KEY_SHADOW =
  'var(--ds-chamfer-soft), 0 1px 2px rgba(0, 0, 0, 0.45)';
// Recessed trough — value readouts, list wells, input plates.
export const WELL_BG = 'var(--ds-grad-well)';
export const WELL_SHADOW =
  'inset 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(255, 252, 242, 0.05)';

// Accent-tinted active key state (brass by default).
export function activeKeyStyle(a: string = DS_ACCENT): React.CSSProperties {
  return {
    background: `linear-gradient(178deg, ${dsAlpha(a, 0.2)}, ${dsAlpha(a, 0.07)}), var(--ds-grad-ceramic)`,
    boxShadow: `inset 0 0 0 1px ${dsAlpha(a, 0.45)}, var(--ds-chamfer-soft), 0 0 14px ${dsAlpha(a, 0.16)}`,
  };
}

// Engraved machined groove — same scribe line as the toolbar's SectionLabel.
const GROOVE_H: React.CSSProperties = {
  background:
    'linear-gradient(90deg, var(--ds-edge-shade), rgba(0, 0, 0, 0) 92%) top / 100% 1px no-repeat, ' +
    'linear-gradient(90deg, var(--ds-edge-side), rgba(255, 252, 242, 0) 86%) bottom / 100% 1px no-repeat',
};

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1.5 mt-0.5">
      <span
        className="text-[9px] font-mono tracking-[0.18em] uppercase whitespace-nowrap"
        style={{
          color: 'var(--ds-text-low)',
          textShadow: '0 1px 0 rgba(0, 0, 0, 0.55)',
        }}
      >
        {children}
      </span>
      <span aria-hidden className="flex-1 min-w-3 h-[2px]" style={GROOVE_H} />
    </div>
  );
}

const fmt2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Range fader — mirrors CanvasToolbar's FaderRow (ds-slider groove + brass
 *  tabular readout). */
export function FaderRow({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  accent,
  testId,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  accent?: string;
  testId?: string;
  format?: (v: number) => string;
}) {
  const a = accent ?? DS_ACCENT;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>
          {label}
        </span>
        <span className="text-[9.5px] font-mono tabular-nums" style={{ color: a }}>
          {(format ?? fmt2)(value)}
        </span>
      </div>
      <input
        type="range"
        data-control={testId}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="ds-slider w-full cursor-pointer"
      />
    </div>
  );
}

/** Small selectable chip key (align / decompose / fill-kind switchers). */
export function ChipKey({
  label,
  active,
  disabled,
  accent,
  onClick,
  title,
  testId,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  accent?: string;
  onClick?: () => void;
  title?: string;
  testId?: string;
}) {
  const a = accent ?? DS_ACCENT;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
      data-testid={testId}
      className={`px-2 h-7 rounded-ds-xs ds-press text-[9px] font-mono transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed' : active ? '' : 'hover:brightness-[1.15]'
      }`}
      style={
        disabled
          ? { background: 'var(--ds-grad-ceramic)', boxShadow: 'var(--ds-chamfer-soft)', color: 'var(--ds-text-low)' }
          : active
            ? { ...activeKeyStyle(a), color: 'var(--ds-text-hi)' }
            : { background: KEY_BG, boxShadow: KEY_SHADOW, color: 'var(--ds-text)' }
      }
    >
      {label}
    </button>
  );
}

/** Labeled color swatch row — mirrors the Lighting flyout's color input row.
 *  The value is SCENE DATA (textSpec pigment), not chrome paint. */
export function ColorRow({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  testId?: string;
}) {
  return (
    <label className="flex items-center justify-between px-2.5 py-2 ds-well">
      <span className="text-[10px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>
        {label}
      </span>
      <input
        type="color"
        data-control={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-6 rounded-ds-xs cursor-pointer bg-transparent"
        style={{
          border: '1px solid rgba(255, 252, 242, 0.14)',
          boxShadow: 'var(--ds-chamfer-soft)',
        }}
      />
    </label>
  );
}

/** Recessed text input plate (search / prompt / url fields). */
export function WellInput({
  value,
  onChange,
  placeholder,
  testId,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      data-control={testId}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className="w-full px-2.5 py-1.5 rounded-ds-xs text-[10px] font-mono outline-none"
      style={{
        background: WELL_BG,
        boxShadow: WELL_SHADOW,
        color: 'var(--ds-text-hi)',
        border: '1px solid rgba(255, 252, 242, 0.07)',
      }}
    />
  );
}
