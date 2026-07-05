'use client';

// GUIDED-TIPS — the scrim + spotlight cutout (C4 DOM-chrome / C6 scene).
//
// Driver.js's spotlight technique, built bespoke as an SVG mask so we own the
// premium look + multiple holes: a dark dimmer fills the viewport with feathered
// rounded-rect holes punched out of it. A 'spotlight' hole frames a real chrome
// region (toolbar/Inspector); a 'window' hole frames the transparent 3D-artifact
// window so the SINGLE canvas (TipArtifactStage) shows through bright. The
// feGaussianBlur on the holes gives a smooth, non-banded edge (C4 smoothness).
//
// Clicking the dimmed backdrop dismisses (C5 scrim-click); clicking inside a
// hole is ignored so the highlighted element is never an accidental dismiss.

import { useId } from 'react';

export interface ScrimHole {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  /** 'spotlight' draws a brass frame ring + sweep; 'window' is a plain reveal. */
  kind: 'spotlight' | 'window';
}

interface Props {
  holes: ScrimHole[];
  /** Dim opacity 0..1. */
  dim: number;
  /** Animate the sweep tick around spotlight frames (false under reduced-motion). */
  animated: boolean;
  onScrimClick: () => void;
  width: number;
  height: number;
}

export default function WalkthroughScrim({ holes, dim, animated, onScrimClick, width, height }: Props) {
  const maskId = useId().replace(/:/g, '');
  const blurId = `${maskId}-blur`;

  const handleClick = (e: React.MouseEvent) => {
    const px = e.clientX;
    const py = e.clientY;
    const insideHole = holes.some(
      (hl) => px >= hl.x && px <= hl.x + hl.w && py >= hl.y && py <= hl.y + hl.h,
    );
    if (!insideHole) onScrimClick();
  };

  return (
    <div
      className={`tip-scrim${animated ? ' tip-scrim--enter' : ''}`}
      onClick={handleClick}
      data-component="tip-scrim"
      aria-hidden
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <mask id={maskId} maskUnits="userSpaceOnUse">
            {/* everything visible (dimmed)… */}
            <rect x="0" y="0" width={width} height={height} fill="white" />
            {/* …minus the feathered holes (black = cut). */}
            <g filter={`url(#${blurId})`}>
              {holes.map((hl, i) => (
                <rect
                  key={i}
                  x={hl.x}
                  y={hl.y}
                  width={hl.w}
                  height={hl.h}
                  rx={hl.radius}
                  ry={hl.radius}
                  fill="black"
                />
              ))}
            </g>
          </mask>
        </defs>

        {/* The dimmer with holes cut out. */}
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill={`rgba(4,5,10,${dim})`}
          mask={`url(#${maskId})`}
        />

        {/* Brass machined frames around spotlight holes. */}
        {holes.map((hl, i) => {
          const perim = 2 * (hl.w + hl.h);
          return (
            <g key={`f${i}`}>
              <rect
                x={hl.x}
                y={hl.y}
                width={hl.w}
                height={hl.h}
                rx={hl.radius}
                ry={hl.radius}
                className={hl.kind === 'spotlight' ? 'tip-frame-ring' : 'tip-frame-ring tip-frame-ring--soft'}
              />
              {hl.kind === 'spotlight' && animated && (
                <rect
                  x={hl.x}
                  y={hl.y}
                  width={hl.w}
                  height={hl.h}
                  rx={hl.radius}
                  ry={hl.radius}
                  className="tip-frame-sweep"
                  strokeDasharray={`${Math.max(40, perim * 0.12)} ${perim}`}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
