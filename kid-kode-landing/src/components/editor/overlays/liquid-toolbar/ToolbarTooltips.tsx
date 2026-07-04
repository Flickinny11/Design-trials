'use client';

// ToolbarTooltips — the machined instrument LABEL for the liquid-glass toolbar.
// The rail itself is textless 3D glass; on hover/focus a label plate slides in
// beside the rail showing the tool's name.
//
// MASTERPIECE M-1 (2026-07-04): the label is part of the instrument, not a
// browser tooltip — a machined-gunmetal plate from the shared premium.ts system
// (RBW body + chrome bezel hairlines), a signal-red jewel (the same diamond cut
// as the keyframe editor's keys), a data-grade mono index numeral, and the
// display face for the name. No backdrop-blur, no frosted card (design-law DL4);
// the plate reads as metal because its gradients ARE the machined surface.
//
// Positioned from the hovered button's index using the same orthographic fit the
// scene uses (bar fills ~92% of the rail height, centered), so the label always
// sits dead-level with its button regardless of float.

import {
  CHROME,
  CHROME_LO,
  RBW,
  rbwAlpha,
  SIGNAL_RED,
} from '@/components/editor/design-system/premium';
import { screenYForButton, type LiquidToolGroup } from './config';

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

  return (
    <div
      aria-hidden={!showTip}
      style={{
        position: 'absolute',
        left: railWidth + 12,
        top: Math.round(screenY) - 16,
        pointerEvents: 'none',
        opacity: showTip ? 1 : 0,
        // weighted entrance: the plate slides out of the rail and settles with a
        // slight overshoot (nothing linear — design-law DL6)
        transform: showTip ? 'translateX(0) scale(1)' : 'translateX(-10px) scale(0.965)',
        transformOrigin: 'left center',
        transition:
          'opacity 150ms ease-out, transform 260ms cubic-bezier(0.34,1.45,0.64,1)',
        zIndex: 60,
        whiteSpace: 'nowrap',
      }}
    >
      <div
        role="tooltip"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px 6px 10px',
          borderRadius: 7,
          background: RBW.bodyMetal,
          boxShadow: `${RBW.bezelEdge}, 0 0 0 1px rgba(0, 0, 0, 0.72), 0 8px 22px -6px rgba(0, 0, 0, 0.75), 0 0 16px -8px ${rbwAlpha(SIGNAL_RED, 0.4)}`,
        }}
      >
        {/* signal-red jewel — the same diamond cut as the keyframe editor's keys */}
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            transform: 'rotate(45deg)',
            borderRadius: 2,
            background: RBW.keyJewel,
            border: RBW.keyJewelRim,
            boxShadow: RBW.keyJewelGlow,
            flexShrink: 0,
          }}
        />
        {/* data-grade mono index — the tool's position on the rail */}
        <span
          style={{
            fontFamily: 'var(--ds-font-mono, ui-monospace, monospace)',
            fontSize: 8.5,
            letterSpacing: '0.14em',
            color: CHROME_LO,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String((hoverIdx ?? 0) + 1).padStart(2, '0')}
        </span>
        {/* the tool's name, in the display face */}
        <span
          style={{
            fontFamily: 'var(--ds-font-display, ui-sans-serif), system-ui, sans-serif',
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: CHROME,
            textShadow: '0 1px 0 rgba(0, 0, 0, 0.6)',
          }}
        >
          {g?.label ?? ''}
        </span>
      </div>
    </div>
  );
}

export default ToolbarTooltips;
