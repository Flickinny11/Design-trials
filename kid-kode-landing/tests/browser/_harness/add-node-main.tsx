// HL13 — Add Node UI harness entrypoint.
//
// Mounts React + the real `AddNodeDialog` component plus a trigger button
// carrying `data-component="add-node-button"` (the same selector the
// production TopBar wires) against the real `useGraphSourceStore` and
// `useGraphEditorStore`. The harness seeds the store with the canonical
// 6-node home-hub live-graph fixture so the dialog's hub dropdown renders
// real options. A `<pre id="readout">` reflects the live nodes count + the
// most-recent node's parentHubId / intent.caption / subtype, so Playwright
// can assert that submission produced exactly one new node with the
// user-supplied fields.
//
// This is intentionally tighter than booting the full editor: we exercise
// the dialog's real wiring (open state + addNode mutator) without the R3F
// canvas. KripVerify's HL13 kvAssert covers the production-canvas integration.

import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import liveGraph from '../../../public/prism-mock/home/live-graph.json' with { type: 'json' };
import AddNodeDialog from '../../../src/components/editor/overlays/AddNodeDialog';
import { useGraphSourceStore } from '../../../src/stores/useGraphSourceStore';
import { useGraphEditorStore } from '../../../src/stores/useGraphEditorStore';
import type { HomeHubJson } from '../../../src/lib/prism-graph/types';

declare global {
  interface Window {
    __hl13Readout?: unknown;
  }
}

function Harness() {
  const nodes = useGraphSourceStore((s) => s.nodes);
  const openAddNodeDialog = useGraphEditorStore((s) => s.openAddNodeDialog);

  const last = nodes[nodes.length - 1];
  const readout = {
    nodesCount: nodes.length,
    lastNodeId: last?.nodeId ?? null,
    lastNodeParentHubId: last?.parentHubId ?? null,
    lastNodeCaption: last?.intent?.caption ?? null,
    lastNodeSubtype: last?.subtype ?? null,
  };

  useEffect(() => {
    window.__hl13Readout = readout;
    const pre = document.getElementById('readout');
    if (pre) pre.textContent = JSON.stringify(readout, null, 2);
    if (!document.body.hasAttribute('data-hl13-ready')) {
      document.body.setAttribute('data-hl13-ready', '1');
    }
  }, [readout.nodesCount, readout.lastNodeId]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 14, marginBottom: 8 }}>HL13 — Add Node UI harness</h1>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
        TopBar trigger + AddNodeDialog mounted against the real stores.
      </p>
      <button
        data-component="add-node-button"
        type="button"
        onClick={openAddNodeDialog}
        style={{
          padding: '6px 14px',
          background: '#5d8bff',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 12,
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        + Add Node
      </button>
      <pre
        id="readout"
        style={{
          background: '#0a0c14',
          color: '#cfd6e8',
          padding: 12,
          borderRadius: 6,
          fontSize: 11,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          margin: 0,
        }}
      >
        {'{}'}
      </pre>
      <AddNodeDialog />
    </div>
  );
}

function main() {
  // Seed both stores with the canonical fixture so the hub dropdown has
  // options and the readout starts at the post-load count.
  useGraphSourceStore.getState().load(liveGraph as unknown as HomeHubJson);
  useGraphEditorStore.setState({ activeHubId: (liveGraph as { hub?: { hubId?: string } }).hub?.hubId ?? null });
  // Make absolutely sure the dialog starts closed (Vitest leak guard).
  useGraphEditorStore.getState().closeAddNodeDialog();

  const container = document.getElementById('root');
  if (!container) throw new Error('#root not found');
  createRoot(container).render(<Harness />);
}

try {
  main();
} catch (err) {
  console.error('[HL13 harness] failed:', err);
  const pre = document.getElementById('readout');
  if (pre) pre.textContent = JSON.stringify({ error: String(err) });
  document.body.setAttribute('data-hl13-ready', '1');
}
