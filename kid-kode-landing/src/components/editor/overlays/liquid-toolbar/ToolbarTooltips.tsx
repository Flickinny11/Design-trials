'use client';

// ToolbarTooltips — DOM label layer for the liquid-glass toolbar. The rail
// itself is textless 3D glass; on hover/focus a glass tooltip slides in beside
// the rail showing the tool's label.
//
// The tooltip is positioned from the hovered button's index using the same
// orthographic fit the scene uses (bar fills ~92% of the rail height, centered),
// so the label always sits dead-level with its button regardless of float.

import { accentFor, screenYForButton, type LiquidToolGroup } from './config';

export interface ToolbarTooltipsProps {
  groups: LiquidToolGroup[];
  hoverIdx: number | null;
  railWidth: number;
  railHeight: number;
}

export function ToolbarTooltips({
  groups,
  hoverIdx,
  railWidth,
  railHeight,
}: ToolbarTooltipsProps) {
  const n = groups.length;
  const visible = hoverIdx != null && groups[hoverIdx] != null;
  const g = visible ? groups[hoverIdx as number] : null;
  const showTip = visible && g != null;

  // Screen Y of the hovered button.
  const screenY = hoverIdx != null ? screenYForButton(hoverIdx, n, railHeight) : 0;
  const accent = g ? accentFor(g.id) : '#d8b46a';

  return (
    <div
      aria-hidden={!showTip}
      style={{
        position: 'absolute',
        left: railWidth + 10,
        top: Math.round(screenY) - 15,
        pointerEvents: 'none',
        opacity: showTip ? 1 : 0,
        transform: showTip ? 'translateX(0)' : 'translateX(-6px)',
        transition: 'opacity 160ms ease, transform 200ms cubic-bezier(0.34,1.56,0.64,1)',
        zIndex: 60,
        whiteSpace: 'nowrap',
      }}
    >
      <div
        role="tooltip"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '5px 11px 5px 9px',
          borderRadius: 8,
          fontFamily: 'var(--font-ui, ui-sans-serif), system-ui, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.01em',
          color: 'var(--ds-text-hi, #eef2f8)',
          background:
            'linear-gradient(180deg, rgba(28,36,52,0.92), rgba(14,19,30,0.92))',
          WebkitBackdropFilter: 'blur(10px) saturate(1.3)',
          backdropFilter: 'blur(10px) saturate(1.3)',
          boxShadow: `0 6px 22px rgba(0,0,0,0.5), inset 0 0 0 1px ${accent}55, 0 0 14px ${accent}33`,
        }}
      >
        {/* accent pip */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: accent,
            boxShadow: `0 0 8px ${accent}`,
          }}
        />
        {g?.label ?? ''}
      </div>
    </div>
  );
}

export default ToolbarTooltips;
