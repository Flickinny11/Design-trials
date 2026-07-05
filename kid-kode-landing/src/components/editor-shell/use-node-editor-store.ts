'use client';

// PRISM WORKSPACE COMPLETION — W-1 node-editor UI store.
//
// Holds the IN-ENGINE TEXT-EDITING focus state for the docked NODE EDITOR
// (the per-node PURPOSE surface: caption / behavior / schema). Exactly ONE
// GlassTextField is focused at a time; while focused, a single window-keydown
// listener (NodeEditorKeyboard) routes printable keys / Backspace / Enter /
// Escape into `buffer`. The COMMIT (what to do with the buffer) lives on the
// field itself (its `onCommit` writes the live app graph via
// useGraphSourceStore.updateNode) — this store only tracks WHICH field is being
// edited and its in-progress text. Generalizes the proven MaterialPromptPanel
// idiom (window-keydown capture — editor chrome, window access allowed) so the
// purpose surface is genuinely editable with ZERO DOM.

import { create } from 'zustand';

// Generous per-field cap. Captions/behaviors/schemas are short; this guards a
// runaway paste without truncating realistic edits.
const MAX_LEN = 240;

interface NodeEditorUIState {
  /** id of the GlassTextField currently capturing keystrokes (null = none). */
  focusedFieldId: string | null;
  /** the in-progress edit buffer for the focused field. */
  buffer: string;
  /** Focus a field and seed its buffer with the field's current value. */
  beginEdit: (fieldId: string, initial: string) => void;
  /** Replace the whole buffer (headless setBuffer + paste). */
  setBuffer: (s: string) => void;
  /** Append one printable character. */
  type: (ch: string) => void;
  /** Delete the last character. */
  backspace: () => void;
  /** Drop focus + clear the buffer (no commit — the caller commits). */
  blur: () => void;
}

export const useNodeEditorStore = create<NodeEditorUIState>((set) => ({
  focusedFieldId: null,
  buffer: '',
  beginEdit: (fieldId, initial) => set({ focusedFieldId: fieldId, buffer: (initial ?? '').slice(0, MAX_LEN) }),
  setBuffer: (buffer) => set({ buffer: (buffer ?? '').slice(0, MAX_LEN) }),
  type: (ch) => set((s) => ({ buffer: (s.buffer + ch).slice(0, MAX_LEN) })),
  backspace: () => set((s) => ({ buffer: s.buffer.slice(0, -1) })),
  blur: () => set({ focusedFieldId: null, buffer: '' }),
}));
