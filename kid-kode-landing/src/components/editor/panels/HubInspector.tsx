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
import { DS } from '@/components/editor/design-system';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { useEditorDensity } from '@/stores/useEditorLayoutStore';
import { BottomSheet } from '@/components/editor/layout/BottomSheet';
import { HubBackgroundPicker } from './HubBackgroundPicker';
import { SceneFxPicker } from './SceneFxPicker';
import { HubRenderModeToggle } from './HubRenderModeToggle';

const TABS: { id: InspectorTab; label: string; icon: string }[] = [
  { id: 'visual', label: 'Visual', icon: 'eye' },
  { id: 'behavior', label: 'Behavior', icon: 'flow' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'animation', label: 'Animation', icon: 'play' },
  { id: 'connections', label: 'Links', icon: 'link' },
  { id: 'backend', label: 'Backend', icon: 'server' },
];

export default function HubInspector() {
  // UI-FIDELITY-2 — hero glass: the hub inspector plate refracts the live
  // scene (same slab recipe as Inspector.tsx; hooks before the early return).
  const hubSlab = useChromeSlab({ material: 'glass', radius: 18, accent: 1, frost: 0.6 });
  // UI-FIDELITY-2 — machined header plate as real brushed metal.
  const headerSlab = useChromeSlab({ material: 'metal', radius: 13, brushAxis: 'x' });
  // UI-WOW-2 P0 — compact pane re-houses this panel as a draggable BottomSheet
  // instead of the edge-to-edge full-height slab. Hook called unconditionally,
  // before the early returns below (hook-order invariant).
  const density = useEditorDensity();
  const compact = density === 'compact';
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

  const inner = (
    <>
      {/* Machined header plate — brushed metal fitting riveted into the glass. */}
      <div ref={headerSlab.ref} className="flex items-center justify-between gap-2 px-4 py-3 m-3 mb-0 ds-metal ds-grain ds-edge rounded-ds-md">
        <div className="min-w-0 flex-1">
          <div className="ds-kicker flex items-center gap-1.5">
            <span>INSPECTOR</span>
            <Icon name="chevron" size={9} color={DS.textLow} />
            <span className="text-ds-text-mid">hub</span>
          </div>
          <div className="font-display font-bold text-ds-text-hi text-lg leading-tight flex items-center gap-2">
            {hub.title}
          </div>
        </div>
        <button
          onClick={close}
          className="ds-btn ds-btn--quiet !px-0 w-8 h-8 !rounded-full shrink-0"
        >
          <Icon name="close" size={12} color={DS.text} />
        </button>
      </div>

      {/* Tab rail — engraved chips, brass-lit when active. */}
      <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`ds-chip ds-press cursor-pointer whitespace-nowrap min-h-[40px] px-3 gap-1.5 ${
                active ? 'ds-chip--metal' : 'hover:text-ds-text'
              }`}
            >
              <Icon name={t.icon} size={11} color={active ? DS.metal400 : DS.textMid} glow={active} />
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
    </>
  );

  // Compact pane → draggable bottom sheet (the hub inspector was the worst
  // offender: edge-to-edge, full viewport height, covering the top bar AND
  // tool rail on phones). Regular/wide → the shipped floating glass housing,
  // byte-identical to before.
  if (compact) {
    return (
      <BottomSheet id="inspector" open onClose={close} initialSnap="half">
        {inner}
      </BottomSheet>
    );
  }

  return (
    // Hero surface — frosted observatory glass with brass-fitted edge.
    // RefractionDefs is mounted once in src/app/page.tsx; RightPane mounts
    // either this panel OR Inspector (never both), so the refract budget is 1.
    <div
      ref={hubSlab.ref}
      className="absolute z-40 right-0 top-0 bottom-0 w-full md:w-[460px] md:right-3 md:top-3 md:bottom-3 flex flex-col overflow-hidden ds-glass ds-glass--refract ds-edge--metal ds-elev-4 rounded-none md:rounded-ds-lg ds-reveal-r"
    >
      {inner}
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
      {/* W-2D — per-hub 2d/3d composition mode (galaxy + canvas inspector). */}
      <HubRenderModeToggle hub={hub} surface="hub-inspector" />

      {/* THREE-D-BACKGROUNDS — droppable, customizable 3D background asset picker. */}
      <HubBackgroundPicker hub={hub} />

      {/* W8 E9/E10 — custom-cursor layer + scene-transition preset for this hub. */}
      <SceneFxPicker hub={hub} />

      {hub.caption && (
        <>
          <div className="ds-kicker">CAPTION</div>
          <div className="px-3 py-2.5 ds-well rounded-ds-md text-[12px] text-ds-text leading-relaxed">
            {hub.caption}
          </div>
        </>
      )}

      <div className="ds-kicker pt-2">LAYOUT</div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <SpecRow icon="grid" label="Viewport">
          <span className="text-ds-text font-mono">{layout.viewportWidth}×{layout.viewportHeight}</span>
        </SpecRow>
        <SpecRow icon="layers" label="Content H">
          <span className="text-ds-text font-mono">{layout.contentHeight}px</span>
        </SpecRow>
        <SpecRow icon="sparkle" label="Bg">
          <span className="text-ds-text font-mono">{layout.backgroundColor}</span>
        </SpecRow>
        <SpecRow icon="home" label="Hub ID">
          <span className="text-ds-text font-mono">{hub.hubId}</span>
        </SpecRow>
      </div>

      <div className="ds-kicker pt-2">RESPONSIVE BREAKPOINTS</div>
      <div className="space-y-1.5">
        {Object.keys(breakpoints).length === 0 ? (
          <div className="text-[11px] text-ds-text-low italic">No responsiveBreakpoints declared</div>
        ) : (
          Object.entries(breakpoints).map(([name, bp]) =>
            bp ? (
              <div key={name} className="px-3 py-2 ds-well rounded-ds-md flex items-center justify-between">
                <span className="text-[11px] text-ds-text font-mono">{name}</span>
                <div className="flex gap-3 text-[10px] font-mono text-ds-text-mid">
                  <span>≤{bp.maxWidth}px</span>
                  <span className="text-ds-metal-300">×{bp.scale}</span>
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
      <div className="ds-kicker">GLOBAL BINDINGS</div>
      <div className="space-y-2">
        {bindings.length === 0 ? (
          <div className="text-[11px] text-ds-text-low italic">No global state/theme bindings declared</div>
        ) : (
          bindings.map((b, i) => (
            <div key={i} className="px-3 py-2.5 ds-well rounded-ds-md">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="ds-chip ds-chip--metal">{b.target}</span>
                <Icon name="chevron" size={9} color={DS.textLow} />
                <span className="text-ds-text-mid font-mono text-[11px] truncate">{b.source}</span>
              </div>
              <div className="text-[9px] font-mono text-ds-text-low mt-1">via {b.nodeId}</div>
            </div>
          ))
        )}
      </div>

      <div className="ds-kicker pt-3">EVENT FAN-OUT</div>
      <div className="text-[11px] text-ds-text-mid leading-relaxed">
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
      <div className="ds-kicker">MANIFEST</div>
      {/* Manifest trough — carved well with an engraved path header. */}
      <div className="ds-well ds-edge rounded-ds-md overflow-hidden">
        <div className="px-3 py-2 border-b border-white/5 text-[10px] font-mono text-ds-text-low">
          public/prism-assets/mock-app.prism :: manifest.json
        </div>
        <pre className="p-3 text-[10.5px] font-mono leading-relaxed overflow-x-auto text-ds-text">
          <code>{JSON.stringify(manifest, null, 2)}</code>
        </pre>
      </div>

      <div className="ds-kicker pt-2">BUILD COMMANDS</div>
      <div className="space-y-1.5 text-[11px] font-mono text-ds-text-mid">
        <div className="px-3 py-1.5 ds-well rounded-ds-md">npm run build:atlas</div>
        <div className="px-3 py-1.5 ds-well rounded-ds-md">npm run build:msdf</div>
        <div className="px-3 py-1.5 ds-well rounded-ds-md">npm run build:prism</div>
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
      <div className="ds-kicker">HUB-LEVEL ANIMATIONS</div>
      <div className="space-y-1.5">
        {animated.length === 0 ? (
          <div className="text-[11px] text-ds-text-low italic">No animated nodes in this hub</div>
        ) : (
          animated.map((n) => (
            <div key={n.nodeId} className="px-3 py-2 ds-well rounded-ds-md flex items-center justify-between">
              <span className="text-[11px] text-ds-text font-mono truncate">{n.nodeId}</span>
              <div className="flex gap-2 text-[10px] font-mono text-ds-text-mid">
                <span>{n.visual.frameCount} frames</span>
                {(() => {
                  const fps = (n.intent?.animationSpec as { fps?: number } | undefined)?.fps;
                  return typeof fps === 'number' ? <span className="text-ds-metal-300">@ {fps}fps</span> : null;
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
      <div className="ds-kicker">ATTACHED NODES ({hubNodes.length})</div>
      <div className="space-y-1.5">
        {hubNodes.length === 0 ? (
          <div className="text-[11px] text-ds-text-low italic">No nodes attached</div>
        ) : (
          hubNodes.map((n) => (
            <button
              key={n.nodeId}
              onClick={() => onPickNode(n.nodeId)}
              className="w-full px-3 py-2 ds-well ds-edge rounded-ds-md ds-lift text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ds-text font-mono truncate">{n.nodeId}</span>
                <Icon name="chevron" size={11} color={DS.textLow} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
              {n.intent?.caption && (
                <div className="text-[10px] text-ds-text-low mt-0.5 truncate">{n.intent.caption.slice(0, 80)}</div>
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
    <div className="p-5 text-center text-ds-text-low text-[12px] italic">
      Hubs do not declare backend contracts. Per-node backend bindings live on each node's Backend tab.
    </div>
  );
}

// ── Shared row helper (mirrors Inspector.tsx SpecRow) ──────────────────────
function SpecRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 ds-well rounded-ds-md flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={11} color={DS.textLow} />
        <span className="ds-label">{label}</span>
      </div>
      {children}
    </div>
  );
}
