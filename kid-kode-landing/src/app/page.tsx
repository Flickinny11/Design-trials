'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import PrismHost, { type ViewportPreset } from '@/components/prism-player/PrismHost';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import TopBar from '@/components/editor/overlays/TopBar';
import HubNav from '@/components/editor/overlays/HubNav';
import DetailCard from '@/components/editor/overlays/DetailCard';
import RightPane from '@/components/editor/panels/RightPane';
import SearchPalette from '@/components/editor/overlays/SearchPalette';
import Minimap from '@/components/editor/overlays/Minimap';
import AddNodeDialog from '@/components/editor/overlays/AddNodeDialog';
import { Icon } from '@/components/editor/icons/Icon';
import { populateElementImages } from '@/lib/editor/populate-element-images';

const GraphScene = dynamic(() => import('@/components/editor/graph/GraphScene'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#04050a]">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-[#5d8bff]/30 border-t-[#5d8bff] animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-[#a978ff]/30 border-b-[#a978ff] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.4s' }} />
        </div>
        <div className="text-[10px] font-mono tracking-widest text-white/45 flex items-center gap-1.5">
          <Icon name="sparkle" size={10} color="#5d8bff" glow />
          INITIALIZING PRISM RUNTIME
        </div>
      </div>
    </div>
  ),
});

export default function Page() {
  const [splitPct, setSplitPct] = useState(36);
  const [dragging, setDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  // viewMode lives on useGraphEditorStore (HL12 / Plan §P12) so Inspector's
  // "Preview in App UI" button can swap panes without prop-drilling.
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const setViewMode = useGraphEditorStore((s) => s.setViewMode);
  const [previewPreset, setPreviewPreset] = useState<ViewportPreset>('desktop');

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    populateElementImages().catch(() => {
      // Best-effort: GlassNode falls back to its procedural texture if the
      // atlas can't be read. Don't surface — boot continues regardless.
    });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const pct = (e.clientX / window.innerWidth) * 100;
      setSplitPct(Math.max(20, Math.min(65, pct)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // Pane visibility derived from the canonical viewMode (RA-06):
  //   - preview-hub / preview-app mount PrismHost full-width.
  //   - galaxy / hub-world mount the graph editor full-width.
  //   - canvas keeps the legacy split-pane authoring surface until EB-05-*
  //     replaces it with the dedicated single-canvas + viewport-frame view.
  const isPreviewMode = viewMode === 'preview-hub' || viewMode === 'preview-app';
  const showsSplit = viewMode === 'canvas';
  const showsPreview = isPreviewMode || showsSplit;
  const showsGraph = viewMode === 'galaxy' || viewMode === 'hub-world' || showsSplit;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#04050a]">
      {/* Ambient nebula backdrop */}
      <div
        className="absolute inset-0 pointer-events-none opacity-75"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 18% 20%, rgba(93,139,255,0.14) 0%, transparent 58%), radial-gradient(ellipse 70% 60% at 82% 82%, rgba(169,120,255,0.12) 0%, transparent 58%)',
        }}
      />

      {isDesktop ? (
        <>
          {/* View-mode toggle — canonical 5 modes (RA-06 / SC-001).
              galaxy:      stub of the App_Name_World galaxy view; renders the
                           graph for now (EB-03 wires real galaxy layout).
              hub-world:   3D knowledge-graph editor for the active hub
                           (replaces the legacy `editor` mode; default after
                           EB-01-04 wires the scene/topology sub-toggle).
              canvas:      single-canvas authoring surface; transitionally
                           shown as the legacy split-pane view so the
                           preview is reachable during migration (EB-05-*
                           introduces the dedicated viewport-frame canvas).
              preview-hub: mock app only, fixed viewport preset.
              preview-app: mock app only, preview-app route navigation
                           (EB-10 introduces multi-hub transitions). */}
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
            data-component="view-mode-toggle"
          >
            <div
              className="flex items-center gap-0.5 p-1 rounded-full border border-white/10"
              style={{
                background: 'rgba(8,10,26,0.78)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
              }}
            >
              {([
                { id: 'galaxy',      label: 'Galaxy' },
                { id: 'hub-world',   label: 'Hub World' },
                { id: 'canvas',      label: 'Canvas' },
                { id: 'preview-hub', label: 'Preview Hub' },
                { id: 'preview-app', label: 'Preview App' },
              ] as const).map((m) => {
                const active = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewMode(m.id)}
                    className={`px-3 h-7 rounded-full text-[11px] font-mono transition-all ${
                      active ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white/85 hover:bg-white/5'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {showsPreview && (
            <div
              data-pane="preview"
              className={`absolute top-0 bottom-0 left-0 ${showsSplit ? 'border-r border-white/5' : ''}`}
              style={{ width: showsSplit ? `${splitPct}%` : '100%' }}
            >
              <PrismHost
                viewportPreset={isPreviewMode ? previewPreset : 'fit'}
                showViewportControls={isPreviewMode}
                onPresetChange={setPreviewPreset}
              />
            </div>
          )}

          {showsSplit && (
            <div
              onMouseDown={() => setDragging(true)}
              className="absolute top-0 bottom-0 w-1 cursor-col-resize z-20 group"
              style={{ left: `calc(${splitPct}% - 2px)` }}
            >
              <div className="absolute inset-0 group-hover:bg-[#5d8bff]/30 transition-colors" />
              <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-1 h-12 rounded-full bg-white/10 group-hover:bg-[#5d8bff] transition-colors" />
            </div>
          )}

          {showsGraph && (
            <div
              data-pane="graph"
              className="absolute top-0 bottom-0 right-0"
              style={{ width: showsSplit ? `${100 - splitPct}%` : '100%' }}
            >
              <GraphScene />
              <TopBar />
              <HubNav />
              <Minimap />
              <DetailCard />
              <RightPane />
            </div>
          )}
        </>
      ) : (
        <>
          {/* Mobile: VERTICAL split — preview top 38%, graph bottom 62%. Both always visible. */}
          <div className="absolute inset-x-0 top-0 border-b border-white/5" style={{ height: '38%' }}>
            <PrismHost />
          </div>
          <div className="absolute inset-x-0 bottom-0" style={{ height: '62%' }}>
            <GraphScene />
            <TopBar />
            <HubNav />
            <DetailCard />
            <RightPane />
          </div>
        </>
      )}

      <SearchPalette />
      <AddNodeDialog />
    </main>
  );
}
