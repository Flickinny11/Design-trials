'use client';

// Keyframe editor — premium timeline bound to the selected node's canonical
// `node.keyframes`, with a smoky / high-tech / FAST EXPANDING reveal (UI-WOW-2
// P1). Desktop/regular: a full-width bottom instrument strip that clip-expands
// up out of dissipating brass smoke. Compact: the same instrument re-housed as
// a bottom sheet so it never fights the mobile dock. Combined deps: GSAP
// timeline (clip-expand + smoke dissipate + light sweep + lane cascade +
// diamond pop), chrome-slab GPU surfaces (t2), tokens-only palette (brass/bone/
// ice, NO purple). Replaces the prior hardcoded-mock placeholder strip.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { Icon } from '@/components/editor/icons/Icon';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { BottomSheet } from '@/components/editor/layout/BottomSheet';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { captureCanvasTransformAsKeyframe } from '@/lib/prism-graph/keyframe-capture';
import type { PrismKeyframe, PrismNode } from '@/lib/prism-graph/types';

// ── token-derived treatments (mirror CanvasToolbar; tokens only) ─────────────
const KEY_BG = 'linear-gradient(178deg, var(--ds-slate), var(--ds-charcoal))';
const KEY_SHADOW = 'var(--ds-chamfer-soft), 0 1px 2px rgba(0, 0, 0, 0.45)';
const WELL_BG = 'var(--ds-grad-well)';
const WELL_SHADOW = 'inset 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(255, 252, 242, 0.05)';
function activeKeyStyle(a: string): React.CSSProperties {
  return {
    background: `linear-gradient(178deg, ${dsAlpha(a, 0.2)}, ${dsAlpha(a, 0.07)}), var(--ds-grad-ceramic)`,
    boxShadow: `inset 0 0 0 1px ${dsAlpha(a, 0.45)}, var(--ds-chamfer-soft), 0 0 14px ${dsAlpha(a, 0.16)}`,
  };
}

// ── data projection: flat PrismKeyframe[] → lanes grouped by animated param ──
interface KfLaneVM { key: string; name: string; color: string; keys: { t: number; idx: number }[] }
const KF_LANE_DEFS: { key: string; name: string; color: string; match: (p: string) => boolean }[] = [
  { key: 'opacity', name: 'Opacity', color: DS.brass400, match: (p) => p === 'opacity' },
  { key: 'translate', name: 'Translate', color: DS.brass200, match: (p) => /^translate/i.test(p) },
  { key: 'scale', name: 'Scale', color: DS.ice300, match: (p) => /^scale/i.test(p) },
  { key: 'rotate', name: 'Rotate', color: DS.ice400, match: (p) => /^rotate/i.test(p) },
];

function deriveKeyframeLanes(keyframes: PrismKeyframe[]): { lanes: KfLaneVM[]; count: number } {
  const n = keyframes.length;
  const maxT = keyframes.reduce((m, k) => (typeof k.t === 'number' && k.t > m ? k.t : m), 0);
  const lanes: KfLaneVM[] = KF_LANE_DEFS.map((l) => ({ key: l.key, name: l.name, color: l.color, keys: [] }));
  keyframes.forEach((kf, idx) => {
    // Normalize t to [0,1]: prefer a real t (absolute seconds → /maxT), else
    // distribute by index so a keyframe list with no t still reads as a timeline.
    const t = typeof kf.t === 'number'
      ? (maxT > 1 ? kf.t / maxT : Math.max(0, Math.min(1, kf.t)))
      : (n > 1 ? idx / (n - 1) : 0.5);
    const params = (kf.params ?? kf.values ?? {}) as Record<string, unknown>;
    const pkeys = Object.keys(params);
    KF_LANE_DEFS.forEach((def, li) => {
      if (pkeys.some((p) => def.match(p))) lanes[li].keys.push({ t, idx });
    });
  });
  return { lanes, count: n };
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export interface KeyframeEditorPanelProps {
  open: boolean;
  onClose: () => void;
  selectionLabel: string;
  node: PrismNode | null | undefined;
  compact: boolean;
}

export function KeyframeEditorPanel({ open, onClose, selectionLabel, node, compact }: KeyframeEditorPanelProps) {
  // Live keyframes: source node ⊕ preview overlay (mirrors the Inspector read).
  const nodeId = node?.nodeId ?? null;
  const sourceKeyframes = useGraphSourceStore(
    (s) => (nodeId ? s.nodes.find((n) => n.nodeId === nodeId)?.keyframes : undefined),
  );
  const previewKeyframes = usePreviewStateStore(
    (s) => (nodeId ? (s.patches[nodeId]?.keyframes as PrismKeyframe[] | undefined) : undefined),
  );
  const keyframes = useMemo<PrismKeyframe[]>(
    () => previewKeyframes ?? sourceKeyframes ?? [],
    [previewKeyframes, sourceKeyframes],
  );
  const { lanes, count } = useMemo(() => deriveKeyframeLanes(keyframes), [keyframes]);

  const [playhead, setPlayhead] = useState(0.32);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [snapGrid, setSnapGrid] = useState<'1/60' | '1/100' | '1/120'>('1/60');

  // Play transport — sweep the playhead so the instrument reads as alive.
  const phRef = useRef(playhead);
  phRef.current = playhead;
  useEffect(() => {
    if (!playing || !open) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      let v = phRef.current + dt / 3; // 3s sweep
      if (v >= 1) {
        if (loop) { v -= 1; } else { setPlayhead(1); setPlaying(false); return; }
      }
      phRef.current = v;
      setPlayhead(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, open]);

  // Capture a keyframe at the playhead from the node's current transform; route
  // through the preview store so Save / Save-and-Rebuild semantics hold (FP-15
  // intent — this overlay never writes source directly).
  const addKeyframe = useCallback(() => {
    if (!node || !nodeId) return;
    const ct = node.canvasTransform ?? {
      x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1,
    };
    const kf = captureCanvasTransformAsKeyframe(ct, { trigger: 'load', t: playhead });
    const next = [...keyframes, kf];
    usePreviewStateStore.getState().set(nodeId, { keyframes: next });
  }, [node, nodeId, keyframes, playhead]);

  const seekTo = useCallback((t: number) => setPlayhead(Math.max(0, Math.min(1, t))), []);

  // ── the smoky / high-tech reveal (runs when shown) ──────────────────────────
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const root = bodyRef.current;
    if (!root) return;
    const smoke = Array.from(root.querySelectorAll('[data-kf-smoke]'));
    const scan = root.querySelector('[data-kf-scan]');
    const laneEls = Array.from(root.querySelectorAll('[data-kf-lane]'));
    const diamonds = Array.from(root.querySelectorAll('[data-kf-diamond]'));
    if (prefersReducedMotion()) {
      gsap.set(smoke, { opacity: 0 });
      if (scan) gsap.set(scan, { opacity: 0 });
      gsap.set(laneEls, { opacity: 1, y: 0 });
      gsap.set(diamonds, { scale: 1, opacity: 1 });
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(smoke, { opacity: 0.6, scale: 0.45, yPercent: 12 },
      { opacity: 0, scale: 1.9, yPercent: -65, duration: 0.78, stagger: 0.045, ease: 'power2.out' }, 0);
    if (scan) tl.fromTo(scan, { yPercent: 130, opacity: 0.9 }, { yPercent: -25, opacity: 0, duration: 0.58, ease: 'power2.out' }, 0.03);
    tl.fromTo(laneEls, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.06, ease: 'power3.out' }, 0.12);
    tl.fromTo(diamonds, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.36, stagger: 0.012, ease: 'back.out(2.2)' }, 0.22);
    return () => { tl.kill(); };
  }, [open, compact]);

  const body = (
    <KeyframeBody
      bodyRef={bodyRef}
      lanes={lanes}
      count={count}
      selectionLabel={selectionLabel}
      hasNode={!!node}
      playhead={playhead}
      setPlayhead={setPlayhead}
      playing={playing}
      setPlaying={setPlaying}
      loop={loop}
      setLoop={setLoop}
      snapGrid={snapGrid}
      setSnapGrid={setSnapGrid}
      onClose={onClose}
      onAddKey={addKeyframe}
      onSeek={seekTo}
      compact={compact}
    />
  );

  if (compact) {
    return (
      <BottomSheet id="keyframe" open={open} onClose={onClose} kicker="TIMELINE" title="Keyframe Editor" initialSnap="full">
        {body}
      </BottomSheet>
    );
  }
  return <DesktopStrip open={open}>{body}</DesktopStrip>;
}

// Desktop bottom strip — the clip-EXPAND envelope (transform/clip only).
function DesktopStrip({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      gsap.set(el, { clipPath: open ? 'inset(0% 0 0 0 round 18px)' : 'inset(100% 0 0 0 round 18px)', y: open ? 0 : 20, autoAlpha: open ? 1 : 0 });
      el.style.pointerEvents = open ? 'auto' : 'none';
      return;
    }
    gsap.killTweensOf(el);
    if (open) {
      el.style.pointerEvents = 'auto';
      gsap.fromTo(el, { clipPath: 'inset(100% 0 0 0 round 18px)', y: 26, autoAlpha: 0 },
        { clipPath: 'inset(0% 0 0 0 round 18px)', y: 0, autoAlpha: 1, duration: 0.52, ease: 'expo.out' });
    } else {
      gsap.to(el, { clipPath: 'inset(100% 0 0 0 round 18px)', y: 18, autoAlpha: 0, duration: 0.34, ease: 'power3.in',
        onComplete: () => { if (ref.current) ref.current.style.pointerEvents = 'none'; } });
    }
  }, [open]);
  return (
    <div
      ref={ref}
      data-component="keyframe-editor"
      className="absolute z-40 bottom-0 left-0 right-0 pointer-events-none"
      style={{ visibility: 'hidden' }}
    >
      {children}
    </div>
  );
}

// The shared instrument body (header transport + scrubber + lanes + smoke).
function KeyframeBody(props: {
  bodyRef: React.RefObject<HTMLDivElement | null>;
  lanes: KfLaneVM[];
  count: number;
  selectionLabel: string;
  hasNode: boolean;
  playhead: number;
  setPlayhead: (n: number) => void;
  playing: boolean;
  setPlaying: (f: (p: boolean) => boolean) => void;
  loop: boolean;
  setLoop: (f: (p: boolean) => boolean) => void;
  snapGrid: '1/60' | '1/100' | '1/120';
  setSnapGrid: (g: '1/60' | '1/100' | '1/120') => void;
  onClose: () => void;
  onAddKey: () => void;
  onSeek: (t: number) => void;
  compact: boolean;
}) {
  const {
    bodyRef, lanes, count, selectionLabel, hasNode, playhead, setPlayhead, playing, setPlaying,
    loop, setLoop, snapGrid, setSnapGrid, onClose, onAddKey, onSeek, compact,
  } = props;
  const bodySlab = useChromeSlab({ material: 'ceramic', radius: 18, order: 40 });
  const headerSlab = useChromeSlab({ material: 'metal', radius: 13, brushAxis: 'x', order: 41 });

  return (
    <div
      ref={bodyRef}
      className={compact ? 'relative flex flex-col' : 'relative m-3 ds-ceramic ds-edge pointer-events-auto overflow-hidden'}
      style={compact ? undefined : { boxShadow: 'var(--ds-chamfer), var(--ds-elev-3)' }}
    >
      <div ref={compact ? undefined : bodySlab.ref} className="relative">
        {/* Brass smoke layer — dissipates on reveal (pointer-safe). */}
        <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: 'var(--ds-r-lg)' }}>
          {[
            { l: '8%', c: DS.brass400 }, { l: '34%', c: DS.brass200 }, { l: '60%', c: DS.ice300 }, { l: '86%', c: DS.brass300 },
          ].map((s, i) => (
            <span
              key={i}
              data-kf-smoke
              className="absolute bottom-0 rounded-full"
              style={{
                left: s.l, width: 180, height: 120, transform: 'translateX(-50%)',
                background: `radial-gradient(closest-side, ${dsAlpha(s.c, 0.5)}, ${dsAlpha(s.c, 0.12)} 55%, transparent 75%)`,
                filter: 'blur(22px)', opacity: 0,
              }}
            />
          ))}
        </div>
        {/* High-tech scan sweep — a thin brass light bar that rides up on reveal. */}
        <div
          data-kf-scan
          aria-hidden
          className="absolute left-0 right-0 h-10 pointer-events-none"
          style={{
            top: 0, opacity: 0,
            background: `linear-gradient(180deg, transparent, ${dsAlpha(DS_ACCENT, 0.22)} 55%, ${dsAlpha(DS.brass200, 0.4)} 80%, transparent)`,
            mixBlendMode: 'screen',
          }}
        />

        {/* Header — machined metal strip. */}
        <div
          ref={compact ? undefined : headerSlab.ref}
          className="relative ds-grain flex items-center justify-between px-3.5 h-11"
          style={{
            background: 'var(--ds-grad-metal)',
            borderBottom: '1px solid rgba(255, 252, 242, 0.07)',
            boxShadow: 'inset 0 1px 0 var(--ds-edge-specular), inset 0 -1px 0 rgba(0, 0, 0, 0.5)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon name="timeline" size={14} color={DS_ACCENT} glow />
            <span className="text-[11px] font-display font-semibold whitespace-nowrap" style={{ color: 'var(--ds-text-hi)' }}>Keyframe Editor</span>
            <span className="ds-chip" style={{ color: 'var(--ds-brass-200)', borderColor: dsAlpha(DS_ACCENT, 0.3) }}>
              {count} {count === 1 ? 'KEY' : 'KEYS'}
            </span>
            <span className="text-[9px] font-mono truncate hidden lg:inline" style={{ color: 'var(--ds-text-mid)' }}>· {selectionLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPlaying((p) => !p)}
              className="w-7 h-7 rounded-ds-xs ds-press hover:brightness-[1.2] transition-all flex items-center justify-center"
              style={playing ? activeKeyStyle(DS_ACCENT) : { background: KEY_BG, boxShadow: KEY_SHADOW }}>
              <Icon name={playing ? 'pause' : 'play'} size={11} color={playing ? DS_ACCENT : DS.brass200} />
            </button>
            <button type="button" onClick={() => setLoop((l) => !l)} title="Loop"
              className="w-7 h-7 rounded-ds-xs ds-press hover:brightness-[1.2] transition-all flex items-center justify-center"
              style={loop ? activeKeyStyle(DS_ACCENT) : { background: KEY_BG, boxShadow: KEY_SHADOW }}>
              <Icon name="refresh" size={11} color={loop ? DS_ACCENT : DS.textMid} />
            </button>
            <div className="flex items-center rounded-ds-xs overflow-hidden" style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}>
              {(['1/60', '1/100', '1/120'] as const).map((g) => (
                <button key={g} type="button" onClick={() => setSnapGrid(g)}
                  className={`px-1.5 h-7 text-[9px] font-mono transition-colors ${snapGrid === g ? '' : 'text-ds-text-mid hover:text-ds-text'}`}
                  style={snapGrid === g ? { background: dsAlpha(DS_ACCENT, 0.18), color: 'var(--ds-brass-200)', boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.35)}` } : undefined}>
                  {g}
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose}
              className="w-7 h-7 rounded-ds-xs ds-press hover:bg-white/[0.06] flex items-center justify-center transition-colors">
              <Icon name="close" size={10} color={DS.textMid} />
            </button>
          </div>
        </div>

        {/* Scrubber / fader */}
        <div className="px-3.5 pt-3 pb-1 relative">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono tabular-nums w-10" style={{ color: 'var(--ds-text-mid)' }}>{(playhead * 3).toFixed(2)}s</span>
            <div className="relative flex-1 h-7">
              <input type="range" min={0} max={1} step={0.001} value={playhead}
                onChange={(e) => setPlayhead(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10" aria-label="Playhead" />
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full" style={{ background: WELL_BG, boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.6)' }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${playhead * 100}%`, background: 'var(--ds-grad-brass)', boxShadow: `0 0 8px ${dsAlpha(DS_ACCENT, 0.35)}` }} />
              </div>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                {Array.from({ length: 31 }).map((_, i) => (
                  <span key={i} className={i % 5 === 0 ? 'w-px h-3' : 'w-px h-1.5'} style={{ background: i % 5 === 0 ? 'rgba(255, 252, 242, 0.22)' : 'rgba(255, 252, 242, 0.08)' }} />
                ))}
              </div>
              <div className="absolute top-0 bottom-0 w-3 -translate-x-1/2 flex justify-center pointer-events-none" style={{ left: `${playhead * 100}%` }}>
                <span className="w-3 h-3 mt-0.5 rotate-45 rounded-[3px]" style={{ background: 'var(--ds-grad-brass)', boxShadow: `0 1px 3px rgba(0, 0, 0, 0.6), var(--ds-glow-brass)` }} />
              </div>
            </div>
            <span className="text-[9px] font-mono tabular-nums w-8" style={{ color: 'var(--ds-text-mid)' }}>3.00s</span>
          </div>
        </div>

        {/* Lanes (bound to node.keyframes) */}
        <div className={`px-3.5 pb-3 pt-1 flex flex-col gap-2 overflow-y-auto ${compact ? 'max-h-[46vh]' : 'max-h-[230px]'}`}>
          {count === 0 ? (
            <div data-kf-lane className="flex flex-col gap-2">
              {lanes.map((lane) => (
                <KeyframeLane key={lane.key} lane={lane} playhead={playhead} empty onSeek={onSeek} onAddKey={onAddKey} canAdd={hasNode} />
              ))}
              <div className="text-[10px] font-mono text-center pt-1" style={{ color: 'var(--ds-text-mid)' }}>
                {hasNode ? 'No keyframes yet — tap + on a lane to capture the current pose.' : 'Select a built element to author its timeline.'}
              </div>
            </div>
          ) : (
            lanes.filter((l) => l.keys.length > 0 || true).map((lane) => (
              <KeyframeLane key={lane.key} lane={lane} playhead={playhead} onSeek={onSeek} onAddKey={onAddKey} canAdd={hasNode} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// One timeline lane — recessed well + glowing brass/ice keyframe jewels.
function KeyframeLane({ lane, playhead, empty, onSeek, onAddKey, canAdd }: {
  lane: KfLaneVM; playhead: number; empty?: boolean; onSeek: (t: number) => void; onAddKey: () => void; canAdd: boolean;
}) {
  const laneSlab = useChromeSlab({ material: 'well', radius: 9, order: 42 });
  return (
    <div data-kf-lane className="flex items-center gap-2.5">
      <span className="w-24 md:w-28 text-[10px] font-mono truncate flex items-center gap-1.5" style={{ color: empty ? 'var(--ds-text-low)' : 'var(--ds-text-mid)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: lane.color, boxShadow: `0 0 5px ${dsAlpha(lane.color, 0.7)}`, opacity: empty ? 0.4 : 1 }} />
        {lane.name}
      </span>
      <div ref={laneSlab.ref} className="relative flex-1 h-7 rounded-ds-xs" style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}>
        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-px" style={{ background: 'rgba(255, 252, 242, 0.08)' }} />
        {lane.keys.map((k, i) => (
          <button
            key={i}
            type="button"
            data-kf-diamond
            onClick={() => onSeek(k.t)}
            title={`Seek to ${(k.t * 3).toFixed(2)}s`}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 rounded-[2px] hover:scale-125 transition-transform"
            style={{
              left: `${6 + k.t * 88}%`,
              background: `radial-gradient(circle at 30% 26%, ${dsAlpha(DS.textHi, 0.55)} 0%, ${dsAlpha(lane.color, 0.95)} 45%, ${dsAlpha(lane.color, 0.72)} 100%)`,
              border: `1px solid ${dsAlpha(DS.textHi, 0.32)}`,
              boxShadow: `0 1px 2px rgba(0, 0, 0, 0.55), 0 0 7px ${dsAlpha(lane.color, 0.4)}`,
            }}
          />
        ))}
        <span className="absolute top-0 bottom-0 w-px pointer-events-none" style={{ left: `${6 + playhead * 88}%`, background: dsAlpha(DS.brass300, 0.65), boxShadow: `0 0 5px ${dsAlpha(DS_ACCENT, 0.45)}` }} />
      </div>
      <button type="button" onClick={onAddKey} disabled={!canAdd} title="Capture keyframe at playhead"
        className="w-6 h-6 rounded-ds-xs ds-press hover:brightness-[1.2] transition-all flex items-center justify-center disabled:opacity-40"
        style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}>
        <Icon name="plus" size={9} color={DS.textMid} />
      </button>
    </div>
  );
}

export default KeyframeEditorPanel;
