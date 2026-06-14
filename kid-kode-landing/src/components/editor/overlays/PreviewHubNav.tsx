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
import { serializePreviewAppHash } from '@/lib/prism-graph/preview-app-routing';

export function navigateToHub(hubId: string) {
  if (typeof window !== 'undefined') {
    try { window.history.pushState(null, '', serializePreviewAppHash(hubId)); } catch { /* noop */ }
  }
  useGraphEditorStore.setState({ activeHubId: hubId });
}

export default function PreviewHubNav() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const hubs = useGraphSourceStore((s) => s.hubs);

  if (viewMode !== 'preview-app' || hubs.length < 2) return null;
  const current = activeHubId ?? hubs[0]?.hubId ?? null;

  return (
    <nav
      aria-label="App sections"
      className="absolute top-[96px] left-1/2 -translate-x-1/2 z-50 pointer-events-auto max-w-[94vw]"
    >
      <div className="ds-glass ds-edge--brass ds-reveal flex items-center gap-0.5 rounded-full p-0.5 overflow-x-auto scrollbar-hide">
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
                background: active ? 'var(--ds-grad-brass)' : 'transparent',
                color: active ? '#2a1f12' : 'var(--ds-text-mid)',
              }}
            >
              <span className="text-[8px] font-mono tabular-nums opacity-70">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[10px] font-ui font-medium tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
