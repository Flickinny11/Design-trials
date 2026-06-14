'use client';

/**
 * APP-REALITY P6 — premium hub morph transition.
 *
 * In preview-app, when the active hub changes (hub rail, Function-bound element,
 * or Prev/Next pager), a brass refractive band sweeps across while a brief dim
 * crossfades the page swap — so navigating hub→hub reads as a designed page
 * morph, not an instant cut. Self-gates to preview-app; inert under reduced
 * motion. Editor overlay scope.
 */

import { useEffect, useRef, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

export default function HubMorphTransition() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const [key, setKey] = useState(0);
  const prevHub = useRef<string | null>(activeHubId);
  const firstRun = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; prevHub.current = activeHubId; return; }
    if (viewMode !== 'preview-app') { prevHub.current = activeHubId; return; }
    if (activeHubId === prevHub.current) return;
    prevHub.current = activeHubId;
    setKey((k) => k + 1);
    setPlaying(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPlaying(false), 660);
  }, [activeHubId, viewMode]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (viewMode !== 'preview-app' || !playing) return null;

  return (
    <div key={key} aria-hidden className="absolute inset-0 z-[45] pointer-events-none overflow-hidden">
      {/* dim crossfade over the page swap */}
      <div className="ds-hub-morph-dim absolute inset-0" style={{ background: 'rgba(4,5,10,0.9)' }} />
      {/* travelling brass refractive band */}
      <div
        className="ds-hub-morph-band absolute inset-y-[-20%] -left-1/2 w-[60%]"
        style={{
          background:
            'linear-gradient(105deg, rgba(var(--ds-brass-200-rgb),0) 0%, rgba(var(--ds-brass-200-rgb),0.18) 38%, rgba(var(--ds-brass-200-rgb),0.42) 50%, rgba(var(--ds-brass-200-rgb),0.18) 62%, rgba(var(--ds-brass-200-rgb),0) 100%)',
          backdropFilter: 'blur(7px) brightness(1.08)',
          WebkitBackdropFilter: 'blur(7px) brightness(1.08)',
        }}
      />
    </div>
  );
}
