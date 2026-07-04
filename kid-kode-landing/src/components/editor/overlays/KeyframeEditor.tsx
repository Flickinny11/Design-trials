'use client';

// Keyframe editor — premium timeline bound to the selected node's canonical
// `node.keyframes`, with a smoky / high-tech / FAST EXPANDING reveal (UI-WOW-2
// P1). Desktop/regular: a full-width bottom instrument strip that clip-expands
// up out of dissipating smoke. Compact: the same instrument re-housed as a
// bottom sheet so it never fights the mobile dock.
//
// FINISH F-1 (founder mandate 2026-07-01): the surface inherits the toolbar's
// RED / BLACK / WHITE photoreal system (design-system/premium.ts — machined
// gunmetal housing, brushed-chrome bezels, signal-red jewels) and the panel's
// scrub/play now DRIVES the selected node live in the canvas: a rAF driver
// applies the interpolated keyframe pose (lib/prism-graph/keyframe-scrub) to
// the node's registered render group on top of its base scenePosition ⊕
// canvasTransform, restoring the base pose on close. Same driver pattern the
// /editor EditorKeyframeDock proves. All authoring still routes through the
// preview store (FP-15 intent — this overlay never writes source directly).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { DS } from '@/components/editor/design-system';
import {
  CHROME,
  CHROME_HI,
  CHROME_LO,
  RBW,
  RED_DEEP,
  RED_HOT,
  SIGNAL_RED,
  rbwAlpha,
} from '@/components/editor/design-system/premium';
import { Icon } from '@/components/editor/icons/Icon';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { BottomSheet } from '@/components/editor/layout/BottomSheet';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { captureCanvasTransformAsKeyframe } from '@/lib/prism-graph/keyframe-capture';
import { evalScrubPose } from '@/lib/prism-graph/keyframe-scrub';
import type { PrismKeyframe, PrismNode } from '@/lib/prism-graph/types';

// ── machined red/black/white treatments (premium.ts recipes) ─────────────────
const KEY_BG = RBW.keycap;
const KEY_SHADOW = RBW.keycapShadow;
const WELL_BG = RBW.well;
const WELL_SHADOW = RBW.wellShadow;
const ACTIVE_KEY: React.CSSProperties = {
  background: RBW.keycapActive,
  boxShadow: RBW.keycapActiveShadow,
};

// ── data projection: flat PrismKeyframe[] → lanes grouped by animated param ──
// Lane identity lives in the label; the palette stays strictly red/black/white
// (chrome whites + the signal-red family — never a jewel-tone rainbow).
interface KfLaneVM { key: string; name: string; color: string; keys: { t: number; idx: number }[] }
const KF_LANE_DEFS: { key: string; name: string; color: string; match: (p: string) => boolean }[] = [
  { key: 'opacity', name: 'Opacity', color: CHROME, match: (p) => p === 'opacity' },
  { key: 'translate', name: 'Translate', color: SIGNAL_RED, match: (p) => /^translate/i.test(p) },
  { key: 'scale', name: 'Scale', color: RED_HOT, match: (p) => /^scale/i.test(p) },
  { key: 'rotate', name: 'Rotate', color: CHROME_LO, match: (p) => /^rotate/i.test(p) },
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

// ── FINISH F-1: live canvas scrub driver ─────────────────────────────────────
// While the panel is open and the selection has keyframes, apply the
// interpolated pose to the node's rendered group (registered by GraphScene in
// __PRISM_EDITOR_NODE_GROUPS__) every frame; restore the base pose on close.
// Editor-overlay chrome — window access is legal here (outside FP-05 scope).
function nodeGroup(id: string): THREE.Object3D | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D> };
  return w.__PRISM_EDITOR_NODE_GROUPS__?.get(id) ?? null;
}

const IDENTITY_SP = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };
const IDENTITY_CT = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };

/** Composed node view (source ⊕ preview patch) — mirrors the renderer's read. */
function composedNodeById(id: string): PrismNode | null {
  const src = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id);
  if (!src) return null;
  const patch = usePreviewStateStore.getState().patches[id];
  return patch ? ({ ...src, ...patch } as PrismNode) : src;
}

// Force a group's materials to `op`, recording each material's ORIGINAL
// `transparent` flag the first time we touch it so `restoreOpacity` can put it
// back exactly (setting transparent:true on an opaque material and never
// clearing it is a subtle render-state leak on shared/cached materials).
const OPACITY_ORIG = new WeakMap<THREE.Material, boolean>();
function applyOpacity(g: THREE.Object3D, op: number) {
  g.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    const apply = (m: THREE.Material) => {
      if (!OPACITY_ORIG.has(m)) OPACITY_ORIG.set(m, m.transparent);
      m.transparent = true;
      (m as THREE.Material & { opacity: number }).opacity = op;
    };
    Array.isArray(mat) ? mat.forEach(apply) : apply(mat);
  });
}

function restoreOpacity(g: THREE.Object3D) {
  g.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    const restore = (m: THREE.Material) => {
      (m as THREE.Material & { opacity: number }).opacity = 1;
      if (OPACITY_ORIG.has(m)) {
        m.transparent = OPACITY_ORIG.get(m)!;
        OPACITY_ORIG.delete(m);
      }
    };
    Array.isArray(mat) ? mat.forEach(restore) : restore(mat);
  });
}

function useCanvasScrubDriver(
  open: boolean,
  nodeId: string | null,
  keyframeCount: number,
  phRef: React.RefObject<number>,
) {
  useEffect(() => {
    if (!open || !nodeId || keyframeCount === 0) return;
    let raf = 0;
    let touchedOpacity = false;
    const id = nodeId;

    const basePose = () => {
      const node = composedNodeById(id);
      const sp = { ...IDENTITY_SP, ...(node?.scenePosition ?? {}) };
      const ct = { ...IDENTITY_CT, ...(node?.canvasTransform ?? {}) };
      return { node, sp, ct };
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const g = nodeGroup(id);
      if (!g) return;
      const { node, sp, ct } = basePose();
      if (!node) return;
      const pose = evalScrubPose((node.keyframes ?? []) as PrismKeyframe[], phRef.current ?? 0);
      // Keyed channels are canvasTransform snapshots — they stand in for ct;
      // unkeyed channels fall back to the node's live ct (base pose).
      g.position.set(
        sp.x + (pose.translateX ?? ct.x),
        sp.y + (pose.translateY ?? ct.y),
        sp.z + (pose.translateZ ?? ct.z),
      );
      g.rotation.set(
        sp.rotationX + (pose.rotateX ?? ct.rotationX),
        sp.rotationY + (pose.rotateY ?? ct.rotationY),
        sp.rotationZ + (pose.rotateZ ?? ct.rotationZ),
      );
      g.scale.set(
        sp.scaleX * (pose.scaleX ?? ct.scaleX),
        sp.scaleY * (pose.scaleY ?? ct.scaleY),
        sp.scaleZ * (pose.scaleZ ?? ct.scaleZ),
      );
      if (typeof pose.opacity === 'number' && pose.opacity < 0.995) {
        applyOpacity(g, pose.opacity);
        touchedOpacity = true;
      } else if (touchedOpacity) {
        restoreOpacity(g);
        touchedOpacity = false;
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      // restore the base pose so closing the panel never leaves a scrub pose
      const g = nodeGroup(id);
      if (!g) return;
      const { node, sp, ct } = basePose();
      if (!node) return;
      g.position.set(sp.x + ct.x, sp.y + ct.y, sp.z + ct.z);
      g.rotation.set(sp.rotationX + ct.rotationX, sp.rotationY + ct.rotationY, sp.rotationZ + ct.rotationZ);
      g.scale.set(sp.scaleX * ct.scaleX, sp.scaleY * ct.scaleY, sp.scaleZ * ct.scaleZ);
      if (touchedOpacity) restoreOpacity(g);
    };
  }, [open, nodeId, keyframeCount, phRef]);
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

  // FINISH F-1 — scrub/play drives the selected node live in the canvas.
  useCanvasScrubDriver(open, nodeId, count, phRef);

  // Capture a keyframe at the playhead from the node's current transform; route
  // through the preview store so Save / Save-and-Rebuild semantics hold (FP-15
  // intent — this overlay never writes source directly).
  const addKeyframe = useCallback(() => {
    if (!node || !nodeId) return;
    // FINISH F-4 fix: snapshot the COMPOSED pose (source ⊕ preview patch), not
    // the raw source node — a gizmo drag stages canvasTransform into the
    // preview buffer, and "capture" must record the pose the user is LOOKING
    // at, not the last-saved one. (Same composed read the scrub driver uses.)
    const ct = composedNodeById(nodeId)?.canvasTransform ?? node.canvasTransform ?? {
      x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1,
    };
    const kf = captureCanvasTransformAsKeyframe(ct, { trigger: 'load', t: phRef.current });
    const live = (usePreviewStateStore.getState().patches[nodeId]?.keyframes as PrismKeyframe[] | undefined)
      ?? useGraphSourceStore.getState().nodes.find((n) => n.nodeId === nodeId)?.keyframes
      ?? [];
    usePreviewStateStore.getState().set(nodeId, { keyframes: [...live, kf] });
  }, [node, nodeId]);

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
      gsap.set(diamonds, { opacity: 1, clearProps: 'transform' });
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(smoke, { opacity: 0.6, scale: 0.45, yPercent: 12 },
      { opacity: 0, scale: 1.9, yPercent: -65, duration: 0.78, stagger: 0.045, ease: 'power2.out' }, 0);
    if (scan) tl.fromTo(scan, { yPercent: 130, opacity: 0.9 }, { yPercent: -25, opacity: 0, duration: 0.58, ease: 'power2.out' }, 0.03);
    tl.fromTo(laneEls, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.06, ease: 'power3.out' }, 0.12);
    // clearProps on complete releases GSAP's inline transform so the CSS
    // hover-grow on the jewels works after the pop-in (inline style would
    // otherwise pin the diamonds at scale 1 forever).
    tl.fromTo(diamonds, { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.36, stagger: 0.012, ease: 'back.out(2.2)', clearProps: 'transform' }, 0.22);
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
  // FINISH F-4 de-collision (same class as the F-1 toolbar-rail inset and the
  // F-3 HubNav shift): while the Inspector dock is up it covers the strip's
  // right edge — the per-lane capture keys sat unreachable under the glass.
  // Inset the strip clear of the dock (md:w-[484px] + right-3 + gutter).
  const inspectorDockOpen = useGraphEditorStore(
    (s) => s.inspectorOpen && (s.selectedNodeId !== null || s.selectedHubId !== null),
  );
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
      // left inset clears the vertical toolbar rail (the rail was covering the
      // instrument's header + title — FINISH F-1 de-collision). Right inset
      // clears the Inspector dock while it is open (FINISH F-4 de-collision).
      className={`absolute z-40 bottom-0 left-[114px] pointer-events-none ${
        inspectorDockOpen ? 'right-0 md:right-[508px]' : 'right-0'
      }`}
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
      className={compact ? 'relative flex flex-col' : 'relative m-3 ds-edge pointer-events-auto overflow-hidden rounded-[18px]'}
      style={compact ? undefined : {
        background: RBW.bodyMetal,
        boxShadow: `${RBW.bezelEdge}, 0 0 0 1px rgba(0, 0, 0, 0.7), 0 18px 44px -14px rgba(0, 0, 0, 0.85), 0 0 26px -14px ${rbwAlpha(SIGNAL_RED, 0.35)}`,
      }}
    >
      <div ref={compact ? undefined : bodySlab.ref} className="relative" style={compact ? undefined : { background: RBW.bodyMetal }}>
        {/* Signal smoke layer — dissipates on reveal (pointer-safe). */}
        <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: 'var(--ds-r-lg)' }}>
          {[
            { l: '8%', c: SIGNAL_RED }, { l: '34%', c: CHROME }, { l: '60%', c: RED_HOT }, { l: '86%', c: RED_DEEP },
          ].map((s, i) => (
            <span
              key={i}
              data-kf-smoke
              className="absolute bottom-0 rounded-full"
              style={{
                left: s.l, width: 180, height: 120, transform: 'translateX(-50%)',
                background: `radial-gradient(closest-side, ${rbwAlpha(s.c, 0.5)}, ${rbwAlpha(s.c, 0.12)} 55%, transparent 75%)`,
                filter: 'blur(22px)', opacity: 0,
              }}
            />
          ))}
        </div>
        {/* High-tech scan sweep — a thin signal-red light bar that rides up on reveal. */}
        <div
          data-kf-scan
          aria-hidden
          className="absolute left-0 right-0 h-10 pointer-events-none"
          style={{
            top: 0, opacity: 0,
            background: `linear-gradient(180deg, transparent, ${rbwAlpha(SIGNAL_RED, 0.26)} 55%, ${rbwAlpha(CHROME_HI, 0.4)} 80%, transparent)`,
            mixBlendMode: 'screen',
          }}
        />

        {/* Header — machined metal strip with a chrome bezel + red signal. */}
        <div
          ref={compact ? undefined : headerSlab.ref}
          className="relative ds-grain flex items-center justify-between px-3.5 h-11"
          style={{
            background: RBW.headerMetal,
            borderBottom: `1px solid ${rbwAlpha(SIGNAL_RED, 0.28)}`,
            boxShadow: `inset 0 1px 0 ${rbwAlpha(CHROME_HI, 0.22)}, inset 0 -1px 0 rgba(0, 0, 0, 0.55)`,
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon name="timeline" size={14} color={SIGNAL_RED} glow />
            <span
              className="text-[11.5px] font-display font-semibold whitespace-nowrap"
              style={{ color: CHROME, letterSpacing: '0.02em' }}
            >
              Keyframe Editor
            </span>
            <span
              className="ds-chip"
              style={{
                color: count > 0 ? CHROME : 'var(--ds-text-mid)',
                borderColor: rbwAlpha(SIGNAL_RED, count > 0 ? 0.55 : 0.3),
                background: count > 0 ? rbwAlpha(SIGNAL_RED, 0.12) : undefined,
                boxShadow: count > 0 ? `0 0 8px ${rbwAlpha(SIGNAL_RED, 0.2)}` : undefined,
              }}
            >
              {count} {count === 1 ? 'KEY' : 'KEYS'}
            </span>
            <span className="text-[9px] font-mono truncate hidden lg:inline" style={{ color: 'var(--ds-text-mid)' }}>· {selectionLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPlaying((p) => !p)} title={playing ? 'Pause' : 'Play'}
              className="w-7 h-7 rounded-ds-xs ds-press hover:brightness-[1.25] transition-all flex items-center justify-center"
              style={playing ? ACTIVE_KEY : { background: KEY_BG, boxShadow: KEY_SHADOW }}>
              <Icon name={playing ? 'pause' : 'play'} size={11} color={playing ? RED_HOT : CHROME} glow={playing} />
            </button>
            <button type="button" onClick={() => setLoop((l) => !l)} title="Loop"
              className="w-7 h-7 rounded-ds-xs ds-press hover:brightness-[1.25] transition-all flex items-center justify-center"
              style={loop ? ACTIVE_KEY : { background: KEY_BG, boxShadow: KEY_SHADOW }}>
              <Icon name="refresh" size={11} color={loop ? RED_HOT : 'var(--ds-text-mid)'} />
            </button>
            <div className="flex items-center rounded-ds-xs overflow-hidden" style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}>
              {(['1/60', '1/100', '1/120'] as const).map((g) => (
                <button key={g} type="button" onClick={() => setSnapGrid(g)}
                  className={`px-1.5 h-7 text-[9px] font-mono transition-colors ${snapGrid === g ? '' : 'text-ds-text-mid hover:text-ds-text'}`}
                  style={snapGrid === g ? { background: rbwAlpha(SIGNAL_RED, 0.2), color: CHROME, boxShadow: `inset 0 0 0 1px ${rbwAlpha(SIGNAL_RED, 0.45)}` } : undefined}>
                  {g}
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose} title="Close"
              className="w-7 h-7 rounded-ds-xs ds-press hover:bg-white/[0.06] flex items-center justify-center transition-colors">
              <Icon name="close" size={10} color={DS.textMid} />
            </button>
          </div>
        </div>

        {/* Scrubber / fader — recessed machined well, red progress, chrome+red jewel */}
        <div className="px-3.5 pt-3 pb-1 relative">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono tabular-nums w-10" style={{ color: CHROME_LO }}>{(playhead * 3).toFixed(2)}s</span>
            <div className="relative flex-1 h-7">
              <input type="range" min={0} max={1} step={0.001} value={playhead}
                onChange={(e) => setPlayhead(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10" aria-label="Playhead" />
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[5px] rounded-full" style={{ background: WELL_BG, boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.85), inset 0 -1px 0 rgba(246, 248, 251, 0.06)' }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${playhead * 100}%`,
                    background: `linear-gradient(90deg, ${RED_DEEP}, ${SIGNAL_RED} 70%, ${RED_HOT})`,
                    boxShadow: `0 0 10px ${rbwAlpha(SIGNAL_RED, 0.55)}, inset 0 1px 0 ${rbwAlpha(CHROME_HI, 0.35)}`,
                  }}
                />
              </div>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                {Array.from({ length: 31 }).map((_, i) => (
                  <span key={i} className={i % 5 === 0 ? 'w-px h-3' : 'w-px h-1.5'} style={{ background: i % 5 === 0 ? rbwAlpha(CHROME, 0.28) : rbwAlpha(CHROME, 0.1) }} />
                ))}
              </div>
              <div className="absolute top-0 bottom-0 w-3 -translate-x-1/2 flex justify-center pointer-events-none" style={{ left: `${playhead * 100}%` }}>
                <span
                  className="w-3 h-3 mt-0.5 rotate-45 rounded-[3px]"
                  style={{
                    background: `radial-gradient(circle at 32% 28%, ${CHROME_HI} 0%, ${RED_HOT} 30%, ${SIGNAL_RED} 62%, ${RED_DEEP} 100%)`,
                    border: RBW.keyJewelRim,
                    boxShadow: `0 1px 3px rgba(0, 0, 0, 0.7), 0 0 10px ${rbwAlpha(SIGNAL_RED, 0.6)}`,
                  }}
                />
              </div>
            </div>
            <span className="text-[9px] font-mono tabular-nums w-8" style={{ color: CHROME_LO }}>3.00s</span>
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

// One timeline lane — recessed machined well + signal-red jewel keys.
function KeyframeLane({ lane, playhead, empty, onSeek, onAddKey, canAdd }: {
  lane: KfLaneVM; playhead: number; empty?: boolean; onSeek: (t: number) => void; onAddKey: () => void; canAdd: boolean;
}) {
  const laneSlab = useChromeSlab({ material: 'well', radius: 9, order: 42 });
  return (
    <div data-kf-lane className="flex items-center gap-2.5">
      <span
        className="w-24 md:w-28 text-[10px] font-display font-medium truncate flex items-center gap-1.5"
        style={{ color: empty ? 'var(--ds-text-low)' : CHROME, letterSpacing: '0.03em' }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: lane.color, boxShadow: `0 0 5px ${rbwAlpha(lane.color, 0.7)}`, opacity: empty ? 0.4 : 1 }} />
        {lane.name}
      </span>
      <div ref={laneSlab.ref} className="relative flex-1 h-7 rounded-ds-xs" style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}>
        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-px" style={{ background: rbwAlpha(CHROME, 0.09) }} />
        {lane.keys.map((k, i) => (
          <button
            key={i}
            type="button"
            data-kf-diamond
            onClick={() => onSeek(k.t)}
            title={`Seek to ${(k.t * 3).toFixed(2)}s`}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rotate-45 rounded-[2px] hover:scale-[1.35] transition-transform after:content-[''] after:absolute after:-inset-2"
            style={{
              left: `${6 + k.t * 88}%`,
              background: RBW.keyJewel,
              border: RBW.keyJewelRim,
              boxShadow: RBW.keyJewelGlow,
            }}
          />
        ))}
        <span className="absolute top-0 bottom-0 w-px pointer-events-none" style={{ left: `${6 + playhead * 88}%`, background: rbwAlpha(CHROME, 0.6), boxShadow: `0 0 6px ${rbwAlpha(SIGNAL_RED, 0.55)}` }} />
      </div>
      <button type="button" onClick={onAddKey} disabled={!canAdd} title="Capture keyframe at playhead"
        className="w-6 h-6 rounded-ds-xs ds-press hover:brightness-[1.25] transition-all flex items-center justify-center disabled:opacity-40"
        style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}>
        <Icon name="plus" size={9} color={CHROME} />
      </button>
    </div>
  );
}

export default KeyframeEditorPanel;
