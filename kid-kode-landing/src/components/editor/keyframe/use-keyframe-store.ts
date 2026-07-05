'use client';

// The keyframe editor's reactive state. The SELECTED NODE holds its own animation
// (`keyframes: PrismKeyframe[]`) — that array is the single source of truth (NODE
// LAW). The store also tracks the playhead time (seconds) and the play/pause clock.

import { create } from 'zustand';
import type { PrismKeyframe } from '@/lib/prism-graph/types';
import { DURATION_S } from './keyframe-config';
import {
  type KeyNode,
  evalAll,
  evalTrack,
  removeKeyframeNear,
  setKeyframe,
} from './keyframe-engine';

const SELECTED_NODE: KeyNode = {
  id: 'kf-subject-node',
  caption: 'Selected Node',
  keyframes: [],
};

export interface KeyframeStore {
  node: KeyNode;
  playhead: number; // seconds
  playing: boolean;
  /** monotonically bumped whenever keyframes change — lets the scene re-read */
  rev: number;

  setPlayhead: (timeS: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** advance the clock during playback (seconds delta) */
  tick: (dt: number) => void;

  /** write/move a keyframe for a track at a time (seconds) */
  writeKeyframe: (trackId: string, timeS: number, value: number) => void;
  /** remove the keyframe nearest `timeS` on a track */
  removeKeyframe: (trackId: string, timeS: number) => void;
  /** clear all keyframes on the node */
  clearAll: () => void;

  /** interpolated value of one track at the current playhead */
  valueAt: (trackId: string) => number;
  /** every track's interpolated value at the current playhead */
  currentValues: () => Record<string, number>;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const useKeyframeStore = create<KeyframeStore>((set, get) => ({
  node: SELECTED_NODE,
  playhead: 0,
  playing: false,
  rev: 0,

  setPlayhead: (timeS) => set({ playhead: clamp(timeS, 0, DURATION_S) }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  tick: (dt) =>
    set((s) => {
      if (!s.playing) return {};
      let p = s.playhead + dt;
      if (p >= DURATION_S) p = 0; // loop
      return { playhead: p };
    }),

  writeKeyframe: (trackId, timeS, value) =>
    set((s) => {
      const keyframes: PrismKeyframe[] = setKeyframe(s.node.keyframes, trackId, timeS, value);
      return { node: { ...s.node, keyframes }, rev: s.rev + 1 };
    }),
  removeKeyframe: (trackId, timeS) =>
    set((s) => {
      const keyframes = removeKeyframeNear(s.node.keyframes, trackId, timeS);
      return { node: { ...s.node, keyframes }, rev: s.rev + 1 };
    }),
  clearAll: () => set((s) => ({ node: { ...s.node, keyframes: [] }, rev: s.rev + 1 })),

  valueAt: (trackId) => evalTrack(get().node, trackId, get().playhead),
  currentValues: () => evalAll(get().node, get().playhead),
}));
