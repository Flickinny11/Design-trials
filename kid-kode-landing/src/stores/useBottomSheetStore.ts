'use client';

/**
 * useBottomSheetStore — single-active bottom-sheet coordinator (UI-WOW-2 P0).
 *
 * On compact density the editor's floating panels (Inspector family) and the
 * canvas tool flyouts re-house as bottom sheets. Only ONE sheet is visible at a
 * time. Opening a new id brings it to the front; when the front sheet closes,
 * any still-"wanting" sheet (its owner's open prop is still true) reclaims the
 * slot via the restore path in <BottomSheet>. The store stays tiny: it owns the
 * active id + the current snap; the surface lives in <BottomSheet>.
 *
 * Additive (INV-18). Not a viewMode (FP-12/FP-14 safe). Pure in-memory.
 */

import { create } from 'zustand';

export type SheetSnap = 'peek' | 'half' | 'full';

interface BottomSheetStore {
  activeId: string | null;
  snap: SheetSnap;
  open: (id: string, snap?: SheetSnap) => void;
  close: (id?: string) => void;
  setSnap: (snap: SheetSnap) => void;
}

export const useBottomSheetStore = create<BottomSheetStore>((set, get) => ({
  activeId: null,
  snap: 'half',
  open: (id, snap) => {
    const cur = get();
    if (cur.activeId === id && (!snap || cur.snap === snap)) return;
    set({ activeId: id, snap: snap ?? (cur.activeId === id ? cur.snap : 'half') });
  },
  close: (id) => {
    const cur = get();
    if (id && cur.activeId !== id) return; // only the owner may close its sheet
    if (cur.activeId === null) return;
    set({ activeId: null });
  },
  setSnap: (snap) => {
    if (get().snap === snap) return;
    set({ snap });
  },
}));
