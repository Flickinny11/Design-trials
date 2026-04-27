"use client";

import { create } from "zustand";

interface ElementImageState {
  // dataURL per node id; missing = fall back to procedural texture
  images: Record<string, string>;
  captureVersion: number; // bump to force texture rebuild
  setImage: (nodeId: string, dataUrl: string) => void;
  setImages: (batch: Record<string, string>) => void;
  clear: () => void;
}

export const useElementImageStore = create<ElementImageState>((set) => ({
  images: {},
  captureVersion: 0,
  setImage: (nodeId, dataUrl) =>
    set((s) => ({
      images: { ...s.images, [nodeId]: dataUrl },
      captureVersion: s.captureVersion + 1,
    })),
  setImages: (batch) =>
    set((s) => ({
      images: { ...s.images, ...batch },
      captureVersion: s.captureVersion + 1,
    })),
  clear: () => set({ images: {}, captureVersion: 0 }),
}));
