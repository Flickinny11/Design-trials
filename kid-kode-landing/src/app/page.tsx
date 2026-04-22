'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import PrismHost from '@/components/prism-player/PrismHost';
import TopBar from '@/components/editor/overlays/TopBar';
import HubNav from '@/components/editor/overlays/HubNav';
import DetailCard from '@/components/editor/overlays/DetailCard';
import Inspector from '@/components/editor/panels/Inspector';
import SearchPalette from '@/components/editor/overlays/SearchPalette';
import Minimap from '@/components/editor/overlays/Minimap';
import { Icon } from '@/components/editor/icons/Icon';

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

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
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
          {/* Left: Live Preview — always visible */}
          <div
            data-pane="preview"
            className="absolute top-0 bottom-0 left-0 border-r border-white/5"
            style={{ width: `${splitPct}%` }}
          >
            <PrismHost />
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={() => setDragging(true)}
            className="absolute top-0 bottom-0 w-1 cursor-col-resize z-20 group"
            style={{ left: `calc(${splitPct}% - 2px)` }}
          >
            <div className="absolute inset-0 group-hover:bg-[#5d8bff]/30 transition-colors" />
            <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-1 h-12 rounded-full bg-white/10 group-hover:bg-[#5d8bff] transition-colors" />
          </div>

          {/* Right: Graph — always visible */}
          <div
            data-pane="graph"
            className="absolute top-0 bottom-0 right-0"
            style={{ width: `${100 - splitPct}%` }}
          >
            <GraphScene />
            <TopBar />
            <HubNav />
            <Minimap />
            <DetailCard />
            <Inspector />
          </div>
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
            <Inspector />
          </div>
        </>
      )}

      <SearchPalette />
    </main>
  );
}
