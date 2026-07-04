'use client';

// VerticalToolbarTooltips — DOM tooltip layer for the vertical chassis toolbar.
// On hover, a tasteful glass tooltip slides in beside the rail showing the
// tool's label. Positioned from the hovered group's index using the same
// orthographic camera fit the scene uses, so the label always sits dead-level
// with its glass cube.

import { VLAYOUT } from './vertical-layout';
import type { LiquidToolGroup } from '../overlays/liquid-toolbar/config';

// World +Y is up → screen up (smaller pixel y). The pane fills ~94% of the
// rail height, centered (matches CameraFit in the scene).
function screenYForToolId(toolId: string, railHeight: number): number {
  const b = VLAYOUT.buttons.find((bb) => bb.fn.id === toolId);
  if (!b) return railHeight / 2;
  const halfPane = VLAYOUT.paneH / 2;
  return railHeight / 2 - (b.y / halfPane) * (0.47 * railHeight);
}

export interface VerticalToolbarTooltipsProps {
  groups: LiquidToolGroup[];
  hoverIdx: number | null;
  railWidth: number;
  railHeight: number;
}

export function VerticalToolbarTooltips({
  groups,
  hoverIdx,
  railWidth,
  railHeight,
}: VerticalToolbarTooltipsProps) {
  if (hoverIdx == null) return null;
  const g = groups[hoverIdx];
  if (!g) return null;
  const yPx = screenYForToolId(g.id, railHeight);
  return (
    <div
      style={{
        position: 'absolute',
        left: railWidth + 6,
        top: yPx,
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        zIndex: 5,
        padding: '5px 10px',
        borderRadius: 8,
        background: 'rgba(8, 12, 22, 0.86)',
        border: '1px solid rgba(180, 210, 240, 0.18)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        color: '#e6f0fb',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(8px)',
      }}
    >
      {g.label}
    </div>
  );
}
