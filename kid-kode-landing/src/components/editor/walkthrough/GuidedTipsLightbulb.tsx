'use client';

// GUIDED-TIPS — the glowing lightbulb affordance (C1).
//
// Bespoke (INV-9: no stock icon) — an SVG bulb with a brass glass envelope, a
// pulsing filament, and a lit halo. Mounted at page level (src/app/page.tsx) so
// it shows top-right in ALL three view modes, including preview-app where the
// TopBar is hidden. Clicking it launches the walkthrough (re-triggerable forever
// — D5/C2). Editor-overlay UI: DOM is fine here (outside the FP-05 scope).

import { useWalkthroughStore } from '@/stores/useWalkthroughStore';

export default function GuidedTipsLightbulb() {
  const launch = useWalkthroughStore((s) => s.launch);
  const status = useWalkthroughStore((s) => s.status);

  // While the tour is running the bulb is covered by the scrim (and revealed by
  // the final "relaunch" step's cutout). It stays mounted so the cutout can
  // frame it and so re-trigger works the instant the tour ends.
  return (
    <button
      type="button"
      data-component="guided-tips-lightbulb"
      className="tip-bulb"
      style={{ top: 64, right: 16 }}
      aria-label="Open the guided tour"
      aria-haspopup="dialog"
      title="Guided tour"
      onClick={() => launch()}
      data-tip-running={status === 'running' ? 'true' : 'false'}
    >
      <span className="tip-bulb__halo" aria-hidden />
      <span className="tip-bulb__glass" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <defs>
            <linearGradient id="tipBulbGlass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f7e9c6" />
              <stop offset="0.5" stopColor="#ddba77" />
              <stop offset="1" stopColor="#b3853f" />
            </linearGradient>
            <radialGradient id="tipBulbCore" cx="0.5" cy="0.42" r="0.6">
              <stop offset="0" stopColor="#fff7e2" />
              <stop offset="0.55" stopColor="rgba(247,233,198,0.55)" />
              <stop offset="1" stopColor="rgba(247,233,198,0)" />
            </radialGradient>
          </defs>
          {/* lit core glow inside the glass */}
          <circle cx="11" cy="9" r="7" fill="url(#tipBulbCore)" />
          {/* glass envelope */}
          <path
            d="M11 2.2c-3.4 0-6 2.6-6 5.9 0 2.2 1.1 3.6 2.2 4.8.6.7 1 1.3 1.1 2.1h5.4c.1-.8.5-1.4 1.1-2.1 1.1-1.2 2.2-2.6 2.2-4.8 0-3.3-2.6-5.9-6-5.9Z"
            stroke="url(#tipBulbGlass)"
            strokeWidth="1.4"
            fill="rgba(247,233,198,0.10)"
            strokeLinejoin="round"
          />
          {/* filament — the part that pulses warm */}
          <path
            className="tip-bulb__filament"
            d="M8.7 9.3c0.7-1.4 1.4-1.4 2.3-0.2 0.9 1.2 1.6 1.1 2.3-0.3"
            stroke="#fff7e2"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          />
          {/* base threads */}
          <path d="M8.4 16.3h5.2M8.9 18h4.2M9.7 19.6h2.6" stroke="url(#tipBulbGlass)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  );
}
