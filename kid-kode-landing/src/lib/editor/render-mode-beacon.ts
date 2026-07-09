// W-2D — client-side fire-and-forget beacon for hub render-mode events.
// The canvas HUD chip and the Hub Inspector toggle call this on a 2d/3d
// flip; the actual recording (consent, PII scrub, sink write) happens
// server-side in /api/prism/render-mode-event. Never throws, never blocks
// the UI — a recorder outage must never break toggling a hub's mode.

import type { HubRenderMode } from '@/lib/prism-graph/types';

export interface RenderModeBeacon {
  surface: 'canvas-hud' | 'hub-inspector';
  hub_ref?: string;
  from_mode?: HubRenderMode;
  to_mode?: HubRenderMode;
  hub_hint?: string;
  ok?: boolean;
  detail?: string;
}

export function beaconRenderModeEvent(payload: RenderModeBeacon): void {
  try {
    if (typeof window === 'undefined') return;
    const body = JSON.stringify(payload);
    // Prefer sendBeacon (survives navigation); fall back to keepalive fetch.
    const nav = navigator as Navigator & {
      sendBeacon?: (url: string, data: BodyInit) => boolean;
    };
    if (typeof nav.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (nav.sendBeacon('/api/prism/render-mode-event', blob)) return;
    }
    void fetch('/api/prism/render-mode-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* fail-open */
  }
}
