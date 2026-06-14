'use client';

/**
 * APP-REALITY P1+P2 — Canvas camera HUD (Observatory-Brass).
 *
 * P1: a live compass + AZ / TILT / ZOOM read-out for the free canvas-edit
 * camera, a one-click "reset view to zero" (straight-on), and a haptic
 * (navigator.vibrate) + visual pulse when the view returns to straight-on.
 *
 * P2: a camera-JOURNEY strip — the canvas user orbits to a pose and "records"
 * it as a waypoint (written to the active hub's `cameraKeyframes`, the shared
 * source graph); Preview plays exactly that journey as a deterministic fly-in.
 *
 * Canvas-only (self-gates on viewMode). DOM/navigator use is fine here: this is
 * an editor overlay, outside the FP-05 runtime/node DOM-discipline scope.
 */

import { useEffect, useRef, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';

const ZERO_TOL = 1.5;

function normAz(deg: number): number {
  return (((deg % 360) + 540) % 360) - 180;
}
function haptic(ms: number) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(ms); } catch { /* non-fatal */ }
  }
}

export default function CanvasCameraHud() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const canvasView = useGraphEditorStore((s) => s.canvasView);
  const resetViewSignal = useGraphEditorStore((s) => s.resetViewSignal);
  const resetViewToZero = useGraphEditorStore((s) => s.resetViewToZero);
  const captureCameraKeyframe = useGraphEditorStore((s) => s.captureCameraKeyframe);
  const setViewMode = useGraphEditorStore((s) => s.setViewMode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const editInPreview = useGraphEditorStore((s) => s.editInPreview);
  const setEditInPreview = useGraphEditorStore((s) => s.setEditInPreview);
  const updateHub = useGraphSourceStore((s) => s.updateHub);
  const journeyCount = useGraphSourceStore(
    (s) => s.hubs.find((h) => h.hubId === activeHubId)?.cameraKeyframes?.length ?? 0,
  );

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

  useEffect(() => {
    if (atZero && !wasAtZero.current) firePulse();
    wasAtZero.current = atZero;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atZero]);

  useEffect(() => {
    if (firstSignal.current) { firstSignal.current = false; return; }
    firePulse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetViewSignal]);

  useEffect(() => () => { if (pulseTimer.current) clearTimeout(pulseTimer.current); }, []);

  if (viewMode !== 'canvas') return null;

  // ── P3: Edit-in-Preview — the camera is locked to the shipped framing; the
  // free-orbit instrument + journey REC don't apply, so show the exit control. ─
  if (editInPreview) {
    return (
      <div className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none top-[60px] md:top-auto md:bottom-4">
        <div className="ds-glass ds-edge--brass ds-reveal pointer-events-auto flex items-center gap-2.5 rounded-full pl-3 pr-1.5 py-1.5"
          style={{ boxShadow: '0 0 0 1px rgba(var(--ds-brass-200-rgb),0.45), 0 6px 22px -8px rgba(var(--ds-brass-400-rgb),0.5)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ds-brass-200)', boxShadow: '0 0 7px var(--ds-brass-200)' }} />
          <div className="flex flex-col leading-none">
            <span className="text-[10px] font-ui font-semibold tracking-wide" style={{ color: 'var(--ds-brass-200)' }}>Editing in Preview</span>
            <span className="text-[8px] font-mono mt-0.5 tracking-wide" style={{ color: 'var(--ds-text-mid)' }}>SHIPPED FRAME · TOOLBAR LIVE</span>
          </div>
          <button type="button" onClick={() => setEditInPreview(false)} title="Back to free orbit"
            className="ds-press flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full"
            style={{ background: 'rgba(var(--ds-brass-200-rgb),0.08)', border: '1px solid rgba(var(--ds-brass-200-rgb),0.28)' }}>
            <span className="text-[9.5px] font-ui font-medium" style={{ color: 'var(--ds-brass-200)' }}>Exit</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none flex flex-col items-center gap-2 top-[60px] md:top-auto md:bottom-4">
      {/* Mobile anchors to the TOP scene band so the Inspector bottom-sheet
          can't occlude it; desktop/tablet sit bottom-centre. */}

      {/* ── P1: camera instrument ─────────────────────────────────────────── */}
      <div
        className={`ds-glass ds-edge--brass ds-reveal pointer-events-auto flex items-center gap-2.5 rounded-full pl-2 pr-1.5 py-1.5${
          pulse ? ' ds-zero-pulse' : ''
        }`}
        style={atZero ? { boxShadow: '0 0 0 1px rgba(var(--ds-brass-200-rgb),0.5), 0 6px 22px -8px rgba(var(--ds-brass-400-rgb),0.55)' } : undefined}
      >
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

        <div role="status" aria-live="polite" className="flex flex-col leading-none font-mono tabular-nums" style={{ minWidth: 84 }}>
          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--ds-brass-200)' }}>
            <span>AZ {az >= 0 ? '+' : ''}{az.toFixed(0)}°</span>
            <span style={{ color: 'var(--ds-text-mid)' }}>TILT {tilt >= 0 ? '+' : ''}{tilt.toFixed(0)}°</span>
          </div>
          <div className="text-[8.5px] mt-0.5 tracking-wide" style={{ color: atZero ? 'var(--ds-brass-200)' : 'var(--ds-text-mid)' }}>
            {atZero ? 'STRAIGHT ON' : `ZOOM ${dist.toFixed(1)}`}
          </div>
        </div>

        <button type="button" onClick={resetViewToZero} aria-label="Reset view to straight-on" title="Reset view — straight on"
          className="ds-press grid place-items-center w-8 h-8 rounded-full shrink-0"
          style={{ background: 'rgba(var(--ds-brass-200-rgb),0.08)', border: '1px solid rgba(var(--ds-brass-200-rgb),0.28)' }}>
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

      {/* ── P2: camera-journey strip ──────────────────────────────────────── */}
      <div className="ds-glass ds-edge--brass ds-reveal pointer-events-auto flex items-center gap-2 rounded-full pl-2.5 pr-1.5 py-1">
        <span className="text-[8.5px] font-mono tracking-[0.12em]" style={{ color: 'var(--ds-text-mid)' }}>JOURNEY</span>
        <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full"
          style={{ color: journeyCount >= 2 ? 'var(--ds-brass-200)' : 'var(--ds-text-mid)', background: 'rgba(var(--ds-brass-200-rgb),0.08)' }}>
          {journeyCount} pt{journeyCount === 1 ? '' : 's'}
        </span>
        <button type="button" onClick={captureCameraKeyframe} title="Record this camera angle as a journey waypoint"
          className="ds-press flex items-center gap-1.5 h-7 pl-1.5 pr-2.5 rounded-full"
          style={{ background: 'rgba(var(--ds-brass-200-rgb),0.1)', border: '1px solid rgba(var(--ds-brass-200-rgb),0.3)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: '#e0594e', boxShadow: '0 0 6px rgba(224,89,78,0.8)' }} />
          <span className="text-[9.5px] font-ui font-medium" style={{ color: 'var(--ds-brass-200)' }}>REC</span>
        </button>
        <button type="button" onClick={() => activeHubId && updateHub(activeHubId, { cameraKeyframes: [] })}
          disabled={journeyCount === 0} aria-label="Clear camera journey" title="Clear journey"
          className="ds-press grid place-items-center w-7 h-7 rounded-full disabled:opacity-30"
          style={{ border: '1px solid rgba(var(--ds-brass-200-rgb),0.22)' }}>
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
            <line x1="2" y1="2" x2="9" y2="9" stroke="var(--ds-text-mid)" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="9" y1="2" x2="2" y2="9" stroke="var(--ds-text-mid)" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" onClick={() => setViewMode('preview-app')}
          disabled={journeyCount < 2} title="Play the journey in Preview"
          className="ds-press flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full disabled:opacity-30"
          style={{ background: journeyCount >= 2 ? 'var(--ds-grad-brass)' : 'rgba(var(--ds-brass-200-rgb),0.06)', border: '1px solid rgba(var(--ds-brass-200-rgb),0.3)' }}>
          <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
            <path d="M1 1 L8 5 L1 9 Z" fill={journeyCount >= 2 ? '#2a1f12' : 'var(--ds-text-mid)'} />
          </svg>
          <span className="text-[9.5px] font-ui font-semibold" style={{ color: journeyCount >= 2 ? '#2a1f12' : 'var(--ds-text-mid)' }}>Preview</span>
        </button>
      </div>

      {/* ── P3: Edit-in-Preview enter ──────────────────────────────────────── */}
      <button type="button" onClick={() => setEditInPreview(true)}
        title="Lock to the shipped framing and edit against the real result"
        className="ds-glass ds-edge--brass ds-reveal pointer-events-auto flex items-center gap-1.5 h-7 pl-2.5 pr-3 rounded-full">
        <svg width="13" height="11" viewBox="0 0 13 11" aria-hidden>
          <rect x="0.7" y="0.7" width="11.6" height="9.6" rx="1.4" fill="none" stroke="var(--ds-brass-200)" strokeWidth="1.1" />
          <path d="M3.4 7.6 L6 4.2 L7.6 6 L9 4.2 L9.6 7.6 Z" fill="var(--ds-brass-200)" opacity="0.85" />
        </svg>
        <span className="text-[9px] font-ui font-medium tracking-wide" style={{ color: 'var(--ds-brass-200)' }}>Edit in Preview</span>
      </button>
    </div>
  );
}
