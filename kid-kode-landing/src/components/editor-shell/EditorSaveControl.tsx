'use client';

// PRISM EDITOR INTEGRATION — I-4: the PERSIST control (save / load round-trip).
//
// The graph already persists itself: every useGraphSourceStore mutator flips
// `isDirty` and schedules a debounced autosave that POSTs the full graph to
// /api/prism/regen (which writes public/prism-mock/home/live-graph.json — the
// exact file the editor boots from). I-4 surfaces that persistence as a real,
// visible affordance: a worn-alloy SAVE button (the founder chassis vocabulary)
// plus a status pip that reads the live dirty/saved state — amber while there are
// unsaved edits, green once the server has confirmed the write. Clicking SAVE
// flushes immediately. Reloading the route restores the exact saved graph (the
// eager boot load reads the same file), so an edit → save → reload round-trips.
//
// Editor CHROME (no graph node) — not tagged prismEditorNode, so the
// node-authorship gate ignores it. ZERO DOM (R3F + MSDF only).

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useWornMaps } from '@/components/editor/chassis/materials';
import { CompositeChip } from '@/components/editor/composite/CompositeChip';
import { CompositeText } from '@/components/editor/composite/CompositeText';

// Top band, just right of the GALAXY/CANVAS/PREVIEW switch (same plane).
const CTRL_POS: [number, number, number] = [7.4, 4.55, 1.35];

const PIP_GEO = new THREE.SphereGeometry(0.12, 20, 16);

/** A small emissive pip: amber while the graph has unsaved edits, green once the
 *  last save was confirmed by the server (savedAt set + not dirty). */
function StatusPip({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ toneMapped: false });
    if (dirty) {
      m.color = new THREE.Color('#caa06a');
      m.emissive = new THREE.Color('#c98a2a');
      m.emissiveIntensity = 0.9;
    } else if (saved) {
      m.color = new THREE.Color('#8fe0b0');
      m.emissive = new THREE.Color('#2f9a64');
      m.emissiveIntensity = 0.85;
    } else {
      m.color = new THREE.Color('#5a6675');
      m.emissive = new THREE.Color('#0a0e14');
      m.emissiveIntensity = 0;
    }
    return m;
  }, [dirty, saved]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <mesh geometry={PIP_GEO} material={mat} position={[0.92, 0.34, 0.1]} />;
}

export function EditorSaveControl() {
  const isDirty = useGraphSourceStore((s) => s.isDirty);
  const savedAt = useGraphSourceStore((s) => s.savedAt);
  const maps = useWornMaps();
  const bronze = maps['bronze'];

  // ── persist probes (editor chrome — headless round-trip proof) ──────────────
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    // current persistence state.
    w.__PRISM_EDITOR_PERSIST__ = () => {
      const s = useGraphSourceStore.getState();
      return {
        isDirty: s.isDirty,
        savedAt: s.savedAt,
        nodeCount: s.nodes.length,
        hubCount: s.hubs.length,
        edgeCount: s.edges.length,
      };
    };
    // flush a save now; resolves with the server result.
    w.__PRISM_EDITOR_SAVE__ = async () => useGraphSourceStore.getState().saveToServer();
    // a compact, order-independent snapshot of the durable graph, so a headless
    // pass can diff "before save" vs "after reload" and prove an exact round-trip.
    w.__PRISM_EDITOR_GRAPH_SNAPSHOT__ = () => {
      const s = useGraphSourceStore.getState();
      const nodes = s.nodes
        .map((n) => {
          const sp = n.scenePosition;
          return [
            n.nodeId,
            n.subtype,
            n.parentHubId,
            n.parentNodeId ?? '',
            n.globalSlot ?? '',
            n.meshPrimitive?.kind ?? '',
            n.materialSpec?.baseColor ?? '',
            (n.keyframes?.length ?? 0),
            sp ? `${(sp.x ?? 0).toFixed(3)},${(sp.y ?? 0).toFixed(3)},${(sp.z ?? 0).toFixed(3)}` : '',
            sp ? `${(sp.scaleX ?? 1).toFixed(3)}` : '',
          ].join('§');
        })
        .sort();
      const edges = s.edges.map((e) => `${e.from}->${e.to}`).sort();
      return { nodeCount: s.nodes.length, edgeCount: s.edges.length, nodes, edges };
    };
  }

  if (!bronze) return null;
  const saved = !isDirty && !!savedAt;

  return (
    <group position={CTRL_POS}>
      <CompositeChip
        maps={bronze}
        position={[0, 0, 0]}
        size={0.62}
        tint={isDirty ? '#caa06a' : '#9fb0c4'}
        label="SAVE"
        labelVariant="bright"
        onClick={() => { void useGraphSourceStore.getState().saveToServer(); }}
      />
      <StatusPip dirty={isDirty} saved={saved} />
      <CompositeText position={[0.92, 0.06, 0.1]} fontSize={0.11} variant="engraved">
        {isDirty ? 'UNSAVED' : saved ? 'SAVED' : 'READY'}
      </CompositeText>
    </group>
  );
}
