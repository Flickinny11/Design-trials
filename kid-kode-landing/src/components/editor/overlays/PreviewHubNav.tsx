'use client';

/**
 * APP-REALITY P6 — preview hub navigation rail.
 *
 * The running app's section nav: the hubs as tabs. Clicking navigates hub→hub
 * (the assembled scene re-scopes to the new hub at the local origin; the
 * HubMorphTransition plays the premium morph). Mirrors the canonical preview
 * nav write — `pushState(serializePreviewAppHash) + setState({activeHubId})` —
 * so hash routing, the Prev/Next pager, and Function-bound elements all stay in
 * sync. Self-gates to preview-app. Editor overlay scope.
 */

import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { requestHubNavigation } from '@/stores/useHubTransitionStore';

export function navigateToHub(hubId: string) {
  // PHASE3 (P3-1) — route hub→hub through the gated in-canvas brass curtain
  // (close → swap at peak cover → open) instead of an instant cut. Pushes the
  // hash + commits internally; falls back to a direct write outside preview-app.
  requestHubNavigation(hubId);
}

export default function PreviewHubNav() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const hubs = useGraphSourceStore((s) => s.hubs);

  if (viewMode !== 'preview-app' || hubs.length < 2) return null;
  const current = activeHubId ?? hubs[0]?.hubId ?? null;
  // PROD-FINISH Phase C — Prev/Next chevrons integrated INTO the rail so hub→hub
  // paging works on EVERY viewport, including the compact mobile layout (whose
  // chrome branch omits the desktop bottom Prev/Next pager). Wrapping, so the
  // pager never dead-ends. Part of the rail = no mobile bottom-band collision.
  const curIdx = Math.max(0, hubs.findIndex((h) => h.hubId === current));
  const goRel = (delta: number) => {
    const n = hubs.length;
    navigateToHub(hubs[(curIdx + delta + n) % n].hubId);
  };
  const chevBtn =
    'ds-press flex items-center justify-center h-7 w-7 rounded-full text-ds-text-mid hover:text-ds-metal-200 hover:bg-white/5 transition-colors shrink-0';

  return (
    <nav
      aria-label="App sections"
      className="absolute top-[96px] left-1/2 -translate-x-1/2 z-50 pointer-events-auto max-w-[94vw]"
    >
      <div className="ds-glass ds-edge--metal ds-reveal flex items-center gap-0.5 rounded-full p-0.5 overflow-x-auto scrollbar-hide">
        <button
          type="button"
          aria-label="Previous hub"
          title="Previous hub"
          onClick={() => goRel(-1)}
          className={chevBtn}
        >
          <span className="text-[12px] leading-none">‹</span>
        </button>
        {hubs.map((hub, i) => {
          const active = current === hub.hubId;
          const label = hub.title || hub.hubId;
          return (
            <button
              key={hub.hubId}
              type="button"
              onClick={() => navigateToHub(hub.hubId)}
              aria-current={active ? 'page' : undefined}
              title={label}
              className="ds-press flex items-center gap-1.5 h-7 px-3 rounded-full whitespace-nowrap transition-colors"
              style={{
                background: active ? 'var(--ds-grad-metal)' : 'transparent',
                color: active ? '#0d1117' : 'var(--ds-text-mid)',
              }}
            >
              <span className="text-[8px] font-mono tabular-nums opacity-70">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[10px] font-ui font-medium tracking-wide">{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Next hub"
          title="Next hub"
          onClick={() => goRel(1)}
          className={chevBtn}
        >
          <span className="text-[12px] leading-none">›</span>
        </button>
      </div>
    </nav>
  );
}
