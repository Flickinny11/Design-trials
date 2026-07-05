'use client';

import { create } from 'zustand';

import type {
  PrismKeyframeCoordinateSpace,
  PrismKeyframeTrigger,
} from '@/lib/prism-graph/types';

export interface FrameProps {
  scale: number;
  opacity: number;
  rotation: number; // degrees
  x: number; // px offset
  y: number;
  color: string; // #rrggbbaa
}

export const defaultFrame = (i: number, total: number): FrameProps => {
  const t = total > 1 ? i / (total - 1) : 0;
  // Default curve: a gentle scale-up + fade-in
  const scale = 1 + 0.06 * Math.sin(t * Math.PI);
  return {
    scale,
    opacity: 1,
    rotation: 0,
    x: 0,
    y: 0,
    color: '#5d8bff',
  };
};

export interface NodeEdits {
  nodeId: string;
  frames: FrameProps[];
  // edits to the node's base visual spec
  primaryColor?: string;
  secondaryColor?: string;
  radius?: number;
  // EB-08-03 — Animation tab picker state. Both optional (INV-18 additive).
  // `coordinateSpace` is the canonical-5 space the active keyframe lives in
  // (RA-03); `trigger` is the SC-044 enum entry that fires this animation.
  coordinateSpace?: PrismKeyframeCoordinateSpace;
  trigger?: PrismKeyframeTrigger;
  // unsaved flag
  dirty: boolean;
}

interface EditState {
  edits: Record<string, NodeEdits>;
  ensureNode: (nodeId: string, initialFrameCount: number) => void;
  setFrame: (nodeId: string, frameIdx: number, patch: Partial<FrameProps>) => void;
  setPrimary: (nodeId: string, color: string) => void;
  setSecondary: (nodeId: string, color: string) => void;
  setCoordinateSpace: (nodeId: string, space: PrismKeyframeCoordinateSpace) => void;
  setTrigger: (nodeId: string, trigger: PrismKeyframeTrigger) => void;
  reorderFrames: (nodeId: string, fromIdx: number, toIdx: number) => void;
  reset: (nodeId: string) => void;
  markSaved: (nodeId: string) => void;
}

export const useAnimationEditsStore = create<EditState>((set, get) => ({
  edits: {},
  ensureNode: (nodeId, initialFrameCount) => {
    if (get().edits[nodeId]) return;
    set((s) => ({
      edits: {
        ...s.edits,
        [nodeId]: {
          nodeId,
          frames: Array.from({ length: initialFrameCount }, (_, i) => defaultFrame(i, initialFrameCount)),
          dirty: false,
        },
      },
    }));
  },
  setFrame: (nodeId, frameIdx, patch) =>
    set((s) => {
      const existing = s.edits[nodeId];
      if (!existing) return s;
      const frames = existing.frames.slice();
      frames[frameIdx] = { ...frames[frameIdx], ...patch };
      return {
        edits: { ...s.edits, [nodeId]: { ...existing, frames, dirty: true } },
      };
    }),
  setPrimary: (nodeId, color) =>
    set((s) => {
      const existing = s.edits[nodeId] || { nodeId, frames: [], dirty: false };
      return { edits: { ...s.edits, [nodeId]: { ...existing, primaryColor: color, dirty: true } } };
    }),
  setSecondary: (nodeId, color) =>
    set((s) => {
      const existing = s.edits[nodeId] || { nodeId, frames: [], dirty: false };
      return { edits: { ...s.edits, [nodeId]: { ...existing, secondaryColor: color, dirty: true } } };
    }),
  setCoordinateSpace: (nodeId, space) =>
    set((s) => {
      const existing = s.edits[nodeId] || { nodeId, frames: [], dirty: false };
      return { edits: { ...s.edits, [nodeId]: { ...existing, coordinateSpace: space, dirty: true } } };
    }),
  setTrigger: (nodeId, trigger) =>
    set((s) => {
      const existing = s.edits[nodeId] || { nodeId, frames: [], dirty: false };
      return { edits: { ...s.edits, [nodeId]: { ...existing, trigger, dirty: true } } };
    }),
  reorderFrames: (nodeId, fromIdx, toIdx) =>
    set((s) => {
      const existing = s.edits[nodeId];
      if (!existing) return s;
      const frames = existing.frames.slice();
      const [moved] = frames.splice(fromIdx, 1);
      frames.splice(toIdx, 0, moved);
      return { edits: { ...s.edits, [nodeId]: { ...existing, frames, dirty: true } } };
    }),
  reset: (nodeId) =>
    set((s) => {
      const existing = s.edits[nodeId];
      if (!existing) return s;
      return {
        edits: {
          ...s.edits,
          [nodeId]: {
            ...existing,
            frames: existing.frames.map((_, i) => defaultFrame(i, existing.frames.length)),
            primaryColor: undefined,
            secondaryColor: undefined,
            dirty: false,
          },
        },
      };
    }),
  markSaved: (nodeId) =>
    set((s) => {
      const existing = s.edits[nodeId];
      if (!existing) return s;
      return { edits: { ...s.edits, [nodeId]: { ...existing, dirty: false } } };
    }),
}));
