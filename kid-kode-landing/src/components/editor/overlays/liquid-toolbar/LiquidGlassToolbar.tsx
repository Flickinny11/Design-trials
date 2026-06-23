'use client';

// LiquidGlassToolbar — the React entry for the photoreal 3D liquid-glass canvas
// toolbar (DESIGN LAW B.1). Mounts an ISOLATED R3F WebGL <Canvas> (the proven
// Glb3DPreview pattern; it never touches the unified three/webgpu graph scene)
// and renders the LiquidGlassBar + the column of sunk 3D tool buttons. It drives
// the SAME activeGroup/handlers the brushed-metal dock did, so the editor's
// functionality is unchanged — only the chrome is reborn.
//
// Lives inside CanvasToolbar's draggable wrapper, so the DOM grip spine reuses
// the existing drag handlers; the Canvas fills the rail beneath it.

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ToolbarScene } from './ToolbarScene';
import { ToolbarTooltips } from './ToolbarTooltips';
import type { LiquidToolGroup } from './config';

export interface LiquidGlassToolbarProps {
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

const RAIL_W = 106; // px — the liquid-glass rail width
const TOP_GAP = 112; // ≈ 7rem reserved (matches the dock's max-h-[calc(100vh-7rem)])
const MAX_H = 768; // cap so the bar never grows absurdly tall on huge monitors

function useRailHeight(): number {
  const [h, setH] = useState(560);
  useEffect(() => {
    const update = () =>
      setH(Math.max(320, Math.min(MAX_H, window.innerHeight - TOP_GAP)));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return h;
}

export function LiquidGlassToolbar({
  groups,
  activeGroup,
  onToggleGroup,
  collapsed,
  onToggleCollapse,
  dragging,
  spineHandlers,
}: LiquidGlassToolbarProps) {
  const railH = useRailHeight();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const canvasH = collapsed ? 0 : railH;
  const hostRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={hostRef}
      data-component="liquid-glass-toolbar"
      className="relative select-none"
      style={{ width: RAIL_W }}
    >
      {/* DOM grip spine — drag to float the toolbar; collapse key folds the rail.
          (Reuses the existing wrapper drag handlers so float/clamp is unchanged.) */}
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
        {/* knurled grip ridges */}
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

      {/* The liquid-glass canvas. Transparent (alpha) so it composites over the
          editor; isolated WebGL renderer mounted only while the toolbar shows. */}
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
            data-testid="liquid-toolbar-canvas"
          >
            <ToolbarScene
              groups={groups}
              activeGroup={activeGroup}
              onToggleGroup={onToggleGroup}
              onHoverButton={setHoverIdx}
            />
          </Canvas>
        )}
        {/* DOM tooltip layer (Wave 3) — labels for the textless buttons. */}
        {!collapsed && (
          <ToolbarTooltips
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

export default LiquidGlassToolbar;
