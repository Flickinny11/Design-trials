'use client';

// PRISM EDITOR INTEGRATION — I-3 keyframe transport state.
//
// Holds ONLY the timeline transport (playhead time in seconds, play/pause). The
// keyframe DATA lives on the selected node (PrismNode.keyframes — NODE LAW), read
// + written through useGraphSourceStore by the dock. The pure interpolation +
// keyframe write helpers are the committed /keyframe-editor engine (reused).

import { create } from 'zustand';
import { DURATION_S } from '@/components/editor/keyframe/keyframe-config';

interface EditorKeyframeState {
  playhead: number; // seconds
  playing: boolean;
  setPlayhead: (t: number) => void;
  togglePlay: () => void;
  setPlaying: (b: boolean) => void;
  tick: (dt: number) => void;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const useEditorKeyframeStore = create<EditorKeyframeState>((set) => ({
  playhead: 0,
  playing: false,
  setPlayhead: (t) => set({ playhead: clamp(t, 0, DURATION_S) }),
  togglePlay: () => set((s) => ({ playing: !s.playing, playhead: !s.playing ? 0 : s.playhead })),
  setPlaying: (playing) => set({ playing }),
  tick: (dt) => set((s) => ({ playhead: (s.playhead + dt) % DURATION_S })),
}));
