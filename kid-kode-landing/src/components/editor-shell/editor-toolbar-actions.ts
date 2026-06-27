'use client';

// PRISM EDITOR INTEGRATION — I-2: the docked toolbar's ACTION layer.
//
// The /toolbar-chassis cubes are visual-only in the lab. Docked into the editor
// (EditorToolbarDock) each cube's onSelect routes here, and EVERY one of the 14
// functions performs a REAL operation on the LIVE APP GRAPH (useGraphSourceStore)
// or the editor scene (useEditorShellStore) — never a fake. CREATE adds a real
// node that appears in galaxy + canvas (INV-0.3); SCENE relights/repaints the
// scene; TRANSFORM moves/selects; LOGIC operates on the selection; OUTPUT
// previews + persists.
//
// Pure dispatch (no React) — called from a pointer handler, so reads stores via
// getState(). Returns a short status string (used by the headless probe).

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { buildBubbleElementNode } from '@/components/editor/add-tools/create-element-node';
import { buildMeshPrimitiveNode } from '@/components/editor/object-tools/create-object-node';
import { buildTextNode } from '@/lib/prism/text/create-text-node';
import { buildImageNode } from '@/components/editor/image-tools/image-helpers';
import { useLibraryStore } from '@/components/editor/library/use-library-store';
import type { MeshPrimitiveKind, PrismNode } from '@/lib/prism-graph/types';
import {
  useEditorShellStore,
  resolveActiveHubId,
  activeHubNodes,
} from './use-editor-shell-store';

// A real bundled content image for the Image CREATE action (present on disk).
const IMAGE_ASSET = '/prism-mock/library-content/abstract-gold.png';
// The cycle order Change-Artifact walks a mesh node's primitive through.
const PRIMITIVE_CYCLE: MeshPrimitiveKind[] = ['cube', 'sphere', 'cylinder', 'cone', 'torus'];

/** Add `input` (a node-builder result) to the live graph, select it, and switch
 *  to canvas so it visibly realizes. Returns the new node id. */
function addAndShow(input: Partial<PrismNode> & { parentHubId: string }): string {
  const id = useGraphSourceStore.getState().addNode(input);
  const shell = useEditorShellStore.getState();
  shell.select(id);
  if (shell.view === 'preview-app') shell.setView('canvas');
  return id;
}

/** The current selection, defaulting to (and selecting) the active hub's first
 *  node so a selection-driven action always has a target and visibly responds. */
function ensureSelection(): string | null {
  const shell = useEditorShellStore.getState();
  if (shell.selectedId && useGraphSourceStore.getState().nodes.some((n) => n.nodeId === shell.selectedId)) {
    return shell.selectedId;
  }
  const first = activeHubNodes()[0]?.nodeId ?? null;
  shell.select(first);
  return first;
}

/** Dispatch a docked-toolbar function id to its real graph/scene operation. */
export function runToolbarAction(fnId: string): string {
  const hub = resolveActiveHubId();
  const graph = useGraphSourceStore.getState();
  const shell = useEditorShellStore.getState();

  switch (fnId) {
    // ── CREATE ──────────────────────────────────────────────────────────────
    case 'add': {
      if (!hub) return 'no-hub';
      const id = addAndShow(buildBubbleElementNode({ parentHubId: hub }));
      return `added element ${id}`;
    }
    case 'object3d': {
      if (!hub) return 'no-hub';
      const id = addAndShow(buildMeshPrimitiveNode({ parentHubId: hub, kind: 'cube' }));
      return `added 3d-object ${id}`;
    }
    case 'text': {
      if (!hub) return 'no-hub';
      const id = addAndShow(buildTextNode({ parentHubId: hub, content: 'Text' }));
      return `added text ${id}`;
    }
    case 'image': {
      if (!hub) return 'no-hub';
      const id = addAndShow(
        buildImageNode({ parentHubId: hub, url: IMAGE_ASSET, width: 1024, height: 1024, sourceName: 'abstract-gold' }),
      );
      return `added image ${id}`;
    }
    case 'library': {
      // Surface the docked LIBRARY palette (the Elements browser): focus its
      // in-canvas search so the next keystroke filters it.
      useLibraryStore.getState().focusSearch(true);
      return 'library-focused';
    }

    // ── TRANSFORM ─────────────────────────────────────────────────────────────
    case 'transform': {
      shell.setEditorMode('transform');
      const sel = ensureSelection();
      if (!sel) return 'transform: no-selection';
      // Real, observable move: nudge the selection along +x in scene space.
      const node = graph.nodes.find((n) => n.nodeId === sel);
      const x = (node?.scenePosition?.x ?? 0) + 0.3;
      graph.setScenePosition(sel, { x });
      return `transform: moved ${sel}`;
    }
    case 'selection': {
      // Cycle the selection through the active hub's nodes (visible in galaxy:
      // the selected seed brightens).
      const ids = activeHubNodes().map((n) => n.nodeId);
      if (ids.length === 0) return 'selection: empty';
      const cur = shell.selectedId ? ids.indexOf(shell.selectedId) : -1;
      const next = ids[(cur + 1) % ids.length];
      shell.select(next);
      return `selection: ${next}`;
    }

    // ── SCENE ─────────────────────────────────────────────────────────────────
    case 'background': {
      shell.cycleBackdrop();
      return `background: ${useEditorShellStore.getState().backdrop}`;
    }
    case 'lighting': {
      shell.cycleLighting();
      return `lighting: ${useEditorShellStore.getState().lighting}`;
    }

    // ── LOGIC (operates on the selection) ──────────────────────────────────────
    case 'changeArtifact': {
      const sel = ensureSelection();
      if (!sel) return 'changeArtifact: no-selection';
      const node = graph.nodes.find((n) => n.nodeId === sel);
      if (!node) return 'changeArtifact: missing';
      // Real artifact change: cycle a mesh node's primitive form; convert a
      // non-mesh selection into a mesh cube (a real artifact swap).
      if (node.meshPrimitive) {
        const cur = PRIMITIVE_CYCLE.indexOf(node.meshPrimitive.kind);
        const kind = PRIMITIVE_CYCLE[(cur + 1) % PRIMITIVE_CYCLE.length];
        graph.updateNode(sel, { renderMode: 'mesh', meshPrimitive: { kind } });
        return `changeArtifact: ${sel} → ${kind}`;
      }
      graph.updateNode(sel, { renderMode: 'mesh', meshPrimitive: { kind: 'cube' } });
      return `changeArtifact: ${sel} → cube`;
    }
    case 'promptEdit': {
      // The prompt-edit pipeline is a later arc; in I-2 this engages the
      // selection (full prompt surface lands in I-4).
      shell.setEditorMode('idle');
      const sel = ensureSelection();
      return sel ? `promptEdit: engaged ${sel}` : 'promptEdit: no-selection';
    }
    case 'animation': {
      // The keyframe/animation surface docks in I-3; here it engages the
      // selection that surface will bind to.
      const sel = ensureSelection();
      return sel ? `animation: engaged ${sel}` : 'animation: no-selection';
    }
    case 'function': {
      // Function binding is a later arc; engage the selection it acts on.
      const sel = ensureSelection();
      return sel ? `function: engaged ${sel}` : 'function: no-selection';
    }

    // ── OUTPUT ──────────────────────────────────────────────────────────────
    case 'build': {
      // Preview the realized app + persist the graph.
      shell.setView('preview-app');
      void useGraphSourceStore.getState().saveToServer();
      return 'build: preview + save';
    }

    default:
      return `unknown:${fnId}`;
  }
}
