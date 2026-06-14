'use client';

/**
 * APP-REALITY P1 — Canvas camera HUD (Observatory-Brass).
 *
 * The free canvas-edit camera now has a small viewport instrument, the way a
 * real 3D editor does: a live compass + AZ / TILT / zoom read-out, and a
 * one-click "reset view to zero" (straight-on) control. When the view returns
 * to straight-on — by the reset button OR by the user orbiting back to it — the
 * instrument fires a haptic pulse (navigator.vibrate where supported) and a
 * subtle visual pulse, so "centred" is felt, not just seen.
 *
 * Canvas-only (self-gates on viewMode). DOM/navigator use is fine here: this is
 * an editor overlay (`src/components/editor/overlays/*`), outside the FP-05
 * runtime/node DOM-discipline scope.
 */

import { useEffect, useRef, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

// Straight-on tolerance (degrees) for the at-zero state + edge-triggered pulse.
const ZERO_TOL = 1.5;

function normAz(deg: number): number {
  // camera-controls azimuth accumulates; fold to [-180, 180] for display.
  return (((deg % 360) + 540) % 360) - 180;
}

function haptic(ms: number) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(ms);
    } catch {
      /* vibrate can throw on some platforms; non-fatal */
    }
  }
}

export default function CanvasCameraHud() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const canvasView = useGraphEditorStore((s) => s.canvasView);
  const resetViewSignal = useGraphEditorStore((s) => s.resetViewSignal);
  const resetViewToZero = useGraphEditorStore((s) => s.resetViewToZero);

  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasAtZero = useRef(true);
  const firstSignal = useRef(true);

  const az = canvasView ? normAz(canvasView.azimuthDeg) : 0;
  const tilt = canvasView ? canvasView.polarDeg - 90 : 0;
  const dist = canvasView ? canvasView.distance : 18;
  const atZero = Math.abs(az) <= ZERO_TOL && Math.abs(tilt) <= ZERO_TOL;

  const firePulse = () => {
    setPulse(true);
    haptic(14);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(false), 620);
  };

  // Edge-trigger: pulse the moment the view CROSSES into the straight-on zone
  // (so manually orbiting back to centre is rewarded, not just the button).
  useEffect(() => {
    if (atZero && !wasAtZero.current) firePulse();
    wasAtZero.current = atZero;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atZero]);

  // Reset button (and any reset-to-zero gesture) always pulses.
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    firePulse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetViewSignal]);

  useEffect(() => () => {
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
  }, []);

  if (viewMode !== 'canvas') return null;

  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none top-[60px] md:top-auto md:bottom-4">
      {/* Mobile anchors the instrument to the TOP scene band so the Inspector
          bottom-sheet can't occlude it; desktop/tablet sit bottom-centre. */}
      <div
        className={`ds-glass ds-edge--brass ds-reveal pointer-events-auto flex items-center gap-2.5 rounded-full pl-2 pr-1.5 py-1.5${
          pulse ? ' ds-zero-pulse' : ''
        }`}
        style={atZero ? { boxShadow: '0 0 0 1px rgba(var(--ds-brass-200-rgb),0.5), 0 6px 22px -8px rgba(var(--ds-brass-400-rgb),0.55)' } : undefined}
      >
        {/* Live compass dial — needle points where the orbit is, brightens at zero. */}
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="shrink-0">
          <circle cx="13" cy="13" r="11" fill="none" stroke="rgba(var(--ds-brass-200-rgb),0.28)" strokeWidth="1" />
          <circle cx="13" cy="13" r="11" fill="none" stroke="var(--ds-brass-200)" strokeWidth="1.4"
            strokeDasharray="2 4" opacity={atZero ? 0.9 : 0.4} />
          <g transform={`rotate(${az} 13 13)`} style={{ transition: 'transform 90ms linear' }}>
            <line x1="13" y1="13" x2="13" y2="3.5" stroke="var(--ds-brass-200)" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="13" y1="13" x2="13" y2="20" stroke="rgba(var(--ds-brass-400-rgb),0.7)" strokeWidth="1.4" strokeLinecap="round" />
          </g>
          <circle cx="13" cy="13" r="1.7" fill={atZero ? 'var(--ds-brass-200)' : 'var(--ds-brass-400)'} />
        </svg>

        {/* Read-out */}
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col leading-none font-mono tabular-nums"
          style={{ minWidth: 84 }}
        >
          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--ds-brass-200)' }}>
            <span>AZ {az >= 0 ? '+' : ''}{az.toFixed(0)}°</span>
            <span style={{ color: 'var(--ds-text-mid)' }}>TILT {tilt >= 0 ? '+' : ''}{tilt.toFixed(0)}°</span>
          </div>
          <div className="text-[8.5px] mt-0.5 tracking-wide" style={{ color: atZero ? 'var(--ds-brass-200)' : 'var(--ds-text-mid)' }}>
            {atZero ? 'STRAIGHT ON' : `ZOOM ${dist.toFixed(1)}`}
          </div>
        </div>

        {/* Reset view to zero (straight-on) */}
        <button
          type="button"
          onClick={resetViewToZero}
          aria-label="Reset view to straight-on"
          title="Reset view — straight on"
          className="ds-press grid place-items-center w-8 h-8 rounded-full shrink-0"
          style={{
            background: 'rgba(var(--ds-brass-200-rgb),0.08)',
            border: '1px solid rgba(var(--ds-brass-200-rgb),0.28)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
            <circle cx="7.5" cy="7.5" r="4.4" fill="none" stroke="var(--ds-brass-200)" strokeWidth="1.2" />
            <line x1="7.5" y1="0.5" x2="7.5" y2="3.2" stroke="var(--ds-brass-200)" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="7.5" y1="11.8" x2="7.5" y2="14.5" stroke="var(--ds-brass-200)" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="0.5" y1="7.5" x2="3.2" y2="7.5" stroke="var(--ds-brass-200)" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="11.8" y1="7.5" x2="14.5" y2="7.5" stroke="var(--ds-brass-200)" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="7.5" cy="7.5" r="1" fill="var(--ds-brass-200)" />
          </svg>
        </button>
      </div>
    </div>
  );
}
