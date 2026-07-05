'use client';

// GUIDED-TIPS — the walkthrough controller store (P0 state machine, D1).
//
// Editor-local Zustand store. Holds the controller state machine
// (idle → running → done|skipped), the current step index, the detected
// reduced-motion flag, and the transient artifact-frame rect the popup
// publishes for the in-scene TipArtifactStage. It NEVER touches the graph
// (INV-2): the only cross-store effect (transient selection for the Inspector
// step) is performed by the host against useGraphEditorStore and restored on
// exit. Persisting the "seen" flag is delegated to seen-store.ts.

import { create } from 'zustand';
import { WALKTHROUGH_STEPS, WALKTHROUGH_STEP_COUNT } from '@/lib/editor/walkthrough/steps';
import type {
  WalkthroughStep,
  WalkthroughStatus,
  ArtifactFrameRect,
} from '@/lib/editor/walkthrough/types';
import { markWalkthroughSeen } from '@/lib/editor/walkthrough/seen-store';

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}

interface WalkthroughState {
  status: WalkthroughStatus;
  stepIndex: number;
  reducedMotion: boolean;
  /** Viewport-px rect of the popup's transparent artifact window (scene/3D
   *  artifact anchor). Null when no artifact is on screen. */
  artifactFrameRect: ArtifactFrameRect | null;

  // ── derived ─────────────────────────────────────────────────────────────
  /** The active step, or null when not running. */
  currentStep(): WalkthroughStep | null;
  isFirst(): boolean;
  isLast(): boolean;

  // ── actions ─────────────────────────────────────────────────────────────
  /** Launch from step 0 (lightbulb click OR first-visit auto-launch). */
  launch(): void;
  /** Advance; on the last step this completes the tour (marks seen). */
  next(): void;
  /** Step back (no-op on the first step). */
  back(): void;
  /** Jump to a specific step (step dots). */
  goTo(index: number): void;
  /** Skip ends the tour immediately (marks seen). */
  skip(): void;
  /** Dismiss (Close / Esc / scrim) — also marks seen. */
  close(): void;
  setReducedMotion(value: boolean): void;
  setArtifactFrameRect(rect: ArtifactFrameRect | null): void;
}

export const useWalkthroughStore = create<WalkthroughState>((set, get) => ({
  status: 'idle',
  stepIndex: 0,
  reducedMotion: false,
  artifactFrameRect: null,

  currentStep: () => {
    const { status, stepIndex } = get();
    if (status !== 'running') return null;
    return WALKTHROUGH_STEPS[stepIndex] ?? null;
  },
  isFirst: () => get().stepIndex <= 0,
  isLast: () => get().stepIndex >= WALKTHROUGH_STEP_COUNT - 1,

  launch: () =>
    set({
      status: 'running',
      stepIndex: 0,
      reducedMotion: prefersReducedMotion(),
      artifactFrameRect: null,
    }),

  next: () => {
    const { stepIndex } = get();
    if (stepIndex >= WALKTHROUGH_STEP_COUNT - 1) {
      markWalkthroughSeen();
      set({ status: 'done', artifactFrameRect: null });
      return;
    }
    set({ stepIndex: stepIndex + 1, artifactFrameRect: null });
  },

  back: () => {
    const { stepIndex } = get();
    if (stepIndex <= 0) return;
    set({ stepIndex: stepIndex - 1, artifactFrameRect: null });
  },

  goTo: (index) => {
    if (index < 0 || index >= WALKTHROUGH_STEP_COUNT) return;
    set({ stepIndex: index, artifactFrameRect: null });
  },

  skip: () => {
    markWalkthroughSeen();
    set({ status: 'skipped', artifactFrameRect: null });
  },

  close: () => {
    markWalkthroughSeen();
    set({ status: 'idle', artifactFrameRect: null });
  },

  setReducedMotion: (value) => set({ reducedMotion: value }),
  setArtifactFrameRect: (rect) => set({ artifactFrameRect: rect }),
}));
