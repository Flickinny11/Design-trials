'use client';

// P2 TOOLBAR WIRING (Task B) — Observatory Brass building blocks for the
// Animation tools flyout. These mirror the CanvasToolbar treatments 1:1
// (machined KEY faces, recessed WELL troughs, engraved SectionLabel grooves,
// brass active-key state) so the Animation group reads as the same
// instrument. Kept local to animation-tools rather than imported from
// CanvasToolbar.tsx to avoid a circular module edge (CanvasToolbar mounts
// AnimationFlyout) — the same precedent text-tools/ui.tsx set in P1.
//
// Styling is design-system tokens/materials ONLY. The rgba black/bone values
// below are the same shading constants the toolbar uses (shadows /
// catch-lights, not hues) — no component-local colors, no purple.

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

/** Small selectable chip key (driver selector / category chips). */
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
      className={`px-2 h-6 rounded-ds-xs ds-press text-[8.5px] font-mono whitespace-nowrap transition-all ${
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

/** Recessed text input plate (the picker search field). */
export function WellInput({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      data-control={testId}
      onChange={(e) => onChange(e.target.value)}
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
