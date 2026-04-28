'use client';

// HubInspector — opens when a hub is selected in the 3D scene.
// Visual chrome mirrors Inspector.tsx (gradient bg, blur, INSPECTOR tag,
// six-tab strip, slide-in animation); tab content is hub-specific.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 3.

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore, type InspectorTab } from '@/stores/useGraphEditorStore';
import type { PrismHub, PrismNode } from '@/lib/prism-graph/types';
import { Icon } from '@/components/editor/icons/Icon';

const TABS: { id: InspectorTab; label: string; icon: string }[] = [
  { id: 'visual', label: 'Visual', icon: 'eye' },
  { id: 'behavior', label: 'Behavior', icon: 'flow' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'animation', label: 'Animation', icon: 'play' },
  { id: 'connections', label: 'Links', icon: 'link' },
  { id: 'backend', label: 'Backend', icon: 'server' },
];

export default function HubInspector() {
  const open = useGraphEditorStore((s) => s.inspectorOpen);
  const close = useGraphEditorStore((s) => s.closeInspector);
  const selectedHubId = useGraphEditorStore((s) => s.selectedHubId);
  const tab = useGraphEditorStore((s) => s.inspectorTab);
  const setTab = useGraphEditorStore((s) => s.setInspectorTab);
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  const flyToNode = useGraphEditorStore((s) => s.flyToNode);

  const hubs = useGraphSourceStore((s) => s.hubs);
  const nodes = useGraphSourceStore((s) => s.nodes);

  if (!open || !selectedHubId) return null;
  const hub = hubs.find((h) => h.hubId === selectedHubId);
  if (!hub) return null;

  const hubNodes = nodes.filter((n) => n.parentHubId === hub.hubId);

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
            <span className="text-white/60">hub</span>
          </div>
          <div className="font-display font-bold text-white text-lg leading-tight flex items-center gap-2">
            {hub.title}
          </div>
        </div>
        <button
          onClick={close}
          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <Icon name="close" size={12} color="#c5ccea" />
        </button>
      </div>

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

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {tab === 'visual' && <HubVisualTab hub={hub} />}
        {tab === 'behavior' && <HubBehaviorTab nodes={hubNodes} />}
        {tab === 'code' && <HubCodeTab hub={hub} hubNodes={hubNodes} />}
        {tab === 'animation' && <HubAnimationTab hubNodes={hubNodes} />}
        {tab === 'connections' && (
          <HubConnectionsTab
            hubNodes={hubNodes}
            onPickNode={(id) => {
              selectNode(id);
              flyToNode(id);
            }}
          />
        )}
        {tab === 'backend' && <HubBackendTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VISUAL TAB — hub.caption + layout + responsiveBreakpoints
// ═══════════════════════════════════════════════════════════════════
function HubVisualTab({ hub }: { hub: PrismHub }) {
  const layout = hub.layout;
  const breakpoints = hub.responsiveBreakpoints ?? {};
  return (
    <div className="p-5 space-y-4">
      {hub.caption && (
        <>
          <div className="text-[9px] font-mono tracking-widest text-white/40">CAPTION</div>
          <div className="px-3 py-2.5 rounded-lg bg-white/[0.025] border border-white/5 text-[12px] text-white/80 leading-relaxed">
            {hub.caption}
          </div>
        </>
      )}

      <div className="text-[9px] font-mono tracking-widest text-white/40 pt-2">LAYOUT</div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <SpecRow icon="grid" label="Viewport">
          <span className="text-white/85 font-mono">{layout.viewportWidth}×{layout.viewportHeight}</span>
        </SpecRow>
        <SpecRow icon="layers" label="Content H">
          <span className="text-white/85 font-mono">{layout.contentHeight}px</span>
        </SpecRow>
        <SpecRow icon="sparkle" label="Bg">
          <span className="text-white/85 font-mono">{layout.backgroundColor}</span>
        </SpecRow>
        <SpecRow icon="home" label="Hub ID">
          <span className="text-white/85 font-mono">{hub.hubId}</span>
        </SpecRow>
      </div>

      <div className="text-[9px] font-mono tracking-widest text-white/40 pt-2">RESPONSIVE BREAKPOINTS</div>
      <div className="space-y-1.5">
        {Object.keys(breakpoints).length === 0 ? (
          <div className="text-[11px] text-white/40 italic">No responsiveBreakpoints declared</div>
        ) : (
          Object.entries(breakpoints).map(([name, bp]) =>
            bp ? (
              <div key={name} className="px-3 py-2 rounded-lg bg-white/[0.025] border border-white/5 flex items-center justify-between">
                <span className="text-[11px] text-white/85 font-mono">{name}</span>
                <div className="flex gap-3 text-[10px] font-mono text-white/55">
                  <span>≤{bp.maxWidth}px</span>
                  <span className="text-[#5d8bff]">×{bp.scale}</span>
                </div>
              </div>
            ) : null
          )
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BEHAVIOR TAB — global theme/data bindings sourced from any node
//   whose dataBindings.target starts with `state.` or `theme.`.
// ═══════════════════════════════════════════════════════════════════
function HubBehaviorTab({ nodes }: { nodes: PrismNode[] }) {
  // Surface bindings whose *source* is a hub-global concern: the page theme,
  // any `state.*` store key, or a `hub.*`-scoped value. Matching on source
  // (rather than target) catches the canonical `{source: "theme", target:
  // "visual.tint"}` page-background binding plus every `state.*` binding,
  // while excluding purely-local visual ties.
  const bindings = nodes.flatMap((n) => {
    const list = n.intent?.behaviorSpec?.dataBindings ?? [];
    return list
      .filter((b) => {
        if (typeof b.source !== 'string') return false;
        return b.source === 'theme' || b.source.startsWith('state.') || b.source.startsWith('hub.');
      })
      .map((b) => ({ nodeId: n.nodeId, source: b.source, target: b.target }));
  });
  return (
    <div className="p-5 space-y-4">
      <div className="text-[9px] font-mono tracking-widest text-white/40">GLOBAL BINDINGS</div>
      <div className="space-y-2">
        {bindings.length === 0 ? (
          <div className="text-[11px] text-white/40 italic">No global state/theme bindings declared</div>
        ) : (
          bindings.map((b, i) => (
            <div key={i} className="px-3 py-2.5 rounded-lg bg-white/[0.025] border border-white/5">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="px-1.5 py-0.5 rounded bg-[#a978ff]/15 text-[#a978ff] font-mono text-[10px]">{b.target}</span>
                <Icon name="chevron" size={9} color="#6b7694" />
                <span className="text-white/65 font-mono text-[11px] truncate">{b.source}</span>
              </div>
              <div className="text-[9px] font-mono text-white/40 mt-1">via {b.nodeId}</div>
            </div>
          ))
        )}
      </div>

      <div className="text-[9px] font-mono tracking-widest text-white/40 pt-3">EVENT FAN-OUT</div>
      <div className="text-[11px] text-white/65 leading-relaxed">
        {nodes.length} nodes attached to this hub.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CODE TAB — manifest snippet / artifactHash / build commands
// ═══════════════════════════════════════════════════════════════════
function HubCodeTab({ hub, hubNodes }: { hub: PrismHub; hubNodes: PrismNode[] }) {
  // The .prism artifactHash is computed at build time and not bundled into
  // the source; show a placeholder pointer to manifest.json so users know
  // where to look. Live manifest data could be wired through later via a
  // build-time inject.
  const manifest = {
    prismVersion: '0.1.0',
    entryHub: hub.hubId,
    nodeCount: hubNodes.length,
    artifactHash: 'see public/prism-assets/mock-app.prism manifest.json',
  };
  return (
    <div className="p-5 space-y-3">
      <div className="text-[9px] font-mono tracking-widest text-white/40">MANIFEST</div>
      <div className="rounded-xl border border-white/10 bg-black/45 overflow-hidden">
        <div className="px-3 py-2 border-b border-white/5 text-[10px] font-mono text-white/40">
          public/prism-assets/mock-app.prism :: manifest.json
        </div>
        <pre className="p-3 text-[10.5px] font-mono leading-relaxed overflow-x-auto text-white/82">
          <code>{JSON.stringify(manifest, null, 2)}</code>
        </pre>
      </div>

      <div className="text-[9px] font-mono tracking-widest text-white/40 pt-2">BUILD COMMANDS</div>
      <div className="space-y-1.5 text-[11px] font-mono text-white/75">
        <div className="px-3 py-1.5 rounded-lg bg-white/[0.025] border border-white/5">npm run build:atlas</div>
        <div className="px-3 py-1.5 rounded-lg bg-white/[0.025] border border-white/5">npm run build:msdf</div>
        <div className="px-3 py-1.5 rounded-lg bg-white/[0.025] border border-white/5">npm run build:prism</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ANIMATION TAB — read-only summary of hub-level animations
// ═══════════════════════════════════════════════════════════════════
function HubAnimationTab({ hubNodes }: { hubNodes: PrismNode[] }) {
  const animated = hubNodes.filter((n) => {
    const fc = n.visual?.frameCount ?? 0;
    return fc > 1;
  });
  return (
    <div className="p-5 space-y-3">
      <div className="text-[9px] font-mono tracking-widest text-white/40">HUB-LEVEL ANIMATIONS</div>
      <div className="space-y-1.5">
        {animated.length === 0 ? (
          <div className="text-[11px] text-white/40 italic">No animated nodes in this hub</div>
        ) : (
          animated.map((n) => (
            <div key={n.nodeId} className="px-3 py-2 rounded-lg bg-white/[0.025] border border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-white/85 font-mono truncate">{n.nodeId}</span>
              <div className="flex gap-2 text-[10px] font-mono text-white/55">
                <span>{n.visual.frameCount} frames</span>
                {(() => {
                  const fps = (n.intent?.animationSpec as { fps?: number } | undefined)?.fps;
                  return typeof fps === 'number' ? <span className="text-[#5d8bff]">@ {fps}fps</span> : null;
                })()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CONNECTIONS TAB — list nodes by parentHubId, click to switch selection
// ═══════════════════════════════════════════════════════════════════
function HubConnectionsTab({ hubNodes, onPickNode }: { hubNodes: PrismNode[]; onPickNode: (id: string) => void }) {
  return (
    <div className="p-5 space-y-3">
      <div className="text-[9px] font-mono tracking-widest text-white/40">ATTACHED NODES ({hubNodes.length})</div>
      <div className="space-y-1.5">
        {hubNodes.length === 0 ? (
          <div className="text-[11px] text-white/40 italic">No nodes attached</div>
        ) : (
          hubNodes.map((n) => (
            <button
              key={n.nodeId}
              onClick={() => onPickNode(n.nodeId)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.025] border border-white/5 hover:bg-white/[0.055] transition-colors text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-white/85 font-mono truncate">{n.nodeId}</span>
                <Icon name="chevron" size={11} color="#6b7694" className="group-hover:translate-x-0.5 transition-transform" />
              </div>
              {n.intent?.caption && (
                <div className="text-[10px] text-white/45 mt-0.5 truncate">{n.intent.caption.slice(0, 80)}</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BACKEND TAB — hubs do not own backends
// ═══════════════════════════════════════════════════════════════════
function HubBackendTab() {
  return (
    <div className="p-5 text-center text-white/40 text-[12px] italic">
      Hubs do not declare backend contracts. Per-node backend bindings live on each node's Backend tab.
    </div>
  );
}

// ── Shared row helper (mirrors Inspector.tsx SpecRow) ──────────────────────
function SpecRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
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
