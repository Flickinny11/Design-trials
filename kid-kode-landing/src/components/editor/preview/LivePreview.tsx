'use client';

import { useRef } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useElementCapture } from '@/lib/useElementCapture';
import { Icon } from '@/components/editor/icons/Icon';

export default function LivePreview() {
  const rootRef = useRef<HTMLDivElement>(null);
  const setLivePreviewHover = useGraphEditorStore((s) => s.setLivePreviewHover);
  const flyToNode = useGraphEditorStore((s) => s.flyToNode);
  const openInspector = useGraphEditorStore((s) => s.openInspector);
  const hoveredId = useGraphEditorStore((s) => s.hoveredNodeId);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const frozenIds = useGraphEditorStore((s) => s.frozenNodeIds);

  useElementCapture(rootRef, 0);

  const handleHover = (id: string | null) => setLivePreviewHover(id);
  const handleClick = (id: string) => { flyToNode(id); openInspector(); };

  const hiCls = (id: string) => {
    const sel = selectedId === id;
    const hov = hoveredId === id;
    if (sel) return 'outline outline-2 outline-[#ffd966] outline-offset-2 ring-4 ring-[#ffd96633]';
    if (hov) return 'outline outline-2 outline-[#5ee0ff] outline-offset-2';
    return '';
  };

  const FrozenBadge = ({ id }: { id: string }) =>
    frozenIds.has(id) ? (
      <div
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#8bb4ff]/25 border border-[#8bb4ff]/60 flex items-center justify-center z-10 shadow-md"
        title="Frozen — AI cannot edit"
      >
        <Icon name="snow" size={11} color="#c5d8ff" />
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="h-full overflow-y-auto overscroll-contain bg-gradient-to-b from-[#07081a] via-[#0a0b1c] to-[#050612]">
      <div className="sticky top-0 z-20 bg-black/55 backdrop-blur-xl border-b border-white/5 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5577]/80 shadow-[0_0_6px_rgba(255,85,119,0.5)]" />
          <div className="w-3 h-3 rounded-full bg-[#ffd966]/80 shadow-[0_0_6px_rgba(255,217,102,0.5)]" />
          <div className="w-3 h-3 rounded-full bg-[#55e6a5]/80 shadow-[0_0_6px_rgba(85,230,165,0.5)]" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-1 rounded-md bg-white/[0.04] text-[11px] text-white/50 font-mono border border-white/5 flex items-center gap-1.5">
            <Icon name="eye" size={10} color="#7a86a8" />
            kriptik.app/preview
          </div>
        </div>
        <span className="text-[9px] text-[#55e6a5] font-mono tracking-widest flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#55e6a5] animate-pulse" />
          LIVE
        </span>
      </div>

      <div
        data-node-id="home-navbar"
        className={`relative px-5 py-3.5 flex items-center justify-between bg-[#0a0a14] border-b border-white/5 cursor-pointer transition-all duration-300 active:scale-[0.98] ${hiCls('home-navbar')}`}
        onMouseEnter={() => handleHover('home-navbar')}
        onMouseLeave={() => handleHover(null)}
        onClick={() => handleClick('home-navbar')}
      >
        <FrozenBadge id="home-navbar" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5d8bff] via-[#a978ff] to-[#ff6ec7] flex items-center justify-center shadow-[0_0_16px_rgba(93,139,255,0.45)]">
            <Icon name="sparkle" size={14} color="#fff" />
          </div>
          <span className="font-display font-bold text-[#e8eaf5] tracking-tight">Kriptik</span>
        </div>
        <div className="hidden md:flex gap-5 text-[13px] text-white/60">
          <span className="transition-colors duration-200 hover:text-white cursor-pointer">Product</span>
          <span className="transition-colors duration-200 hover:text-white cursor-pointer">Builders</span>
          <span className="transition-colors duration-200 hover:text-white cursor-pointer">Pricing</span>
        </div>
        <div
          data-node-id="auth-btn"
          className={`relative px-3.5 py-1.5 rounded-full bg-white/10 text-white/90 text-[12px] font-medium border border-white/10 transition-all duration-300 active:scale-[0.98] hover:bg-white/15 ${hiCls('auth-btn')}`}
          onMouseEnter={(e) => { e.stopPropagation(); handleHover('auth-btn'); }}
          onMouseLeave={(e) => { e.stopPropagation(); handleHover(null); }}
          onClick={(e) => { e.stopPropagation(); handleClick('auth-btn'); }}
        >
          <FrozenBadge id="auth-btn" />
          Sign in
        </div>
      </div>

      <div
        data-node-id="home-hero"
        className={`relative px-6 py-12 md:py-16 cursor-pointer transition-all duration-300 active:scale-[0.98] ${hiCls('home-hero')}`}
        onMouseEnter={() => handleHover('home-hero')}
        onMouseLeave={() => handleHover(null)}
        onClick={() => handleClick('home-hero')}
      >
        <FrozenBadge id="home-hero" />
        <div className="text-center max-w-md mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-white/55 mb-5 tracking-widest">
            <Icon name="sparkle" size={10} color="#a978ff" />
            DIFFUSION NATIVE
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-[1.05] bg-gradient-to-r from-white via-[#c5b5ff] to-[#5ee0ff] bg-clip-text text-transparent">
            Build apps<br />that think
          </h1>
          <p className="mt-4 text-sm text-white/55 leading-relaxed">
            The diffusion-powered builder that turns language into living interfaces.
          </p>
          <div
            data-node-id="home-cta"
            className={`relative mt-6 inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-br from-[#55e6a5] to-[#22c55e] text-black font-semibold text-sm shadow-[0_0_36px_rgba(85,230,165,0.45)] transition-all duration-300 active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-[0_0_48px_rgba(85,230,165,0.7)] animate-[shimmer_3s_ease-in-out_infinite] ${hiCls('home-cta')}`}
            onMouseEnter={(e) => { e.stopPropagation(); handleHover('home-cta'); }}
            onMouseLeave={(e) => { e.stopPropagation(); handleHover(null); }}
            onClick={(e) => { e.stopPropagation(); handleClick('home-cta'); }}
          >
            <FrozenBadge id="home-cta" />
            Get Started
            <Icon name="chevron" size={14} color="#000" />
          </div>
        </div>
      </div>

      <div
        data-node-id="home-features"
        className={`relative grid grid-cols-3 gap-2 px-4 pb-4 cursor-pointer transition-all duration-300 active:scale-[0.98] ${hiCls('home-features')}`}
        onMouseEnter={() => handleHover('home-features')}
        onMouseLeave={() => handleHover(null)}
        onClick={() => handleClick('home-features')}
      >
        <FrozenBadge id="home-features" />
        {[
          { title: 'Diffusion', icon: 'sparkle' as const, grad: 'from-[#5d8bff] to-[#a978ff]' },
          { title: 'Knowledge Graph', icon: 'grid' as const, grad: 'from-[#a978ff] to-[#ff9a44]' },
          { title: 'PixiJS v8', icon: 'zap' as const, grad: 'from-[#55e6a5] to-[#5ee0ff]' },
        ].map((t) => (
          <div key={t.title} className="rounded-xl p-3 bg-white/[0.025] border border-white/5 hover:bg-white/[0.045] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(93,139,255,0.2)]">
            <div className={`w-9 h-9 rounded-xl mb-2 flex items-center justify-center bg-gradient-to-br ${t.grad} shadow-[0_4px_16px_rgba(93,139,255,0.3)]`}>
              <Icon name={t.icon} size={16} color="#fff" />
            </div>
            <div className="text-[11px] font-semibold text-white/85 mb-0.5">{t.title}</div>
            <div className="text-[9px] text-white/40 leading-tight">Images become UI elements</div>
          </div>
        ))}
      </div>

      <div
        data-node-id="home-testimonial"
        className={`relative mx-4 mb-4 p-4 rounded-2xl bg-white/[0.025] border border-white/5 cursor-pointer transition-all duration-300 active:scale-[0.98] hover:border-white/20 ${hiCls('home-testimonial')}`}
        onMouseEnter={() => handleHover('home-testimonial')}
        onMouseLeave={() => handleHover(null)}
        onClick={() => handleClick('home-testimonial')}
      >
        <FrozenBadge id="home-testimonial" />
        <p className="text-sm italic text-white/75 font-serif leading-relaxed">
          "Changes everything about how we ship."
        </p>
        <div className="flex items-center gap-2 mt-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#a978ff] to-[#ff9a44]" />
          <div>
            <div className="text-[11px] font-semibold text-white/85">Alex Rivera</div>
            <div className="text-[9px] text-white/40">CTO at Nova</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 text-[9px] font-mono text-white/30 tracking-widest border-t border-white/5 bg-black/20 flex items-center gap-2">
        <Icon name="chart" size={10} color="#a978ff" />
        DASHBOARD HUB
      </div>

      <div className="flex gap-2 px-3 py-3">
        <div
          data-node-id="dash-sidebar"
          className={`relative w-24 rounded-xl bg-[#0d0f22] border border-white/5 p-2.5 cursor-pointer transition-all duration-300 active:scale-[0.98] ${hiCls('dash-sidebar')}`}
          onMouseEnter={() => handleHover('dash-sidebar')}
          onMouseLeave={() => handleHover(null)}
          onClick={() => handleClick('dash-sidebar')}
        >
          <FrozenBadge id="dash-sidebar" />
          <div className="space-y-2">
            {['Home', 'Analytics', 'Orders', 'Team', 'Settings'].map((item, i) => (
              <div key={item} className={`flex items-center gap-1.5 text-[10px] ${i === 1 ? 'text-[#5d8bff] font-semibold' : 'text-white/45'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${i === 1 ? 'bg-[#5d8bff] shadow-[0_0_6px_#5d8bff]' : 'bg-white/20'}`} />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div
            data-node-id="dash-filter"
            className={`relative flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/5 cursor-pointer transition-all duration-300 active:scale-[0.98] ${hiCls('dash-filter')}`}
            onMouseEnter={() => handleHover('dash-filter')}
            onMouseLeave={() => handleHover(null)}
            onClick={() => handleClick('dash-filter')}
          >
            <FrozenBadge id="dash-filter" />
            <Icon name="search" size={11} color="#6b7694" />
            <span className="text-[10px] text-white/40">Filter activity…</span>
          </div>

          <div
            data-node-id="dash-stats"
            className={`relative p-3 rounded-xl bg-gradient-to-br from-[#1a1b30] to-[#0f1022] border border-white/5 cursor-pointer transition-all duration-300 active:scale-[0.98] hover:border-white/20 ${hiCls('dash-stats')}`}
            onMouseEnter={() => handleHover('dash-stats')}
            onMouseLeave={() => handleHover(null)}
            onClick={() => handleClick('dash-stats')}
          >
            <FrozenBadge id="dash-stats" />
            <div className="text-[9px] font-mono text-white/40 tracking-widest">ACTIVE USERS</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <div className="text-xl font-display font-bold text-white">12,487</div>
              <div className="flex items-center gap-0.5 text-[10px] text-[#55e6a5] font-semibold">
                <Icon name="arrowRight" size={10} color="#55e6a5" style={{ transform: 'rotate(-45deg)' }} />
                8.2%
              </div>
            </div>
          </div>

          <div
            data-node-id="dash-chart"
            className={`relative p-3 rounded-xl bg-[#0f1022] border border-[#ef4466]/30 cursor-pointer transition-all duration-300 active:scale-[0.98] hover:border-[#ef4466]/50 ${hiCls('dash-chart')}`}
            onMouseEnter={() => handleHover('dash-chart')}
            onMouseLeave={() => handleHover(null)}
            onClick={() => handleClick('dash-chart')}
          >
            <FrozenBadge id="dash-chart" />
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] font-mono text-white/40 tracking-widest">7-DAY TREND</div>
              <div className="text-[9px] font-mono text-[#ef4466] animate-pulse">◆ FAILED</div>
            </div>
            <svg viewBox="0 0 120 40" className="w-full h-10">
              <path d="M0,30 Q15,10 30,22 T60,18 T90,26 T120,14" stroke="#5d8bff" strokeWidth="1.8" fill="none" />
              <path d="M0,30 Q15,10 30,22 T60,18 T90,26 T120,14 L120,40 L0,40 Z" fill="url(#cg)" opacity="0.4" />
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#5d8bff" />
                  <stop offset="1" stopColor="#5d8bff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div
            data-node-id="dash-table"
            className={`relative p-2 rounded-xl bg-white/[0.025] border border-white/5 cursor-pointer transition-all duration-300 active:scale-[0.98] hover:border-white/20 ${hiCls('dash-table')}`}
            onMouseEnter={() => handleHover('dash-table')}
            onMouseLeave={() => handleHover(null)}
            onClick={() => handleClick('dash-table')}
          >
            <FrozenBadge id="dash-table" />
            <div className="grid grid-cols-3 gap-2 text-[9px] font-mono text-white/40 pb-1 border-b border-white/5">
              <span>NAME</span><span>STATUS</span><span>DATE</span>
            </div>
            {[['user.login','ok','12:04'],['checkout','ok','11:58'],['sync.err','fail','11:42']].map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 text-[10px] text-white/70 py-1">
                <span className="font-mono">{row[0]}</span>
                <span className={row[1] === 'ok' ? 'text-[#55e6a5]' : 'text-[#ef4466]'}>{row[1]}</span>
                <span className="text-white/40 font-mono">{row[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-2 text-[9px] font-mono text-white/30 tracking-widest border-t border-white/5 bg-black/20 flex items-center gap-2">
        <Icon name="user" size={10} color="#ff9a44" />
        PROFILE HUB
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div
            data-node-id="prof-avatar"
            className={`relative w-12 h-12 rounded-full bg-gradient-to-br from-[#a978ff] to-[#ff9a44] flex items-center justify-center font-bold text-white cursor-pointer transition-all duration-300 active:scale-[0.98] ${hiCls('prof-avatar')}`}
            onMouseEnter={() => handleHover('prof-avatar')}
            onMouseLeave={() => handleHover(null)}
            onClick={() => handleClick('prof-avatar')}
          >
            <FrozenBadge id="prof-avatar" />
            LH
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#55e6a5] border-2 border-black animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">Logan H.</div>
            <div className="text-[10px] text-white/40">logan@kriptik.app</div>
          </div>
          <div
            data-node-id="dash-notif-badge"
            className={`relative w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-[0.98] hover:bg-white/10 ${hiCls('dash-notif-badge')}`}
            onMouseEnter={() => handleHover('dash-notif-badge')}
            onMouseLeave={() => handleHover(null)}
            onClick={() => handleClick('dash-notif-badge')}
          >
            <FrozenBadge id="dash-notif-badge" />
            <Icon name="pin" size={14} color="#b5bddf" />
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff5577] text-[9px] font-bold text-white flex items-center justify-center shadow-[0_0_8px_rgba(255,85,119,0.65)]">3</div>
          </div>
        </div>

        <div
          data-node-id="prof-tabs"
          className={`relative flex gap-0 border-b border-white/10 cursor-pointer transition-all duration-300 active:scale-[0.98] ${hiCls('prof-tabs')}`}
          onMouseEnter={() => handleHover('prof-tabs')}
          onMouseLeave={() => handleHover(null)}
          onClick={() => handleClick('prof-tabs')}
        >
          <FrozenBadge id="prof-tabs" />
          {['Account','Security','Billing'].map((t, i) => (
            <div key={t} className={`px-3 py-2 text-[11px] font-medium relative ${i === 0 ? 'text-white' : 'text-white/40'}`}>
              {t}
              {i === 0 && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#5d8bff]" />}
            </div>
          ))}
        </div>

        <div
          data-node-id="prof-edit"
          className={`relative p-3 rounded-xl bg-white/[0.025] border border-white/5 space-y-2 cursor-pointer transition-all duration-300 active:scale-[0.98] hover:border-white/20 ${hiCls('prof-edit')}`}
          onMouseEnter={() => handleHover('prof-edit')}
          onMouseLeave={() => handleHover(null)}
          onClick={() => handleClick('prof-edit')}
        >
          <FrozenBadge id="prof-edit" />
          <div className="text-[10px] font-mono text-white/40 tracking-widest">EDIT PROFILE</div>
          {['Display name','Email address'].map((label) => (
            <div key={label}>
              <div className="text-[9px] text-white/40 mb-1">{label}</div>
              <div className="h-7 rounded-md bg-black/30 border border-white/10" />
            </div>
          ))}
        </div>

        <div
          data-node-id="prof-payment"
          className={`relative p-3 rounded-xl bg-white/[0.025] border border-[#ef4466]/30 space-y-2 cursor-pointer transition-all duration-300 active:scale-[0.98] hover:border-[#ef4466]/50 ${hiCls('prof-payment')}`}
          onMouseEnter={() => handleHover('prof-payment')}
          onMouseLeave={() => handleHover(null)}
          onClick={() => handleClick('prof-payment')}
        >
          <FrozenBadge id="prof-payment" />
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-white/40 tracking-widest flex items-center gap-1.5">
              <Icon name="lock" size={10} color="#7a86a8" /> PAYMENT
            </div>
            <div className="text-[9px] font-mono text-[#ef4466] animate-pulse">◆ FAILED</div>
          </div>
          <div className="h-7 rounded-md bg-black/30 border border-white/10 font-mono text-[10px] text-white/30 flex items-center px-2">
            •••• •••• •••• ••••
          </div>
        </div>
      </div>

      <div
        data-node-id="home-footer"
        className={`relative bg-[#030412] p-4 border-t border-white/5 cursor-pointer transition-all duration-300 active:scale-[0.98] ${hiCls('home-footer')}`}
        onMouseEnter={() => handleHover('home-footer')}
        onMouseLeave={() => handleHover(null)}
        onClick={() => handleClick('home-footer')}
      >
        <FrozenBadge id="home-footer" />
        <div className="grid grid-cols-3 gap-2 mb-3">
          {['Product','Company','Legal'].map((t) => (
            <div key={t}>
              <div className="text-[10px] font-semibold text-white/75 mb-1">{t}</div>
              <div className="space-y-0.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-1.5 rounded bg-white/10 w-3/4" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-[9px] text-white/30 font-mono pt-2 border-t border-white/5">
          © 2026 Kriptik — All rights reserved
        </div>
      </div>
    </div>
  );
}
