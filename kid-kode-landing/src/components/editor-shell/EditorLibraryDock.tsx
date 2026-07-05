'use client';

// PRISM EDITOR INTEGRATION — I-2: the REAL library palette, DOCKED.
//
// The committed /library palette (the P-6 browse + search + LIVE-preview shelf)
// mounted into the editor's left dock zone — LITERALLY LibraryPalette + DragGhost.
// It matches the approved glass look by construction (it IS that palette). Two
// editor adaptations (both additive, lab untouched):
//   • the palette is wrapped in a fitted group so it sits in the left margin (the
//     lab route gives it the whole left half);
//   • the drag-to-canvas DROP is redirected — via DragGhost's onCanvasDrop — into
//     the REAL app graph (editor-library-actions), so a dragged primitive /
//     material / fluid / composite becomes a genuine node in galaxy + canvas
//     (INV-0.3), not a library-local instance.
//
// The library scene-globals (StudioEnv / Backdrop / lights / NodeLayer / Inspector)
// are deliberately NOT mounted — the editor scene supplies its own env + lights,
// and the dropped nodes realize through EditorGraphViewport.
//
// Editor CHROME (not a graph node) — the palette is NOT tagged prismEditorNode, so
// the node-authorship gate ignores it; only the dropped graph nodes are counted.

import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { LibraryPalette } from '@/components/editor/library/LibraryPalette';
import { DragGhost } from '@/components/editor/library/DragGhost';
import { useLibraryStore } from '@/components/editor/library/use-library-store';
import type { LibraryEntry } from '@/components/editor/library/library-catalog';
import { useMaterialMapSets } from '@/components/editor/material/material-build';
import { instantiateLibraryEntryIntoGraph } from './editor-library-actions';

// Fit the palette (≈6 × 12.6u) into the left margin, clear of the centered
// viewport content and between the toolbar (top) and keyframes (bottom) docks.
const PALETTE_POS: [number, number, number] = [-9.0, 0.2, 0.8];
const PALETTE_SCALE = 0.7;

// Window-keystroke capture for the in-canvas search bar (zero DOM input — the
// MaterialPromptPanel idiom, same listener the lab scene uses; reads the shared
// library store so the docked LibrarySearchBar's focus drives it).
function LibrarySearchKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useLibraryStore.getState();
      if (!st.searchFocused) return;
      if (e.key === 'Escape' || e.key === 'Enter') { st.focusSearch(false); e.preventDefault(); return; }
      if (e.key === 'Backspace') { st.backspaceSearch(); e.preventDefault(); return; }
      if (e.key.length === 1 && /[\w \-.]/.test(e.key)) { st.typeSearch(e.key); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}

/** Headless-verification probes (editor chrome — window exemption). Resolve tile
 *  world centers for a trusted-pointer drag, expose the library browse store, and
 *  a deterministic drop-into-graph helper. */
function LibraryDockProbe() {
  const scene = useThree((s) => s.scene);
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_EDITOR_LIBRARY_STORE__ = () => useLibraryStore.getState();
    w.__PRISM_EDITOR_LIBRARY_TILES__ = () => {
      const out: { entryId: string; world: [number, number, number] }[] = [];
      const v = new THREE.Vector3();
      scene.traverse((o) => {
        if (o.userData?.prismLibTile) {
          o.getWorldPosition(v);
          out.push({ entryId: o.userData.prismLibTile as string, world: [v.x, v.y, v.z] });
        }
      });
      return out;
    };
    w.__PRISM_EDITOR_LIBRARY_DROP__ = (entryId: string) => {
      const entry = useLibraryStore.getState().catalog().find((e) => e.id === entryId);
      if (!entry) return [];
      return instantiateLibraryEntryIntoGraph(entry);
    };
  }
  return null;
}

const onCanvasDrop = (entry: LibraryEntry) => {
  instantiateLibraryEntryIntoGraph(entry);
};

export function EditorLibraryDock() {
  const matSets = useMaterialMapSets();
  const hubs = useLibraryStore((s) => s.hubs);
  return (
    <group>
      {/* the REAL palette, fitted into the left dock margin */}
      <group position={PALETTE_POS} scale={PALETTE_SCALE}>
        <LibraryPalette position={[0, 0, 0]} matSets={matSets} hubs={hubs} />
      </group>

      {/* the drag-ghost runs at world scale (it tracks the pointer in world space);
          a valid drop routes into the REAL app graph. */}
      <DragGhost matSets={matSets} hubs={hubs} onCanvasDrop={onCanvasDrop} />

      <LibrarySearchKeys />
      <LibraryDockProbe />
    </group>
  );
}
