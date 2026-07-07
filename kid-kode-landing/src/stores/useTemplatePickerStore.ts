// W-TPL D5 — the template-picker open/close store. A tiny DEDICATED zustand
// store (not a field on the large useGraphEditorStore) so the picker overlay and
// its launch button share open state without touching any existing store — fully
// additive (I-ADDITIVE). Two modes: 'hub' (new hub from template, dropped as a
// new planet in the galaxy) and 'section' (drop a section into the active hub).

import { create } from 'zustand';

export type PickerMode = 'hub' | 'section';

interface TemplatePickerState {
  open: boolean;
  mode: PickerMode;
  openPicker: (mode: PickerMode) => void;
  close: () => void;
}

export const useTemplatePickerStore = create<TemplatePickerState>((set) => ({
  open: false,
  mode: 'hub',
  openPicker: (mode) => set({ open: true, mode }),
  close: () => set({ open: false }),
}));
