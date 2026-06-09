'use client';

/**
 * STEP8 — Prism Canvas Toolbar (canvas-spec §5 the editing suite, §6 build
 * lifecycle, §8.4 keyframe editor, §14 selection/grouping, §1.3 boundary).
 *
 * The toolbar is part of the PRISM DESIGN SYSTEM: a glassy cosmic left rail of
 * grouped tool clusters with per-group flyouts, a slide-up keyframe editor, a
 * marquee-select overlay, and contextual "coming with <subsystem>" states for
 * the groups whose engines are not yet wired. It is the canvas authoring chrome
 * — it only renders while viewMode === 'canvas' (page.tsx gates it) and never
 * appears in galaxy or preview-app.
 *
 * WIRED NOW (their engines already exist):
 *   - Transform — select / Edit handles / move / rotate / scale / nudge / align
 *     / reset, all writing the node's OWN `scenePosition` (canvas-spec SC-9 /
 *     CORRECTED CONCEPT). Group selections cascade.
 *   - Selection — marquee + shift-click, Group / Ungroup (additive `groupId`,
 *     INV-1 topology untouched), Lock / Unlock, Freeze, Select-all-in-hub.
 *   - Build — Build Node / Rebuild (Step-5/6 surgical rebuild path) and Add to
 *     System (re-caption + clear dirty).
 *
 * DESIGNED-PLACEHOLDER (look complete, never fake output — clicking a deferred
 * tool surfaces a tasteful "coming with <subsystem>" state):
 *   - Add (← Media & Library pipeline), Image (← Media pipeline), 3D Object
 *     (← Mesh & Material systems), Text (← Text System / MSDF), Animation
 *     picker + triggers + from-scratch (← Primitive Catalog), Lighting
 *     (← Lighting & Material systems). The Keyframe Editor *toggle* is real
 *     (it slides the §8.4 editor in/out); its track content is designed.
 *
 * Boundary (canvas-spec §1.3 / FP): this surface authors visual + spatial +
 * animation only. Function/behavior wiring is the node editor. Trigger buttons
 * assign animation *drivers*, never app behavior.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useBuiltSnapshotStore } from '@/stores/useBuiltSnapshotStore';
import { commitPreviewToSource } from '@/lib/editor/preview-commit';
import { rebuildNode } from '@/lib/editor/rebuild-node';
import { addNodeToSystem } from '@/lib/editor/add-to-system';
import { Icon } from '@/components/editor/icons/Icon';
import type { GizmoMode } from '@/lib/editor/canvas-transform-gizmo';
import type {
  PrismNode,
  ScenePosition,
  PrismHub,
  PrismLight,
  PrismLightType,
  LightingSpec,
} from '@/lib/prism-graph/types';
import {
  LIGHTING_SPEC_DEFAULT,
  receivesLightingDefault,
} from '@/lib/prism-graph/types';

// ── Design tokens ──────────────────────────────────────────────────────────
const GLASS: React.CSSProperties = {
  background: 'rgba(8,10,26,0.82)',
  backdropFilter: 'blur(22px) saturate(180%)',
  WebkitBackdropFilter: 'blur(22px) saturate(180%)',
  boxShadow:
    '0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
};
const ACCENT = '#5d8bff';
const VIOLET = '#a978ff';
const GREEN = '#55e6a5';
const AMBER = '#f5a524';
const TRANSLATE_STEP = 0.06;
const ROTATE_STEP = Math.PI / 12; // 15°
const SCALE_FACTOR = 1.08;

type ToolGroupId =
  | 'transform'
  | 'selection'
  | 'add'
  | 'image'
  | 'object3d'
  | 'text'
  | 'animation'
  | 'lighting'
  | 'build';

interface ToolGroupMeta {
  id: ToolGroupId;
  icon: string;
  label: string;
  wired: boolean;
  subsystem?: string;
}

const GROUPS: ToolGroupMeta[] = [
  { id: 'transform', icon: 'move', label: 'Transform', wired: true },
  { id: 'selection', icon: 'group', label: 'Selection', wired: true },
  { id: 'add', icon: 'plus', label: 'Add', wired: false, subsystem: 'Media & Library pipeline' },
  { id: 'image', icon: 'image', label: 'Image', wired: false, subsystem: 'Media pipeline' },
  { id: 'object3d', icon: 'cube', label: '3D Object', wired: false, subsystem: 'Mesh & Material systems' },
  { id: 'text', icon: 'text', label: 'Text', wired: false, subsystem: 'Text System (MSDF)' },
  { id: 'animation', icon: 'wand', label: 'Animation', wired: false, subsystem: 'Primitive Catalog' },
  { id: 'lighting', icon: 'bulb', label: 'Lighting', wired: true },
  { id: 'build', icon: 'hammer', label: 'Build', wired: true },
];

const SP_DEFAULT: ScenePosition = {
  x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1,
};

function readSP(node: PrismNode | undefined | null): ScenePosition {
  const s = node?.scenePosition;
  if (!s) return { ...SP_DEFAULT };
  return {
    x: s.x ?? 0, y: s.y ?? 0, z: s.z ?? 0,
    rotationX: s.rotationX ?? 0, rotationY: s.rotationY ?? 0, rotationZ: s.rotationZ ?? 0,
    scaleX: s.scaleX ?? 1, scaleY: s.scaleY ?? 1, scaleZ: s.scaleZ ?? 1,
  };
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const deg = (rad: number) => `${Math.round((rad * 180) / Math.PI)}°`;

// ── Lighting helpers (canvas-spec §5 / §10) ──────────────────────────────────
const LIGHT_TYPES: PrismLightType[] = [
  'directional',
  'point',
  'spot',
  'ambient',
  'hemisphere',
  'rim',
];

const LIGHT_TYPE_LABEL: Record<PrismLightType, string> = {
  directional: 'Directional',
  point: 'Point',
  spot: 'Spot',
  ambient: 'Ambient',
  hemisphere: 'Hemisphere',
  rim: 'Rim',
};

// Merge a hub's stored lightingSpec over the canonical default so the flyout
// always renders defined controls (and never overwrites unset fields with
// undefined when it writes back). Additive read — never mutates the source.
function readLightingSpec(hub: PrismHub | null | undefined): LightingSpec {
  const s = hub?.lightingSpec;
  return {
    ...LIGHTING_SPEC_DEFAULT,
    ...(s ?? {}),
    lights: s?.lights ? [...s.lights] : [],
  };
}

let lightSeq = 0;
function makeLight(type: PrismLightType): PrismLight {
  lightSeq += 1;
  const id = `light-${Date.now().toString(36)}-${lightSeq.toString(36)}`;
  const base: PrismLight = { id, type, color: '#ffffff', intensity: 1 };
  switch (type) {
    case 'directional':
    case 'rim':
      return { ...base, position: { x: 3, y: 5, z: 4 }, target: { x: 0, y: 0, z: 0 }, castShadow: true };
    case 'point':
      return { ...base, position: { x: 2, y: 3, z: 3 }, distance: 0, decay: 2 };
    case 'spot':
      return {
        ...base, position: { x: 2, y: 4, z: 3 }, target: { x: 0, y: 0, z: 0 },
        distance: 0, decay: 2, angle: Math.PI / 6, penumbra: 0.3, castShadow: true,
      };
    case 'hemisphere':
      return { ...base, groundColor: '#404050', intensity: 0.6 };
    case 'ambient':
      return { ...base, intensity: 0.4 };
    default:
      return base;
  }
}

// ── Small building blocks ────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-mono tracking-[0.18em] uppercase text-white/35 mb-1.5 mt-0.5">
      {children}
    </div>
  );
}

function ToolButton({
  icon, label, active, disabled, accent, onClick, title, testId,
}: {
  icon: string; label: string; active?: boolean; disabled?: boolean;
  accent?: string; onClick?: () => void; title?: string; testId?: string;
}) {
  const a = accent ?? ACCENT;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
      data-testid={testId}
      className={`group/tool flex flex-col items-center justify-center gap-1 h-14 rounded-xl border transition-all ${
        disabled
          ? 'border-white/5 opacity-40 cursor-not-allowed'
          : active
            ? 'border-white/20'
            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
      }`}
      style={active && !disabled ? { background: `${a}1f`, boxShadow: `inset 0 0 0 1px ${a}55` } : undefined}
    >
      <Icon name={icon} size={15} color={active ? a : '#c5ccea'} glow={active} />
      <span className={`text-[8.5px] font-mono tracking-wide ${active ? 'text-white' : 'text-white/55'}`}>
        {label}
      </span>
    </button>
  );
}

function StepperRow({
  label, value, onDec, onInc, accent, testId,
}: {
  label: string; value: string; onDec: () => void; onInc: () => void; accent?: string; testId?: string;
}) {
  const a = accent ?? ACCENT;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-5 text-[10px] font-mono text-white/45">{label}</span>
      <button
        type="button"
        onClick={onDec}
        data-testid={testId ? `${testId}-dec` : undefined}
        className="w-6 h-6 rounded-md border border-white/10 text-white/70 hover:bg-white/5 hover:border-white/20 transition-colors text-[12px] leading-none"
      >
        −
      </button>
      <span
        className="flex-1 text-center text-[10px] font-mono tabular-nums text-white/80 px-1 py-1 rounded-md bg-black/30 border border-white/5"
        style={{ color: a }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={onInc}
        data-testid={testId ? `${testId}-inc` : undefined}
        className="w-6 h-6 rounded-md border border-white/10 text-white/70 hover:bg-white/5 hover:border-white/20 transition-colors text-[12px] leading-none"
      >
        +
      </button>
    </div>
  );
}

/** Designed-placeholder tile grid. Clicking any tile surfaces the coming state. */
function PlaceholderTiles({
  tiles, subsystem, onPick,
}: {
  tiles: { icon: string; label: string; hint?: string }[];
  subsystem: string;
  onPick: (label: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {tiles.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onPick(t.label)}
          title={`${t.label} — coming with the ${subsystem}`}
          className="relative flex flex-col items-start gap-1 p-2 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all text-left"
        >
          <Icon name={t.icon} size={14} color="#b5bddf" />
          <span className="text-[9.5px] font-mono text-white/75 leading-tight">{t.label}</span>
          {t.hint && <span className="text-[8px] font-mono text-white/35 leading-tight">{t.hint}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function CanvasToolbar() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);

  // Selection / editor state
  const selectedNodeId = useGraphEditorStore((s) => s.selectedNodeId);
  const selectedNodeIds = useGraphEditorStore((s) => s.selectedNodeIds);
  const editorMode = useGraphEditorStore((s) => s.editorMode);
  const setEditorMode = useGraphEditorStore((s) => s.setEditorMode);
  const gizmoMode = useGraphEditorStore((s) => s.canvasGizmoMode);
  const setGizmoMode = useGraphEditorStore((s) => s.setCanvasGizmoMode);
  const setMultiSelection = useGraphEditorStore((s) => s.setMultiSelection);
  const clearMultiSelection = useGraphEditorStore((s) => s.clearMultiSelection);
  const toggleFreeze = useGraphEditorStore((s) => s.toggleFreeze);
  const frozenNodeIds = useGraphEditorStore((s) => s.frozenNodeIds);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);

  // Source graph
  const nodes = useGraphSourceStore((s) => s.nodes);
  const hubs = useGraphSourceStore((s) => s.hubs);
  const setScenePosition = useGraphSourceStore((s) => s.setScenePosition);
  const updateNode = useGraphSourceStore((s) => s.updateNode);
  const groupNodes = useGraphSourceStore((s) => s.groupNodes);
  const ungroupNodes = useGraphSourceStore((s) => s.ungroupNodes);
  const setNodeLocked = useGraphSourceStore((s) => s.setNodeLocked);
  const saveToServer = useGraphSourceStore((s) => s.saveToServer);
  const markSourceDirty = useGraphSourceStore((s) => s.markDirty);

  const builtSnap = useBuiltSnapshotStore((s) => (selectedNodeId ? s.snapshots[selectedNodeId] : undefined));

  // Toolbar-local UI state
  const [activeGroup, setActiveGroup] = useState<ToolGroupId | null>('transform');
  const [keyframeOpen, setKeyframeOpen] = useState(false);
  const [marqueeArmed, setMarqueeArmed] = useState(false);
  const [coming, setComing] = useState<{ tool: string; subsystem: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);
  const [lightPickerOpen, setLightPickerOpen] = useState(false);

  const nodeById = useCallback(
    (id: string | null | undefined) => (id ? nodes.find((n) => n.nodeId === id) ?? null : null),
    [nodes],
  );
  const selectedNode = nodeById(selectedNodeId);

  // ── Lighting target hub (canvas-spec §5/§10): the active hub, else the
  // selected node's parent hub, else the first hub. The Lighting flyout writes
  // this hub's `lightingSpec`. ────────────────────────────────────────────────
  const lightingHub = useMemo<PrismHub | null>(() => {
    const byActive = activeHubId ? hubs.find((h) => h.hubId === activeHubId) : null;
    if (byActive) return byActive;
    const byNode = selectedNode?.parentHubId
      ? hubs.find((h) => h.hubId === selectedNode.parentHubId)
      : null;
    if (byNode) return byNode;
    return hubs[0] ?? null;
  }, [activeHubId, hubs, selectedNode]);

  const lightingSpec = useMemo(() => readLightingSpec(lightingHub), [lightingHub]);
  const selectedLight = useMemo(
    () => (selectedLightId ? lightingSpec.lights?.find((l) => l.id === selectedLightId) ?? null : null),
    [selectedLightId, lightingSpec],
  );

  // Effective transform target set (canvas-spec §14 group cascade): a multi-
  // selection, else a selected node's whole group, else the single node.
  const effectiveIds = useMemo<string[]>(() => {
    if (selectedNodeIds.size >= 2) return [...selectedNodeIds];
    if (selectedNode) {
      if (selectedNode.groupId) {
        return nodes.filter((n) => n.groupId === selectedNode.groupId).map((n) => n.nodeId);
      }
      return [selectedNode.nodeId];
    }
    return [];
  }, [selectedNodeIds, selectedNode, nodes]);

  const hasSelection = effectiveIds.length > 0;
  const isGroup = effectiveIds.length > 1;
  const isLocked = selectedNode?.locked === true;

  // Auto-clear transient banners.
  useEffect(() => {
    if (!coming) return;
    const t = setTimeout(() => setComing(null), 4200);
    return () => clearTimeout(t);
  }, [coming]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const showComing = useCallback((tool: string, subsystem: string) => {
    setComing({ tool, subsystem });
  }, []);

  // ── Transform actions (write the node's own scenePosition) ─────────────────
  const ensureEdit = useCallback(
    (mode: GizmoMode) => {
      setGizmoMode(mode);
      if (editorMode !== 'edit') setEditorMode('edit');
    },
    [editorMode, setEditorMode, setGizmoMode],
  );

  const applyToSelection = useCallback(
    (patchFor: (sp: ScenePosition) => Partial<ScenePosition>) => {
      for (const id of effectiveIds) {
        const n = nodes.find((x) => x.nodeId === id);
        if (!n || n.locked) continue;
        setScenePosition(id, patchFor(readSP(n)));
      }
    },
    [effectiveIds, nodes, setScenePosition],
  );

  const nudge = (axis: 'x' | 'y' | 'z', dir: 1 | -1) =>
    applyToSelection((sp) => ({ [axis]: sp[axis] + dir * TRANSLATE_STEP }) as Partial<ScenePosition>);
  const scaleBy = (dir: 1 | -1) => {
    const f = dir === 1 ? SCALE_FACTOR : 1 / SCALE_FACTOR;
    applyToSelection((sp) => ({ scaleX: sp.scaleX * f, scaleY: sp.scaleY * f, scaleZ: sp.scaleZ * f }));
  };
  const rotateZBy = (dir: 1 | -1) =>
    applyToSelection((sp) => ({ rotationZ: sp.rotationZ + dir * ROTATE_STEP }));
  const resetTransform = () =>
    applyToSelection(() => ({
      rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1,
    }));
  const alignAxis = (axis: 'x' | 'y') => {
    if (effectiveIds.length < 2) return;
    const sps = effectiveIds.map((id) => readSP(nodes.find((n) => n.nodeId === id)));
    const avg = sps.reduce((acc, sp) => acc + sp[axis], 0) / sps.length;
    for (const id of effectiveIds) {
      const n = nodes.find((x) => x.nodeId === id);
      if (n?.locked) continue;
      setScenePosition(id, { [axis]: avg } as Partial<ScenePosition>);
    }
  };

  // ── Selection actions ──────────────────────────────────────────────────────
  const doGroup = () => {
    if (selectedNodeIds.size < 2) return;
    const id = groupNodes([...selectedNodeIds]);
    if (id) {
      setMultiSelection([...selectedNodeIds]);
      setToast(`Grouped ${selectedNodeIds.size} elements`);
    }
  };
  const doUngroup = () => {
    const gid = selectedNode?.groupId;
    if (!gid) return;
    const members = nodes.filter((n) => n.groupId === gid).map((n) => n.nodeId);
    ungroupNodes(gid);
    setMultiSelection(members);
    setToast('Ungrouped — world transforms preserved');
  };
  const toggleLock = () => {
    if (!selectedNode) return;
    setNodeLocked(selectedNode.nodeId, !isLocked);
    setToast(isLocked ? 'Unlocked' : 'Locked — removed from transform');
  };
  const selectAllInHub = () => {
    const ids = nodes.filter((n) => !activeHubId || n.parentHubId === activeHubId).map((n) => n.nodeId);
    setMultiSelection(ids);
  };

  // ── Build actions ──────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const doRebuild = async () => {
    if (!selectedNodeId || busy) return;
    setBusy(true);
    commitPreviewToSource(selectedNodeId);
    await saveToServer();
    rebuildNode(selectedNodeId);
    setBusy(false);
    setToast('Rebuilt — artifact re-realized');
  };
  const doAddToSystem = () => {
    if (!selectedNodeId) return;
    const r = addNodeToSystem(selectedNodeId);
    if (r.ok) setToast(`Added to system · re-captioned`);
  };

  // ── Lighting actions (write the active hub's lightingSpec) ─────────────────
  // The toolbar is NOT an Inspector tab, so per canvas-spec §5 it MAY write to
  // the source store directly (like Transform does). No `updateHub` action
  // exists, so we patch the hub in place via the store's `setState` — mirroring
  // the shape `addHub`/`updateNode` use — then schedule the durable autosave
  // through the public `markDirty`. Non-destructive: only `hub.lightingSpec`
  // changes; topology and layout are untouched (INV-1 / INV-17).
  const writeHubLightingSpec = useCallback(
    (next: LightingSpec) => {
      const hubId = lightingHub?.hubId;
      if (!hubId) return;
      useGraphSourceStore.setState((s) => ({
        hubs: s.hubs.map((h) => (h.hubId === hubId ? { ...h, lightingSpec: next } : h)),
      }));
      markSourceDirty(true);
    },
    [lightingHub, markSourceDirty],
  );

  const patchLightingSpec = useCallback(
    (patch: Partial<LightingSpec>) => {
      writeHubLightingSpec({ ...lightingSpec, ...patch, lights: [...(lightingSpec.lights ?? [])] });
    },
    [lightingSpec, writeHubLightingSpec],
  );

  const addLight = useCallback(
    (type: PrismLightType) => {
      const light = makeLight(type);
      writeHubLightingSpec({ ...lightingSpec, lights: [...(lightingSpec.lights ?? []), light] });
      setSelectedLightId(light.id);
      setLightPickerOpen(false);
      setToast(`Added ${LIGHT_TYPE_LABEL[type]} light`);
    },
    [lightingSpec, writeHubLightingSpec],
  );

  const updateLight = useCallback(
    (id: string, patch: Partial<PrismLight>) => {
      writeHubLightingSpec({
        ...lightingSpec,
        lights: (lightingSpec.lights ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)),
      });
    },
    [lightingSpec, writeHubLightingSpec],
  );

  const removeLight = useCallback(
    (id: string) => {
      writeHubLightingSpec({
        ...lightingSpec,
        lights: (lightingSpec.lights ?? []).filter((l) => l.id !== id),
      });
      setSelectedLightId((cur) => (cur === id ? null : cur));
      setToast('Removed light');
    },
    [lightingSpec, writeHubLightingSpec],
  );

  const toggleReceivesLighting = useCallback(() => {
    if (!selectedNode) return;
    const cur = selectedNode.receivesLighting ?? receivesLightingDefault(selectedNode.renderMode);
    updateNode(selectedNode.nodeId, { receivesLighting: !cur });
    setToast(!cur ? 'Node receives lighting' : 'Node unlit (texture-only)');
  }, [selectedNode, updateNode]);

  // ── Marquee select ─────────────────────────────────────────────────────────
  const onMarqueeCommit = useCallback(
    (rectClient: { left: number; top: number; width: number; height: number }) => {
      const canvas = typeof document !== 'undefined' ? document.querySelector('canvas') : null;
      const hit = (window as unknown as {
        __PRISM_EDITOR_MARQUEE_HIT__?: (r: { x: number; y: number; w: number; h: number }) => string[];
      }).__PRISM_EDITOR_MARQUEE_HIT__;
      if (!canvas || !hit) {
        setMarqueeArmed(false);
        return;
      }
      const cb = canvas.getBoundingClientRect();
      const ids = hit({
        x: rectClient.left - cb.left,
        y: rectClient.top - cb.top,
        w: rectClient.width,
        h: rectClient.height,
      });
      setMultiSelection(ids);
      setToast(ids.length ? `Marquee selected ${ids.length}` : 'Marquee — nothing in region');
      setMarqueeArmed(false);
    },
    [setMultiSelection],
  );

  if (viewMode !== 'canvas') return null;

  const selectionLabel = !hasSelection
    ? 'No selection'
    : isGroup
      ? `${effectiveIds.length} selected${selectedNode?.groupId ? ' · group' : ''}`
      : (selectedNode?.intent?.caption?.split(' · ')[0] || selectedNode?.subtype || '1 selected');

  return (
    <>
      {marqueeArmed && <MarqueeOverlay onCommit={onMarqueeCommit} onCancel={() => setMarqueeArmed(false)} />}

      {/* Left tool rail */}
      <div
        data-component="canvas-toolbar"
        className="absolute z-50 left-3 top-1/2 -translate-y-1/2 pointer-events-auto flex items-stretch gap-2"
      >
        <div className="flex flex-col gap-1 p-1.5 rounded-2xl border border-white/10" style={GLASS}>
          <div className="px-1 pt-0.5 pb-1.5 flex flex-col items-center gap-0.5">
            <Icon name="grid" size={13} color={ACCENT} glow />
            <span className="text-[7.5px] font-mono tracking-[0.2em] text-white/40">CANVAS</span>
          </div>
          {GROUPS.map((g) => {
            const isActive = activeGroup === g.id;
            const beforeBuild = g.id === 'build';
            return (
              <div key={g.id} className="contents">
                {beforeBuild && <div className="mx-2 my-0.5 h-px bg-white/10" />}
                <button
                  type="button"
                  data-tool-group={g.id}
                  onClick={() => setActiveGroup((cur) => (cur === g.id ? null : g.id))}
                  title={g.label}
                  className={`relative w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                    isActive ? 'border border-white/20' : 'border border-transparent hover:bg-white/[0.05]'
                  }`}
                  style={isActive ? { background: `${ACCENT}1f`, boxShadow: `inset 0 0 0 1px ${ACCENT}55` } : undefined}
                >
                  {isActive && (
                    <span
                      className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full"
                      style={{ background: `linear-gradient(180deg, ${ACCENT}, ${VIOLET})` }}
                    />
                  )}
                  <Icon name={g.icon} size={16} color={isActive ? '#fff' : '#c5ccea'} glow={isActive} />
                  <span className={`text-[7px] font-mono tracking-wide ${isActive ? 'text-white' : 'text-white/45'}`}>
                    {g.label}
                  </span>
                  {!g.wired && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: VIOLET, boxShadow: `0 0 6px ${VIOLET}` }} />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Flyout */}
        {activeGroup && (
          <FlyoutShell
            meta={GROUPS.find((g) => g.id === activeGroup)!}
            coming={coming}
            onClose={() => setActiveGroup(null)}
          >
            {activeGroup === 'transform' && (
              <TransformFlyout
                hasSelection={hasSelection}
                isGroup={isGroup}
                isLocked={isLocked}
                editorMode={editorMode}
                gizmoMode={gizmoMode}
                selectionLabel={selectionLabel}
                sp={readSP(selectedNode)}
                snap={snap}
                setSnap={setSnap}
                onEditToggle={() => setEditorMode(editorMode === 'edit' ? 'idle' : 'edit')}
                onMode={ensureEdit}
                onNudge={nudge}
                onScale={scaleBy}
                onRotate={rotateZBy}
                onReset={resetTransform}
                onAlign={alignAxis}
              />
            )}
            {activeGroup === 'selection' && (
              <SelectionFlyout
                count={effectiveIds.length}
                canGroup={selectedNodeIds.size >= 2}
                canUngroup={!!selectedNode?.groupId}
                isLocked={isLocked}
                isFrozen={selectedNodeId ? frozenNodeIds.has(selectedNodeId) : false}
                marqueeArmed={marqueeArmed}
                onMarquee={() => setMarqueeArmed((v) => !v)}
                onGroup={doGroup}
                onUngroup={doUngroup}
                onLock={toggleLock}
                onFreeze={() => selectedNodeId && toggleFreeze(selectedNodeId)}
                onSelectAll={selectAllInHub}
                onClear={() => clearMultiSelection()}
              />
            )}
            {activeGroup === 'build' && (
              <BuildFlyout
                hasSelection={!!selectedNode}
                busy={busy}
                dirty={selectedNode?.dirty === true}
                status={builtSnap?.status}
                buildCount={builtSnap?.buildCount}
                onRebuild={doRebuild}
                onAddToSystem={doAddToSystem}
                onComing={(t) => showComing(t, 'Version history UI')}
              />
            )}
            {activeGroup === 'add' && (
              <PlaceholderTiles
                subsystem="Media & Library pipeline"
                onPick={(t) => showComing(t, 'Media & Library pipeline')}
                tiles={[
                  { icon: 'plus', label: 'Add Element', hint: 'blank bubble node' },
                  { icon: 'text', label: 'Add Text', hint: 'MSDF text node' },
                  { icon: 'layers', label: 'From Library', hint: 'prebuilt clusters' },
                  { icon: 'refresh', label: 'Change Artifact', hint: 'upload / prompt' },
                ]}
              />
            )}
            {activeGroup === 'image' && (
              <PlaceholderTiles
                subsystem="Media pipeline"
                onPick={(t) => showComing(t, 'Media pipeline')}
                tiles={[
                  { icon: 'crop', label: 'Crop' },
                  { icon: 'eye', label: 'Opacity' },
                  { icon: 'scale', label: 'Borders / Radius' },
                  { icon: 'palette', label: 'Color Adjust' },
                  { icon: 'layers', label: 'Blend Mode' },
                  { icon: 'sparkle', label: 'Filters' },
                ]}
              />
            )}
            {activeGroup === 'object3d' && (
              <PlaceholderTiles
                subsystem="Mesh & Material systems"
                onPick={(t) => showComing(t, 'Mesh & Material systems')}
                tiles={[
                  { icon: 'cube', label: 'Shape / Dimensions' },
                  { icon: 'grid', label: 'Per-face Mapping' },
                  { icon: 'palette', label: 'Material Editor' },
                  { icon: 'move', label: 'Gizmos', hint: 'see Transform' },
                ]}
              />
            )}
            {activeGroup === 'text' && (
              <PlaceholderTiles
                subsystem="Text System (MSDF)"
                onPick={(t) => showComing(t, 'Text System (MSDF)')}
                tiles={[
                  { icon: 'text', label: 'Font Picker', hint: '1,800+ families' },
                  { icon: 'sliders', label: 'Size / Weight / Spacing' },
                  { icon: 'palette', label: 'Fills / Strokes / Glow' },
                  { icon: 'wand', label: 'AI Texture-Fill', hint: 'describe the look' },
                  { icon: 'layers', label: 'Presets' },
                  { icon: 'timeline', label: 'Text Animation' },
                ]}
              />
            )}
            {activeGroup === 'animation' && (
              <AnimationFlyout
                keyframeOpen={keyframeOpen}
                onToggleKeyframe={() => setKeyframeOpen((v) => !v)}
                onComing={(t) => showComing(t, 'Primitive Catalog')}
              />
            )}
            {activeGroup === 'lighting' && (
              <LightingFlyout
                hubTitle={lightingHub?.title ?? null}
                spec={lightingSpec}
                selectedLightId={selectedLightId}
                selectedLight={selectedLight}
                pickerOpen={lightPickerOpen}
                node={selectedNode}
                onTogglePicker={() => setLightPickerOpen((v) => !v)}
                onAddLight={addLight}
                onSelectLight={setSelectedLightId}
                onRemoveLight={removeLight}
                onUpdateLight={updateLight}
                onPatchSpec={patchLightingSpec}
                onToggleReceives={toggleReceivesLighting}
              />
            )}
          </FlyoutShell>
        )}
      </div>

      {/* Slide-up keyframe editor */}
      <KeyframeEditorPanel
        open={keyframeOpen}
        onClose={() => setKeyframeOpen(false)}
        selectionLabel={selectionLabel}
      />

      {/* Toast */}
      {toast && (
        <div
          className="absolute z-50 left-1/2 -translate-x-1/2 top-16 pointer-events-none px-3.5 py-2 rounded-full border border-white/10 flex items-center gap-2"
          style={GLASS}
        >
          <Icon name="check" size={11} color={GREEN} />
          <span className="text-[10px] font-mono text-white/85">{toast}</span>
        </div>
      )}
    </>
  );
}

// ── Flyout shell ─────────────────────────────────────────────────────────────
function FlyoutShell({
  meta, coming, onClose, children,
}: {
  meta: ToolGroupMeta;
  coming: { tool: string; subsystem: string } | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-component="canvas-toolbar-flyout"
      data-group={meta.id}
      className="w-[252px] rounded-2xl border border-white/10 p-3 flex flex-col gap-2.5 max-h-[78vh] overflow-y-auto"
      style={GLASS}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: meta.wired ? `${ACCENT}22` : `${VIOLET}22`, boxShadow: `inset 0 0 0 1px ${(meta.wired ? ACCENT : VIOLET)}44` }}
          >
            <Icon name={meta.icon} size={14} color={meta.wired ? ACCENT : VIOLET} glow />
          </div>
          <div>
            <div className="text-[12px] font-display font-semibold text-white leading-none">{meta.label}</div>
            <div className="text-[8px] font-mono tracking-widest mt-0.5" style={{ color: meta.wired ? `${GREEN}cc` : `${VIOLET}cc` }}>
              {meta.wired ? 'WIRED' : 'COMING SOON'}
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="w-6 h-6 rounded-md hover:bg-white/5 flex items-center justify-center">
          <Icon name="close" size={10} color="#8b93b5" />
        </button>
      </div>

      {!meta.wired && (
        <div className="text-[9px] font-mono text-white/45 leading-relaxed -mt-1">
          Designed preview. Wires to the <span className="text-white/70">{meta.subsystem}</span>.
        </div>
      )}

      {children}

      {coming && (
        <div
          className="mt-1 px-2.5 py-2 rounded-xl border flex items-start gap-2"
          style={{ background: `${VIOLET}14`, borderColor: `${VIOLET}40` }}
        >
          <Icon name="sparkle" size={12} color={VIOLET} glow />
          <div className="leading-tight">
            <div className="text-[10px] font-mono text-white/90">{coming.tool}</div>
            <div className="text-[8.5px] font-mono text-white/50">Coming with the {coming.subsystem}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transform flyout (WIRED) ─────────────────────────────────────────────────
function TransformFlyout({
  hasSelection, isGroup, isLocked, editorMode, gizmoMode, selectionLabel, sp, snap, setSnap,
  onEditToggle, onMode, onNudge, onScale, onRotate, onReset, onAlign,
}: {
  hasSelection: boolean; isGroup: boolean; isLocked: boolean;
  editorMode: 'idle' | 'edit'; gizmoMode: GizmoMode; selectionLabel: string; sp: ScenePosition;
  snap: boolean; setSnap: (v: boolean) => void;
  onEditToggle: () => void; onMode: (m: GizmoMode) => void;
  onNudge: (axis: 'x' | 'y' | 'z', dir: 1 | -1) => void;
  onScale: (dir: 1 | -1) => void; onRotate: (dir: 1 | -1) => void;
  onReset: () => void; onAlign: (axis: 'x' | 'y') => void;
}) {
  if (!hasSelection) {
    return (
      <EmptyHint
        icon="cursor"
        text="Select a built element on the canvas, then click Edit to reveal transform handles."
      />
    );
  }
  return (
    <>
      <SelectionChip label={selectionLabel} locked={isLocked} group={isGroup} />
      {isLocked && (
        <div className="text-[9px] font-mono px-2 py-1.5 rounded-lg border" style={{ color: AMBER, background: `${AMBER}12`, borderColor: `${AMBER}33` }}>
          Locked — unlock in Selection to transform.
        </div>
      )}
      <button
        type="button"
        data-action="edit-toggle"
        onClick={onEditToggle}
        className="w-full h-9 rounded-xl border flex items-center justify-center gap-2 transition-all"
        style={
          editorMode === 'edit'
            ? { background: `${ACCENT}22`, borderColor: `${ACCENT}66`, boxShadow: `inset 0 0 0 1px ${ACCENT}55` }
            : { borderColor: 'rgba(255,255,255,0.12)' }
        }
      >
        <Icon name="edit" size={13} color={editorMode === 'edit' ? ACCENT : '#c5ccea'} glow={editorMode === 'edit'} />
        <span className="text-[11px] font-mono text-white/90">{editorMode === 'edit' ? 'Editing — handles on' : 'Edit Handles'}</span>
      </button>

      <SectionLabel>Tool</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5">
        <ToolButton icon="move" label="Move" testId="tt-move" active={gizmoMode === 'translate' && editorMode === 'edit'} onClick={() => onMode('translate')} />
        <ToolButton icon="rotate" label="Rotate" testId="tt-rotate" active={gizmoMode === 'rotate' && editorMode === 'edit'} onClick={() => onMode('rotate')} />
        <ToolButton icon="scale" label="Scale" testId="tt-scale" active={gizmoMode === 'scale' && editorMode === 'edit'} onClick={() => onMode('scale')} />
      </div>

      <SectionLabel>Position · writes scenePosition</SectionLabel>
      <div className="flex flex-col gap-1.5">
        <StepperRow label="X" testId="tt-pos-x" value={fmt(sp.x)} onDec={() => onNudge('x', -1)} onInc={() => onNudge('x', 1)} />
        <StepperRow label="Y" testId="tt-pos-y" value={fmt(sp.y)} onDec={() => onNudge('y', -1)} onInc={() => onNudge('y', 1)} />
        <StepperRow label="Z" testId="tt-pos-z" value={fmt(sp.z)} onDec={() => onNudge('z', -1)} onInc={() => onNudge('z', 1)} accent={GREEN} />
      </div>

      <SectionLabel>Scale · Rotate</SectionLabel>
      <div className="flex flex-col gap-1.5">
        <StepperRow label="S" testId="tt-scale-val" value={`${fmt(sp.scaleX)}×`} onDec={() => onScale(-1)} onInc={() => onScale(1)} accent={VIOLET} />
        <StepperRow label="R" testId="tt-rot-val" value={deg(sp.rotationZ)} onDec={() => onRotate(-1)} onInc={() => onRotate(1)} accent={VIOLET} />
      </div>

      <SectionLabel>Align{isGroup ? '' : ' · needs group'}</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton icon="align" label="Align X" disabled={!isGroup} onClick={() => onAlign('x')} />
        <ToolButton icon="align" label="Align Y" disabled={!isGroup} onClick={() => onAlign('y')} />
      </div>

      <div className="flex items-center gap-1.5 mt-0.5">
        <button
          type="button"
          onClick={() => setSnap(!snap)}
          className="flex-1 h-8 rounded-lg border border-white/10 flex items-center justify-center gap-1.5 hover:bg-white/5"
        >
          <Icon name="grid" size={11} color={snap ? ACCENT : '#8b93b5'} />
          <span className="text-[9.5px] font-mono text-white/70">Snap {snap ? 'On' : 'Off'}</span>
        </button>
        <button
          type="button"
          data-action="reset-transform"
          onClick={onReset}
          className="flex-1 h-8 rounded-lg border border-white/10 flex items-center justify-center gap-1.5 hover:bg-white/5"
        >
          <Icon name="refresh" size={11} color="#c5ccea" />
          <span className="text-[9.5px] font-mono text-white/70">Reset</span>
        </button>
      </div>
    </>
  );
}

// ── Selection flyout (WIRED) ─────────────────────────────────────────────────
function SelectionFlyout({
  count, canGroup, canUngroup, isLocked, isFrozen, marqueeArmed,
  onMarquee, onGroup, onUngroup, onLock, onFreeze, onSelectAll, onClear,
}: {
  count: number; canGroup: boolean; canUngroup: boolean; isLocked: boolean; isFrozen: boolean;
  marqueeArmed: boolean;
  onMarquee: () => void; onGroup: () => void; onUngroup: () => void; onLock: () => void;
  onFreeze: () => void; onSelectAll: () => void; onClear: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-black/30 border border-white/5">
        <span className="text-[10px] font-mono text-white/55">Selected</span>
        <span className="text-[12px] font-mono font-semibold" style={{ color: count > 1 ? VIOLET : ACCENT }}>{count}</span>
      </div>

      <SectionLabel>Select</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton icon="cursor" label="Marquee" testId="tt-marquee" active={marqueeArmed} accent={GREEN} onClick={onMarquee} title="Drag a box over the canvas to select" />
        <ToolButton icon="grid" label="All in Hub" testId="tt-select-all" onClick={onSelectAll} />
      </div>
      <div className="text-[8.5px] font-mono text-white/35 leading-tight -mt-0.5">Shift-click adds to the selection.</div>

      <SectionLabel>Group</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton icon="group" label="Group" testId="tt-group" accent={VIOLET} disabled={!canGroup} onClick={onGroup} title="Group 2+ selected elements" />
        <ToolButton icon="ungroup" label="Ungroup" testId="tt-ungroup" accent={VIOLET} disabled={!canUngroup} onClick={onUngroup} />
      </div>

      <SectionLabel>Protect</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton icon={isLocked ? 'lock' : 'lockOpen'} label={isLocked ? 'Unlock' : 'Lock'} testId="tt-lock" active={isLocked} accent={AMBER} onClick={onLock} />
        <ToolButton icon="snow" label={isFrozen ? 'Unfreeze' : 'Freeze'} active={isFrozen} accent={GREEN} onClick={onFreeze} title="Freeze = AI off-limits" />
      </div>

      <button
        type="button"
        onClick={onClear}
        className="mt-0.5 h-8 rounded-lg border border-white/10 flex items-center justify-center gap-1.5 hover:bg-white/5"
      >
        <Icon name="close" size={10} color="#8b93b5" />
        <span className="text-[9.5px] font-mono text-white/60">Clear selection</span>
      </button>
    </>
  );
}

// ── Build flyout (WIRED) ─────────────────────────────────────────────────────
function BuildFlyout({
  hasSelection, busy, dirty, status, buildCount, onRebuild, onAddToSystem, onComing,
}: {
  hasSelection: boolean; busy: boolean; dirty: boolean;
  status?: 'built' | 'repaired' | 'failed'; buildCount?: number;
  onRebuild: () => void; onAddToSystem: () => void; onComing: (tool: string) => void;
}) {
  if (!hasSelection) {
    return <EmptyHint icon="hammer" text="Select a built element to rebuild it or re-add it to the system." />;
  }
  const stateColor = dirty ? AMBER : status === 'failed' ? '#ef4466' : status === 'repaired' ? AMBER : GREEN;
  const stateLabel = dirty ? 'Dirty — needs rebuild' : status === 'failed' ? 'Failed' : status === 'repaired' ? 'Repaired' : 'Built · in system';
  return (
    <>
      <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-black/30 border border-white/5">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: stateColor, boxShadow: `0 0 6px ${stateColor}` }} />
          <span className="text-[10px] font-mono text-white/75">{stateLabel}</span>
        </span>
        <span className="text-[9px] font-mono text-white/40">v{buildCount ?? 1}</span>
      </div>

      <button
        type="button"
        data-action="rebuild"
        disabled={busy}
        onClick={onRebuild}
        className="w-full h-9 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        style={{ background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})`, boxShadow: `0 6px 20px ${ACCENT}44` }}
      >
        <Icon name="hammer" size={13} color="#fff" />
        <span className="text-[11px] font-mono font-semibold text-white">{busy ? 'Rebuilding…' : 'Save & Rebuild'}</span>
      </button>

      <button
        type="button"
        data-action="add-to-system"
        onClick={onAddToSystem}
        className="w-full h-9 rounded-xl border border-white/12 flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
      >
        <Icon name="check" size={12} color={GREEN} />
        <span className="text-[11px] font-mono text-white/90">Add to System</span>
      </button>
      <div className="text-[8.5px] font-mono text-white/35 leading-tight -mt-0.5">Re-captions the node and clears its dirty flag.</div>

      <SectionLabel>History</SectionLabel>
      <button
        type="button"
        onClick={() => onComing('Version history')}
        className="h-8 rounded-lg border border-white/10 flex items-center justify-center gap-1.5 hover:bg-white/5"
      >
        <Icon name="layers" size={11} color="#c5ccea" />
        <span className="text-[9.5px] font-mono text-white/70">{buildCount ?? 1} build{(buildCount ?? 1) === 1 ? '' : 's'} · view history</span>
      </button>
    </>
  );
}

// ── Lighting flyout (WIRED — canvas-spec §5 / §10) ───────────────────────────
function LightingFlyout({
  hubTitle, spec, selectedLightId, selectedLight, pickerOpen, node,
  onTogglePicker, onAddLight, onSelectLight, onRemoveLight, onUpdateLight,
  onPatchSpec, onToggleReceives,
}: {
  hubTitle: string | null;
  spec: LightingSpec;
  selectedLightId: string | null;
  selectedLight: PrismLight | null;
  pickerOpen: boolean;
  node: PrismNode | null;
  onTogglePicker: () => void;
  onAddLight: (type: PrismLightType) => void;
  onSelectLight: (id: string) => void;
  onRemoveLight: (id: string) => void;
  onUpdateLight: (id: string, patch: Partial<PrismLight>) => void;
  onPatchSpec: (patch: Partial<LightingSpec>) => void;
  onToggleReceives: () => void;
}) {
  if (!hubTitle) {
    return <EmptyHint icon="bulb" text="No hub in view. Enter a hub on the canvas to light its scene." />;
  }
  const lights = spec.lights ?? [];
  const intensity = selectedLight?.intensity ?? 1;
  const shadowSoftness = spec.shadowSoftness ?? 0.5;
  const envIntensity = spec.envIntensity ?? 1;
  const nodeReceives = node
    ? node.receivesLighting ?? receivesLightingDefault(node.renderMode)
    : false;

  return (
    <>
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-black/30 border border-white/5">
        <Icon name="bulb" size={12} color={ACCENT} />
        <span className="flex-1 text-[10px] font-mono text-white/80 truncate">{hubTitle}</span>
        <span className="text-[9px] font-mono text-white/40">{lights.length} light{lights.length === 1 ? '' : 's'}</span>
      </div>

      {/* Light list + Add */}
      <SectionLabel>Lights · writes hub lightingSpec</SectionLabel>
      <div className="flex flex-col gap-1">
        {lights.length === 0 && (
          <div className="text-[8.5px] font-mono text-white/35 leading-tight px-1 py-1">
            No author lights — the runtime default 3-point rig is active. Add one to override.
          </div>
        )}
        {lights.map((l) => {
          const active = l.id === selectedLightId;
          return (
            <div
              key={l.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${
                active ? 'border-white/20' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
              }`}
              style={active ? { background: `${ACCENT}1a`, boxShadow: `inset 0 0 0 1px ${ACCENT}44` } : undefined}
            >
              <button
                type="button"
                onClick={() => onSelectLight(l.id)}
                className="flex-1 flex items-center gap-2 text-left"
                title={`Select ${LIGHT_TYPE_LABEL[l.type]} light`}
              >
                <span className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ background: l.color ?? '#ffffff' }} />
                <span className={`text-[10px] font-mono ${active ? 'text-white' : 'text-white/70'}`}>
                  {LIGHT_TYPE_LABEL[l.type]}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveLight(l.id)}
                title="Remove light"
                className="w-5 h-5 rounded-md hover:bg-white/5 flex items-center justify-center"
              >
                <Icon name="trash" size={10} color="#8b93b5" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        data-action="add-light"
        onClick={onTogglePicker}
        className="w-full h-8 rounded-lg border flex items-center justify-center gap-1.5 transition-all"
        style={
          pickerOpen
            ? { background: `${ACCENT}22`, borderColor: `${ACCENT}55` }
            : { borderColor: 'rgba(255,255,255,0.12)' }
        }
      >
        <Icon name="plus" size={11} color={pickerOpen ? ACCENT : '#c5ccea'} />
        <span className="text-[9.5px] font-mono text-white/80">Add Light</span>
      </button>
      {pickerOpen && (
        <div className="grid grid-cols-2 gap-1.5">
          {LIGHT_TYPES.map((t) => (
            <ToolButton key={t} icon="bulb" label={LIGHT_TYPE_LABEL[t]} onClick={() => onAddLight(t)} />
          ))}
        </div>
      )}

      {/* Selected-light controls */}
      {selectedLight ? (
        <>
          <SectionLabel>Light · {LIGHT_TYPE_LABEL[selectedLight.type]}</SectionLabel>
          <label className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-black/30 border border-white/5">
            <span className="text-[10px] font-mono text-white/55">Type</span>
            <select
              data-control="light-type"
              value={selectedLight.type}
              onChange={(e) => onUpdateLight(selectedLight.id, { type: e.target.value as PrismLightType })}
              className="bg-transparent text-[10px] font-mono text-white/85 outline-none cursor-pointer"
            >
              {LIGHT_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[#0b0d1f] text-white">{LIGHT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-black/30 border border-white/5">
            <span className="text-[10px] font-mono text-white/55">Color</span>
            <input
              type="color"
              data-control="light-color"
              value={selectedLight.color ?? '#ffffff'}
              onChange={(e) => onUpdateLight(selectedLight.id, { color: e.target.value })}
              className="w-7 h-6 rounded cursor-pointer bg-transparent border border-white/10"
            />
          </label>

          <StepperRow
            label="I"
            testId="light-intensity"
            value={fmt(intensity)}
            onDec={() => onUpdateLight(selectedLight.id, { intensity: Math.max(0, intensity - 0.1) })}
            onInc={() => onUpdateLight(selectedLight.id, { intensity: intensity + 0.1 })}
          />

          {(selectedLight.type === 'directional' || selectedLight.type === 'spot' || selectedLight.type === 'rim') && (
            <ToolButton
              icon="eye"
              label={selectedLight.castShadow ? 'Casts Shadow' : 'No Shadow'}
              active={selectedLight.castShadow === true}
              accent={GREEN}
              onClick={() => onUpdateLight(selectedLight.id, { castShadow: !(selectedLight.castShadow === true) })}
            />
          )}
        </>
      ) : (
        lights.length > 0 && (
          <div className="text-[8.5px] font-mono text-white/35 leading-tight px-1">Select a light above to tune it.</div>
        )
      )}

      {/* Scene-wide: shadow softness + env/IBL */}
      <SectionLabel>Scene · Shadow / Env</SectionLabel>
      <FaderRow
        label="Shadow Softness"
        value={shadowSoftness}
        accent={VIOLET}
        testId="shadow-softness"
        onChange={(v) => onPatchSpec({ shadowSoftness: v })}
      />
      <FaderRow
        label="Env / IBL Intensity"
        value={envIntensity}
        max={2}
        accent={GREEN}
        testId="env-intensity"
        onChange={(v) => onPatchSpec({ envIntensity: v })}
      />

      {/* Per-node receivesLighting toggle (shown when a node is selected) */}
      {node && (
        <>
          <SectionLabel>Selected Node</SectionLabel>
          <ToolButton
            icon="bulb"
            label={nodeReceives ? 'Receives Light' : 'Unlit'}
            testId="receives-lighting"
            active={nodeReceives}
            accent={AMBER}
            onClick={onToggleReceives}
            title="Toggle whether this node is lit by the scene rig"
          />
          <div className="text-[8px] font-mono text-white/30 leading-tight">
            {`renderMode: ${node.renderMode ?? 'sprite'} · default ${
              receivesLightingDefault(node.renderMode) ? 'lit' : 'unlit'
            }`}
          </div>
        </>
      )}
    </>
  );
}

// ── Fader (0..max range, mirrors MaterialTab native range pattern) ───────────
function FaderRow({
  label, value, onChange, min = 0, max = 1, step = 0.01, accent, testId,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; accent?: string; testId?: string;
}) {
  const a = accent ?? ACCENT;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-mono text-white/55">{label}</span>
        <span className="text-[9.5px] font-mono tabular-nums" style={{ color: a }}>{fmt(value)}</span>
      </div>
      <input
        type="range"
        data-control={testId}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 cursor-pointer accent-current"
        style={{ accentColor: a }}
      />
    </div>
  );
}

// ── Animation flyout (toggle is real; rest designed) ─────────────────────────
function AnimationFlyout({
  keyframeOpen, onToggleKeyframe, onComing,
}: {
  keyframeOpen: boolean; onToggleKeyframe: () => void; onComing: (tool: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton icon="sparkle" label="Picker" onClick={() => onComing('Animation Picker (300+ catalog)')} />
        <ToolButton icon="sliders" label="Edit Anim" onClick={() => onComing('Edit Animation')} />
      </div>

      <button
        type="button"
        data-action="keyframe-toggle"
        onClick={onToggleKeyframe}
        className="w-full h-9 rounded-xl border flex items-center justify-center gap-2 transition-all"
        style={
          keyframeOpen
            ? { background: `${ACCENT}22`, borderColor: `${ACCENT}66`, boxShadow: `inset 0 0 0 1px ${ACCENT}55` }
            : { borderColor: 'rgba(255,255,255,0.12)' }
        }
      >
        <Icon name="timeline" size={13} color={keyframeOpen ? ACCENT : '#c5ccea'} glow={keyframeOpen} />
        <span className="text-[11px] font-mono text-white/90">{keyframeOpen ? 'Hide Keyframe Editor' : 'Keyframe Editor'}</span>
      </button>

      <SectionLabel>Triggers · assign driver</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5">
        {(['Load', 'Click', 'Hover', 'Scroll', 'Drag'] as const).map((t) => (
          <ToolButton key={t} icon="zap" label={t} onClick={() => onComing(`${t} driver`)} />
        ))}
        <ToolButton icon="wand" label="Scratch" accent={VIOLET} onClick={() => onComing('Create From Scratch')} />
      </div>
      <div className="text-[8px] font-mono text-white/30 leading-tight">Drivers play animation only — behavior wiring lives in the node editor (§1.3).</div>
    </>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function SelectionChip({ label, locked, group }: { label: string; locked: boolean; group: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-black/30 border border-white/5">
      <Icon name={group ? 'group' : 'cursor'} size={12} color={group ? VIOLET : ACCENT} />
      <span className="flex-1 text-[10px] font-mono text-white/80 truncate">{label}</span>
      {locked && <Icon name="lock" size={11} color={AMBER} />}
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-4 px-2">
      <div className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center bg-white/[0.02]">
        <Icon name={icon} size={16} color="#8b93b5" />
      </div>
      <span className="text-[9.5px] font-mono text-white/45 leading-relaxed">{text}</span>
    </div>
  );
}

// ── Keyframe editor (slide-up; §8.4 — designed, content forthcoming) ─────────
const TRACKS = [
  { name: 'Opacity', color: ACCENT, keys: [0.0, 0.25, 0.6, 1.0] },
  { name: 'Translate Y', color: VIOLET, keys: [0.0, 0.5, 0.85] },
  { name: 'Scale', color: GREEN, keys: [0.0, 1.0] },
];

function KeyframeEditorPanel({
  open, onClose, selectionLabel,
}: {
  open: boolean; onClose: () => void; selectionLabel: string;
}) {
  const [playhead, setPlayhead] = useState(0.32);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [snapGrid, setSnapGrid] = useState<'1/60' | '1/100' | '1/120'>('1/60');

  return (
    <div
      data-component="keyframe-editor"
      // Full viewport width (Logan): the editor spans edge-to-edge for finer
      // scrubber / fader control. It floats above the left rail and the right
      // Inspector at the bottom of the canvas.
      className="absolute z-40 bottom-0 left-0 right-0 pointer-events-none"
      style={{
        transform: open ? 'translateY(0)' : 'translateY(110%)',
        opacity: open ? 1 : 0,
        transition: 'transform 320ms cubic-bezier(0.16,1,0.3,1), opacity 240ms ease',
      }}
    >
      <div className="m-3 rounded-2xl border border-white/10 pointer-events-auto overflow-hidden" style={GLASS}>
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 h-11 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <Icon name="timeline" size={14} color={ACCENT} glow />
            <span className="text-[11px] font-display font-semibold text-white">Keyframe Editor</span>
            <span className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded" style={{ background: `${VIOLET}22`, color: VIOLET }}>
              CATALOG FORTHCOMING
            </span>
            <span className="text-[9px] font-mono text-white/40 hidden lg:inline">· {selectionLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPlaying((p) => !p)} className="w-7 h-7 rounded-md border border-white/10 flex items-center justify-center hover:bg-white/5">
              <Icon name={playing ? 'pause' : 'play'} size={11} color={GREEN} />
            </button>
            <button type="button" onClick={() => setLoop((l) => !l)} title="Loop" className="w-7 h-7 rounded-md border border-white/10 flex items-center justify-center hover:bg-white/5" style={loop ? { background: `${ACCENT}1f` } : undefined}>
              <Icon name="refresh" size={11} color={loop ? ACCENT : '#8b93b5'} />
            </button>
            <div className="flex items-center rounded-md border border-white/10 overflow-hidden">
              {(['1/60', '1/100', '1/120'] as const).map((g) => (
                <button key={g} type="button" onClick={() => setSnapGrid(g)} className={`px-1.5 h-7 text-[8.5px] font-mono ${snapGrid === g ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'}`}>
                  {g}
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose} className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center">
              <Icon name="close" size={10} color="#8b93b5" />
            </button>
          </div>
        </div>

        {/* Scrubber / fader */}
        <div className="px-3.5 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono tabular-nums text-white/55 w-10">{(playhead * 3).toFixed(2)}s</span>
            <div className="relative flex-1 h-7">
              <input
                type="range" min={0} max={1} step={0.001} value={playhead}
                onChange={(e) => setPlayhead(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              />
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${playhead * 100}%`, background: `linear-gradient(90deg, ${ACCENT}, ${VIOLET})` }} />
              </div>
              {/* ruler ticks — major every 0.5s, minor every 0.1s (reads as a real timeline at full width) */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                {Array.from({ length: 31 }).map((_, i) => (
                  <span
                    key={i}
                    className={i % 5 === 0 ? 'w-px h-3 bg-white/25' : 'w-px h-1.5 bg-white/10'}
                  />
                ))}
              </div>
              <div className="absolute top-0 bottom-0 w-3 -translate-x-1/2 flex justify-center pointer-events-none" style={{ left: `${playhead * 100}%` }}>
                <span className="w-3 h-3 mt-0.5 rotate-45 rounded-[3px]" style={{ background: '#fff', boxShadow: `0 0 8px ${ACCENT}` }} />
              </div>
            </div>
            <span className="text-[9px] font-mono tabular-nums text-white/35 w-8">3.00s</span>
          </div>
        </div>

        {/* Multi-track lanes */}
        <div className="px-3.5 pb-3 pt-1 flex flex-col gap-2 max-h-[200px] overflow-y-auto">
          {TRACKS.map((tr) => (
            <div key={tr.name} className="flex items-center gap-2.5">
              <span className="w-28 text-[10px] font-mono text-white/60 truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tr.color, boxShadow: `0 0 5px ${tr.color}` }} />
                {tr.name}
              </span>
              <div className="relative flex-1 h-7 rounded-md bg-black/30 border border-white/5">
                <div className="absolute inset-y-1.5 left-2 right-2 top-1/2 -translate-y-1/2 h-px bg-white/10" />
                {tr.keys.map((k, i) => (
                  <span
                    key={i}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 rounded-[2px] border"
                    style={{ left: `${6 + k * 88}%`, background: `${tr.color}cc`, borderColor: '#ffffff44' }}
                  />
                ))}
                <span className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${6 + playhead * 88}%` }} />
              </div>
              <button type="button" className="w-6 h-6 rounded-md border border-white/10 flex items-center justify-center hover:bg-white/5">
                <Icon name="plus" size={9} color="#8b93b5" />
              </button>
            </div>
          ))}
          <div className="text-[8px] font-mono text-white/30 pl-[122px]">
            Timeline is continuous seconds (no global fps). Tracks bind to the selection&apos;s Animatable controls once the Primitive Catalog lands.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Marquee overlay ──────────────────────────────────────────────────────────
function MarqueeOverlay({
  onCommit, onCancel,
}: {
  onCommit: (rect: { left: number; top: number; width: number; height: number }) => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [cur, setCur] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const rect = start && cur
    ? {
        left: Math.min(start.x, cur.x),
        top: Math.min(start.y, cur.y),
        width: Math.abs(cur.x - start.x),
        height: Math.abs(cur.y - start.y),
      }
    : null;

  return (
    <div
      ref={ref}
      className="absolute inset-0 z-30 pointer-events-auto"
      style={{ cursor: 'crosshair' }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setStart({ x: e.clientX, y: e.clientY });
        setCur({ x: e.clientX, y: e.clientY });
      }}
      onPointerMove={(e) => {
        if (start) setCur({ x: e.clientX, y: e.clientY });
      }}
      onPointerUp={() => {
        if (rect && rect.width > 4 && rect.height > 4) onCommit(rect);
        else onCancel();
        setStart(null);
        setCur(null);
      }}
    >
      <div className="absolute top-16 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full border border-white/10 pointer-events-none" style={GLASS}>
        <span className="text-[10px] font-mono text-white/80">Drag a box to select · release to confirm</span>
      </div>
      {rect && (
        <div
          className="absolute rounded-md pointer-events-none"
          style={{
            left: rect.left, top: rect.top, width: rect.width, height: rect.height,
            background: `${ACCENT}1a`, border: `1px solid ${ACCENT}`, boxShadow: `0 0 0 1px ${ACCENT}55, 0 0 24px ${ACCENT}33`,
          }}
        />
      )}
    </div>
  );
}
