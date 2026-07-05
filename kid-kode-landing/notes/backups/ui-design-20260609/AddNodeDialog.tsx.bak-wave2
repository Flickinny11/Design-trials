'use client';

// HL13 — Add Node UI (Plan §P13).
//
// A modal dialog that lets the editor author a Stage-0 (intent-only) node:
// the user picks a parent hub, types a 1–2 sentence caption, and (optionally)
// overrides the subtype (default "element"). On submit the dialog calls
// useGraphSourceStore.addNode({ parentHubId, intent: { caption }, subtype })
// and closes itself. Per Plan §P13 the new node has no artifact data — the
// editor renders it as the GlassNode sphere fallback (HL10 delegation), and
// the preview pane shows nothing for that node (correct per Stage 0).
//
// Open/close state is owned by useGraphEditorStore (addNodeDialogOpen +
// openAddNodeDialog/closeAddNodeDialog) so the TopBar "+ Add Node" button
// can drive it without prop-drilling.
//
// data-* attributes carry the contract surface the Playwright spec
// (tests/browser/add-node.spec.ts) and KripVerify (HL13 kvAssert) drive.

import { useEffect, useMemo, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';

const DEFAULT_SUBTYPE = 'element';

export default function AddNodeDialog() {
  const open = useGraphEditorStore((s) => s.addNodeDialogOpen);
  const close = useGraphEditorStore((s) => s.closeAddNodeDialog);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const hubs = useGraphSourceStore((s) => s.hubs);
  const addNode = useGraphSourceStore((s) => s.addNode);

  const fallbackHubId = useMemo(() => activeHubId ?? hubs[0]?.hubId ?? '', [activeHubId, hubs]);

  const [parentHubId, setParentHubId] = useState<string>(fallbackHubId);
  const [caption, setCaption] = useState<string>('');
  const [subtype, setSubtype] = useState<string>(DEFAULT_SUBTYPE);

  useEffect(() => {
    if (!open) return;
    setParentHubId(fallbackHubId);
    setCaption('');
    setSubtype(DEFAULT_SUBTYPE);
  }, [open, fallbackHubId]);

  if (!open) return null;

  const trimmedCaption = caption.trim();
  const trimmedSubtype = subtype.trim() || DEFAULT_SUBTYPE;
  const canSubmit = trimmedCaption.length > 0 && parentHubId.length > 0;

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!canSubmit) return;
    addNode({
      parentHubId,
      subtype: trimmedSubtype,
      intent: { caption: trimmedCaption },
    } as Parameters<typeof addNode>[0]);
    close();
  };

  return (
    <div
      data-component="add-node-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Add node"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-[420px] max-w-[92vw] rounded-2xl bg-[#0a0c14] border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.6)] p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[14px] font-display font-bold text-white tracking-tight">Add Node</div>
            <div className="text-[10px] font-mono text-white/40 tracking-widest mt-0.5">STAGE-0 INTENT</div>
          </div>
          <button
            type="button"
            data-role="add-node-cancel"
            onClick={close}
            className="text-white/40 hover:text-white text-[18px] leading-none px-2 py-1"
            aria-label="Cancel"
          >
            ×
          </button>
        </div>

        <label className="block mb-3">
          <span className="block text-[10px] font-mono text-white/50 tracking-widest mb-1">PARENT HUB</span>
          <select
            data-role="add-node-hub"
            value={parentHubId}
            onChange={(e) => setParentHubId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-md text-white text-[12px] px-3 py-2 focus:outline-none focus:border-[#5d8bff]/60"
          >
            {hubs.length === 0 && <option value="">(no hubs)</option>}
            {hubs.map((h) => (
              <option key={h.hubId} value={h.hubId}>
                {h.title ?? h.hubId}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-3">
          <span className="block text-[10px] font-mono text-white/50 tracking-widest mb-1">CAPTION</span>
          <textarea
            data-role="add-node-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="One or two sentences describing what this node is and what it does."
            className="w-full bg-white/5 border border-white/10 rounded-md text-white text-[12px] px-3 py-2 focus:outline-none focus:border-[#5d8bff]/60 resize-none"
          />
        </label>

        <label className="block mb-5">
          <span className="block text-[10px] font-mono text-white/50 tracking-widest mb-1">SUBTYPE</span>
          <input
            data-role="add-node-subtype"
            type="text"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
            placeholder={DEFAULT_SUBTYPE}
            className="w-full bg-white/5 border border-white/10 rounded-md text-white text-[12px] px-3 py-2 focus:outline-none focus:border-[#5d8bff]/60"
          />
        </label>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            data-role="add-node-cancel-2"
            onClick={close}
            className="px-3 py-1.5 rounded-md text-[11px] font-mono text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-role="add-node-submit"
            disabled={!canSubmit}
            className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-semibold transition-colors ${
              canSubmit
                ? 'bg-[#5d8bff] text-white hover:bg-[#7aa0ff]'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            Add Node
          </button>
        </div>
      </form>
    </div>
  );
}
