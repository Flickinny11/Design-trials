'use client';

/**
 * FINISH-F3 — branded hub-transition interstitial (advocate MUST-FIX 4).
 *
 * The PHASE3 brass curtain masks the incoming hub's mount stall at full
 * cover. The state machine is fast (0.34s close · 0.2s hold · 0.46s open),
 * but a FIRST visit to a heavy hub (Acquire 48 nodes, Atelier 103) freezes
 * rAF during the mount, so the curtain can sit at full cover for seconds —
 * and a bare full-cover curtain reads as a broken frame, not a page change.
 *
 * This veil makes the dwell read INTENTIONAL: the maison wordmark + a live
 * brass shimmer line fade in over the curtain while it is covered and fade
 * out with the reveal — the standard luxury-site branded interstitial.
 * DOM is fine here (editor overlay scope); it renders ONLY in preview-app
 * while a transition is actually covering the frame.
 */

import { useEffect, useMemo, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useHubTransitionStore } from '@/stores/useHubTransitionStore';

export default function TransitionVeil() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  // The wordmark comes from the LOADED GRAPH (the app's own brand node), not a
  // hardcoded string — the runtime hosts ANY app. Generic apps without a brand
  // wordmark node get the shimmer line alone.
  const nodes = useGraphSourceStore((s) => s.nodes);
  const wordmark = useMemo(() => {
    const brand = nodes.find(
      (n) =>
        typeof n.textSpec?.content === 'string' &&
        n.textSpec.content.trim() !== '' &&
        (/\bbrand wordmark\b/i.test(n.intent?.caption ?? '') || /(^|-)brand-mark$/.test(n.nodeId)),
    );
    if (!brand) return null;
    // Typographic refinement only (brand-agnostic): "No." → "№", the numero sign.
    return brand.textSpec!.content.replace(/\bNo\.\s*/, '№ ').toUpperCase();
  }, [nodes]);
  // Gate on PHASE (the driver keeps `cover` in a per-frame ref and never
  // writes it back to the store): closing/holding = the curtain is sweeping
  // to / sitting at full cover — exactly the window the wordmark should own.
  const covered = useHubTransitionStore((s) => s.phase === 'closing' || s.phase === 'holding');
  // Keep mounted briefly after cover drops so the fade-out can play.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (covered) { setVisible(true); return; }
    const t = window.setTimeout(() => setVisible(false), 380);
    return () => window.clearTimeout(t);
  }, [covered]);

  if (viewMode !== 'preview-app' || !visible) return null;

  return (
    <div
      aria-hidden
      className="absolute inset-0 z-[60] pointer-events-none flex flex-col items-center justify-center gap-4"
      style={{
        opacity: covered ? 1 : 0,
        // Fast in (short hops still get a legible read — advocate flag),
        // gentler out with the reveal.
        transition: covered ? 'opacity 140ms ease-out' : 'opacity 300ms ease',
        // Soft dark halo lifts the wordmark off the brightest curtain pleat.
        background: 'radial-gradient(ellipse 46% 30% at 50% 50%, rgba(8,6,3,0.42), transparent 70%)',
      }}
    >
      {wordmark && (
        <div
          className="font-display tracking-[0.34em] text-[15px] md:text-[17px]"
          style={{ color: '#e9dfc4', textShadow: '0 1px 12px rgba(0,0,0,0.55)' }}
        >
          {wordmark}
        </div>
      )}
      <div className="relative h-px w-36 md:w-44 overflow-hidden rounded-full" style={{ background: 'rgba(233,223,196,0.22)' }}>
        <div
          className="absolute inset-y-0 w-1/3 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, #d8b25a, transparent)',
            animation: 'prism-veil-sweep 1.1s ease-in-out infinite',
          }}
        />
      </div>
      <style jsx>{`
        @keyframes prism-veil-sweep {
          0% { left: -34%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
