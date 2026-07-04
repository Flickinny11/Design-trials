'use client';

/**
 * APP-REALITY P7 — preview overlay host.
 *
 * When a Function-bound element is clicked in preview-app and its binding is
 * `{ kind: 'overlay' }`, the store's `openOverlay` is set; this host renders the
 * referenced global element as a HolographicDetailCard at the binding's
 * customizable size + location (viewport fractions). Backdrop / Esc close it.
 * Self-gates to preview-app. Editor overlay scope.
 */

import { useEffect } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { OverlaySpec } from '@/lib/prism-graph/types';
import HolographicDetailCard from './HolographicDetailCard';

export default function OverlayHost() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const openOverlay = useGraphEditorStore((s) => s.openOverlay);
  const closeOverlay = useGraphEditorStore((s) => s.closeOverlay);
  const nodes = useGraphSourceStore((s) => s.nodes);

  useEffect(() => {
    if (!openOverlay) return;
    // FINISH-F3 — capture + stop: while the app overlay is open, Escape must
    // ONLY close the overlay. Without this the editor-level Escape hotkey also
    // fired and kicked the running app out of preview-app into canvas.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        closeOverlay();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [openOverlay, closeOverlay]);

  if (viewMode !== 'preview-app' || !openOverlay) return null;
  const el = nodes.find((n) => n.nodeId === openOverlay.elementId);
  if (!el) return null;

  const spec: OverlaySpec =
    el.overlaySpec ?? { kind: 'holographic-detail', title: el.intent?.caption?.slice(0, 40) || el.subtype || 'Detail' };

  const size = openOverlay.size ?? { w: 0.34, h: 0.62 };
  const anchor = openOverlay.anchor ?? { x: 0.5, y: 0.5 };
  // The card owns its own entrance transform, so positioning/centring lives on a
  // WRAPPER (the binding's size + location) and the card fills it (inset:0).
  // FINISH-F3 (advocate MUST-FIX) — the binding's viewport FRACTIONS are
  // authored against desktop; on a 390px phone 0.34vw was a 132px card and
  // every spec row truncated mid-word. Clamp to a readable floor (and keep
  // the 92vw/88vh ceiling for small windows).
  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${anchor.x * 100}vw`,
    top: `${anchor.y * 100}vh`,
    width: `clamp(min(340px, 92vw), ${size.w * 100}vw, 92vw)`,
    height: `clamp(min(480px, 88vh), ${size.h * 100}vh, 88vh)`,
    transform: 'translate(-50%, -50%)',
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 ds-reveal" style={{ background: 'rgba(4,5,10,0.55)', backdropFilter: 'blur(2px)' }} onClick={closeOverlay} />
      <div style={wrapperStyle}>
        <HolographicDetailCard spec={spec} onClose={closeOverlay} style={{ position: 'absolute', inset: 0 }} />
      </div>
    </div>
  );
}
