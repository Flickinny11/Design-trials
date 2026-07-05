'use client';

/**
 * PHASE3 (P3-1) — gated in-canvas hub-transition orchestrator.
 *
 * Phase 2 shipped a DOM-overlay curtain (HubMorphTransition, z-45 CSS): an
 * in-WebGPU camera-followed plane "rendered but never covered the viewport"
 * because it was a frustum-culled, scene-rooted position-follower. Phase 3
 * fixes the root cause (see HubSceneTransition.tsx — camera-PARENTED quad,
 * frustumCulled=false, the ChromeSlabLayer idiom) and moves the curtain INTO
 * the WebGPU scene.
 *
 * The other reason Phase 2 went DOM: the CSS compositor keeps animating through
 * the heavy hub-swap main-thread stall, whereas an R3F useFrame quad freezes
 * during a JS stall. We solve that here by GATING the content swap to the
 * curtain's PEAK coverage: the in-scene driver advances closing → (commit at
 * full cover) → holding → opening, so the expensive activeHubId mount fires
 * while the curtain is fully closed. A frozen-at-full-cover curtain during the
 * stall is exactly what hides the swap; the open only runs once the main thread
 * is free again.
 *
 * This store is the shared signal between the nav (intent, outside the Canvas)
 * and the in-scene driver (render, inside the Canvas). The driver owns all
 * timing; this store only holds shared state + the request trigger + the
 * commit.
 */

import { create } from 'zustand';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { serializePreviewAppHash } from '@/lib/prism-graph/preview-app-routing';

export type HubTransitionPhase = 'idle' | 'closing' | 'holding' | 'opening';

interface HubTransitionState {
  phase: HubTransitionPhase;
  /** 0..1 current curtain coverage — written by the in-scene driver each frame. */
  cover: number;
  /** Bumps on every accepted request. Drives the camera dolly-through kick. */
  token: number;
  toHub: string | null;
  fromHub: string | null;
  /** True while HubSceneTransition is mounted (preview-app Canvas). */
  driverMounted: boolean;
  /** Nav intent → begin the gated close. The driver advances from here. */
  request: (hubId: string) => void;
  _setPhase: (p: HubTransitionPhase) => void;
  _setCover: (c: number) => void;
  /** Driver calls this at peak coverage to perform the actual hub swap. */
  _commit: () => void;
  _setDriverMounted: (v: boolean) => void;
}

export const useHubTransitionStore = create<HubTransitionState>((set, get) => ({
  phase: 'idle',
  cover: 0,
  token: 0,
  toHub: null,
  fromHub: null,
  driverMounted: false,
  request: (hubId) => {
    const cur = useGraphEditorStore.getState().activeHubId;
    if (cur === hubId) return; // no-op for the active hub
    set((s) => ({ phase: 'closing', toHub: hubId, fromHub: cur, token: s.token + 1 }));
  },
  _setPhase: (p) => set({ phase: p }),
  _setCover: (c) => set({ cover: c }),
  _commit: () => {
    const { toHub } = get();
    if (toHub) useGraphEditorStore.setState({ activeHubId: toHub });
  },
  _setDriverMounted: (v) => set({ driverMounted: v }),
}));

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * The single entry every user-initiated hub navigation routes through. Pushes
 * the URL hash (same write the legacy direct-setState path did) then either
 * runs the gated in-canvas transition (preview-app, driver mounted, motion ok)
 * or commits immediately (so nav never dead-ends in galaxy/canvas or with
 * reduced-motion).
 */
export function requestHubNavigation(hubId: string): void {
  if (typeof window !== 'undefined') {
    try {
      window.history.pushState(null, '', serializePreviewAppHash(hubId));
    } catch {
      /* noop */
    }
  }
  const ed = useGraphEditorStore.getState();
  const tr = useHubTransitionStore.getState();
  const canAnimate =
    ed.viewMode === 'preview-app' &&
    tr.driverMounted &&
    ed.activeHubId !== hubId &&
    !prefersReducedMotion();
  if (canAnimate) {
    tr.request(hubId);
  } else {
    useGraphEditorStore.setState({ activeHubId: hubId });
  }
}
