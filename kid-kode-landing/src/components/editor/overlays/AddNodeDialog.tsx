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
//
// Chrome: Observatory Brass — frosted glass modal (ds-glass ds-edge) over a
// smoked scrim, carved input troughs (ds-input / ds-select), machined
// ds-btn actions with a brass primary.

import { useEffect, useMemo, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { DS, dsAlpha } from '@/components/editor/design-system';

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
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{
        background: dsAlpha(DS.void, 0.6),
        backdropFilter: 'var(--ds-frost-light)',
        WebkitBackdropFilter: 'var(--ds-frost-light)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-[420px] max-w-[92vw] ds-glass ds-edge rounded-ds-lg p-5 ds-reveal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="ds-title tracking-tight">Add Node</div>
            <div className="ds-kicker mt-1">STAGE-0 INTENT</div>
          </div>
          <button
            type="button"
            data-role="add-node-cancel"
            onClick={close}
            className="ds-btn ds-btn--quiet ds-press w-8 h-8 px-0 text-[18px] leading-none"
            aria-label="Cancel"
          >
            ×
          </button>
        </div>

        <label className="block mb-3">
          <span className="ds-label block mb-1.5">PARENT HUB</span>
          <select
            data-role="add-node-hub"
            value={parentHubId}
            onChange={(e) => setParentHubId(e.target.value)}
            className="ds-select w-full"
            style={{ minHeight: 34 }}
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
          <span className="ds-label block mb-1.5">CAPTION</span>
          <textarea
            data-role="add-node-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="One or two sentences describing what this node is and what it does."
            className="ds-input w-full resize-none"
            style={{ padding: '8px 10px', lineHeight: 1.5 }}
          />
        </label>

        <label className="block mb-5">
          <span className="ds-label block mb-1.5">SUBTYPE</span>
          <input
            data-role="add-node-subtype"
            type="text"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
            placeholder={DEFAULT_SUBTYPE}
            className="ds-input w-full"
            style={{ minHeight: 34 }}
          />
        </label>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            data-role="add-node-cancel-2"
            onClick={close}
            className="ds-btn ds-btn--quiet ds-press"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-role="add-node-submit"
            disabled={!canSubmit}
            className="ds-btn ds-btn--primary ds-press"
          >
            Add Node
          </button>
        </div>
      </form>
    </div>
  );
}
