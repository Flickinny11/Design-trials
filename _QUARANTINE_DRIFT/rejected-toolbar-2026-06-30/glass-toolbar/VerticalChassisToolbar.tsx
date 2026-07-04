'use client';

// VerticalChassisToolbar — drop-in replacement for LiquidGlassToolbar. Mounts
// the founder-approved chassis vocabulary (real transmission glass pane, glass
// cube buttons that raise on hover, bespoke 3D icons, engraved section labels)
// in the existing canvas-toolbar wrapper. Identical props contract to
// LiquidGlassToolbar so CanvasToolbar.tsx just swaps the import + JSX tag.
//
// Lives inside CanvasToolbar's draggable wrapper; the DOM grip spine reuses
// the existing drag handlers and the Canvas fills the rail beneath it.

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { VerticalGlassToolbarScene } from './VerticalGlassToolbarScene';
import { VerticalToolbarTooltips } from './VerticalToolbarTooltips';
import type { LiquidToolGroup } from '../overlays/liquid-toolbar/config';

export interface VerticalChassisToolbarProps {
  groups: LiquidToolGroup[];
  activeGroup: string | null;
  onToggleGroup: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  dragging: boolean;
  spineHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

const RAIL_W = 112; // px — vertical chassis rail width (slightly wider for label legibility)
const TOP_GAP = 112;
const MAX_H = 820;

function useRailHeight(): number {
  const [h, setH] = useState(640);
  useEffect(() => {
    const update = () =>
      setH(Math.max(420, Math.min(MAX_H, window.innerHeight - TOP_GAP)));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return h;
}

export function VerticalChassisToolbar({
  groups,
  activeGroup,
  onToggleGroup,
  collapsed,
  onToggleCollapse,
  dragging,
  spineHandlers,
}: VerticalChassisToolbarProps) {
  const railH = useRailHeight();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const canvasH = collapsed ? 0 : railH;
  const hostRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={hostRef}
      data-component="vertical-chassis-toolbar"
      className="relative select-none"
      style={{ width: RAIL_W }}
    >
      {/* DOM grip spine — drag to float the toolbar; collapse key folds the rail. */}
      <div
        data-dock-handle
        {...spineHandlers}
        className="relative flex flex-col items-center gap-1 pt-1 pb-1.5 touch-none"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        title="Drag to move the toolbar"
      >
        <button
          type="button"
          data-action="dock-collapse"
          aria-label={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}
          title={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleCollapse}
          className="absolute top-0 right-1 w-5 h-5 rounded-[5px] flex items-center justify-center transition-colors"
          style={{ color: 'var(--ds-text-mid)' }}
        >
          <span
            style={{
              display: 'inline-block',
              transform: `rotate(${collapsed ? 90 : -90}deg)`,
              transition: 'transform 200ms ease',
              fontSize: 11,
              lineHeight: 1,
            }}
          >
            ‹
          </span>
        </button>
        <span aria-hidden className="flex flex-col items-center gap-[2px] opacity-70 mt-1">
          <span className="w-5 h-[2px] rounded-full" style={{ background: 'var(--ds-edge-side)', boxShadow: '0 1px 0 rgba(0,0,0,0.5)' }} />
          <span className="w-5 h-[2px] rounded-full" style={{ background: 'var(--ds-edge-side)', boxShadow: '0 1px 0 rgba(0,0,0,0.5)' }} />
          <span className="w-5 h-[2px] rounded-full" style={{ background: 'var(--ds-edge-side)', boxShadow: '0 1px 0 rgba(0,0,0,0.5)' }} />
        </span>
        <span
          className="text-[8px] font-mono tracking-[0.24em]"
          style={{ color: 'var(--ds-text-mid)', textShadow: '0 1px 0 rgba(0,0,0,0.6)' }}
        >
          CANVAS
        </span>
      </div>

      <div
        className="relative"
        style={{
          width: RAIL_W,
          height: canvasH,
          transition: 'height 280ms cubic-bezier(0.4,0,0.2,1)',
          overflow: 'visible',
          pointerEvents: collapsed ? 'none' : 'auto',
        }}
      >
        {!collapsed && (
          <Canvas
            shadows
            gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
            dpr={[1, 2]}
            frameloop="always"
            style={{ width: RAIL_W, height: railH, overflow: 'visible' }}
            data-testid="vertical-chassis-toolbar-canvas"
          >
            <VerticalGlassToolbarScene
              groups={groups}
              activeGroup={activeGroup}
              onToggleGroup={onToggleGroup}
              onHoverButton={setHoverIdx}
            />
          </Canvas>
        )}
        {!collapsed && (
          <VerticalToolbarTooltips
            groups={groups}
            hoverIdx={hoverIdx}
            railWidth={RAIL_W}
            railHeight={railH}
          />
        )}
      </div>
    </div>
  );
}

export default VerticalChassisToolbar;
