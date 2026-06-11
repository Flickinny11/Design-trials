'use client';

/**
 * STEP8 — Prism Canvas Toolbar (canvas-spec §5 the editing suite, §6 build
 * lifecycle, §8.4 keyframe editor, §14 selection/grouping, §1.3 boundary).
 *
 * The toolbar is part of the PRISM DESIGN SYSTEM ("Observatory Brass"): a
 * machined brushed-metal left dock of grouped tool clusters with a frosted-
 * glass flyout per group, a slide-up ceramic keyframe editor, a marquee-select
 * overlay, and contextual "coming with <subsystem>" states for the groups
 * whose engines are not yet wired. It is the canvas authoring chrome — it only
 * renders while viewMode === 'canvas' (page.tsx gates it) and never appears in
 * galaxy or preview-app.
 *
 * WIRED NOW (their engines already exist):
 *   - Transform — select / Edit handles / move / rotate / scale / nudge / align
 *     / reset, all writing the node's OWN `scenePosition` (canvas-spec SC-9 /
 *     CORRECTED CONCEPT). Group selections cascade.
 *   - Selection — marquee + shift-click, Group / Ungroup (additive `groupId`,
 *     INV-1 topology untouched), Lock / Unlock, Freeze, Select-all-in-hub.
 *   - Build — Build Node / Rebuild (Step-5/6 surgical rebuild path) and Add to
 *     System (re-caption + clear dirty).
 *   - Text — P1 TEXT SYSTEM (canvas-spec §5 / §7.2-7.5): Add Text node
 *     (create-text-node builder), font picker (full library + on-demand
 *     atlas bake, criterion 27), type metrics, fills (solid/gradient/
 *     texture/ai-texture with local procedural swatches), outline/glow/
 *     shadow, preset chips, and the text-animation picker surface. Live
 *     styling edits route through usePreviewStateStore (FP-15).
 *   - Animation — P2 TOOLBAR WIRING (canvas-spec §5 Animation group, §8.2/
 *     §8.3, criteria 12/13): live hover-play picker over the full Animatable
 *     registry (shared catalog rig — one WebGPU canvas), click-to-bind onto
 *     `node.animationBindings`, per-binding driver chips (Load/Time · Scroll
 *     · Pointer · State · Event), ControlSchema param tuning via the reused
 *     catalog ControlPanel, reorder + remove. Lives in
 *     `@/components/editor/animation-tools/`.
 *   - Add — P2 (canvas-spec §5 Add group): AddElementFlyout at
 *     `@/components/editor/add-tools/`.
 *   - Image — P3 IMAGE/MEDIA (canvas-spec §5 Image tools): upload (file-drop
 *     well → /api/prism/assets) and paste-a-link creation of image-plane
 *     nodes (born Populated — visual.sourceAsset IS the artifact), Replace
 *     via the surgical rebuild path, and imageSpec presentation controls
 *     (fit/crop/corners/opacity) restyling live. Generate stays HONEST: it
 *     probes /api/prism/image-gen and discloses, never fakes. Lives in
 *     `@/components/editor/image-tools/`.
 *   - 3D Object — P4 (canvas-spec §5 3D object tools): the 7-key primitive
 *     picker (cube/sphere/plane/cylinder/cone/torus/capsule via the frozen
 *     create-object-node builder seam), per-kind dimension faders writing
 *     `node.meshPrimitive` (live reshape), a read-only material summary +
 *     jump key into the Inspector's Material tab (the §11 editor stays the
 *     single source of truth), and a lighting note pointing at the Lighting
 *     group's Receives Light switch. Lives in
 *     `@/components/editor/object-tools/`.
 *
 * DESIGNED-PLACEHOLDER (look complete, never fake output — clicking a deferred
 * tool surfaces a tasteful "coming with <subsystem>" state):
 *   - Animation from-scratch / bespoke authoring (← bespoke lane).
 *     The Keyframe Editor *toggle* is real
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
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import TextToolsFlyout from '@/components/editor/text-tools/TextToolsFlyout';
import AnimationFlyout from '@/components/editor/animation-tools/AnimationFlyout';
import AddElementFlyout from '@/components/editor/add-tools/AddElementFlyout';
import ImageFlyout from '@/components/editor/image-tools/ImageFlyout';
import ObjectFlyout from '@/components/editor/object-tools/ObjectFlyout';
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

// ── Observatory Brass treatments (derived from design-system tokens ONLY) ───
// Machined key — a raised button face cut into the dock / flyout plates.
const KEY_BG = 'linear-gradient(178deg, var(--ds-slate), var(--ds-charcoal))';
const KEY_SHADOW = 'var(--ds-chamfer-soft), 0 1px 2px rgba(0, 0, 0, 0.45)';
// Recessed trough — value readouts, status plates, timeline lanes.
const WELL_BG = 'var(--ds-grad-well)';
const WELL_SHADOW =
  'inset 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(255, 252, 242, 0.05)';
// Transient smoked-glass pill (toast / marquee hint) — never always-visible,
// so it sits outside the one-glass-per-region backdrop budget.
const SMOKED_PILL: React.CSSProperties = {
  background: 'var(--ds-grad-smoked)',
  WebkitBackdropFilter: 'var(--ds-frost-light)',
  backdropFilter: 'var(--ds-frost-light)',
  boxShadow: 'var(--ds-chamfer-soft), var(--ds-elev-2)',
};
// Accent-tinted active key state (brass by default; ice for frozen states).
function activeKeyStyle(a: string): React.CSSProperties {
  return {
    background: `linear-gradient(178deg, ${dsAlpha(a, 0.2)}, ${dsAlpha(a, 0.07)}), var(--ds-grad-ceramic)`,
    boxShadow: `inset 0 0 0 1px ${dsAlpha(a, 0.45)}, var(--ds-chamfer-soft), 0 0 14px ${dsAlpha(a, 0.16)}`,
  };
}

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
  { id: 'add', icon: 'plus', label: 'Add', wired: true },
  { id: 'image', icon: 'image', label: 'Image', wired: true },
  { id: 'object3d', icon: 'cube', label: '3D Object', wired: true },
  { id: 'text', icon: 'text', label: 'Text', wired: true },
  { id: 'animation', icon: 'wand', label: 'Animation', wired: true },
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

// Light COLOR DATA defaults — sanctioned hex exception (NOT chrome styling).
// These are physical emitter colors written into `hub.lightingSpec` graph data
// and consumed by the renderer: a neutral white emitter and the conventional
// three.js hemisphere ground-bounce tone. They are scene data, not UI paint,
// so they intentionally bypass the chrome token system.
const LIGHT_COLOR_DEFAULT = '#ffffff';
const HEMI_GROUND_DEFAULT = '#404050';

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
  const base: PrismLight = { id, type, color: LIGHT_COLOR_DEFAULT, intensity: 1 };
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
      return { ...base, groundColor: HEMI_GROUND_DEFAULT, intensity: 0.6 };
    case 'ambient':
      return { ...base, intensity: 0.4 };
    default:
      return base;
  }
}

// ── Small building blocks ────────────────────────────────────────────────────
// Engraved machined groove — a 1px shade line over a 1px bone catch-light,
// both feathering out — used as the specular section divider across the
// dock and flyouts (reads as a scribe line cut into the housing).
const GROOVE_H: React.CSSProperties = {
  background:
    'linear-gradient(90deg, var(--ds-edge-shade), rgba(0, 0, 0, 0) 92%) top / 100% 1px no-repeat, ' +
    'linear-gradient(90deg, var(--ds-edge-side), rgba(255, 252, 242, 0) 86%) bottom / 100% 1px no-repeat',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1.5 mt-0.5">
      <span
        className="text-[9px] font-mono tracking-[0.18em] uppercase whitespace-nowrap"
        style={{ color: 'var(--ds-text-low)', textShadow: '0 1px 0 rgba(0, 0, 0, 0.55)' }}
      >
        {children}
      </span>
      <span aria-hidden className="flex-1 min-w-3 h-[2px]" style={GROOVE_H} />
    </div>
  );
}

function ToolButton({
  icon, label, active, disabled, accent, onClick, title, testId,
}: {
  icon: string; label: string; active?: boolean; disabled?: boolean;
  accent?: string; onClick?: () => void; title?: string; testId?: string;
}) {
  const a = accent ?? DS_ACCENT;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
      data-testid={testId}
      className={`group/tool flex flex-col items-center justify-center gap-1 h-14 rounded-ds-sm ds-press transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed' : active ? '' : 'hover:brightness-[1.15]'
      }`}
      style={
        disabled
          ? { background: 'var(--ds-grad-ceramic)', boxShadow: 'var(--ds-chamfer-soft)' }
          : active
            ? activeKeyStyle(a)
            : { background: KEY_BG, boxShadow: KEY_SHADOW }
      }
    >
      <Icon name={icon} size={15} color={active ? a : DS.text} glow={active} />
      <span
        className="text-[8.5px] font-mono tracking-wide"
        style={{ color: active ? 'var(--ds-text-hi)' : 'var(--ds-text-mid)' }}
      >
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
  const a = accent ?? DS_ACCENT;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-5 text-[10px] font-mono" style={{ color: 'var(--ds-text-low)' }}>{label}</span>
      <button
        type="button"
        onClick={onDec}
        data-testid={testId ? `${testId}-dec` : undefined}
        className="w-6 h-6 rounded-ds-xs ds-press hover:brightness-[1.2] transition-all text-[12px] leading-none"
        style={{ background: KEY_BG, boxShadow: KEY_SHADOW, color: 'var(--ds-text)' }}
      >
        −
      </button>
      <span
        className="flex-1 text-center text-[10px] font-mono tabular-nums px-1 py-1 rounded-ds-xs"
        style={{ color: a, background: WELL_BG, boxShadow: WELL_SHADOW }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={onInc}
        data-testid={testId ? `${testId}-inc` : undefined}
        className="w-6 h-6 rounded-ds-xs ds-press hover:brightness-[1.2] transition-all text-[12px] leading-none"
        style={{ background: KEY_BG, boxShadow: KEY_SHADOW, color: 'var(--ds-text)' }}
      >
        +
      </button>
    </div>
  );
}

// (The designed-placeholder tile grid that used to live here retired with the
// last placeholder group — every toolbar group is wired now except the
// bespoke-authoring lane inside Animation, which renders its own coming
// state via `showComing`.)

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
        {/* Machined brushed-metal dock — the instrument fitting the tool keys
            are cut into (ds-metal + grain tooth + specular edge). */}
        <div className="flex flex-col gap-1 p-1.5 ds-metal ds-grain ds-edge">
          <div className="px-1 pt-0.5 pb-1.5 flex flex-col items-center gap-0.5">
            <Icon name="grid" size={13} color={DS_ACCENT} glow />
            <span className="text-[7.5px] font-mono tracking-[0.2em]" style={{ color: 'var(--ds-text-low)', textShadow: '0 1px 0 rgba(0, 0, 0, 0.6)' }}>
              CANVAS
            </span>
          </div>
          {/* Scribed part line under the nameplate — same machined groove as
              the pre-Build divider, so the label reads as a fitted plate. */}
          <div
            aria-hidden
            className="mx-1.5 mb-0.5 h-[2px]"
            style={{
              background:
                'linear-gradient(90deg, rgba(0, 0, 0, 0), var(--ds-edge-shade) 22%, var(--ds-edge-shade) 78%, rgba(0, 0, 0, 0)) top / 100% 1px no-repeat, ' +
                'linear-gradient(90deg, rgba(255, 252, 242, 0), var(--ds-edge-side) 26%, var(--ds-edge-side) 74%, rgba(255, 252, 242, 0)) bottom / 100% 1px no-repeat',
            }}
          />
          {GROUPS.map((g) => {
            const isActive = activeGroup === g.id;
            const beforeBuild = g.id === 'build';
            return (
              <div key={g.id} className="contents">
                {beforeBuild && (
                  // Machined V-groove cut across the dock plate — shade line
                  // over bone catch-light, feathering into the metal at both
                  // ends like a lathe-scribed part line.
                  <div
                    aria-hidden
                    className="mx-1.5 my-1 h-[2px]"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(0, 0, 0, 0), var(--ds-edge-shade) 22%, var(--ds-edge-shade) 78%, rgba(0, 0, 0, 0)) top / 100% 1px no-repeat, ' +
                        'linear-gradient(90deg, rgba(255, 252, 242, 0), var(--ds-edge-side) 26%, var(--ds-edge-side) 74%, rgba(255, 252, 242, 0)) bottom / 100% 1px no-repeat',
                    }}
                  />
                )}
                <button
                  type="button"
                  data-tool-group={g.id}
                  onClick={() => setActiveGroup((cur) => (cur === g.id ? null : g.id))}
                  title={g.label}
                  className={`relative w-12 h-12 rounded-ds-sm flex flex-col items-center justify-center gap-0.5 ds-press transition-all ${
                    isActive ? '' : 'hover:brightness-[1.2] hover:bg-white/[0.04]'
                  }`}
                  style={isActive ? activeKeyStyle(DS_ACCENT) : undefined}
                >
                  {isActive && (
                    <span
                      className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full"
                      style={{ background: 'var(--ds-grad-brass)', boxShadow: 'var(--ds-glow-brass)' }}
                    />
                  )}
                  <Icon name={g.icon} size={16} color={isActive ? DS.brass200 : DS.text} glow={isActive} />
                  <span
                    className="text-[7px] font-mono tracking-wide"
                    style={{ color: isActive ? 'var(--ds-brass-200)' : 'var(--ds-text-low)' }}
                  >
                    {g.label}
                  </span>
                  {!g.wired && (
                    <span
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                      style={{ background: 'var(--ds-ice-400)', boxShadow: `0 0 6px ${dsAlpha(DS.ice400, 0.8)}` }}
                    />
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
              // P2 (Task C) — wired Add group. Same hub resolution the Text
              // and Lighting groups share (active hub → selected node's
              // parent → first hub).
              <AddElementFlyout hub={lightingHub} onToast={setToast} />
            )}
            {activeGroup === 'image' && (
              // P3 IMAGE/MEDIA (Task B) — wired Image group. Same hub
              // resolution the Text / Add / Lighting groups share (active hub
              // → selected node's parent → first hub).
              <ImageFlyout node={selectedNode} hub={lightingHub} onToast={setToast} />
            )}
            {activeGroup === 'object3d' && (
              // P4 3D-OBJECT (Task B) — wired 3D Object group. Same hub
              // resolution the Text / Add / Image / Lighting groups share
              // (active hub → selected node's parent → first hub).
              <ObjectFlyout node={selectedNode} hub={lightingHub} onToast={setToast} />
            )}
            {activeGroup === 'text' && (
              // P1 TEXT SYSTEM (Task B) — wired flyout. `lightingHub` is the
              // shared active-hub resolution (active hub → selected node's
              // parent → first hub); Add Text tethers the new node there.
              <TextToolsFlyout
                node={selectedNode}
                hub={lightingHub}
                onToast={setToast}
              />
            )}
            {activeGroup === 'animation' && (
              // P2 TOOLBAR WIRING (Task B) — wired Animation group: live
              // catalog picker + binding stack on the selected node. The
              // keyframe-editor slide-up toggle stays owned here (§8.4).
              <AnimationFlyout
                node={selectedNode}
                multiCount={selectedNodeIds.size}
                onToast={setToast}
                keyframeOpen={keyframeOpen}
                onToggleKeyframe={() => setKeyframeOpen((v) => !v)}
                onComing={(t) => showComing(t, 'bespoke authoring lane')}
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
          className="absolute z-50 left-1/2 -translate-x-1/2 top-16 pointer-events-none px-3.5 py-2 rounded-full flex items-center gap-2 ds-reveal"
          style={SMOKED_PILL}
        >
          <Icon name="check" size={11} color={DS.ok} />
          <span className="text-[10px] font-mono" style={{ color: 'var(--ds-text)' }}>{toast}</span>
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
  // P2: the Animation picker is a 3-across LIVE tile grid — it gets a wider
  // plate and manages its OWN scroll region (the flyout component clips the
  // shared-rig canvas to that region), so the shell must not double-scroll.
  const wide = meta.id === 'animation';
  return (
    <div
      data-component="canvas-toolbar-flyout"
      data-group={meta.id}
      // Hero surface of canvas mode (1 of ≤3 refract surfaces; RefractionDefs
      // is mounted once in page.tsx). Falls back to plain frost below t2.
      className={`${wide ? 'w-[424px]' : 'w-[252px]'} ds-glass ds-glass--refract ds-edge--brass max-h-[78vh] overflow-hidden flex ds-reveal`}
    >
      {/* Inner scroll plate — keeps the specular edge ring pinned to the
          glass while long flyouts (Lighting) scroll. */}
      <div className={`flex-1 min-w-0 p-3 flex flex-col gap-2.5 ${wide ? 'min-h-0 overflow-hidden' : 'overflow-y-auto'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-ds-xs flex items-center justify-center"
              style={{
                background: meta.wired ? 'var(--ds-grad-brass-soft)' : dsAlpha(DS.ice400, 0.12),
                boxShadow: `inset 0 0 0 1px ${dsAlpha(meta.wired ? DS_ACCENT : DS.ice400, 0.34)}, var(--ds-chamfer-soft)`,
              }}
            >
              <Icon name={meta.icon} size={14} color={meta.wired ? DS.brass300 : DS.ice300} glow />
            </div>
            <div>
              <div className="text-[12px] font-display font-semibold leading-none" style={{ color: 'var(--ds-text-hi)' }}>
                {meta.label}
              </div>
              <div
                className="text-[8px] font-mono tracking-widest mt-0.5"
                style={{ color: meta.wired ? 'var(--ds-ok)' : 'var(--ds-ice-300)' }}
              >
                {meta.wired ? 'WIRED' : 'COMING SOON'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-ds-xs ds-press hover:bg-white/[0.06] flex items-center justify-center transition-colors"
          >
            <Icon name="close" size={10} color={DS.textMid} />
          </button>
        </div>

        {!meta.wired && (
          <div className="text-[9px] font-mono leading-relaxed -mt-1" style={{ color: 'var(--ds-text-low)' }}>
            Designed preview. Wires to the <span style={{ color: 'var(--ds-text)' }}>{meta.subsystem}</span>.
          </div>
        )}

        {children}

        {coming && (
          <div
            className="mt-1 px-2.5 py-2 rounded-ds-sm flex items-start gap-2 ds-reveal"
            style={{
              background: dsAlpha(DS.ice400, 0.1),
              boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.28)}, var(--ds-chamfer-soft)`,
            }}
          >
            <Icon name="sparkle" size={12} color={DS.ice300} glow />
            <div className="leading-tight">
              <div className="text-[10px] font-mono" style={{ color: 'var(--ds-text-hi)' }}>{coming.tool}</div>
              <div className="text-[8.5px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>
                Coming with the {coming.subsystem}
              </div>
            </div>
          </div>
        )}
      </div>
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
        <div
          className="text-[9px] font-mono px-2 py-1.5 rounded-ds-sm"
          style={{
            color: 'var(--ds-warn)',
            background: dsAlpha(DS.warn, 0.08),
            boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.warn, 0.26)}`,
          }}
        >
          Locked — unlock in Selection to transform.
        </div>
      )}
      <button
        type="button"
        data-action="edit-toggle"
        onClick={onEditToggle}
        className="w-full h-9 rounded-ds-sm flex items-center justify-center gap-2 ds-press hover:brightness-[1.12] transition-all"
        style={editorMode === 'edit' ? activeKeyStyle(DS_ACCENT) : { background: KEY_BG, boxShadow: KEY_SHADOW }}
      >
        <Icon name="edit" size={13} color={editorMode === 'edit' ? DS_ACCENT : DS.text} glow={editorMode === 'edit'} />
        <span
          className="text-[11px] font-mono"
          style={{ color: editorMode === 'edit' ? 'var(--ds-brass-200)' : 'var(--ds-text)' }}
        >
          {editorMode === 'edit' ? 'Editing — handles on' : 'Edit Handles'}
        </span>
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
        <StepperRow label="Z" testId="tt-pos-z" value={fmt(sp.z)} onDec={() => onNudge('z', -1)} onInc={() => onNudge('z', 1)} accent={DS.ice300} />
      </div>

      <SectionLabel>Scale · Rotate</SectionLabel>
      <div className="flex flex-col gap-1.5">
        <StepperRow label="S" testId="tt-scale-val" value={`${fmt(sp.scaleX)}×`} onDec={() => onScale(-1)} onInc={() => onScale(1)} accent={DS.brass300} />
        <StepperRow label="R" testId="tt-rot-val" value={deg(sp.rotationZ)} onDec={() => onRotate(-1)} onInc={() => onRotate(1)} accent={DS.brass300} />
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
          className="flex-1 h-8 rounded-ds-sm flex items-center justify-center gap-1.5 ds-press hover:brightness-[1.15] transition-all"
          style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
        >
          <Icon name="grid" size={11} color={snap ? DS_ACCENT : DS.textMid} />
          <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text)' }}>Snap {snap ? 'On' : 'Off'}</span>
        </button>
        <button
          type="button"
          data-action="reset-transform"
          onClick={onReset}
          className="flex-1 h-8 rounded-ds-sm flex items-center justify-center gap-1.5 ds-press hover:brightness-[1.15] transition-all"
          style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
        >
          <Icon name="refresh" size={11} color={DS.text} />
          <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text)' }}>Reset</span>
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
      <div className="flex items-center justify-between px-2.5 py-2 ds-well">
        <span className="text-[10px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>Selected</span>
        <span
          className="text-[12px] font-mono font-semibold"
          style={{ color: count > 1 ? 'var(--ds-brass-200)' : 'var(--ds-brass-300)' }}
        >
          {count}
        </span>
      </div>

      <SectionLabel>Select</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton icon="cursor" label="Marquee" testId="tt-marquee" active={marqueeArmed} onClick={onMarquee} title="Drag a box over the canvas to select" />
        <ToolButton icon="grid" label="All in Hub" testId="tt-select-all" onClick={onSelectAll} />
      </div>
      <div className="text-[8.5px] font-mono leading-tight -mt-0.5" style={{ color: 'var(--ds-text-low)' }}>
        Shift-click adds to the selection.
      </div>

      <SectionLabel>Group</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton icon="group" label="Group" testId="tt-group" accent={DS.brass300} disabled={!canGroup} onClick={onGroup} title="Group 2+ selected elements" />
        <ToolButton icon="ungroup" label="Ungroup" testId="tt-ungroup" accent={DS.brass300} disabled={!canUngroup} onClick={onUngroup} />
      </div>

      <SectionLabel>Protect</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton icon={isLocked ? 'lock' : 'lockOpen'} label={isLocked ? 'Unlock' : 'Lock'} testId="tt-lock" active={isLocked} accent={DS.warn} onClick={onLock} />
        <ToolButton icon="snow" label={isFrozen ? 'Unfreeze' : 'Freeze'} active={isFrozen} accent={DS.ice300} onClick={onFreeze} title="Freeze = AI off-limits" />
      </div>

      <button
        type="button"
        onClick={onClear}
        className="mt-0.5 h-8 rounded-ds-sm flex items-center justify-center gap-1.5 ds-press hover:brightness-[1.15] transition-all"
        style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
      >
        <Icon name="close" size={10} color={DS.textMid} />
        <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>Clear selection</span>
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
  const stateColor = dirty ? DS.warn : status === 'failed' ? DS.danger : status === 'repaired' ? DS.warn : DS.ok;
  const stateLabel = dirty ? 'Dirty — needs rebuild' : status === 'failed' ? 'Failed' : status === 'repaired' ? 'Repaired' : 'Built · in system';
  return (
    <>
      <div className="flex items-center justify-between px-2.5 py-2 ds-well">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: stateColor, boxShadow: `0 0 6px ${dsAlpha(stateColor, 0.8)}` }} />
          <span className="text-[10px] font-mono" style={{ color: 'var(--ds-text)' }}>{stateLabel}</span>
        </span>
        <span className="text-[9px] font-mono" style={{ color: 'var(--ds-text-low)' }}>v{buildCount ?? 1}</span>
      </div>

      <button
        type="button"
        data-action="rebuild"
        disabled={busy}
        onClick={onRebuild}
        className="ds-btn ds-btn--primary ds-press w-full h-9"
      >
        <Icon name="hammer" size={13} color={DS.ink} />
        <span className="text-[11px] font-mono font-semibold">{busy ? 'Rebuilding…' : 'Save & Rebuild'}</span>
      </button>

      <button
        type="button"
        data-action="add-to-system"
        onClick={onAddToSystem}
        className="ds-btn w-full h-9"
      >
        <Icon name="check" size={12} color={DS.ok} />
        <span className="text-[11px] font-mono">Add to System</span>
      </button>
      <div className="text-[8.5px] font-mono leading-tight -mt-0.5" style={{ color: 'var(--ds-text-low)' }}>
        Re-captions the node and clears its dirty flag.
      </div>

      <SectionLabel>History</SectionLabel>
      <button
        type="button"
        onClick={() => onComing('Version history')}
        className="h-8 rounded-ds-sm flex items-center justify-center gap-1.5 ds-press hover:brightness-[1.15] transition-all"
        style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
      >
        <Icon name="layers" size={11} color={DS.text} />
        <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text)' }}>{buildCount ?? 1} build{(buildCount ?? 1) === 1 ? '' : 's'} · view history</span>
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
      <div className="flex items-center gap-2 px-2.5 py-2 ds-well">
        <Icon name="bulb" size={12} color={DS_ACCENT} />
        <span className="flex-1 text-[10px] font-mono truncate" style={{ color: 'var(--ds-text)' }}>{hubTitle}</span>
        <span className="text-[9px] font-mono" style={{ color: 'var(--ds-text-low)' }}>{lights.length} light{lights.length === 1 ? '' : 's'}</span>
      </div>

      {/* Light list + Add */}
      <SectionLabel>Lights · writes hub lightingSpec</SectionLabel>
      <div className="flex flex-col gap-1">
        {lights.length === 0 && (
          <div className="text-[8.5px] font-mono leading-tight px-1 py-1" style={{ color: 'var(--ds-text-low)' }}>
            No author lights — the runtime default 3-point rig is active. Add one to override.
          </div>
        )}
        {lights.map((l) => {
          const active = l.id === selectedLightId;
          return (
            <div
              key={l.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-ds-sm transition-all ${active ? '' : 'hover:brightness-[1.15]'}`}
              style={
                active
                  ? activeKeyStyle(DS_ACCENT)
                  : { background: 'var(--ds-grad-ceramic)', boxShadow: 'var(--ds-chamfer-soft)' }
              }
            >
              <button
                type="button"
                onClick={() => onSelectLight(l.id)}
                className="flex-1 flex items-center gap-2 text-left"
                title={`Select ${LIGHT_TYPE_LABEL[l.type]} light`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: l.color ?? LIGHT_COLOR_DEFAULT, border: '1px solid rgba(255, 252, 242, 0.3)', boxShadow: 'inset 0 1px 1px rgba(255, 252, 242, 0.3), 0 1px 2px rgba(0, 0, 0, 0.5)' }}
                />
                <span className="text-[10px] font-mono" style={{ color: active ? 'var(--ds-text-hi)' : 'var(--ds-text)' }}>
                  {LIGHT_TYPE_LABEL[l.type]}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveLight(l.id)}
                title="Remove light"
                className="w-5 h-5 rounded-ds-xs ds-press hover:bg-white/[0.06] flex items-center justify-center transition-colors"
              >
                <Icon name="trash" size={10} color={DS.textMid} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        data-action="add-light"
        onClick={onTogglePicker}
        className="w-full h-8 rounded-ds-sm flex items-center justify-center gap-1.5 ds-press hover:brightness-[1.12] transition-all"
        style={pickerOpen ? activeKeyStyle(DS_ACCENT) : { background: KEY_BG, boxShadow: KEY_SHADOW }}
      >
        <Icon name="plus" size={11} color={pickerOpen ? DS_ACCENT : DS.text} />
        <span className="text-[9.5px] font-mono" style={{ color: pickerOpen ? 'var(--ds-brass-200)' : 'var(--ds-text)' }}>Add Light</span>
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
          <label className="flex items-center justify-between px-2.5 py-2 ds-well">
            <span className="text-[10px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>Type</span>
            <select
              data-control="light-type"
              value={selectedLight.type}
              onChange={(e) => onUpdateLight(selectedLight.id, { type: e.target.value as PrismLightType })}
              className="bg-transparent text-[10px] font-mono outline-none cursor-pointer"
              style={{ color: 'var(--ds-text-hi)' }}
            >
              {LIGHT_TYPES.map((t) => (
                <option key={t} value={t} style={{ background: 'var(--ds-charcoal)', color: 'var(--ds-text-hi)' }}>{LIGHT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between px-2.5 py-2 ds-well">
            <span className="text-[10px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>Color</span>
            <input
              type="color"
              data-control="light-color"
              value={selectedLight.color ?? LIGHT_COLOR_DEFAULT}
              onChange={(e) => onUpdateLight(selectedLight.id, { color: e.target.value })}
              className="w-7 h-6 rounded-ds-xs cursor-pointer bg-transparent"
              style={{ border: '1px solid rgba(255, 252, 242, 0.14)', boxShadow: 'var(--ds-chamfer-soft)' }}
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
              accent={DS.brass300}
              onClick={() => onUpdateLight(selectedLight.id, { castShadow: !(selectedLight.castShadow === true) })}
            />
          )}
        </>
      ) : (
        lights.length > 0 && (
          <div className="text-[8.5px] font-mono leading-tight px-1" style={{ color: 'var(--ds-text-low)' }}>Select a light above to tune it.</div>
        )
      )}

      {/* Scene-wide: shadow softness + env/IBL */}
      <SectionLabel>Scene · Shadow / Env</SectionLabel>
      <FaderRow
        label="Shadow Softness"
        value={shadowSoftness}
        accent={DS.brass300}
        testId="shadow-softness"
        onChange={(v) => onPatchSpec({ shadowSoftness: v })}
      />
      <FaderRow
        label="Env / IBL Intensity"
        value={envIntensity}
        max={2}
        accent={DS.ice300}
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
            accent={DS.brass300}
            onClick={onToggleReceives}
            title="Toggle whether this node is lit by the scene rig"
          />
          <div className="text-[8px] font-mono leading-tight" style={{ color: 'var(--ds-text-low)' }}>
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
  const a = accent ?? DS_ACCENT;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>{label}</span>
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
        className="ds-slider w-full cursor-pointer"
      />
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function SelectionChip({ label, locked, group }: { label: string; locked: boolean; group: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 ds-well">
      <Icon name={group ? 'group' : 'cursor'} size={12} color={group ? DS.brass300 : DS_ACCENT} />
      <span className="flex-1 text-[10px] font-mono truncate" style={{ color: 'var(--ds-text)' }}>{label}</span>
      {locked && <Icon name="lock" size={11} color={DS.warn} />}
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-4 px-2">
      <div className="w-9 h-9 ds-well flex items-center justify-center">
        <Icon name={icon} size={16} color={DS.textMid} />
      </div>
      <span className="text-[9.5px] font-mono leading-relaxed" style={{ color: 'var(--ds-text-low)' }}>{text}</span>
    </div>
  );
}

// ── Keyframe editor (slide-up; §8.4 — designed, content forthcoming) ─────────
const TRACKS = [
  { name: 'Opacity', color: DS.brass400, keys: [0.0, 0.25, 0.6, 1.0] },
  { name: 'Translate Y', color: DS.brass200, keys: [0.0, 0.5, 0.85] },
  { name: 'Scale', color: DS.ice300, keys: [0.0, 1.0] },
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
        transition: 'transform var(--ds-t-slow) var(--ds-ease-out), opacity var(--ds-t-base) var(--ds-ease-out)',
      }}
    >
      {/* Ceramic instrument body with a machined header strip; engraved labels
          + brass markers throughout. */}
      <div
        className="m-3 ds-ceramic ds-edge pointer-events-auto overflow-hidden"
        style={{ boxShadow: 'var(--ds-chamfer), var(--ds-elev-3)' }}
      >
        {/* Header — machined metal strip with grain tooth and a specular
            top catch / shaded bottom seam against the ceramic body. */}
        <div
          className="relative ds-grain flex items-center justify-between px-3.5 h-11"
          style={{
            background: 'var(--ds-grad-metal)',
            borderBottom: '1px solid rgba(255, 252, 242, 0.07)',
            boxShadow: 'inset 0 1px 0 var(--ds-edge-specular), inset 0 -1px 0 rgba(0, 0, 0, 0.5)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Icon name="timeline" size={14} color={DS_ACCENT} glow />
            <span className="text-[11px] font-display font-semibold" style={{ color: 'var(--ds-text-hi)' }}>Keyframe Editor</span>
            <span className="ds-chip ds-chip--ice">
              CATALOG FORTHCOMING
            </span>
            <span className="text-[9px] font-mono hidden lg:inline" style={{ color: 'var(--ds-text-low)' }}>· {selectionLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="w-7 h-7 rounded-ds-xs ds-press hover:brightness-[1.2] transition-all flex items-center justify-center"
              style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
            >
              <Icon name={playing ? 'pause' : 'play'} size={11} color={DS.brass200} />
            </button>
            <button
              type="button"
              onClick={() => setLoop((l) => !l)}
              title="Loop"
              className="w-7 h-7 rounded-ds-xs ds-press hover:brightness-[1.2] transition-all flex items-center justify-center"
              style={loop ? activeKeyStyle(DS_ACCENT) : { background: KEY_BG, boxShadow: KEY_SHADOW }}
            >
              <Icon name="refresh" size={11} color={loop ? DS_ACCENT : DS.textMid} />
            </button>
            <div
              className="flex items-center rounded-ds-xs overflow-hidden"
              style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}
            >
              {(['1/60', '1/100', '1/120'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSnapGrid(g)}
                  className={`px-1.5 h-7 text-[8.5px] font-mono transition-colors ${
                    snapGrid === g ? '' : 'text-ds-text-low hover:text-ds-text'
                  }`}
                  style={
                    snapGrid === g
                      ? {
                          background: dsAlpha(DS_ACCENT, 0.18),
                          color: 'var(--ds-brass-200)',
                          boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.35)}`,
                        }
                      : undefined
                  }
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-ds-xs ds-press hover:bg-white/[0.06] flex items-center justify-center transition-colors"
            >
              <Icon name="close" size={10} color={DS.textMid} />
            </button>
          </div>
        </div>

        {/* Scrubber / fader */}
        <div className="px-3.5 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono tabular-nums w-10" style={{ color: 'var(--ds-text-mid)' }}>{(playhead * 3).toFixed(2)}s</span>
            <div className="relative flex-1 h-7">
              <input
                type="range" min={0} max={1} step={0.001} value={playhead}
                onChange={(e) => setPlayhead(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              />
              {/* Machined groove + brass fill */}
              <div
                className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full"
                style={{ background: WELL_BG, boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.6)' }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${playhead * 100}%`,
                    background: 'var(--ds-grad-brass)',
                    boxShadow: `0 0 8px ${dsAlpha(DS_ACCENT, 0.35)}`,
                  }}
                />
              </div>
              {/* ruler ticks — major every 0.5s, minor every 0.1s (reads as a real timeline at full width) */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                {Array.from({ length: 31 }).map((_, i) => (
                  <span
                    key={i}
                    className={i % 5 === 0 ? 'w-px h-3' : 'w-px h-1.5'}
                    style={{ background: i % 5 === 0 ? 'rgba(255, 252, 242, 0.22)' : 'rgba(255, 252, 242, 0.08)' }}
                  />
                ))}
              </div>
              {/* Brass playhead jewel */}
              <div className="absolute top-0 bottom-0 w-3 -translate-x-1/2 flex justify-center pointer-events-none" style={{ left: `${playhead * 100}%` }}>
                <span
                  className="w-3 h-3 mt-0.5 rotate-45 rounded-[3px]"
                  style={{
                    background: 'var(--ds-grad-brass)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.6), var(--ds-glow-brass)',
                  }}
                />
              </div>
            </div>
            <span className="text-[9px] font-mono tabular-nums w-8" style={{ color: 'var(--ds-text-low)' }}>3.00s</span>
          </div>
        </div>

        {/* Multi-track lanes */}
        <div className="px-3.5 pb-3 pt-1 flex flex-col gap-2 max-h-[200px] overflow-y-auto">
          {TRACKS.map((tr) => (
            <div key={tr.name} className="flex items-center gap-2.5">
              <span className="w-28 text-[10px] font-mono truncate flex items-center gap-1.5" style={{ color: 'var(--ds-text-mid)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tr.color, boxShadow: `0 0 5px ${dsAlpha(tr.color, 0.7)}` }} />
                {tr.name}
              </span>
              <div
                className="relative flex-1 h-7 rounded-ds-xs"
                style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}
              >
                <div className="absolute inset-y-1.5 left-2 right-2 top-1/2 -translate-y-1/2 h-px" style={{ background: 'rgba(255, 252, 242, 0.08)' }} />
                {tr.keys.map((k, i) => (
                  <span
                    key={i}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 rounded-[2px]"
                    style={{
                      left: `${6 + k * 88}%`,
                      background: `radial-gradient(circle at 30% 26%, ${dsAlpha(DS.textHi, 0.5)} 0%, ${dsAlpha(tr.color, 0.92)} 45%, ${dsAlpha(tr.color, 0.7)} 100%)`,
                      border: `1px solid ${dsAlpha(DS.textHi, 0.3)}`,
                      boxShadow: `0 1px 2px rgba(0, 0, 0, 0.55), 0 0 6px ${dsAlpha(tr.color, 0.35)}`,
                    }}
                  />
                ))}
                <span
                  className="absolute top-0 bottom-0 w-px"
                  style={{ left: `${6 + playhead * 88}%`, background: dsAlpha(DS.brass300, 0.6), boxShadow: `0 0 4px ${dsAlpha(DS_ACCENT, 0.4)}` }}
                />
              </div>
              <button
                type="button"
                className="w-6 h-6 rounded-ds-xs ds-press hover:brightness-[1.2] transition-all flex items-center justify-center"
                style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
              >
                <Icon name="plus" size={9} color={DS.textMid} />
              </button>
            </div>
          ))}
          <div className="text-[8px] font-mono pl-[122px]" style={{ color: 'var(--ds-text-low)' }}>
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
      <div className="absolute top-16 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full pointer-events-none" style={SMOKED_PILL}>
        <span className="text-[10px] font-mono" style={{ color: 'var(--ds-text)' }}>Drag a box to select · release to confirm</span>
      </div>
      {rect && (
        <div
          className="absolute rounded-md pointer-events-none"
          style={{
            left: rect.left, top: rect.top, width: rect.width, height: rect.height,
            background: dsAlpha(DS_ACCENT, 0.1),
            border: `1px solid ${dsAlpha(DS_ACCENT, 0.85)}`,
            boxShadow: `0 0 0 1px ${dsAlpha(DS_ACCENT, 0.35)}, 0 0 24px ${dsAlpha(DS_ACCENT, 0.22)}`,
          }}
        />
      )}
    </div>
  );
}
