'use client';

// LiquidGlassToolbar — the React entry for the photoreal 3D liquid-glass canvas
// toolbar (DESIGN LAW B.1). Mounts an ISOLATED R3F WebGL <Canvas> (the proven
// Glb3DPreview pattern; it never touches the unified three/webgpu graph scene)
// and renders the photoreal glass pane + the vertical column of glass-cube tool
// buttons. It drives the SAME activeGroup/handlers the retired DOM dock did, so
// the editor's functionality is unchanged.
//
// Lives inside CanvasToolbar's draggable wrapper, so the DOM grip spine reuses
// the existing drag handlers; the Canvas fills the rail beneath it.

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { ToolbarScene, type RailPointer } from './ToolbarScene';
import { ToolbarTooltips } from './ToolbarTooltips';
import { preloadToolbarGlbs } from './glb';
import { screenYForButton, type LiquidToolGroup } from './config';

export interface LiquidGlassToolbarProps {
  groups: LiquidToolGroup[];
  activeGroup: string | null;
  onToggleGroup: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  dragging: boolean;
  density?: 'regular' | 'compact';
  spineHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

const RAIL_W = 126; // px — physical glass rail width
const HIT = 58; // px — semantic target aligned over each glass cube
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
  density = 'regular',
  spineHandlers,
}: LiquidGlassToolbarProps) {
  const railH = useRailHeight();
  // Warm the GLTF cache for every generated toolbar form so the shell + 28
  // button/icon GLBs stream in together (not waterfalled) on first mount.
  useEffect(() => {
    preloadToolbarGlbs();
  }, []);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // M-1 press weight — the DOM hit targets own the pointer, so press (like
  // hover) is plumbed into the scene from here.
  const [pressIdx, setPressIdx] = useState<number | null>(null);
  const canvasH = collapsed ? 0 : railH;
  const hostRef = useRef<HTMLDivElement | null>(null);
  // MASTERPIECE M-1 living light — normalized pointer over the rail, read every
  // frame by the scene's RailRig (tilt + key-light sweep). Mutated in place; no
  // React state so pointer tracking costs nothing.
  const railPointer = useRef<RailPointer>({ x: 0, y: 0, over: 0 });

  return (
    <div
      ref={hostRef}
      data-component="liquid-glass-toolbar"
      data-orientation="vertical"
      data-density={density}
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
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderTop: '1.5px solid currentColor',
              borderRight: '1.5px solid currentColor',
              transform: `rotate(${collapsed ? 135 : -45}deg)`,
              transition: 'transform 200ms ease',
            }}
          />
        </button>
        {/* knurled grip ridges */}
        <span aria-hidden className="flex flex-col items-center gap-[2px] opacity-70 mt-1">
          <span className="w-5 h-[2px] rounded-full" style={{ background: 'var(--ds-edge-side)', boxShadow: '0 1px 0 rgba(0,0,0,0.5)' }} />
          <span className="w-5 h-[2px] rounded-full" style={{ background: 'var(--ds-edge-side)', boxShadow: '0 1px 0 rgba(0,0,0,0.5)' }} />
          <span className="w-5 h-[2px] rounded-full" style={{ background: 'var(--ds-edge-side)', boxShadow: '0 1px 0 rgba(0,0,0,0.5)' }} />
        </span>
      </div>

      {/* The physical glass canvas. Transparent (alpha) so it composites over the
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
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) return;
          railPointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          railPointer.current.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
          railPointer.current.over = 1;
        }}
        onPointerLeave={() => {
          railPointer.current.over = 0;
        }}
      >
        {/* M-1 compact z-discipline (advocate MUST-FIX): on phones the rail
            floats over whatever chrome shares the band, and DOM text used to
            bleed through the transmission glass between the cubes. A machined
            gunmetal backing sits UNDER the glass canvas on compact only, so the
            rail reads as one deliberate instrument layer over a quiet ground.
            Desktop keeps the pure open-glass look. */}
        {!collapsed && (
          <div
            aria-hidden
            className="md:hidden absolute rounded-[16px] pointer-events-none"
            style={{
              left: 7,
              right: 7,
              top: 4,
              bottom: 4,
              background:
                'linear-gradient(180deg, rgba(11,11,16,0.78) 0%, rgba(4,6,10,0.82) 50%, rgba(11,11,16,0.78) 100%)',
              boxShadow:
                'inset 0 1px 0 rgba(246,248,251,0.07), inset 0 -1px 0 rgba(0,0,0,0.6), 0 10px 30px -12px rgba(0,0,0,0.8)',
            }}
          />
        )}
        {!collapsed && (
          <Canvas
            shadows
            gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
            dpr={[1, 2]}
            frameloop="always"
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.AgXToneMapping;
              gl.toneMappingExposure = 1.05;
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
            }}
            style={{ width: RAIL_W, height: railH, overflow: 'visible' }}
            data-testid="liquid-toolbar-canvas"
          >
            <ToolbarScene
              groups={groups}
              activeGroup={activeGroup}
              onToggleGroup={onToggleGroup}
              externalHoverIndex={hoverIdx}
              externalPressIndex={pressIdx}
              onHoverButton={setHoverIdx}
              pointerRef={railPointer}
            />
          </Canvas>
        )}
        {!collapsed && groups.map((group, i) => {
          const top = Math.round(screenYForButton(i, groups.length, railH)) - HIT / 2;
          return (
            <button
              key={group.id}
              type="button"
              data-tool-group={group.id}
              data-toolbar-hit-target="glass-cube"
              aria-label={group.label}
              title={group.label}
              onPointerEnter={() => setHoverIdx(i)}
              onPointerLeave={() => {
                setHoverIdx((cur) => (cur === i ? null : cur));
                setPressIdx((cur) => (cur === i ? null : cur));
              }}
              onFocus={() => setHoverIdx(i)}
              onBlur={() => setHoverIdx((cur) => (cur === i ? null : cur))}
              onPointerDown={() => setPressIdx(i)}
              onPointerUp={() => setPressIdx((cur) => (cur === i ? null : cur))}
              onClick={() => onToggleGroup(group.id)}
              style={{
                position: 'absolute',
                left: (RAIL_W - HIT) / 2,
                top,
                width: HIT,
                height: HIT,
                padding: 0,
                border: 0,
                borderRadius: 13,
                background: 'transparent',
                color: 'transparent',
                cursor: 'pointer',
                zIndex: 55,
              }}
            />
          );
        })}
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
