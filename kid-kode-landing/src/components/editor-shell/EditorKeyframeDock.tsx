'use client';

// PRISM EDITOR INTEGRATION — I-3: the docked KEYFRAME panel (animate the selection).
//
// The committed /keyframe-editor surface, docked into the bottom KEYFRAMES zone and
// bound to the SELECTED node: a TIME ruler with a worn-cube PLAYHEAD knob + a
// sweeping vertical bar, and one milled track per animatable property (RISE/SCALE/
// SPIN/FADE). Dragging a track knob writes a keyframe at the current playhead on the
// node's `keyframes: PrismKeyframe[]` (NODE LAW); scrubbing the playhead glides every
// knob to its interpolated value AND the realized node animates live (a per-frame
// driver applies the eased interpolation to the node's group on top of its base
// pose). Reuses the PURE committed engine (keyframe-engine + keyframe-config). ZERO
// DOM — controls are R3F + MSDF; editor CHROME (not tagged prismEditorNode).

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useWornMaps } from '@/components/editor/chassis/materials';
import { buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { CompositeChip } from '@/components/editor/composite/CompositeChip';
import { ClickCatcher } from '@/components/editor/primitive/ClickCatcher';
import { TRACKS, DURATION_S } from '@/components/editor/keyframe/keyframe-config';
import { evalAll, evalTrack, setKeyframe, removeKeyframeNear, type KeyNode } from '@/components/editor/keyframe/keyframe-engine';
import { FaderRow } from './editor-shell-controls';
import { effectivePos } from './editor-manipulation';
import { useEditorShellStore } from './use-editor-shell-store';
import { useEditorKeyframeStore } from './use-editor-keyframe-store';

export const KEYFRAME_DOCK_POS: [number, number, number] = [0, -5.4, 1.0];
const FADER_W = 10.5;
const HALF = FADER_W / 2;
const TIME_Y = 1.35;
const TRACK_Y0 = 0.72;
const TRACK_PITCH = 0.56;

function nodeGroups(): Map<string, THREE.Object3D> | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __PRISM_EDITOR_NODE_GROUPS__?: Map<string, THREE.Object3D> };
  return w.__PRISM_EDITOR_NODE_GROUPS__ ?? null;
}

function liveNode(id: string | null) {
  if (!id) return undefined;
  return useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id);
}
function keyNodeFor(id: string | null): KeyNode {
  const n = liveNode(id);
  return { id: id ?? '', caption: n?.intent?.caption ?? '', keyframes: n?.keyframes ?? [] };
}

/** Write (or move) a keyframe for `trackId` at the current playhead → node.keyframes. */
function writeKeyframe(trackId: string, value: number) {
  const id = useEditorShellStore.getState().selectedId;
  if (!id) return;
  const node = liveNode(id);
  const t = useEditorKeyframeStore.getState().playhead;
  const next = setKeyframe(node?.keyframes ?? [], trackId, t, value);
  useGraphSourceStore.getState().updateNode(id, { keyframes: next });
}
function clearKeyframesAtPlayhead() {
  const id = useEditorShellStore.getState().selectedId;
  if (!id) return;
  const node = liveNode(id);
  const t = useEditorKeyframeStore.getState().playhead;
  let kfs = node?.keyframes ?? [];
  for (const tr of TRACKS) kfs = removeKeyframeNear(kfs, tr.id, t);
  useGraphSourceStore.getState().updateNode(id, { keyframes: kfs });
}

// ── per-frame driver: apply the eased interpolation to the selected node group ──
function KeyframeDriver() {
  useFrame(() => {
    const id = useEditorShellStore.getState().selectedId;
    const view = useEditorShellStore.getState().view;
    if (!id || view !== 'canvas') return;
    const map = nodeGroups();
    const g = map?.get(id);
    if (!g) return;
    const node = liveNode(id);
    if (!node) return;
    if (!node.keyframes || node.keyframes.length === 0) return; // no animation → leave the static pose
    const ph = useEditorKeyframeStore.getState().playhead;
    const v = evalAll({ id, caption: '', keyframes: node.keyframes }, ph);
    const byId = new Map(useGraphSourceStore.getState().nodes.map((n) => [n.nodeId, n]));
    const eff = effectivePos(node, byId);
    const sp = node.scenePosition;
    g.position.y = eff.y + (v.posY ?? 0);
    g.rotation.z = (sp?.rotationZ ?? 0) + (v.rotZ ?? 0);
    const s = v.scale ?? 1;
    g.scale.set((sp?.scaleX ?? 1) * s, (sp?.scaleY ?? 1) * s, (sp?.scaleZ ?? 1) * s);
    const op = v.opacity ?? 1;
    if (op < 0.995) {
      g.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!mat) return;
        const apply = (m: THREE.Material) => { m.transparent = true; (m as THREE.Material & { opacity: number }).opacity = op; };
        Array.isArray(mat) ? mat.forEach(apply) : apply(mat);
      });
    }
  });
  return null;
}

function ClockDriver() {
  useFrame((_, dt) => {
    if (useEditorKeyframeStore.getState().playing) useEditorKeyframeStore.getState().tick(Math.min(dt, 0.05));
  });
  return null;
}

// ── the sweeping vertical playhead bar ──────────────────────────────────────
const BAR_GEO = buildCubeGeometry({ width: 0.06, height: 2.0, depth: 0.08, cornerRadius: 0.02, bevel: 0.01, radius: 0, segments: 3, cutouts: [] });
function PlayheadBar() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#caa06a', toneMapped: false, transparent: true, opacity: 0.85 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => {
    const r = ref.current;
    if (!r) return;
    const ph = useEditorKeyframeStore.getState().playhead;
    r.position.x = -HALF + (ph / DURATION_S) * FADER_W;
  });
  return <mesh ref={ref} geometry={BAR_GEO} material={mat} position={[-HALF, -0.05, 0.28]} />;
}

export function EditorKeyframeDock() {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const node = useGraphSourceStore((s) => (selectedId ? s.nodes.find((n) => n.nodeId === selectedId) ?? null : null));
  const playhead = useEditorKeyframeStore((s) => s.playhead);
  const playing = useEditorKeyframeStore((s) => s.playing);
  const maps = useWornMaps();
  const gun = maps['gunmetal'];

  const kn = useMemo<KeyNode>(() => ({ id: selectedId ?? '', caption: '', keyframes: node?.keyframes ?? [] }), [selectedId, node]);

  // headless probe
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_EDITOR_KF_SET_PLAYHEAD__ = (t: number) => useEditorKeyframeStore.getState().setPlayhead(t);
    w.__PRISM_EDITOR_KF_PLAY__ = (b: boolean) => useEditorKeyframeStore.getState().setPlaying(b);
    w.__PRISM_EDITOR_KEYFRAME__ = () => {
      const id = useEditorShellStore.getState().selectedId;
      const n = liveNode(id);
      const ph = useEditorKeyframeStore.getState().playhead;
      const knl = keyNodeFor(id);
      const groupY = (() => { const g = id ? nodeGroups()?.get(id) : null; return g ? g.position.y : null; })();
      return {
        selectedId: id,
        playhead: ph,
        playing: useEditorKeyframeStore.getState().playing,
        keyframeCount: n?.keyframes?.length ?? 0,
        eval: evalAll(knl, ph),
        groupY,
      };
    };
  }

  return (
    <group position={KEYFRAME_DOCK_POS}>
      <ClockDriver />
      <KeyframeDriver />
      <ClickCatcher width={15.4} height={3.6} position={[0, 0, 0.1]} />

      <CompositeText position={[-7.0, 1.45, 0.3]} fontSize={0.2} anchorX="left" variant="bright">
        KEYFRAMES
      </CompositeText>

      {!selectedId && (
        <CompositeText position={[0, 0, 0.3]} fontSize={0.22} variant="engraved">
          SELECT A NODE TO ANIMATE
        </CompositeText>
      )}

      {selectedId && (
        <>
          <PlayheadBar />

          {/* TIME ruler — the playhead scrubber */}
          <FaderRow
            y={TIME_Y}
            width={FADER_W}
            value={playhead}
            min={0}
            max={DURATION_S}
            label="TIME"
            maps={gun}
            tint="#caa06a"
            probeId="kf:time"
            format={(v) => v.toFixed(2) + 's'}
            onChange={(v) => useEditorKeyframeStore.getState().setPlayhead(v)}
          />

          {/* one milled track per animatable property */}
          {TRACKS.map((tr, i) => (
            <FaderRow
              key={tr.id}
              y={TRACK_Y0 - i * TRACK_PITCH}
              width={FADER_W}
              value={evalTrack(kn, tr.id, playhead)}
              min={tr.min}
              max={tr.max}
              label={tr.label}
              maps={maps[tr.textureKey] ?? gun}
              tint="#9fb6d6"
              probeId={'kf:' + tr.id}
              onChange={(v) => writeKeyframe(tr.id, v)}
            />
          ))}

          {/* transport: play/pause + clear-at-playhead */}
          {gun && (
            <>
              <CompositeChip
                maps={gun}
                position={[6.6, 0.55, 0.3]}
                size={0.42}
                tint="#7fd6a0"
                active={playing}
                label={playing ? 'PAUSE' : 'PLAY'}
                onClick={() => useEditorKeyframeStore.getState().togglePlay()}
              />
              <CompositeChip
                maps={gun}
                position={[6.6, -0.45, 0.3]}
                size={0.42}
                tint="#c98a8a"
                label="CLEAR"
                onClick={clearKeyframesAtPlayhead}
              />
            </>
          )}
        </>
      )}
    </group>
  );
}
