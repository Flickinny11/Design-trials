'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView, type EditorGraph, type EditorNode } from '@/lib/prism-graph/view-model';
import { useGraphEditorStore, type InspectorTab } from '@/stores/useGraphEditorStore';
import { useElementImageStore } from '@/stores/useElementImageStore';
import { useAnimationEditsStore, defaultFrame, type FrameProps } from '@/stores/useAnimationEditsStore';
import { Icon } from '@/components/editor/icons/Icon';
import { ColorPicker } from './ColorPicker';
import VisualPreview from './visual-preview/VisualPreview';
import type { PrismNode } from '@/lib/prism-graph/types';

const TABS: { id: InspectorTab; label: string; icon: string }[] = [
  { id: 'visual', label: 'Visual', icon: 'eye' },
  { id: 'behavior', label: 'Behavior', icon: 'flow' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'animation', label: 'Animation', icon: 'play' },
  { id: 'connections', label: 'Links', icon: 'link' },
  { id: 'backend', label: 'Backend', icon: 'server' },
];

export default function Inspector() {
  const open = useGraphEditorStore((s) => s.inspectorOpen);
  const close = useGraphEditorStore((s) => s.closeInspector);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const tab = useGraphEditorStore((s) => s.inspectorTab);
  const setTab = useGraphEditorStore((s) => s.setInspectorTab);
  const frozen = useGraphEditorStore((s) => (selectedId ? s.frozenNodeIds.has(selectedId) : false));
  const flyToNode = useGraphEditorStore((s) => s.flyToNode);
  const flyToHub = useGraphEditorStore((s) => s.flyToHub);
  const setViewMode = useGraphEditorStore((s) => s.setViewMode);

  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const isDirty = useGraphSourceStore((s) => s.isDirty);
  const savedAt = useGraphSourceStore((s) => s.savedAt);
  const saveToServer = useGraphSourceStore((s) => s.saveToServer);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const r = await saveToServer();
    setSaving(false);
    if (!r.ok) setSaveError(r.error ?? 'save failed');
  };

  const handlePreviewInAppUi = () => {
    setViewMode('preview');
    if (!selectedId) return;
    const node = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === selectedId);
    if (node?.parentHubId) flyToHub(node.parentHubId);
  };
  const editorGraph = useMemo<EditorGraph>(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );

  // T-EDIT-05 — bidirectional editor↔preview live binding (plan §Phase 5).
  // Editor → preview: when the editor's selection changes, push a visual
  // highlight ring onto the matching preview node. The PixiJS-era
  // `window.__prism` debug surface was retired in Phase 5 (spec §15);
  // T07 will re-implement highlight + selection on the Three.js mount.
  // Until then, the editor still drives `selectedId` locally — only the
  // cross-pane visual ring is dormant.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = (window as { __prism?: { highlightNode?: (id: string | null) => void } }).__prism;
    handle?.highlightNode?.(selectedId ?? null);
  }, [selectedId]);

  // Preview → editor: subscribe to user-driven node clicks in the preview
  // pane. Same Phase 5 caveat — `__prism.onNodeSelected` is not on the
  // Three.js debug handle yet; the polling guard now no-ops cleanly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let off: (() => void) | undefined;
    let cancelled = false;
    const tryAttach = () => {
      const handle = (window as { __prism?: { onNodeSelected?: (cb: (nodeId: string) => void) => () => void } }).__prism;
      if (!handle?.onNodeSelected) return false;
      off = handle.onNodeSelected((nodeId) => {
        const store = useGraphEditorStore.getState();
        store.selectNode(nodeId);
        store.openInspector();
      });
      return true;
    };
    if (!tryAttach()) {
      const timer = setInterval(() => {
        if (cancelled) return;
        if (tryAttach()) clearInterval(timer);
      }, 200);
      return () => { cancelled = true; clearInterval(timer); off?.(); };
    }
    return () => { off?.(); };
  }, []);

  // Memoize the source-node lookup; consumed by the Visual tab's live R3F
  // sub-canvas (T07).
  const sourceNodeById = useMemo<PrismNode | null>(
    () => sourceNodes.find((s) => s.nodeId === selectedId) ?? null,
    [sourceNodes, selectedId],
  );

  if (!open || !selectedId) return null;
  const node = editorGraph.nodes.find((n) => n.id === selectedId);
  if (!node) return null;

  return (
    <div
      className="absolute z-40 right-0 top-0 bottom-0 w-full md:w-[460px] border-l border-white/10 flex flex-col animate-slide-in-r"
      style={{
        background: 'linear-gradient(180deg, rgba(14,16,37,0.97) 0%, rgba(8,10,26,0.98) 100%)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        boxShadow: '-24px 0 64px rgba(0,0,0,0.55)',
      }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-mono tracking-widest text-white/40 flex items-center gap-1.5">
            <span>INSPECTOR</span>
            <Icon name="chevron" size={9} color="#6b7694" />
            <span className="text-white/60">{node.elementType}</span>
          </div>
          <div className="font-display font-bold text-white text-lg leading-tight flex items-center gap-2">
            {node.name}
            {frozen && <Icon name="snow" size={13} color="#c5d8ff" glow />}
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <button
            type="button"
            data-role="save"
            disabled={saving}
            onClick={handleSave}
            title={isDirty ? 'Save graph to server' : 'No unsaved changes'}
            className={`px-2.5 h-7 rounded-md text-[10px] font-mono border transition-colors ${
              isDirty
                ? 'bg-[#5d8bff]/20 hover:bg-[#5d8bff]/30 border-[#5d8bff]/40 text-[#c5d8ff]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/55'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
          </button>
          <button
            type="button"
            data-role="preview-in-app-ui"
            onClick={handlePreviewInAppUi}
            title="Preview in App UI"
            className="px-2.5 h-7 rounded-md text-[10px] font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 transition-colors"
          >
            Preview in App UI
          </button>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            title="Close inspector"
          >
            <Icon name="close" size={12} color="#c5ccea" />
          </button>
        </div>
      </div>
      {(saveError || (savedAt && !isDirty)) && (
        <div
          data-role="save-status"
          className={`mx-5 mt-2 px-2.5 py-1 rounded-md text-[10px] font-mono ${
            saveError ? 'bg-[#ef4466]/15 border border-[#ef4466]/30 text-[#ffb1c0]' : 'bg-[#55e6a5]/10 border border-[#55e6a5]/25 text-[#a8efce]'
          }`}
        >
          {saveError ? `save failed: ${saveError}` : `saved · ${new Date(savedAt!).toLocaleTimeString()}`}
        </div>
      )}

      <div className="flex border-b border-white/5 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2.5 text-[11px] font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                active ? 'border-[#5d8bff] text-white bg-[#5d8bff]/6' : 'border-transparent text-white/45 hover:text-white/75'
              }`}
            >
              <Icon name={t.icon} size={11} color={active ? '#5d8bff' : '#8896b8'} glow={active} />
              {t.label}
            </button>
          );
        })}
      </div>

      {frozen && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-[#5d8bff]/10 border border-[#8bb4ff]/30 flex items-center gap-2">
          <Icon name="snow" size={12} color="#c5d8ff" glow />
          <div className="text-[11px] text-[#c5d8ff] font-mono">Node frozen — AI cannot edit</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {tab === 'visual' && <VisualTab node={node} frozen={frozen} sourceNode={sourceNodeById} />}
        {tab === 'behavior' && <BehaviorTab node={node} />}
        {tab === 'code' && <CodeTab node={node} frozen={frozen} />}
        {tab === 'animation' && <AnimationTab node={node} frozen={frozen} />}
        {tab === 'connections' && <ConnectionsTab node={node} graph={editorGraph} flyToNode={flyToNode} />}
        {tab === 'backend' && <BackendTab node={node} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VISUAL TAB — live R3F sub-canvas (T07) + editable color pickers
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L477.
// ═══════════════════════════════════════════════════════════════════
function VisualTab({ node, frozen, sourceNode }: { node: any; frozen: boolean; sourceNode: PrismNode | null }) {
  const [frame, setFrame] = useState(0);
  const total = node.animationFrames || 1;
  const capturedImage = useElementImageStore((s) => s.images[node.id]);

  const edits = useAnimationEditsStore((s) => s.edits[node.id]);
  const setPrimary = useAnimationEditsStore((s) => s.setPrimary);
  const setSecondary = useAnimationEditsStore((s) => s.setSecondary);

  const primaryColor = edits?.primaryColor || node.visualSpec.primaryColor;
  const secondaryColor = edits?.secondaryColor || node.visualSpec.secondaryColor;

  return (
    <div className="p-5 space-y-4">
      <div className="text-[9px] font-mono tracking-widest text-white/40">LIVE PREVIEW</div>

      {sourceNode ? (
        <VisualPreview node={sourceNode} frozen={frozen} />
      ) : (
        <div className="rounded-xl border border-white/10 p-4 text-[11px] text-white/50">
          No source node available for this selection.
        </div>
      )}

      <div className="text-[9px] font-mono tracking-widest text-white/40 pt-2">ELEMENT IMAGE</div>

      <div
        className="relative aspect-[16/10] rounded-xl overflow-hidden border border-white/10"
        style={{
          background: capturedImage
            ? '#0a0b1c'
            : `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor || primaryColor} 100%)`,
          boxShadow: `0 10px 40px ${primaryColor}44`,
        }}
      >
        {capturedImage ? (
          <img src={capturedImage} alt={node.name} className="w-full h-full object-contain" />
        ) : (
          <>
            {node.hasAnimation && (
              <>
                <div className="absolute inset-0 translate-x-2 translate-y-2 bg-white/10 rounded-xl border border-white/5" />
                <div className="absolute inset-0 translate-x-1 translate-y-1 bg-white/5 rounded-xl border border-white/5" />
              </>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white/80 font-display text-2xl font-bold">{node.name}</div>
            </div>
          </>
        )}
        {node.hasAnimation && (
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur text-[10px] font-mono text-white/80 flex items-center gap-1">
            <Icon name="play" size={8} color="#c5ccea" />
            Frame {frame + 1}/{total}
          </div>
        )}
      </div>

      {node.hasAnimation && (
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={total - 1}
            value={frame}
            onChange={(e) => setFrame(+e.target.value)}
            className="w-full"
          />
          <div className="text-[9px] font-mono text-white/40">Drag to preview frames. Open the Animation tab to edit them.</div>
        </div>
      )}

      <div className="text-[9px] font-mono tracking-widest text-white/40 pt-2">STYLE — CLICK TO EDIT</div>
      <div className="grid grid-cols-1 gap-2">
        <SpecRow icon="sparkle" label="Primary color">
          <ColorPicker
            value={primaryColor}
            onChange={(c) => setPrimary(node.id, c)}
            label="Primary color"
            disabled={frozen}
          />
        </SpecRow>
        {secondaryColor && (
          <SpecRow icon="sparkle" label="Accent color">
            <ColorPicker
              value={secondaryColor}
              onChange={(c) => setSecondary(node.id, c)}
              label="Accent color"
              disabled={frozen}
            />
          </SpecRow>
        )}
        <SpecRow icon="edit" label="Font">
          <span className="text-[11px] text-white/85 font-mono">{node.visualSpec.font}</span>
        </SpecRow>
        <SpecRow icon="grid" label="Radius">
          <span className="text-[11px] text-white/85 font-mono">{node.visualSpec.radius}px</span>
        </SpecRow>
      </div>

      <div className="text-[9px] font-mono tracking-widest text-white/40 pt-2">TEXT CONTENT</div>
      <div className="space-y-1.5">
        {node.textContent.map((t: any, i: number) => (
          <div key={i} className="px-3 py-2 rounded-lg bg-white/[0.025] border border-white/5 flex items-center justify-between">
            <span className="text-[12px] text-white/85 truncate max-w-[60%]">"{t.text}"</span>
            <div className="flex gap-1.5 text-[9px] font-mono">
              <span className="text-white/50">{t.role}</span>
              <span className="text-[#5d8bff]">{t.renderMethod}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpecRow({ icon, label, children }: any) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white/[0.025] border border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={11} color="#7a86a8" />
        <span className="text-[10px] font-mono tracking-widest text-white/50">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BEHAVIOR TAB
// ═══════════════════════════════════════════════════════════════════
function BehaviorTab({ node }: { node: any }) {
  return (
    <div className="p-5 space-y-4">
      <div className="text-[9px] font-mono tracking-widest text-white/40">INTERACTIONS</div>
      <div className="space-y-2">
        {node.interactions.length === 0 ? (
          <div className="text-[11px] text-white/40 italic">No interactions defined</div>
        ) : (
          node.interactions.map((i: any, idx: number) => (
            <div key={idx} className="px-3 py-2.5 rounded-lg bg-white/[0.025] border border-white/5">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="px-1.5 py-0.5 rounded bg-[#5d8bff]/15 text-[#5d8bff] font-mono text-[10px]">{i.event}</span>
                <Icon name="chevron" size={9} color="#6b7694" />
                <span className="text-white/75 font-mono text-[11px]">{i.action}</span>
                <Icon name="chevron" size={9} color="#6b7694" />
                <span className="text-white/55 font-mono text-[11px] truncate">{i.target}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-[9px] font-mono tracking-widest text-white/40 pt-3">STATE MANAGEMENT</div>
      <div className="px-3 py-2.5 rounded-lg bg-white/[0.025] border border-white/5">
        <div className="text-[11px] text-white/75">
          Store: <span className="font-mono text-[#5d8bff]">{node.id.replace(/-/g, '')}Store</span>
        </div>
        <div className="text-[10px] text-white/50 mt-1">{node.stateCount} state key{node.stateCount !== 1 ? 's' : ''} tracked</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CODE TAB — now shows live-generated code from the animation edits
// ═══════════════════════════════════════════════════════════════════
function CodeTab({ node, frozen }: { node: any; frozen: boolean }) {
  const edits = useAnimationEditsStore((s) => s.edits[node.id]);
  const markSaved = useAnimationEditsStore((s) => s.markSaved);
  const [saved, setSaved] = useState(false);

  // If there are keyframe edits, show the generated GSAP code. Otherwise show static code.
  const code = edits && edits.frames.length > 0 ? generateAnimationCode(node, edits.frames) : node.code;

  const handleSave = () => {
    markSaved(node.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-mono tracking-widest text-white/40">ASSOCIATED CONTEXT</div>
        <div className="text-[10px] font-mono" style={{ color: node.verificationScore >= 0.6 ? '#22c55e' : '#ef4466' }}>
          SWE-RM: {node.verificationScore.toFixed(2)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div className="px-2.5 py-2 rounded-lg bg-white/[0.025] border border-white/5">
          <div className="text-white/40 text-[9px] tracking-widest">IMPORTS</div>
          <div className="text-white/75 mt-0.5">pixi.js, gsap</div>
        </div>
        <div className="px-2.5 py-2 rounded-lg bg-white/[0.025] border border-white/5">
          <div className="text-white/40 text-[9px] tracking-widest">EXPORTS</div>
          <div className="text-white/75 mt-0.5">createNode</div>
        </div>
      </div>

      <div className={`rounded-xl border overflow-hidden ${frozen ? 'border-[#8bb4ff]/30 bg-[#5d8bff]/[0.03]' : 'border-white/10 bg-black/45'}`}>
        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between text-[10px] font-mono text-white/40">
          <span>{edits?.dirty ? 'animation.generated.ts (edited)' : 'createNode.ts'}</span>
          {frozen && <span className="text-[#c5d8ff] flex items-center gap-1"><Icon name="snow" size={9} color="#c5d8ff" /> read-only</span>}
          {edits?.dirty && !frozen && <span className="text-[#ff9a44]">● modified</span>}
        </div>
        <pre className={`p-3 text-[10.5px] font-mono leading-relaxed overflow-x-auto ${frozen ? 'text-[#c5d8ff]/60' : 'text-white/82'}`}>
          <code>{code}</code>
        </pre>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          disabled={frozen}
          onClick={handleSave}
          className="flex-1 h-9 rounded-lg bg-[#5d8bff]/15 hover:bg-[#5d8bff]/25 border border-[#5d8bff]/30 text-[11px] font-semibold text-[#5d8bff] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {saved ? (
            <>
              <Icon name="check" size={11} color="#55e6a5" />
              <span className="text-[#55e6a5]">Saved</span>
            </>
          ) : (
            <>
              <Icon name="save" size={11} color="#5d8bff" />
              Save &amp; Verify
            </>
          )}
        </button>
        <button
          disabled={frozen}
          className="flex-1 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-white/75 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          <Icon name="refresh" size={11} color="#c5ccea" />
          Revert
        </button>
      </div>
    </div>
  );
}

function generateAnimationCode(node: any, frames: FrameProps[]): string {
  const duration = 0.3;
  const step = duration / Math.max(frames.length - 1, 1);
  const lines = [
    `import gsap from 'gsap';`,
    ``,
    `// Auto-generated from keyframe editor`,
    `export function animate${node.name.replace(/-/g, '_')}(node) {`,
    `  const tl = gsap.timeline();`,
  ];
  frames.forEach((f, i) => {
    lines.push(
      `  tl.to(node, {`,
      `    scale: ${f.scale.toFixed(3)},`,
      `    opacity: ${f.opacity.toFixed(2)},`,
      `    rotation: ${f.rotation.toFixed(1)},`,
      `    x: ${f.x.toFixed(1)}, y: ${f.y.toFixed(1)},`,
      `    duration: ${step.toFixed(3)},`,
      `    ease: 'power2.out',`,
      `  }${i === 0 ? ', 0' : ''});`
    );
  });
  lines.push(`  return tl;`, `}`);
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// ANIMATION TAB — fully interactive keyframe editor
// ═══════════════════════════════════════════════════════════════════
function AnimationTab({ node, frozen }: { node: any; frozen: boolean }) {
  const total = node.animationFrames || 0;
  const capturedImage = useElementImageStore((s) => s.images[node.id]);

  const ensureNode = useAnimationEditsStore((s) => s.ensureNode);
  const setFrame = useAnimationEditsStore((s) => s.setFrame);
  const reset = useAnimationEditsStore((s) => s.reset);
  const markSaved = useAnimationEditsStore((s) => s.markSaved);
  const edits = useAnimationEditsStore((s) => s.edits[node.id]);

  useEffect(() => {
    if (total > 0) ensureNode(node.id, total);
  }, [node.id, total, ensureNode]);

  const [activeFrame, setActiveFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playT, setPlayT] = useState(0);
  const [saved, setSaved] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Playback loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    let startTime: number | null = null;
    const DURATION_MS = 1500;
    const loop = (now: number) => {
      if (startTime == null) startTime = now;
      const elapsed = (now - startTime) % DURATION_MS;
      setPlayT(elapsed / DURATION_MS);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  if (!node.hasAnimation) {
    return (
      <div className="p-5 text-center text-white/40 text-[12px] italic">This node has no animations.</div>
    );
  }

  if (!edits) return <div className="p-5 text-white/40 text-[12px]">Loading…</div>;

  const frames = edits.frames;
  const currentFrame = frames[activeFrame] || defaultFrame(activeFrame, frames.length);

  // Interpolate for live preview during playback
  const previewProps = playing ? interpolateFrames(frames, playT) : currentFrame;

  const handleFrameEdit = (patch: Partial<FrameProps>) => {
    if (frozen) return;
    setFrame(node.id, activeFrame, patch);
  };

  const handleSave = () => {
    markSaved(node.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const primary = edits.primaryColor || node.visualSpec.primaryColor;
  const secondary = edits.secondaryColor || node.visualSpec.secondaryColor || primary;

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] font-mono tracking-widest text-white/40">ANIMATION</div>
          <div className="text-[13px] font-semibold text-white mt-0.5">
            hover → keyframes · {(frames.length * 50)}ms · ease-out
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setPlaying(false); setPlayT(0); }}
            disabled={!playing}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors disabled:opacity-40"
            title="Stop"
          >
            <div className="w-2.5 h-2.5 bg-white/70" />
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className="w-9 h-9 rounded-full bg-[#5d8bff]/15 hover:bg-[#5d8bff]/25 border border-[#5d8bff]/30 flex items-center justify-center text-[#5d8bff] transition-colors"
            title={playing ? 'Pause' : 'Play animation'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={14} color="#5d8bff" glow />
          </button>
        </div>
      </div>

      {/* Live preview surface */}
      <div
        className="relative rounded-xl border border-white/10 h-40 overflow-hidden flex items-center justify-center"
        style={{
          background: 'radial-gradient(ellipse at center, #10122a, #05060f)',
        }}
      >
        <div
          className="relative max-w-[70%] max-h-[80%]"
          style={{
            transform: `translate(${previewProps.x}px, ${previewProps.y}px) rotate(${previewProps.rotation}deg) scale(${previewProps.scale})`,
            opacity: previewProps.opacity,
            transition: playing ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms linear',
            boxShadow: `0 0 30px ${previewProps.color}55`,
            filter: `drop-shadow(0 0 14px ${previewProps.color}88)`,
          }}
        >
          {capturedImage ? (
            <img src={capturedImage} alt="" className="max-h-32 rounded-lg border border-white/10" />
          ) : (
            <div
              className="px-6 py-3 rounded-lg font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              {node.name}
            </div>
          )}
        </div>
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/50 backdrop-blur text-[9px] font-mono tracking-widest text-white/60 flex items-center gap-1">
          <Icon name="eye" size={9} color="#c5ccea" />
          LIVE PREVIEW
        </div>
        {playing && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#55e6a5]/15 border border-[#55e6a5]/30">
            <div className="w-1.5 h-1.5 rounded-full bg-[#55e6a5] animate-pulse" />
            <span className="text-[9px] font-mono text-[#55e6a5]">PLAYING</span>
          </div>
        )}
      </div>

      {/* Timeline playhead */}
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] font-mono text-white/40 tracking-widest">
          <span>TIMELINE</span>
          <span>{Math.round(((activeFrame / Math.max(total - 1, 1)) * frames.length * 50))}ms</span>
        </div>
        <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
            style={{
              width: `${((activeFrame + 1) / frames.length) * 100}%`,
              background: `linear-gradient(90deg, ${primary}, ${secondary})`,
              boxShadow: `0 0 10px ${primary}`,
            }}
          />
        </div>
      </div>

      {/* Frame strip */}
      <div>
        <div className="text-[9px] font-mono tracking-widest text-white/40 mb-1.5">KEYFRAMES</div>
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          {frames.map((f, i) => (
            <button
              key={i}
              onClick={() => setActiveFrame(i)}
              className={`flex-shrink-0 w-12 h-12 rounded-md border-2 transition-all flex items-center justify-center text-[10px] font-mono ${
                i === activeFrame
                  ? 'border-[#5d8bff] shadow-[0_0_14px_rgba(93,139,255,0.55)]'
                  : 'border-white/10 hover:border-white/30'
              }`}
              style={{
                background: `linear-gradient(135deg, ${f.color}, ${primary})`,
                opacity: 0.4 + 0.6 * f.opacity,
                transform: `scale(${0.7 + 0.3 * Math.min(f.scale, 1.2) / 1.2})`,
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Keyframe property editors */}
      <div className="p-4 rounded-xl bg-white/[0.025] border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-white/85">
            Keyframe {activeFrame + 1} <span className="text-white/40 font-normal">/ {frames.length}</span>
          </div>
          <div className="text-[10px] font-mono text-white/40">
            t = {(activeFrame / Math.max(frames.length - 1, 1)).toFixed(2)}
          </div>
        </div>

        <PropSlider label="Scale"     value={currentFrame.scale}    min={0.1} max={2}   step={0.01} disabled={frozen} onChange={(v) => handleFrameEdit({ scale: v })} fmt={(v) => v.toFixed(2) + '×'} />
        <PropSlider label="Opacity"   value={currentFrame.opacity}  min={0}   max={1}   step={0.01} disabled={frozen} onChange={(v) => handleFrameEdit({ opacity: v })} fmt={(v) => Math.round(v * 100) + '%'} />
        <PropSlider label="Rotation"  value={currentFrame.rotation} min={-180} max={180} step={1}  disabled={frozen} onChange={(v) => handleFrameEdit({ rotation: v })} fmt={(v) => v + '°'} />
        <PropSlider label="Translate X" value={currentFrame.x}      min={-50} max={50}  step={1}   disabled={frozen} onChange={(v) => handleFrameEdit({ x: v })} fmt={(v) => v + 'px'} />
        <PropSlider label="Translate Y" value={currentFrame.y}      min={-50} max={50}  step={1}   disabled={frozen} onChange={(v) => handleFrameEdit({ y: v })} fmt={(v) => v + 'px'} />

        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-[10px] font-mono text-white/50 tracking-widest">GLOW COLOR</span>
          <ColorPicker
            value={currentFrame.color}
            onChange={(c) => handleFrameEdit({ color: c })}
            label="Keyframe glow"
            disabled={frozen}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setPlaying(true)}
          disabled={playing}
          className="flex-1 h-9 rounded-lg bg-[#5d8bff]/15 hover:bg-[#5d8bff]/25 border border-[#5d8bff]/30 text-[11px] font-semibold text-[#5d8bff] transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          <Icon name="play" size={11} color="#5d8bff" />
          Preview
        </button>
        <button
          onClick={handleSave}
          disabled={frozen || !edits.dirty}
          className="flex-1 h-9 rounded-lg bg-[#55e6a5]/15 hover:bg-[#55e6a5]/25 border border-[#55e6a5]/30 text-[11px] font-semibold text-[#55e6a5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {saved ? (
            <><Icon name="check" size={11} color="#55e6a5" /> Saved</>
          ) : (
            <><Icon name="save" size={11} color="#55e6a5" /> Save</>
          )}
        </button>
        <button
          onClick={() => reset(node.id)}
          disabled={frozen || !edits.dirty}
          className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 transition-colors disabled:opacity-40"
          title="Reset to default"
        >
          <Icon name="refresh" size={12} color="#c5ccea" />
        </button>
      </div>

      <div className="text-[10px] text-white/40 leading-relaxed italic pt-1">
        Drag any slider to modify that keyframe. Tap Preview to play the full animation. The Code tab shows the generated GSAP code updating in real time.
      </div>
    </div>
  );
}

function PropSlider({
  label, value, min, max, step, onChange, disabled, fmt,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean; fmt?: (v: number) => string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono mb-1">
        <span className="text-white/55">{label}</span>
        <span className="text-white/85">{fmt ? fmt(value) : value}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full disabled:opacity-40"
      />
    </div>
  );
}

function interpolateFrames(frames: FrameProps[], t: number): FrameProps {
  if (frames.length === 0) return defaultFrame(0, 1);
  if (frames.length === 1) return frames[0];
  const idxF = t * (frames.length - 1);
  const i0 = Math.floor(idxF);
  const i1 = Math.min(frames.length - 1, i0 + 1);
  const k = idxF - i0;
  const a = frames[i0], b = frames[i1];
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    scale: lerp(a.scale, b.scale),
    opacity: lerp(a.opacity, b.opacity),
    rotation: lerp(a.rotation, b.rotation),
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    color: a.color, // keep snappy color transition
  };
}

// ═══════════════════════════════════════════════════════════════════
// CONNECTIONS TAB
// ═══════════════════════════════════════════════════════════════════
function ConnectionsTab({ node, graph, flyToNode }: { node: any; graph: EditorGraph; flyToNode: (id: string) => void }) {
  const incoming = graph.edges.filter((e) => e.target === node.id);
  const outgoing = graph.edges.filter((e) => e.source === node.id);
  const other = (id: string): EditorNode | undefined => graph.nodes.find((n) => n.id === id);
  const edgeColor = (t: string) =>
    ({ contains: '#b5bddf', 'navigates-to': '#5ee0ff', triggers: '#ff9a44', 'data-flow': '#55e6a5', 'shares-state': '#a978ff', 'depends-on': '#6b7694' }[t] || '#b5bddf');

  return (
    <div className="p-5 space-y-4">
      <div>
        <div className="text-[9px] font-mono tracking-widest text-white/40 mb-2">INCOMING ({incoming.length})</div>
        <div className="space-y-1.5">
          {incoming.length === 0 && <div className="text-[11px] text-white/40 italic">None</div>}
          {incoming.map((e) => {
            const src = other(e.source);
            if (!src) return null;
            return (
              <button
                key={e.id}
                onClick={() => flyToNode(src.id)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.025] border border-white/5 hover:bg-white/[0.055] transition-colors text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] tracking-wider" style={{ color: edgeColor(e.type) }}>← {e.type}</span>
                </div>
                <div className="text-[12px] text-white/85 font-semibold mt-0.5 flex items-center justify-between">
                  <span className="truncate">{src.name}</span>
                  <Icon name="chevron" size={11} color="#6b7694" className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-mono tracking-widest text-white/40 mb-2">OUTGOING ({outgoing.length})</div>
        <div className="space-y-1.5">
          {outgoing.length === 0 && <div className="text-[11px] text-white/40 italic">None</div>}
          {outgoing.map((e) => {
            const tgt = other(e.target);
            if (!tgt) return null;
            return (
              <button
                key={e.id}
                onClick={() => flyToNode(tgt.id)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.025] border border-white/5 hover:bg-white/[0.055] transition-colors text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] tracking-wider" style={{ color: edgeColor(e.type) }}>→ {e.type}</span>
                </div>
                <div className="text-[12px] text-white/85 font-semibold mt-0.5 flex items-center justify-between">
                  <span className="truncate">{tgt.name}</span>
                  <Icon name="chevron" size={11} color="#6b7694" className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 border-t border-white/5">
        <div className="text-[9px] font-mono tracking-widest text-white/40 mb-2 flex items-center gap-1">
          <Icon name="flow" size={10} color="#a978ff" />
          FLOW NAVIGATOR
        </div>
        <div className="text-[11px] text-white/65 italic leading-relaxed">
          {outgoing.length > 0
            ? `Step through this node's interaction chain: ${node.name} → ${other(outgoing[0].target)?.name}`
            : 'This node is a terminal — no outgoing flows.'}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BACKEND TAB
// ═══════════════════════════════════════════════════════════════════
function BackendTab({ node }: { node: any }) {
  if (!node.backendContract) {
    return <div className="p-5 text-center text-white/40 text-[12px] italic">No backend contract. This is a client-only node.</div>;
  }
  const bc = node.backendContract;
  return (
    <div className="p-5 space-y-3">
      <div className="text-[9px] font-mono tracking-widest text-white/40">ASSOCIATED BACKEND</div>
      <div className="p-3 rounded-xl bg-gradient-to-br from-[#5d8bff]/12 to-[#a978ff]/6 border border-[#5d8bff]/22">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="server" size={13} color="#5d8bff" glow />
          <div className="text-[12px] font-semibold text-white">{bc.service}</div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold"
              style={{
                background:
                  bc.method === 'GET' ? '#22c55e33' :
                  bc.method === 'POST' ? '#5d8bff33' :
                  bc.method === 'PUT' ? '#f5a52433' : '#ef446633',
                color:
                  bc.method === 'GET' ? '#22c55e' :
                  bc.method === 'POST' ? '#5d8bff' :
                  bc.method === 'PUT' ? '#f5a524' : '#ef4466',
              }}
            >
              {bc.method}
            </span>
            <span className="text-white/75">{bc.route}</span>
          </div>
          <div className="text-[10px] font-mono text-white/55 bg-black/30 p-2 rounded-md border border-white/5 overflow-x-auto">{bc.schema}</div>
        </div>
      </div>

      <div className="text-[9px] font-mono tracking-widest text-white/40 pt-2">DEPLOYMENT</div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="px-2.5 py-2 rounded-lg bg-white/[0.025] border border-white/5">
          <div className="text-[9px] font-mono tracking-widest text-white/40">PLATFORM</div>
          <div className="text-white/75 font-mono mt-0.5">cloudflare-workers</div>
        </div>
        <div className="px-2.5 py-2 rounded-lg bg-white/[0.025] border border-white/5">
          <div className="text-[9px] font-mono tracking-widest text-white/40">STATUS</div>
          <div className="text-[#55e6a5] font-mono mt-0.5 flex items-center gap-1">
            <Icon name="check" size={11} color="#55e6a5" /> Deployed
          </div>
        </div>
      </div>
    </div>
  );
}
