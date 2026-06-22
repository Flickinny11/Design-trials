'use client';

/**
 * PHASE2 (P2-4) — MORPHING hub transition: a Curtains-style brass curtain morph.
 *
 * In preview-app, on a hub change two pleated BRASS curtain panels swing CLOSED
 * across the viewport (CSS 3D perspective rotateY — a real depth swing, not a flat
 * wipe), hold for the page swap, then swing OPEN to reveal the new hub. A
 * refractive backdrop-filter bends the live 3D scene behind the pleats; the swing
 * is transform/opacity only (compositor-driven → smooth through the heavy hub-swap
 * main-thread stall).
 *
 * Driven ENTIRELY by CSS keyed on `activeHubId`: each change remounts the keyed
 * subtree, so the one-shot animation replays — no React `playing` flag (which the
 * hub-swap remount kept resetting) and no imperative body-append (which Next's
 * React root clobbered on re-render). The animation begins AND ends fully
 * off-screen (opacity 0), so when idle the curtain is invisible. A module-level
 * flag suppresses the curtain on the very first hub the visitor lands on.
 */

import { useEffect } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

let _seenFirst = false;

const PLEATS =
  'repeating-linear-gradient(90deg,' +
  ' rgba(8,7,4,0.86) 0px, rgba(120,92,42,0.80) 14px, rgba(214,176,110,0.94) 26px,' +
  ' rgba(120,92,42,0.80) 38px, rgba(8,7,4,0.86) 52px)';

export default function HubMorphTransition() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);

  useEffect(() => { _seenFirst = true; }, []);

  if (viewMode !== 'preview-app' || !_seenFirst) return null;

  return (
    <div
      key={activeHubId}
      aria-hidden
      className="ds-hub-morph-stage absolute inset-0 z-[45] pointer-events-none overflow-hidden"
    >
      <div className="ds-hub-morph-dim absolute inset-0" style={{ background: 'rgba(4,5,10,0.72)' }} />
      <div
        className="ds-hub-curtain ds-hub-curtain-l absolute inset-y-0 left-0 w-[52%]"
        style={{
          background: PLEATS,
          backdropFilter: 'blur(6px) brightness(1.06) saturate(1.1)',
          WebkitBackdropFilter: 'blur(6px) brightness(1.06) saturate(1.1)',
          boxShadow: 'inset -28px 0 60px rgba(0,0,0,0.6), inset 0 0 120px rgba(214,176,110,0.18)',
        }}
      />
      <div
        className="ds-hub-curtain ds-hub-curtain-r absolute inset-y-0 right-0 w-[52%]"
        style={{
          background: PLEATS,
          backdropFilter: 'blur(6px) brightness(1.06) saturate(1.1)',
          WebkitBackdropFilter: 'blur(6px) brightness(1.06) saturate(1.1)',
          boxShadow: 'inset 28px 0 60px rgba(0,0,0,0.6), inset 0 0 120px rgba(214,176,110,0.18)',
        }}
      />
      <div className="ds-hub-morph-seam absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2" />
    </div>
  );
}
