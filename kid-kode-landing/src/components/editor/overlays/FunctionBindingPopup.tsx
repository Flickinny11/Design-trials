'use client';

/**
 * APP-REALITY P7 (AMENDMENT 2026-06-14) — the Function binding popup.
 *
 * Opened from the Canvas Function toolbar action for the selected element. Shows
 * selectable VISUALS of every existing hub + every global element, plus
 * New hub / New global element / New element. Picking a hub binds
 * "navigate to that hub on click"; picking a global element binds "open this
 * element as an OVERLAY" with a customizable size + location. The binding is
 * written to the node's ADDITIVE `functionBinding` (the shared source graph) —
 * the node editor reads/writes the same field; Preview executes it.
 *
 * Root-mounted modal (mirrors ElementLibraryBrowser). Editor overlay scope.
 */

import { useEffect, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { FunctionBinding } from '@/lib/prism-graph/types';

const SIZE_PRESETS: { id: string; label: string; w: number; h: number }[] = [
  { id: 'S', label: 'Small', w: 0.26, h: 0.5 },
  { id: 'M', label: 'Medium', w: 0.34, h: 0.62 },
  { id: 'L', label: 'Large', w: 0.46, h: 0.78 },
];
const ANCHORS: { x: number; y: number }[][] = [
  [{ x: 0.2, y: 0.24 }, { x: 0.5, y: 0.24 }, { x: 0.8, y: 0.24 }],
  [{ x: 0.2, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 }],
  [{ x: 0.2, y: 0.76 }, { x: 0.5, y: 0.76 }, { x: 0.8, y: 0.76 }],
];

function nodeCaption(n: { intent?: { caption?: string }; subtype?: string; nodeId: string }): string {
  return n.intent?.caption?.slice(0, 40) || n.subtype || n.nodeId;
}

export default function FunctionBindingPopup() {
  const nodeId = useGraphEditorStore((s) => s.functionPopupNodeId);
  const close = useGraphEditorStore((s) => s.closeFunctionPopup);
  const hubs = useGraphSourceStore((s) => s.hubs);
  const nodes = useGraphSourceStore((s) => s.nodes);
  const updateNode = useGraphSourceStore((s) => s.updateNode);
  const addNode = useGraphSourceStore((s) => s.addNode);
  const addHub = useGraphSourceStore((s) => s.addHub);

  const node = nodes.find((n) => n.nodeId === nodeId) ?? null;
  const globals = nodes.filter((n) => n.isGlobalElement);

  const [overlayTarget, setOverlayTarget] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState('M');
  const [anchor, setAnchor] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    // re-seed the overlay editor from the node's current binding when opened
    if (node?.functionBinding?.kind === 'overlay') {
      setOverlayTarget(node.functionBinding.elementId);
      const sz = node.functionBinding.size;
      const found = SIZE_PRESETS.find((p) => sz && Math.abs(p.w - sz.w) < 0.02);
      setSizeId(found?.id ?? 'M');
      setAnchor(node.functionBinding.anchor ?? { x: 0.5, y: 0.5 });
    } else {
      setOverlayTarget(null);
      setSizeId('M');
      setAnchor({ x: 0.5, y: 0.5 });
    }
  }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!nodeId || !node) return null;

  const current = node.functionBinding;

  const bind = (b: FunctionBinding) => {
    updateNode(node.nodeId, { functionBinding: b });
  };
  const bindNavigate = (hubId: string) => { bind({ kind: 'navigate', hubId }); close(); };
  const commitOverlay = () => {
    if (!overlayTarget) return;
    const sz = SIZE_PRESETS.find((p) => p.id === sizeId) ?? SIZE_PRESETS[1];
    bind({ kind: 'overlay', elementId: overlayTarget, size: { w: sz.w, h: sz.h }, anchor });
    close();
  };
  const clearBinding = () => { updateNode(node.nodeId, { functionBinding: undefined }); close(); };

  const newGlobalElement = () => {
    const id = addNode({
      parentHubId: '',
      subtype: 'overlay-element',
      isGlobalElement: true,
      intent: { caption: 'New global element' } as never,
      overlaySpec: { kind: 'holographic-detail', title: 'New element', specs: [] },
    } as never);
    setOverlayTarget(id);
  };
  const newElement = () => {
    if (!node.parentHubId) return;
    addNode({ parentHubId: node.parentHubId, subtype: 'element', intent: { caption: 'New element' } as never } as never);
  };
  const newHub = () => {
    const hubId = `hub-${hubs.length + 1}`;
    addHub({ hubId, title: `Section ${hubs.length + 1}`, layout: { viewportWidth: 1280, viewportHeight: 720, contentHeight: 720, backgroundColor: '#0b0d13' } } as never);
    bindNavigate(hubId);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Function binding">
      <div className="absolute inset-0" style={{ background: 'rgba(4,5,10,0.66)', backdropFilter: 'blur(3px)' }} onClick={close} />
      <div className="ds-glass ds-glass--refract ds-edge--brass ds-reveal relative w-[min(680px,94vw)] max-h-[86vh] overflow-y-auto scrollbar-hide rounded-ds-lg p-5">
        {/* header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-[9px] font-mono tracking-[0.18em]" style={{ color: 'var(--ds-text-mid)' }}>FUNCTION · ON CLICK</div>
            <div className="text-[15px] font-ui font-semibold mt-0.5" style={{ color: 'var(--ds-text)' }}>{nodeCaption(node)}</div>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="ds-press grid place-items-center w-8 h-8 rounded-full" style={{ border: '1px solid rgba(var(--ds-brass-200-rgb),0.22)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="var(--ds-text-mid)" strokeWidth="1.4" strokeLinecap="round" /><line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="var(--ds-text-mid)" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>
        {current && (
          <div className="text-[10px] font-mono mb-3" style={{ color: 'var(--ds-brass-200)' }}>
            Bound: {current.kind === 'navigate' ? `navigate → ${hubs.find((h) => h.hubId === current.hubId)?.title ?? current.hubId}` : `overlay → ${nodes.find((n) => n.nodeId === current.elementId)?.overlaySpec?.title ?? current.elementId}`}
            <button type="button" onClick={clearBinding} className="ds-press ml-2 underline" style={{ color: 'var(--ds-text-mid)' }}>clear</button>
          </div>
        )}

        {/* NAVIGATE — hub tiles */}
        <div className="text-[10px] font-mono tracking-[0.14em] mb-1.5" style={{ color: 'var(--ds-text-mid)' }}>NAVIGATE TO A HUB</div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
          {hubs.map((hub, i) => {
            const active = current?.kind === 'navigate' && current.hubId === hub.hubId;
            return (
              <button key={hub.hubId} type="button" onClick={() => bindNavigate(hub.hubId)} title={hub.title}
                className="ds-press relative h-16 rounded-ds-sm overflow-hidden flex flex-col justify-end p-2 text-left"
                style={{ background: hub.layout?.backgroundColor || '#0b0d13', border: active ? '1.5px solid var(--ds-brass-200)' : '1px solid rgba(var(--ds-brass-200-rgb),0.18)' }}>
                <span className="absolute top-1.5 left-2 text-[8px] font-mono opacity-60" style={{ color: 'var(--ds-brass-200)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[10px] font-ui font-medium leading-tight" style={{ color: 'var(--ds-text)' }}>{hub.title || hub.hubId}</span>
              </button>
            );
          })}
          <button type="button" onClick={newHub} className="ds-press h-16 rounded-ds-sm flex flex-col items-center justify-center gap-1" style={{ border: '1px dashed rgba(var(--ds-brass-200-rgb),0.3)' }}>
            <span className="text-[16px] leading-none" style={{ color: 'var(--ds-brass-200)' }}>+</span>
            <span className="text-[8.5px] font-ui" style={{ color: 'var(--ds-text-mid)' }}>New hub</span>
          </button>
        </div>

        {/* OVERLAY — global element tiles */}
        <div className="text-[10px] font-mono tracking-[0.14em] mb-1.5" style={{ color: 'var(--ds-text-mid)' }}>OPEN A GLOBAL ELEMENT AS OVERLAY</div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {globals.map((g) => {
            const active = overlayTarget === g.nodeId;
            return (
              <button key={g.nodeId} type="button" onClick={() => setOverlayTarget(g.nodeId)} title={g.overlaySpec?.title || g.nodeId}
                className="ds-press relative h-16 rounded-ds-sm overflow-hidden flex flex-col justify-end p-2 text-left ds-glass"
                style={{ border: active ? '1.5px solid var(--ds-brass-200)' : '1px solid rgba(var(--ds-brass-200-rgb),0.18)' }}>
                <span className="absolute top-1.5 left-2 text-[8px] font-mono" style={{ color: 'var(--ds-brass-200)' }}>◈</span>
                <span className="text-[10px] font-ui font-medium leading-tight" style={{ color: 'var(--ds-text)' }}>{g.overlaySpec?.title || 'Element'}</span>
              </button>
            );
          })}
          <button type="button" onClick={newGlobalElement} className="ds-press h-16 rounded-ds-sm flex flex-col items-center justify-center gap-1" style={{ border: '1px dashed rgba(var(--ds-brass-200-rgb),0.3)' }}>
            <span className="text-[16px] leading-none" style={{ color: 'var(--ds-brass-200)' }}>+</span>
            <span className="text-[8.5px] font-ui text-center" style={{ color: 'var(--ds-text-mid)' }}>New global<br />element</span>
          </button>
        </div>

        {/* overlay size + location controls (when a global element is selected) */}
        {overlayTarget && (
          <div className="ds-glass rounded-ds-sm p-3 mb-1 flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono w-12" style={{ color: 'var(--ds-text-mid)' }}>SIZE</span>
              <div className="flex gap-1.5">
                {SIZE_PRESETS.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSizeId(s.id)} className="ds-press px-2.5 h-7 rounded-ds-xs text-[10px] font-ui"
                    style={{ background: sizeId === s.id ? 'var(--ds-grad-brass)' : 'transparent', color: sizeId === s.id ? '#2a1f12' : 'var(--ds-text-mid)', border: '1px solid rgba(var(--ds-brass-200-rgb),0.22)' }}>{s.label}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono w-12" style={{ color: 'var(--ds-text-mid)' }}>LOCATION</span>
              <div className="grid grid-cols-3 gap-1">
                {ANCHORS.flat().map((a, i) => {
                  const active = Math.abs(a.x - anchor.x) < 0.01 && Math.abs(a.y - anchor.y) < 0.01;
                  return <button key={i} type="button" onClick={() => setAnchor(a)} aria-label={`Position ${i + 1}`} className="ds-press w-6 h-6 rounded-ds-xs grid place-items-center"
                    style={{ border: '1px solid rgba(var(--ds-brass-200-rgb),0.22)', background: active ? 'rgba(var(--ds-brass-200-rgb),0.18)' : 'transparent' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? 'var(--ds-brass-200)' : 'var(--ds-text-mid)' }} /></button>;
                })}
              </div>
            </div>
            <button type="button" onClick={commitOverlay} className="ds-press h-8 rounded-ds-sm text-[11px] font-ui font-semibold mt-0.5" style={{ background: 'var(--ds-grad-brass)', color: '#2a1f12' }}>
              Bind overlay on click
            </button>
          </div>
        )}

        <div className="text-[9px] font-mono mt-2" style={{ color: 'var(--ds-text-mid)' }}>
          Stored in the node’s shared schema — the node editor reads/writes the same binding.
          {node.parentHubId && <button type="button" onClick={newElement} className="ds-press ml-2 underline">+ New element</button>}
        </div>
      </div>
    </div>
  );
}
