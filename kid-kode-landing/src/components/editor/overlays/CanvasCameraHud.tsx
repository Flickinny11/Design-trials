'use client';

/**
 * APP-REALITY P1+P2 — Canvas camera HUD (Chrome-Arc).
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
import { SIGNAL_RED, rbwAlpha } from '@/components/editor/design-system/premium';
import type { HubRenderMode } from '@/lib/prism-graph/types';
import { resolveHubRenderMode } from '@/lib/prism-graph/hub-render-mode';
import { beaconRenderModeEvent } from '@/lib/editor/render-mode-beacon';

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
  // W-2D — the active hub's composition mode drives the HUD: on a 2d hub the
  // orbit instrument reads FLAT, camera staging (JOURNEY) greys out, and the
  // mode chip offers the live 3D⇄2D toggle. `find` returns a stable ref, so
  // this selector never loops useSyncExternalStore (the W7 gotcha).
  const activeHub = useGraphSourceStore(
    (s) => s.hubs.find((h) => h.hubId === activeHubId) ?? null,
  );
  const hubMode = resolveHubRenderMode(activeHub);
  const is2d = hubMode === '2d';
  const setHubMode = (mode: HubRenderMode) => {
    if (!activeHubId || !activeHub || mode === hubMode) return;
    updateHub(activeHubId, { renderMode: mode });
    beaconRenderModeEvent({
      surface: 'canvas-hud',
      hub_ref: activeHubId,
      from_mode: hubMode,
      to_mode: mode,
      hub_hint: activeHub.title,
    });
  };
  // FINISH F-1 — the open keyframe strip owns the bottom band on desktop; the
  // HUD lifts above it (was overlapping the lanes) with a smooth transition.
  // FINISH F-2 (advocate MUST-FIX) — the resting HUD stack used to sit at
  // bottom-4, directly ON the hub-count rail (bottom-5): the JOURNEY strip +
  // Shipped Frame pill occluded a hub pill's element count. Rest the stack one
  // clear band ABOVE the rail instead.
  const keyframePanelOpen = useGraphEditorStore((s) => s.keyframePanelOpen);
  const hudBottomLift = keyframePanelOpen ? 'md:bottom-[318px]' : 'md:bottom-[84px]';
  // MASTERPIECE M-1 (advocate MUST-FIX, one-layer-per-band): on compact the
  // HUD stack shares the top-right band with the selection DetailCard — the
  // pills used to float OVER the card's content. While the card is up, the
  // HUD yields (fades out, non-interactive); it returns the moment the card
  // closes. Desktop keeps both (different bands there).
  const selectedNodeId = useGraphEditorStore((s) => s.selectedNodeId);
  const inspectorOpen = useGraphEditorStore((s) => s.inspectorOpen);
  const detailCardOpen = selectedNodeId !== null && !inspectorOpen;
  const hudYield = detailCardOpen ? ' max-md:opacity-0 max-md:pointer-events-none' : '';

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

  // ── P3: Shipped-Frame lock — a CANVAS sub-mode (renamed from "Edit in
  // Preview", FINISH F-2): the canvas camera locks to the shipped framing so
  // the user designs against the real result, but authoring stays HERE in
  // canvas — Preview itself remains camera-locked shippable output with no
  // authoring tools. The free-orbit instrument + journey REC don't apply while
  // locked, so show the exit control. ─
  if (editInPreview) {
    return (
      <div className={`absolute z-50 pointer-events-none select-none max-md:left-auto max-md:right-2 max-md:translate-x-0 max-md:top-[112px] md:left-1/2 md:-translate-x-1/2 md:top-auto ${hudBottomLift} transition-[bottom,opacity] duration-300${hudYield}`}>
        <div className="ds-glass ds-edge--metal ds-reveal pointer-events-auto flex items-center gap-2.5 rounded-full pl-3 pr-1.5 py-1.5"
          style={{ boxShadow: '0 0 0 1px rgba(var(--ds-metal-200-rgb),0.45), 0 6px 22px -8px rgba(var(--ds-metal-400-rgb),0.5)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ds-metal-200)', boxShadow: '0 0 7px var(--ds-metal-200)' }} />
          <div className="flex flex-col leading-none">
            <span className="text-[10px] font-ui font-semibold tracking-wide" style={{ color: 'var(--ds-metal-200)' }}>Canvas · Shipped Frame</span>
            <span className="text-[8px] font-mono mt-0.5 tracking-wide" style={{ color: 'var(--ds-text-mid)' }}>CAMERA LOCKED · EDITING LIVE</span>
          </div>
          <button type="button" onClick={() => setEditInPreview(false)} title="Back to free orbit"
            className="ds-press flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full"
            style={{ background: 'rgba(var(--ds-metal-200-rgb),0.08)', border: '1px solid rgba(var(--ds-metal-200-rgb),0.28)' }}>
            <span className="text-[9.5px] font-ui font-medium" style={{ color: 'var(--ds-metal-200)' }}>Exit</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute z-50 pointer-events-none select-none flex flex-col gap-2 max-md:left-auto max-md:right-2 max-md:translate-x-0 max-md:top-[112px] max-md:items-end md:left-1/2 md:-translate-x-1/2 md:top-auto md:items-center ${hudBottomLift} transition-[bottom,opacity] duration-300${hudYield}`}>
      {/* Mobile anchors to the TOP scene band so the Inspector bottom-sheet
          can't occlude it; desktop/tablet sit bottom-centre. FINISH F-4
          de-collision: on compact the centred stack overlapped the toolbar
          rail's first cubes (the HUD glass ate taps on the Transform cube) —
          right-anchor it below the tips bulb instead. When the keyframe
          strip is open the whole HUD stack lifts above it (FINISH F-1). */}

      {/* ── P1: camera instrument ─────────────────────────────────────────── */}
      <div
        className={`ds-glass ds-edge--metal ds-reveal pointer-events-auto flex items-center gap-2.5 rounded-full pl-2 pr-1.5 py-1.5${
          pulse ? ' ds-zero-pulse' : ''
        }`}
        style={atZero ? { boxShadow: '0 0 0 1px rgba(var(--ds-metal-200-rgb),0.5), 0 6px 22px -8px rgba(var(--ds-metal-400-rgb),0.55)' } : undefined}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="shrink-0">
          <circle cx="13" cy="13" r="11" fill="none" stroke="rgba(var(--ds-metal-200-rgb),0.28)" strokeWidth="1" />
          <circle cx="13" cy="13" r="11" fill="none" stroke="var(--ds-metal-200)" strokeWidth="1.4"
            strokeDasharray="2 4" opacity={atZero ? 0.9 : 0.4} />
          <g transform={`rotate(${az} 13 13)`} style={{ transition: 'transform 90ms linear' }}>
            <line x1="13" y1="13" x2="13" y2="3.5" stroke="var(--ds-metal-200)" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="13" y1="13" x2="13" y2="20" stroke="rgba(var(--ds-metal-400-rgb),0.7)" strokeWidth="1.4" strokeLinecap="round" />
          </g>
          <circle cx="13" cy="13" r="1.7" fill={atZero ? 'var(--ds-metal-200)' : 'var(--ds-metal-400)'} />
        </svg>

        <div role="status" aria-live="polite" className="flex flex-col leading-none font-mono tabular-nums" style={{ minWidth: 84 }}>
          {is2d ? (
            // W-2D — flat hub: orbit is off (the instrument would only ever
            // read zero), so the readout states the mode instead.
            <>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--ds-metal-200)' }}>
                <span data-testid="hud-flat-readout">2D · FLAT</span>
              </div>
              <div className="text-[8.5px] mt-0.5 tracking-wide" style={{ color: 'var(--ds-text-mid)' }}>
                PAN + ZOOM · DEPTH OFF
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--ds-metal-200)' }}>
                <span>AZ {az >= 0 ? '+' : ''}{az.toFixed(0)}°</span>
                <span style={{ color: 'var(--ds-text-mid)' }}>TILT {tilt >= 0 ? '+' : ''}{tilt.toFixed(0)}°</span>
              </div>
              <div className="text-[8.5px] mt-0.5 tracking-wide" style={{ color: atZero ? 'var(--ds-metal-200)' : 'var(--ds-text-mid)' }}>
                {atZero ? 'STRAIGHT ON' : `ZOOM ${dist.toFixed(1)}`}
              </div>
            </>
          )}
        </div>

        <button type="button" onClick={resetViewToZero} aria-label="Reset view to straight-on" title="Reset view — straight on"
          className="ds-press grid place-items-center w-8 h-8 rounded-full shrink-0"
          style={{ background: 'rgba(var(--ds-metal-200-rgb),0.08)', border: '1px solid rgba(var(--ds-metal-200-rgb),0.28)' }}>
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
            <circle cx="7.5" cy="7.5" r="4.4" fill="none" stroke="var(--ds-metal-200)" strokeWidth="1.2" />
            <line x1="7.5" y1="0.5" x2="7.5" y2="3.2" stroke="var(--ds-metal-200)" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="7.5" y1="11.8" x2="7.5" y2="14.5" stroke="var(--ds-metal-200)" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="0.5" y1="7.5" x2="3.2" y2="7.5" stroke="var(--ds-metal-200)" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="11.8" y1="7.5" x2="14.5" y2="7.5" stroke="var(--ds-metal-200)" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="7.5" cy="7.5" r="1" fill="var(--ds-metal-200)" />
          </svg>
        </button>
      </div>

      {/* ── W-2D: the mode chip — the hub's 2d/3d composition, toggleable live.
             Subtle segmented pill; the same source-store write the Hub
             Inspector toggle uses. Non-destructive both directions. ───────── */}
      <div
        data-testid="hud-mode-chip"
        className="ds-glass ds-edge--metal ds-reveal pointer-events-auto flex items-center gap-1.5 rounded-full pl-2.5 pr-1.5 py-1"
      >
        <span className="text-[8.5px] font-mono tracking-[0.12em] max-md:hidden" style={{ color: 'var(--ds-text-mid)' }}>MODE</span>
        {(['3d', '2d'] as const).map((m) => {
          const active = hubMode === m;
          return (
            <button
              key={m}
              type="button"
              data-testid={`hud-mode-${m}`}
              onClick={() => setHubMode(m)}
              title={m === '2d'
                ? 'Flat composition — same renderer, depth data preserved (unused); 3D accents still render'
                : 'Perspective composition — depth staging, orbit, camera journeys'}
              className="ds-press flex items-center gap-1 h-6 px-2 rounded-full"
              style={active
                ? { background: 'var(--ds-grad-metal)', border: '1px solid rgba(var(--ds-metal-200-rgb),0.4)' }
                : { background: 'rgba(var(--ds-metal-200-rgb),0.06)', border: '1px solid rgba(var(--ds-metal-200-rgb),0.2)' }}
            >
              <span className="text-[9px] font-ui font-semibold tracking-wide" style={{ color: active ? '#0d1117' : 'var(--ds-text-mid)' }}>
                {m === '3d' ? '3D' : '2D'}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── P2: camera-journey strip (W-2D: camera staging is a 3D tool — the
             whole strip greys out on a 2d hub; journey DATA stays intact). ── */}
      <div
        className="ds-glass ds-edge--metal ds-reveal pointer-events-auto flex items-center gap-2 rounded-full pl-2.5 pr-1.5 py-1"
        data-journey-disabled={is2d || undefined}
        title={is2d ? 'Camera staging is 3D-only — switch the hub to 3D to stage the camera (your journey is preserved)' : undefined}
        style={is2d ? { opacity: 0.38 } : undefined}
      >
        {/* M-1 compact narrowing (advocate MUST-FIX): the strip's left edge ran
            under the toolbar rail at 390px — drop the word labels on compact so
            the whole strip fits the space right of the rail. */}
        <span className="text-[8.5px] font-mono tracking-[0.12em] max-md:hidden" style={{ color: 'var(--ds-text-mid)' }}>JOURNEY</span>
        <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full"
          style={{ color: journeyCount >= 2 ? 'var(--ds-metal-200)' : 'var(--ds-text-mid)', background: 'rgba(var(--ds-metal-200-rgb),0.08)' }}>
          {journeyCount}<span className="max-md:hidden"> pt{journeyCount === 1 ? '' : 's'}</span>
        </span>
        <button type="button" onClick={captureCameraKeyframe} disabled={is2d}
          title={is2d ? 'Camera staging is 3D-only on this hub' : 'Record this camera angle as a journey waypoint'}
          className="ds-press flex items-center gap-1.5 h-7 pl-1.5 pr-2.5 rounded-full disabled:opacity-30 disabled:pointer-events-none"
          style={{ background: rbwAlpha(SIGNAL_RED, 0.1), border: `1px solid ${rbwAlpha(SIGNAL_RED, 0.4)}`, boxShadow: `0 0 10px -4px ${rbwAlpha(SIGNAL_RED, 0.5)}` }}>
          <span className="w-2 h-2 rounded-full" style={{ background: SIGNAL_RED, boxShadow: `0 0 7px ${rbwAlpha(SIGNAL_RED, 0.85)}` }} />
          <span className="text-[9.5px] font-ui font-medium" style={{ color: 'var(--ds-metal-200)' }}>REC</span>
        </button>
        <button type="button" onClick={() => activeHubId && updateHub(activeHubId, { cameraKeyframes: [] })}
          disabled={journeyCount === 0 || is2d} aria-label="Clear camera journey" title="Clear journey"
          className="ds-press grid place-items-center w-7 h-7 rounded-full disabled:opacity-30"
          style={{ border: '1px solid rgba(var(--ds-metal-200-rgb),0.22)' }}>
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
            <line x1="2" y1="2" x2="9" y2="9" stroke="var(--ds-text-mid)" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="9" y1="2" x2="2" y2="9" stroke="var(--ds-text-mid)" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" onClick={() => setViewMode('preview-app')}
          disabled={journeyCount < 2 || is2d} title={is2d ? 'Camera staging is 3D-only on this hub' : 'Play the journey in Preview'}
          className="ds-press flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full disabled:opacity-30"
          style={{ background: journeyCount >= 2 ? 'var(--ds-grad-metal)' : 'rgba(var(--ds-metal-200-rgb),0.06)', border: '1px solid rgba(var(--ds-metal-200-rgb),0.3)' }}>
          <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
            <path d="M1 1 L8 5 L1 9 Z" fill={journeyCount >= 2 ? '#0d1117' : 'var(--ds-text-mid)'} />
          </svg>
          <span className="text-[9.5px] font-ui font-semibold" style={{ color: journeyCount >= 2 ? '#0d1117' : 'var(--ds-text-mid)' }}>Preview</span>
        </button>
      </div>

      {/* ── P3: Shipped-Frame lock enter (canvas stays the authoring surface;
             renamed from "Edit in Preview" so it can never read as authoring
             FROM Preview — FINISH F-2). ─────────────────────────────────────── */}
      <button type="button" onClick={() => setEditInPreview(true)}
        title="Lock the canvas camera to the shipped framing — edit here in Canvas against the real result (Preview stays read-only)"
        className="ds-glass ds-edge--metal ds-reveal pointer-events-auto flex items-center gap-1.5 h-7 pl-2.5 pr-3 rounded-full">
        <svg width="13" height="11" viewBox="0 0 13 11" aria-hidden>
          <rect x="0.7" y="0.7" width="11.6" height="9.6" rx="1.4" fill="none" stroke="var(--ds-metal-200)" strokeWidth="1.1" />
          <path d="M3.4 7.6 L6 4.2 L7.6 6 L9 4.2 L9.6 7.6 Z" fill="var(--ds-metal-200)" opacity="0.85" />
        </svg>
        <span className="text-[9px] font-ui font-medium tracking-wide" style={{ color: 'var(--ds-metal-200)' }}>Shipped Frame</span>
      </button>
    </div>
  );
}
