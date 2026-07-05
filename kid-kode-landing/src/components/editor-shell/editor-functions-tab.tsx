'use client';

// PRISM WORKSPACE COMPLETION — W-2 FUNCTIONS section (criteria D1/D2/D4/D5).
//
// CAPABILITY-FIRST: the user types what they want to DO ("send email", "charge a
// card", "store signups") into a glass search field; the catalog (the active
// CapabilityProvider — MCP reference offline, Nango when keyed) returns branded
// action TILES (the provider's REAL mark). Click — or DRAG — a tile onto the
// node to attach it; multiple per node, REORDERABLE (▲▼), detach (✕), each
// validated on select (a status pip + badge) with auto-fix surfaced. Save / name
// reusable custom SNIPPETS, reusable across builds. Every attach/detach/reorder
// writes the LIVE app graph (functionTiles) via the capability store, which
// schedules the durable autosave → round-trips through save/reload (INV-W5).
// ZERO DOM. Editor CHROME.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useEditorShellStore } from './use-editor-shell-store';
import { useNodeEditorStore } from './use-node-editor-store';
import { GlassTextField } from './editor-text-field';
import { BrandTile } from './editor-brand-tile';
import { useCapabilityStore } from './use-capability-store';
import type { FunctionTileValidationStatus } from '@/lib/prism-graph/types';

const MAX_RESULTS = 4;
const MAX_ATTACHED = 4;
const ROW_H = 0.42;

function pipFor(s?: FunctionTileValidationStatus): string {
  switch (s) {
    case 'valid': return '#5fce8e';
    case 'fixed': return '#9ed27a';
    case 'broken': return '#e0795f';
    case 'validating': return '#d9b878';
    default: return '#5a6675';
  }
}
function badgeFor(s?: FunctionTileValidationStatus): string {
  return s === 'valid' ? 'VALID' : s === 'fixed' ? 'AUTO-FIXED' : s === 'broken' ? 'BROKEN' : s === 'validating' ? 'TESTING' : 'UNTESTED';
}

// ── a tiny clickable worn control (▲ / ▼ / ✕), pure geometry symbol (no font) ──
function MiniButton({
  position,
  kind,
  tint = '#cdd6e2',
  onClick,
}: {
  position: [number, number, number];
  kind: 'up' | 'down' | 'x';
  tint?: string;
  onClick: () => void;
}) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#10161f', emissive: new THREE.Color(tint).multiplyScalar(0.05), roughness: 0.55, metalness: 0.3 }),
    [tint],
  );
  const sym = useMemo(() => new THREE.MeshBasicMaterial({ color: tint, toneMapped: false }), [tint]);
  return (
    <group position={position}>
      <mesh material={mat} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}>
        <boxGeometry args={[0.18, 0.18, 0.06]} />
      </mesh>
      {kind === 'x' ? (
        <group position={[0, 0, 0.05]} rotation={[0, 0, Math.PI / 4]}>
          <mesh material={sym}><boxGeometry args={[0.11, 0.022, 0.01]} /></mesh>
          <mesh material={sym}><boxGeometry args={[0.022, 0.11, 0.01]} /></mesh>
        </group>
      ) : (
        <mesh material={sym} position={[0, 0, 0.05]} rotation={[0, 0, kind === 'down' ? Math.PI : 0]}>
          <coneGeometry args={[0.05, 0.07, 3]} />
        </mesh>
      )}
    </group>
  );
}

export function EditorFunctionsTab({ position }: { position: [number, number, number] }) {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const results = useCapabilityStore((s) => s.fnResults);
  const live = useCapabilityStore((s) => s.fnLive);
  const fnQuery = useCapabilityStore((s) => s.fnQuery);
  const snippets = useCapabilityStore((s) => s.snippets);
  const focusedFieldId = useNodeEditorStore((s) => s.focusedFieldId);
  const buffer = useNodeEditorStore((s) => s.buffer);

  // live attached tiles (reorderable) — read the count to subscribe, resolve order below.
  const tiles = useGraphSourceStore((s) => {
    const n = selectedId ? s.nodes.find((x) => x.nodeId === selectedId) : null;
    return n?.functionTiles ?? EMPTY;
  });
  const ordered = useMemo(() => tiles.slice().sort((a, b) => a.order - b.order), [tiles]);

  // initial catalog load (empty query → the whole catalog, capability-first).
  useEffect(() => {
    if (results.length === 0) void useCapabilityStore.getState().searchActions('');
    void useCapabilityStore.getState().loadSnippets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live search while the search field is focused — runs on each buffer change
  // (the catalog query is local + cheap, and the store's monotonic search token
  // guarantees the latest query's result wins regardless of network order). A
  // timer-debounce proved unreliable under the R3F render loop in headless
  // verification (background-tab timer throttling); an immediate local search
  // reads instantly, so debouncing buys nothing here. Enter also commits a search.
  const lastSearched = useRef<string | null>(null);
  useEffect(() => {
    if (focusedFieldId !== 'cap:fn-search') return;
    if (lastSearched.current === buffer) return;
    lastSearched.current = buffer;
    void useCapabilityStore.getState().searchActions(buffer);
  }, [buffer, focusedFieldId]);

  // ── drag-to-attach ──────────────────────────────────────────────────────────
  const [drag, setDrag] = useState<{ label: string; brandKey: string } | null>(null);
  const dragData = useRef<{ actionId: string; brandKey: string; label: string; platform: string } | null>(null);
  const ghostRef = useRef<THREE.Group>(null);
  const ptr = useRef(new THREE.Vector3());
  useFrame(() => {
    if (ghostRef.current && drag) ghostRef.current.position.lerp(ptr.current, 0.5);
  });
  const beginDrag = (d: { actionId: string; brandKey: string; label: string; platform: string }) => {
    dragData.current = d;
    setDrag({ label: d.label, brandKey: d.brandKey });
  };
  const endDrag = (overDrop: boolean) => {
    if (overDrop && dragData.current) void useCapabilityStore.getState().attachFunctionTile(dragData.current);
    dragData.current = null;
    setDrag(null);
  };

  const attach = (d: { actionId: string; brandKey: string; label: string; platform: string }) =>
    void useCapabilityStore.getState().attachFunctionTile(d);

  const overflowResults = Math.max(0, results.length - MAX_RESULTS);
  const overflowAttached = Math.max(0, ordered.length - MAX_ATTACHED);

  return (
    <group position={position}>
      {/* search field (capability-first) */}
      <GlassTextField
        id="cap:fn-search"
        label="WHAT DO YOU WANT TO DO?"
        value={fnQuery}
        onCommit={(v) => void useCapabilityStore.getState().searchActions(v)}
        position={[0, 3.05, 0]}
        width={2.55}
        tint="#caa06a"
        placeholder="send email · charge a card · store signups…"
        seedEmpty
      />
      <CompositeText position={[1.18, 3.34, 0.32]} fontSize={0.062} anchorX="right" variant="engraved">
        {live ? 'LIVE' : 'CATALOG'}
      </CompositeText>

      {/* results (branded tiles) */}
      <CompositeText position={[-1.3, 2.62, 0.32]} fontSize={0.082} anchorX="left" variant="bright">
        RESULTS
      </CompositeText>
      {results.slice(0, MAX_RESULTS).map((r, i) => (
        <BrandTile
          key={r.actionId}
          data={{ brandKey: r.brandKey, label: r.label, subtitle: `${r.platform}${r.category ? ' · ' + r.category : ''}` }}
          position={[0, 2.28 - i * ROW_H, 0]}
          width={2.5}
          onClick={() => attach({ actionId: r.actionId, brandKey: r.brandKey, label: r.label, platform: r.platform })}
          onPointerDown={() => beginDrag({ actionId: r.actionId, brandKey: r.brandKey, label: r.label, platform: r.platform })}
        />
      ))}
      {overflowResults > 0 && (
        <CompositeText position={[0, 2.28 - MAX_RESULTS * ROW_H + 0.04, 0.32]} fontSize={0.06} variant="engraved">
          {`+${overflowResults} more — refine the search`}
        </CompositeText>
      )}

      {/* attached drop-zone + reorderable list */}
      <mesh
        position={[0, -0.62, 0.02]}
        userData={{ prismFnDropZone: true }}
        onPointerUp={(e) => { e.stopPropagation(); if (drag) endDrag(true); }}
      >
        <planeGeometry args={[2.7, 2.0]} />
        <meshBasicMaterial color={drag ? '#1a2740' : '#0a0f17'} transparent opacity={drag ? 0.5 : 0.18} />
      </mesh>
      <CompositeText position={[-1.3, 0.28, 0.32]} fontSize={0.082} anchorX="left" variant="bright">
        {`ATTACHED (${ordered.length})`}
      </CompositeText>
      {ordered.length === 0 && (
        <CompositeText position={[0, -0.05, 0.32]} fontSize={0.066} variant="engraved">
          CLICK OR DRAG AN ACTION TO ATTACH
        </CompositeText>
      )}
      {ordered.slice(0, MAX_ATTACHED).map((t, i) => {
        const y = -0.02 - i * ROW_H;
        return (
          <group key={t.id}>
            <BrandTile
              data={{ brandKey: t.brandKey, label: `${i + 1}. ${t.label}`, subtitle: `${t.platform} · ${badgeFor(t.validation?.status)}` }}
              position={[-0.22, y, 0]}
              width={2.0}
              pip={pipFor(t.validation?.status)}
              onClick={() => void useCapabilityStore.getState().validateFunctionTile(t.id)}
            />
            <MiniButton position={[0.96, y + 0.085, 0.2]} kind="up" onClick={() => useCapabilityStore.getState().reorderFunctionTile(t.id, -1)} />
            <MiniButton position={[0.96, y - 0.095, 0.2]} kind="down" onClick={() => useCapabilityStore.getState().reorderFunctionTile(t.id, 1)} />
            <MiniButton position={[1.22, y, 0.2]} kind="x" tint="#e0795f" onClick={() => useCapabilityStore.getState().detachFunctionTile(t.id)} />
          </group>
        );
      })}
      {overflowAttached > 0 && (
        <CompositeText position={[0, -0.02 - MAX_ATTACHED * ROW_H, 0.32]} fontSize={0.058} variant="engraved">
          {`+${overflowAttached} more attached`}
        </CompositeText>
      )}

      {/* snippets (D5) */}
      <CompositeText position={[-1.3, -1.92, 0.32]} fontSize={0.078} anchorX="left" variant="bright">
        MY SNIPPETS
      </CompositeText>
      <GlassTextField
        id="cap:fn-snippet"
        label="NAME A REUSABLE SNIPPET"
        value=""
        onCommit={(v) => { if (v.trim()) void useCapabilityStore.getState().saveSnippet(v); }}
        position={[0, -2.22, 0]}
        width={2.55}
        tint="#9ed27a"
        placeholder="e.g. charge-pro-plan…"
      />
      {snippets.slice(0, 3).map((s, i) => (
        <BrandTile
          key={s.id}
          data={{ brandKey: s.brandKey, label: s.name, subtitle: `${s.platform} · SNIPPET` }}
          position={[0, -2.6 - i * ROW_H, 0]}
          width={2.5}
          dim
          onClick={() => void useCapabilityStore.getState().attachFunctionTile({ actionId: s.actionId, brandKey: s.brandKey, label: s.label, platform: s.platform, providerId: s.providerId, source: 'snippet', snippetId: s.id })}
        />
      ))}

      {/* drag ghost */}
      {drag && (
        <group ref={ghostRef} position={[0, 0, 0.6]}>
          <BrandTile data={{ brandKey: drag.brandKey, label: drag.label }} position={[0, 0, 0]} width={2.0} highlight />
        </group>
      )}
      {/* while dragging, a catcher behind the drop-zone tracks the pointer + cancels on release */}
      {drag && (
        <mesh
          position={[0, 0, -0.2]}
          onPointerMove={(e) => { ptr.current.copy(e.point); }}
          onPointerUp={(e) => { e.stopPropagation(); endDrag(false); }}
        >
          <planeGeometry args={[40, 30]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

const EMPTY: never[] = [];
