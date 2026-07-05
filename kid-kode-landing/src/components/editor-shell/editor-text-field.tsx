'use client';

// PRISM WORKSPACE COMPLETION — W-1: the in-engine GLASS TEXT FIELD.
//
// A reusable, keyboard-driven, ZERO-DOM editable text field rendered entirely in
// the WebGPU canvas — the missing primitive the workspace needs so a node's
// PURPOSE (caption / behavior / schema) is editable in-engine, not in DOM. It
// generalizes the founder-approved MaterialPromptPanel idiom:
//   • a milled dark SLOT inset on the dock glass + an engraved MSDF label;
//   • click the slot to FOCUS it (sets the single focused-field id in
//     use-node-editor-store); a blinking worn caret marks the insertion point;
//   • a single window-keydown listener (NodeEditorKeyboard) appends printable
//     keys / Backspace, and Enter COMMITS / Escape CANCELS;
//   • COMMIT calls the field's own `onCommit`, which writes the live app graph
//     (useGraphSourceStore.updateNode) — so the edit is live + synced (INV-W8).
//
// ZERO DOM/CSS — MSDF text + R3F meshes only. Window access here is the same
// editor-chrome verification/keyboard exemption every editor-shell piece uses;
// these are NOT graph nodes (no prismEditorNode tag), so the authorship gate
// ignores them.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useNodeEditorStore } from './use-node-editor-store';

// ── field registry (module-level): id → { commit, current value, world pos } ──
// Lets the single keyboard listener commit the focused field, and the headless
// probe resolve each field's value + world center without prop-drilling.
interface FieldEntry {
  onCommit: (v: string) => void;
  getValue: () => string;
  getWorld: () => [number, number, number];
  label: string;
  /** Search-style fields seed an EMPTY buffer on focus (fresh entry) instead of
   *  the current value, so clicking + typing starts a new query/name. */
  seedEmpty?: boolean;
}
const fieldRegistry = new Map<string, FieldEntry>();

/** Commit the currently-focused field's buffer through its onCommit, then blur.
 *  Used by Enter, by click-away, and before focusing a different field (so an
 *  in-progress edit is never silently lost). */
export function commitFocusedField(): void {
  const st = useNodeEditorStore.getState();
  const id = st.focusedFieldId;
  if (!id) return;
  const entry = fieldRegistry.get(id);
  const buf = st.buffer;
  st.blur();
  if (entry) entry.onCommit(buf);
}

/** Focus a field, committing whatever was being edited first. */
export function focusField(id: string): void {
  const entry = fieldRegistry.get(id);
  if (!entry) return;
  commitFocusedField();
  useNodeEditorStore.getState().beginEdit(id, entry.seedEmpty ? '' : entry.getValue());
}

/** Snapshot of all live fields for the headless verification pass. */
export function listFields() {
  return Array.from(fieldRegistry.entries()).map(([id, e]) => ({
    id,
    label: e.label,
    value: e.getValue(),
    world: e.getWorld(),
  }));
}

const SLOT_DEPTH = 0.08;

/** One editable glass text field. `value` is the live model value; `onCommit`
 *  writes it back. `id` is stable + unique (used for focus + the probe). */
export function GlassTextField({
  id,
  label,
  value,
  onCommit,
  position,
  width = 2.5,
  height = 0.4,
  placeholder = '—',
  tint = '#9fd0ff',
  seedEmpty = false,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (v: string) => void;
  position: [number, number, number];
  width?: number;
  height?: number;
  placeholder?: string;
  tint?: string;
  seedEmpty?: boolean;
}) {
  const focused = useNodeEditorStore((s) => s.focusedFieldId === id);
  const buffer = useNodeEditorStore((s) => s.buffer);
  const slotRef = useRef<THREE.Mesh>(null);
  const caret = useRef(true);

  // keep the registry entry fresh without re-registering each render: refs hold
  // the latest value/commit/position so the keyboard listener + probe see current
  // data. CRITICAL: the registration effect must NOT depend on `position` (a new
  // array literal each render) — otherwise a parent re-render mid-typing (e.g. a
  // live search updating results) tears the field down + re-registers it, which
  // BLURS the focused field and drops keystrokes. Register once; read via refs.
  const valueRef = useRef(value);
  const commitRef = useRef(onCommit);
  const positionRef = useRef(position);
  valueRef.current = value;
  commitRef.current = onCommit;
  positionRef.current = position;

  useEffect(() => {
    fieldRegistry.set(id, {
      onCommit: (v) => commitRef.current(v),
      getValue: () => valueRef.current ?? '',
      getWorld: () => {
        const m = slotRef.current;
        if (!m) return positionRef.current;
        const v = new THREE.Vector3();
        m.getWorldPosition(v);
        return [v.x, v.y, v.z];
      },
      label,
      seedEmpty,
    });
    return () => {
      // if this field is unmounting while focused, drop focus cleanly.
      if (useNodeEditorStore.getState().focusedFieldId === id) useNodeEditorStore.getState().blur();
      fieldRegistry.delete(id);
    };
  }, [id, label, seedEmpty]);

  // caret blink (only matters while focused).
  useFrame((state) => {
    caret.current = Math.floor(state.clock.elapsedTime * 1.8) % 2 === 0;
  });

  const shown = focused ? buffer : value;
  const display = (shown || (focused ? '' : placeholder)) + (focused && caret.current ? '|' : '');

  return (
    <group position={position}>
      {/* engraved field label, just above-left of the slot */}
      <CompositeText position={[-width / 2, height / 2 + 0.075, 0.34]} fontSize={0.1} anchorX="left" variant="engraved">
        {label}
      </CompositeText>

      {/* the focusable milled slot */}
      <mesh
        ref={slotRef}
        position={[0, 0, 0.18]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          focusField(id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (typeof document !== 'undefined') document.body.style.cursor = 'text';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          if (typeof document !== 'undefined') document.body.style.cursor = '';
        }}
      >
        <boxGeometry args={[width, height, SLOT_DEPTH]} />
        <meshStandardMaterial
          color={focused ? '#1b2a3e' : '#0f151f'}
          emissive={focused ? new THREE.Color(tint).multiplyScalar(0.16) : new THREE.Color('#05070c')}
          roughness={0.5}
          metalness={0.25}
        />
      </mesh>
      {/* a thin lit rim when focused (so the active field reads clearly) */}
      {focused && (
        <mesh position={[0, 0, 0.135]}>
          <boxGeometry args={[width + 0.07, height + 0.07, 0.04]} />
          <meshBasicMaterial color={tint} toneMapped={false} transparent opacity={0.5} />
        </mesh>
      )}

      {/* the live value / edit buffer (bright while focused) */}
      <CompositeText
        position={[-width / 2 + 0.12, 0, 0.24]}
        fontSize={0.135}
        anchorX="left"
        variant={focused ? 'bright' : 'engraved'}
      >
        {(display || ' ').slice(0, 64)}
      </CompositeText>
    </group>
  );
}

/** The single window-keydown listener for the docked node editor. Mount it ONCE
 *  inside the node-editor dock. While a GlassTextField is focused it captures
 *  printable keys / Backspace / Enter (commit) / Escape (cancel). Editor chrome. */
export function NodeEditorKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useNodeEditorStore.getState();
      if (!st.focusedFieldId) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        commitFocusedField();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        st.blur();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        st.backspace();
      } else if (e.key.length === 1) {
        e.preventDefault();
        st.type(e.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
