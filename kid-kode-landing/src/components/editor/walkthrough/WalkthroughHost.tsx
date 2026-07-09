'use client';

// GUIDED-TIPS — the orchestrator (P1 shell + lifecycle).
//
// Owns the running walkthrough: it drives the view mode per step, measures the
// chrome target, computes the scrim holes (chrome spotlight + the popup's
// artifact window), drives the synthetic cursor between targets, places the
// popup clear of the target, and wires the full lifecycle (first-visit
// auto-launch once → Skip/Close/Esc/scrim-click dismiss → re-trigger from the
// lightbulb → Next/Back/dots/arrow keys). Editor-overlay UI: DOM is fine here.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useWalkthroughStore } from '@/stores/useWalkthroughStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { WALKTHROUGH_STEPS, WALKTHROUGH_STEP_COUNT } from '@/lib/editor/walkthrough/steps';
import { hasSeenWalkthrough, clearWalkthroughSeen, markWalkthroughSeen } from '@/lib/editor/walkthrough/seen-store';
import type { ArtifactFrameRect } from '@/lib/editor/walkthrough/types';
import WalkthroughScrim, { type ScrimHole } from './WalkthroughScrim';
import DrivenCursor from './DrivenCursor';
import WalkthroughPopup from './WalkthroughPopup';

interface Rect { x: number; y: number; w: number; h: number }

const POPUP_W = 380;
const POPUP_H_EST = 360;
const GAP = 18;

function measure(selector: string | undefined): Rect | null {
  if (!selector || typeof document === 'undefined') return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** Place the popup clear of the target, clamped on-screen. */
function placePopup(target: Rect | null, vw: number, vh: number): { left: number; top: number } {
  const clampX = (x: number) => Math.max(GAP, Math.min(x, vw - POPUP_W - GAP));
  const clampY = (y: number) => Math.max(GAP, Math.min(y, vh - POPUP_H_EST - GAP));
  if (!target) {
    // scene step / no target → centred, slightly above middle.
    return { left: clampX((vw - POPUP_W) / 2), top: clampY((vh - POPUP_H_EST) / 2 - 20) };
  }
  const tcx = target.x + target.w / 2;
  const below = target.y + target.h + GAP;
  const above = target.y - POPUP_H_EST - GAP;
  // Prefer below if the target sits in the top 55% of the viewport; else above.
  let top: number;
  if (target.y + target.h < vh * 0.55 && below + POPUP_H_EST < vh - GAP) {
    top = below;
  } else if (above > GAP) {
    top = above;
  } else {
    // No vertical room either side → place to the side with most room.
    top = clampY(target.y);
    const rightSpace = vw - (target.x + target.w);
    const left = rightSpace > target.x ? target.x + target.w + GAP : target.x - POPUP_W - GAP;
    return { left: clampX(left), top };
  }
  return { left: clampX(tcx - POPUP_W / 2), top };
}

export default function WalkthroughHost() {
  const status = useWalkthroughStore((s) => s.status);
  const stepIndex = useWalkthroughStore((s) => s.stepIndex);
  const reducedMotion = useWalkthroughStore((s) => s.reducedMotion);
  const artifactRect = useWalkthroughStore((s) => s.artifactFrameRect);
  const launch = useWalkthroughStore((s) => s.launch);
  const next = useWalkthroughStore((s) => s.next);
  const back = useWalkthroughStore((s) => s.back);
  const goTo = useWalkthroughStore((s) => s.goTo);
  const skip = useWalkthroughStore((s) => s.skip);
  const close = useWalkthroughStore((s) => s.close);
  const setReducedMotion = useWalkthroughStore((s) => s.setReducedMotion);
  const setArtifactFrameRect = useWalkthroughStore((s) => s.setArtifactFrameRect);

  const running = status === 'running';
  const step = running ? WALKTHROUGH_STEPS[stepIndex] ?? null : null;

  const [viewport, setViewport] = useState({ w: 1440, h: 900 });
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cursorTarget, setCursorTarget] = useState<{ x: number; y: number } | null>(null);
  const [clickKey, setClickKey] = useState(0);

  // Remember the user's selection so the Inspector-step prep is non-destructive.
  const priorSelection = useRef<string | null>(null);
  const launchedSelectionSaved = useRef(false);

  // ── viewport tracking ─────────────────────────────────────────────────────
  useEffect(() => {
    const apply = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  // ── reduced-motion detection (live) ───────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [setReducedMotion]);

  // UXV-P7 belt-and-suspenders: any terminal status persists the seen flag,
  // so no dismissal/finish path (or a mid-write reload) can re-trigger the
  // tour on the next visit.
  useEffect(() => {
    if (status === 'done' || status === 'skipped') markWalkthroughSeen();
  }, [status]);

  // ── first-visit auto-launch (once) ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasSeenWalkthrough()) return;
    // Let the editor boot/settle before driving the screen.
    const t = window.setTimeout(() => {
      if (useWalkthroughStore.getState().status === 'idle' && !hasSeenWalkthrough()) {
        launch();
      }
    }, 1600);
    return () => window.clearTimeout(t);
  }, [launch]);

  // ── dev/verification hook ─────────────────────────────────────────────────
  useEffect(() => {
    const w = window as unknown as { __PRISM_TIPS__?: unknown };
    w.__PRISM_TIPS__ = {
      launch: () => useWalkthroughStore.getState().launch(),
      next: () => useWalkthroughStore.getState().next(),
      back: () => useWalkthroughStore.getState().back(),
      goTo: (i: number) => useWalkthroughStore.getState().goTo(i),
      skip: () => useWalkthroughStore.getState().skip(),
      close: () => useWalkthroughStore.getState().close(),
      setReducedMotion: (b: boolean) => useWalkthroughStore.getState().setReducedMotion(b),
      clearSeen: () => clearWalkthroughSeen(),
      seen: () => hasSeenWalkthrough(),
      state: () => {
        const s = useWalkthroughStore.getState();
        return {
          status: s.status,
          stepIndex: s.stepIndex,
          stepId: WALKTHROUGH_STEPS[s.stepIndex]?.id ?? null,
          total: WALKTHROUGH_STEP_COUNT,
          reducedMotion: s.reducedMotion,
          artifactFrameRect: s.artifactFrameRect,
        };
      },
    };
    return () => {
      delete (window as unknown as { __PRISM_TIPS__?: unknown }).__PRISM_TIPS__;
    };
  }, []);

  // ── per-step orchestration: view mode, selection prep, target measure ─────
  useEffect(() => {
    if (!running || !step) return;

    // Save the user's selection ONCE per launch so we can restore it on exit.
    if (!launchedSelectionSaved.current) {
      priorSelection.current = useGraphEditorStore.getState().selectedNodeId;
      launchedSelectionSaved.current = true;
    }

    // Switch view mode for this step (canonical 3 only).
    if (step.viewMode && useGraphEditorStore.getState().viewMode !== step.viewMode) {
      useGraphEditorStore.getState().setViewMode(step.viewMode);
    }

    // Transient Inspector prep — select the first node (editor state only). For
    // every other step, restore the user's original selection so the Inspector
    // (and its own pre-existing preview canvas) is scoped to the inspector step
    // alone — keeping non-inspector steps at the single scene renderer (C7).
    if (step.prepare === 'select-first-node') {
      const nodes = useGraphSourceStore.getState().nodes;
      const firstSelectable = nodes.find((n) => n.parentHubId) ?? nodes[0];
      if (firstSelectable) useGraphEditorStore.getState().selectNode(firstSelectable.nodeId);
    } else if (useGraphEditorStore.getState().selectedNodeId !== priorSelection.current) {
      useGraphEditorStore.getState().selectNode(priorSelection.current);
    }

    // Measure the target a few times to catch the mode-switch / layout settle.
    let cancelled = false;
    const remeasure = () => {
      if (cancelled) return;
      setTargetRect(measure(step.targetSelector));
    };
    const timers = [60, 220, 480, 820].map((d) => window.setTimeout(remeasure, d));
    remeasure();

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [running, step, stepIndex]);

  // ── cursor target + click pulse on arrival ────────────────────────────────
  useEffect(() => {
    if (!running || !step) {
      setCursorTarget(null);
      return;
    }
    // Cursor goes to the explicit cursorSelector, else the chrome target, else
    // the artifact window (scene steps).
    const cursorRect =
      measure(step.cursorSelector) ??
      measure(step.targetSelector) ??
      (artifactRect ? { x: artifactRect.x, y: artifactRect.y, w: artifactRect.w, h: artifactRect.h } : null);
    if (cursorRect) {
      setCursorTarget({ x: cursorRect.x + cursorRect.w / 2, y: cursorRect.y + cursorRect.h / 2 });
    }
    // Fire a click pulse after the cursor has had time to travel (unless reduced).
    if (reducedMotion) return;
    const t = window.setTimeout(() => setClickKey((k) => k + 1), 1050);
    return () => window.clearTimeout(t);
    // Re-run when the artifact window first appears so scene-step cursor lands.
  }, [running, step, stepIndex, reducedMotion, artifactRect?.x, artifactRect?.y]);

  // ── restore selection when the tour ends ──────────────────────────────────
  useEffect(() => {
    if (running) return;
    if (launchedSelectionSaved.current) {
      const prior = priorSelection.current;
      useGraphEditorStore.getState().selectNode(prior);
      launchedSelectionSaved.current = false;
      priorSelection.current = null;
    }
    setTargetRect(null);
    setCursorTarget(null);
  }, [running]);

  // ── keyboard: Esc / arrows (Enter handled by focused button) ──────────────
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, close, next, back]);

  const onWindowRect = useCallback(
    (rect: ArtifactFrameRect | null) => setArtifactFrameRect(rect),
    [setArtifactFrameRect],
  );

  if (!running || !step) return null;

  // Compose the scrim holes.
  const holes: ScrimHole[] = [];
  const isScene = step.highlightMode === 'scene';
  if (!isScene && targetRect) {
    const pad = 8;
    holes.push({
      x: targetRect.x - pad,
      y: targetRect.y - pad,
      w: targetRect.w + pad * 2,
      h: targetRect.h + pad * 2,
      radius: 14,
      kind: 'spotlight',
    });
  }
  if (artifactRect) {
    holes.push({
      x: artifactRect.x,
      y: artifactRect.y,
      w: artifactRect.w,
      h: artifactRect.h,
      radius: 12,
      kind: isScene ? 'spotlight' : 'window',
    });
  }

  const popupPos = placePopup(isScene ? null : targetRect, viewport.w, viewport.h);

  return (
    <>
      <WalkthroughScrim
        holes={holes}
        dim={isScene ? 0.74 : 0.66}
        animated={!reducedMotion}
        onScrimClick={close}
        width={viewport.w}
        height={viewport.h}
      />
      <DrivenCursor target={cursorTarget} clickKey={clickKey} reducedMotion={reducedMotion} />
      <WalkthroughPopup
        step={step}
        stepIndex={stepIndex}
        total={WALKTHROUGH_STEP_COUNT}
        isFirst={stepIndex <= 0}
        isLast={stepIndex >= WALKTHROUGH_STEP_COUNT - 1}
        reducedMotion={reducedMotion}
        style={{ left: popupPos.left, top: popupPos.top }}
        onNext={next}
        onBack={back}
        onSkip={skip}
        onClose={close}
        onGoTo={goTo}
        onWindowRect={onWindowRect}
      />
    </>
  );
}
