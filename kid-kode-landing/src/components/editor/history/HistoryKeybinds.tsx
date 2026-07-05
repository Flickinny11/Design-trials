"use client";

// EDITOR-EXP P7 (C32) — global undo/redo keybinds.
//
// Self-contained client component: mount once at the page root. Wires
//   Cmd/Ctrl+Z        → undo
//   Cmd/Ctrl+Shift+Z  → redo   (and Cmd/Ctrl+Y as a Windows-style alias)
// onto `window` and routes them through the COHERENT wrappers so an undo/redo
// reverts the schema AND re-realizes the BUILT scene (rebuild-version bump),
// re-fires the server autosave (C32), and reconciles the preview overlay (C34).
//
// Guards against firing while the user is typing in a text field / editing a
// contentEditable, so Cmd+Z keeps its native in-field undo there.
//
// This is editor-shell UI (a 'use client' component); window/document access
// here is NOT subject to FP-05 (which scopes to src/lib/prism/runtime/** and
// node modules). It renders nothing.

import { useEffect } from "react";
import {
  coherentUndo,
  coherentRedo,
  coherentJumpBy,
  canUndo,
  canRedo,
} from "@/lib/editor/history-coherence";
import { getHistoryMeta, getTemporalStore } from "@/stores/useGraphSourceStore";

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export default function HistoryKeybinds() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Only the platform command modifier (⌘ on macOS, Ctrl elsewhere).
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      // Don't hijack in-field undo while typing.
      if (isEditableTarget(e.target)) return;

      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) coherentRedo();
        else coherentUndo();
        return;
      }
      // Windows-style redo alias.
      if (key === "y") {
        e.preventDefault();
        coherentRedo();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    // EDITOR-EXP P7 — debug/verification hook so central verification can drive
    // and inspect the timeline without synthesizing key events. Editor-shell
    // code (not subject to INV-13/FP-05). Mirrors the existing
    // __PRISM_EDITOR_*__ debug hooks installed by page.tsx.
    (
      window as unknown as {
        __PRISM_EDITOR_HISTORY__?: {
          undo: () => void;
          redo: () => void;
          jumpBy: (steps: number) => void;
          canUndo: () => boolean;
          canRedo: () => boolean;
          pastCount: () => number;
          futureCount: () => number;
          meta: () => readonly { description: string; timestamp: number }[];
        };
      }
    ).__PRISM_EDITOR_HISTORY__ = {
      undo: coherentUndo,
      redo: coherentRedo,
      jumpBy: coherentJumpBy,
      canUndo,
      canRedo,
      pastCount: () => getTemporalStore().getState().pastStates.length,
      futureCount: () => getTemporalStore().getState().futureStates.length,
      meta: () => getHistoryMeta(),
    };

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      delete (window as unknown as { __PRISM_EDITOR_HISTORY__?: unknown })
        .__PRISM_EDITOR_HISTORY__;
    };
  }, []);

  return null;
}
