'use client';

/**
 * APP-REALITY P2 — Preview-side "replay intro" control. In preview-app, when the
 * active hub has an authored camera journey (≥2 waypoints), a subtle pill lets
 * the end-user replay the deterministic fly-in — the way a landing page offers
 * "watch the intro again". Self-gates; renders nothing otherwise so it never
 * intrudes on the running-app surface.
 */

import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';

export default function PreviewJourneyReplay() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const replay = useGraphEditorStore((s) => s.replayCameraJourney);
  const journeyCount = useGraphSourceStore((s) => {
    const hub = s.hubs.find((h) => h.hubId === activeHubId) ?? s.hubs[0];
    return hub?.cameraKeyframes?.length ?? 0;
  });

  if (viewMode !== 'preview-app' || journeyCount < 2) return null;

  return (
    <button
      type="button"
      onClick={replay}
      title="Replay the camera journey"
      className="ds-glass ds-edge--metal ds-reveal pointer-events-auto absolute bottom-5 right-5 z-50 flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full"
    >
      <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
        <path d="M6.5 1.5 a5 5 0 1 0 4.6 3" fill="none" stroke="var(--ds-metal-200)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M11.2 1 L11.4 4.2 L8.3 3.6 Z" fill="var(--ds-metal-200)" />
      </svg>
      <span className="text-[9.5px] font-ui font-medium tracking-wide" style={{ color: 'var(--ds-metal-200)' }}>
        Replay intro
      </span>
    </button>
  );
}
