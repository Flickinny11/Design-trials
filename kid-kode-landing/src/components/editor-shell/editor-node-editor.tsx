'use client';

// PRISM WORKSPACE COMPLETION — W-1: the IN-ENGINE NODE EDITOR (purpose surface).
//
// Select a node in /editor → this docked glass panel shows that node's PURPOSE —
// its data / meaning, NOT its 3D handles (C2 / anchor F7: no visual-editor mode
// inside the node editor; visual editing stays in canvas). For W-1 the purpose
// surface is the node's:
//   • CAPTION   — intent.caption (the artifact's human name/meaning);
//   • BEHAVIOR  — intent.behaviorSpec (the primary interaction ON→DO + the node's
//                 EMITS / LISTENS event contract);
//   • SCHEMA    — intent.contracts (the node's typed INPUTS / OUTPUTS).
// Each field is an in-engine GlassTextField (keyboard-driven, zero DOM). Every
// commit writes the LIVE app graph via useGraphSourceStore.updateNode, so the
// edit is live + SYNCED to every surface that reads the same store (INV-W8) and
// round-trips through save/reload (C4). Reuses the existing node SCHEMA
// (PrismIntent) + the shared store — only the rendering is rebuilt as glass.
//
// Editor CHROME (not a graph node — no prismEditorNode tag), so the
// node-authorship gate ignores it. Window access is the editor-chrome exemption.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type {
  PrismNode,
  PrismIntent,
  PrismBehaviorSpec,
  PrismContracts,
  PrismInteraction,
} from '@/lib/prism-graph/types';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { GlassTextField, focusField, commitFocusedField, listFields } from './editor-text-field';
import { useNodeEditorStore } from './use-node-editor-store';
import { useEditorShellStore } from './use-editor-shell-store';

// ── string ⇄ model mappings (lossless for the represented subset; the rest of
//    behaviorSpec/contracts is preserved untouched so round-trips stay exact) ──
const EMPTY_BEHAVIOR: PrismBehaviorSpec = {
  interactions: [],
  apiCalls: [],
  dataBindings: [],
  emits: [],
  listens: [],
  triggersDownstream: [],
};
const EMPTY_CONTRACTS: PrismContracts = { inputs: {}, outputs: {} };

function listToCsv(arr: string[] | undefined): string {
  return (arr ?? []).join(', ');
}
function csvToList(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}
function recordToKv(rec: Record<string, string> | undefined): string {
  return Object.entries(rec ?? {})
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
}
function kvToRecord(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of s.split(',')) {
    const t = pair.trim();
    if (!t) continue;
    const i = t.indexOf(':');
    if (i < 0) {
      out[t] = '';
    } else {
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (k) out[k] = v;
    }
  }
  return out;
}

// ── fresh-state writers (never act on a stale closure snapshot) ──────────────
function freshNode(id: string): PrismNode | undefined {
  return useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id);
}
function writeIntent(id: string, patch: Partial<PrismIntent>) {
  const n = freshNode(id);
  if (!n) return;
  useGraphSourceStore.getState().updateNode(id, { intent: { ...n.intent, ...patch } });
}
function writeBehavior(id: string, patch: Partial<PrismBehaviorSpec>) {
  const n = freshNode(id);
  if (!n) return;
  const bs = n.intent.behaviorSpec ?? EMPTY_BEHAVIOR;
  writeIntent(id, { behaviorSpec: { ...EMPTY_BEHAVIOR, ...bs, ...patch } });
}
function writeInteraction0(id: string, patch: Partial<PrismInteraction>) {
  const n = freshNode(id);
  if (!n) return;
  const bs = n.intent.behaviorSpec ?? EMPTY_BEHAVIOR;
  const ix = [...(bs.interactions ?? [])];
  const cur = ix[0] ?? { event: 'click', effect: '' };
  ix[0] = { ...cur, ...patch };
  writeBehavior(id, { interactions: ix });
}
function writeContracts(id: string, patch: Partial<PrismContracts>) {
  const n = freshNode(id);
  if (!n) return;
  const c = n.intent.contracts ?? EMPTY_CONTRACTS;
  writeIntent(id, { contracts: { ...EMPTY_CONTRACTS, ...c, ...patch } });
}

// purpose snapshot (read fresh — used by the headless probe to confirm a commit
// landed on the model without racing React).
function purposeOf(id: string | null) {
  const n = id ? freshNode(id) : undefined;
  if (!n) return null;
  const bs = n.intent.behaviorSpec ?? EMPTY_BEHAVIOR;
  const ix0 = bs.interactions?.[0];
  const c = n.intent.contracts ?? EMPTY_CONTRACTS;
  return {
    nodeId: n.nodeId,
    caption: n.intent.caption ?? '',
    event: ix0?.event ?? '',
    effect: ix0?.effect ?? '',
    emits: bs.emits ?? [],
    listens: bs.listens ?? [],
    inputs: c.inputs ?? {},
    outputs: c.outputs ?? {},
  };
}

// vertical rhythm (content-local; the dock content group is dropped below the
// tab switch). A cursor walks down; each element type advances by its own gap so
// section headers never collide with the field label beneath them.
const SUBTYPE_Y = 3.7;
const CONTENT_TOP = 3.18;
const GAP_HEADER_TO_FIELD = 0.6; // header text → first field below it
const GAP_FIELD_TO_FIELD = 0.9; // field → next field
const GAP_FIELD_TO_HEADER = 0.66; // field → next section header

// headless verification probe (editor chrome). Installed from the ALWAYS-mounted
// EditorInspectorDock (NOT this component, which unmounts on the VISUAL tab) so
// the probe — including setTab — stays available across tab switches. Every fn
// reads getState()/the module registry, so it never holds stale component state.
export function installNodeEditorProbe(): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = window as unknown as Record<string, unknown>;
  w.__PRISM_EDITOR_NODE_EDITOR__ = {
    selectedId: () => useEditorShellStore.getState().selectedId,
    tab: () => useEditorShellStore.getState().inspectorTab,
    setTab: (t: 'node' | 'visual') => useEditorShellStore.getState().setInspectorTab(t),
    fields: () => listFields(),
    focus: (id: string) => focusField(id),
    setBuffer: (s: string) => useNodeEditorStore.getState().setBuffer(s),
    type: (str: string) => {
      for (const ch of str) useNodeEditorStore.getState().type(ch);
    },
    backspace: () => useNodeEditorStore.getState().backspace(),
    commit: () => commitFocusedField(),
    cancel: () => useNodeEditorStore.getState().blur(),
    buffer: () => useNodeEditorStore.getState().buffer,
    focusedId: () => useNodeEditorStore.getState().focusedFieldId,
    // one-call helper: focus a field, replace its text, commit it.
    setField: (id: string, text: string) => {
      focusField(id);
      useNodeEditorStore.getState().setBuffer(text);
      commitFocusedField();
    },
    purpose: () => purposeOf(useEditorShellStore.getState().selectedId),
    // VICE-VERSA sync proof: an external surface (canvas/clone/etc.) writes the
    // caption straight to the shared store; the node editor + the in-canvas label
    // must both reflect it because they read the same store (INV-W8).
    extSetCaption: (id: string, text: string) => writeIntent(id, { caption: text }),
  };
  return () => {
    delete w.__PRISM_EDITOR_NODE_EDITOR__;
  };
}

export function EditorNodeEditor({ position }: { position: [number, number, number] }) {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const node = useGraphSourceStore((s) =>
    selectedId ? s.nodes.find((n) => n.nodeId === selectedId) ?? null : null,
  );

  if (!node) {
    return (
      <group position={position}>
        <CompositeText position={[0, 1.0, 0.3]} fontSize={0.24} variant="engraved">
          SELECT A NODE
        </CompositeText>
        <CompositeText position={[0, 0.55, 0.3]} fontSize={0.12} variant="engraved">
          ITS PURPOSE APPEARS HERE
        </CompositeText>
      </group>
    );
  }

  const id = node.nodeId;
  const bs = node.intent.behaviorSpec ?? EMPTY_BEHAVIOR;
  const ix0 = bs.interactions?.[0];
  const contracts = node.intent.contracts ?? EMPTY_CONTRACTS;

  // walk a cursor down the dock, advancing by the gap appropriate to the
  // previous element so headers never collide with the field below them.
  const els: React.ReactNode[] = [];
  let y = CONTENT_TOP;
  let prev: 'top' | 'header' | 'field' = 'top';
  const pushHeader = (label: string) => {
    if (prev === 'field') y -= GAP_FIELD_TO_HEADER;
    els.push(
      <CompositeText key={'h:' + label} position={[-1.32, y, 0.32]} fontSize={0.135} anchorX="left" variant="bright">
        {label}
      </CompositeText>,
    );
    prev = 'header';
  };
  const pushField = (key: string, label: string, value: string, onCommit: (v: string) => void, tint?: string) => {
    if (prev === 'header') y -= GAP_HEADER_TO_FIELD;
    else if (prev === 'field') y -= GAP_FIELD_TO_FIELD;
    els.push(
      <GlassTextField key={key} id={key} label={label} value={value} onCommit={onCommit} position={[0, y, 0]} width={2.55} tint={tint} />,
    );
    prev = 'field';
  };

  pushHeader('CAPTION');
  pushField('ne:caption', 'NAME', node.intent.caption ?? '', (v) => writeIntent(id, { caption: v }), '#9fd0ff');

  pushHeader('BEHAVIOR');
  pushField('ne:event', 'ON (EVENT)', ix0?.event ?? '', (v) => writeInteraction0(id, { event: v }), '#caa06a');
  pushField('ne:effect', 'DO (EFFECT)', ix0?.effect ?? '', (v) => writeInteraction0(id, { effect: v }), '#caa06a');
  pushField('ne:emits', 'EMITS', listToCsv(bs.emits), (v) => writeBehavior(id, { emits: csvToList(v) }), '#caa06a');
  pushField('ne:listens', 'LISTENS', listToCsv(bs.listens), (v) => writeBehavior(id, { listens: csvToList(v) }), '#caa06a');

  pushHeader('SCHEMA');
  pushField('ne:inputs', 'INPUTS (k:type)', recordToKv(contracts.inputs), (v) => writeContracts(id, { inputs: kvToRecord(v) }), '#9fe7c4');
  pushField('ne:outputs', 'OUTPUTS (k:type)', recordToKv(contracts.outputs), (v) => writeContracts(id, { outputs: kvToRecord(v) }), '#9fe7c4');

  return (
    <group position={position}>
      {/* node identity — the subtype (the caption is the editable NAME field below) */}
      <CompositeText position={[0, SUBTYPE_Y, 0.32]} fontSize={0.12} variant="engraved">
        {(node.subtype ?? 'NODE').toString().toUpperCase().slice(0, 26)}
      </CompositeText>
      {els}
    </group>
  );
}

// ── the in-canvas SYNC proof (INV-W8) ────────────────────────────────────────
// A bright MSDF caption floating above the SELECTED node in canvas, reading the
// node's LIVE caption from the SAME shared store the node editor writes. Editing
// the CAPTION field in the node editor updates this label in the canvas (and any
// external change to the caption updates both) — one store, every surface reads
// it. Scene-level + immune to the FitGroup scale (tracks the node's world bbox
// each frame, like SelectionOverlay). Editor CHROME — NOT tagged prismEditorNode.
function nodeGroupsMap(): Map<string, THREE.Object3D> | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D> };
  return w.__PRISM_EDITOR_NODE_GROUPS__ ?? null;
}

export function SelectedCaptionLabel() {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const view = useEditorShellStore((s) => s.view);
  const caption = useGraphSourceStore((s) => {
    const n = selectedId ? s.nodes.find((x) => x.nodeId === selectedId) : null;
    return n?.intent?.caption ?? '';
  });
  const groupRef = useRef<THREE.Group>(null);
  const box = useMemo(() => new THREE.Box3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const size = useMemo(() => new THREE.Vector3(), []);
  const text = caption.trim().slice(0, 30) || '(unnamed)';

  // publish the label state for the headless sync proof (editor chrome).
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__PRISM_EDITOR_CAPTION_LABEL__ = () => {
      const g = groupRef.current;
      return {
        selectedId: useEditorShellStore.getState().selectedId,
        view: useEditorShellStore.getState().view,
        caption,
        visible: !!g?.visible,
      };
    };
  }

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const map = nodeGroupsMap();
    const target = selectedId && view === 'canvas' ? map?.get(selectedId) : null;
    if (!target || !target.parent || !caption.trim()) {
      g.visible = false;
      return;
    }
    box.setFromObject(target, true);
    if (box.isEmpty()) {
      g.visible = false;
      return;
    }
    box.getCenter(center);
    box.getSize(size);
    g.visible = true;
    g.position.set(center.x, center.y + Math.max(size.y, 0.3) / 2 + 0.5, center.z);
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={22}>
      <CompositeText fontSize={0.42} variant="bright">
        {text}
      </CompositeText>
    </group>
  );
}
