'use client';

// PRISM EDITOR INTEGRATION — I-1: the editor SHELL scene.
//
// One continuous WebGPU scene composing the proven lab pieces into the editor:
//   • the live-app-graph viewport (EditorGraphViewport) — galaxy/canvas/preview;
//   • the docked panel zones (EditorDocks) — glass frames matching the approved
//     /toolbar-chassis + /keyframe-editor look (W2);
//   • the galaxy/canvas/preview tri-state switch (EditorModeSwitch) (W3);
//   • shared studio IBL + an editorial backdrop so the transmission glass reads.
//
// ZERO DOM/CSS — everything visible lives in the canvas (no-dom-ui LAW). Window
// access here is EDITOR CHROME only (the verification probes + camera rig), the
// same exemption /library + /toolbar-chassis use; the pure runtime stays clean.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { StudioEnv } from '@/components/editor/chassis/StudioEnv';
import { buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { EditorGraphViewport, SelectionOverlay } from './EditorGraphViewport';
import { EditorDocks } from './EditorDock';
import { EditorToolbarDock } from './EditorToolbarDock';
import { EditorLibraryDock } from './EditorLibraryDock';
import { EditorInspectorDock } from './EditorInspectorDock';
import { EditorKeyframeDock } from './EditorKeyframeDock';
import { EditorGizmo } from './EditorGizmo';
import { EditorConnectors } from './EditorConnectors';
import { EditorModeSwitch } from './EditorModeSwitch';
import { makeDockGlass, dockPaneParams } from './editor-shell-glass';
import {
  useEditorShellStore,
  allGraphNodes,
  activeHubNodes,
  allHubIds,
  resolveActiveHubId,
  type EditorShellView,
  isDeselectGuarded,
  type EditorBackdrop,
  type EditorLighting,
} from './use-editor-shell-store';

// ── editorial backdrop (DataTexture radial gradient — zero DOM) ─────────────
// A soft steel-blue glow lifting toward the viewport center, falling to deep
// navy at the edges, with a faint warm lobe — content for the transmission glass
// docks to refract (the same editorial-backdrop role the chassis/library use).
// I-2 SCENE-toolbar: the Background button cycles these editorial-backdrop
// palettes, so it is a real, visible operation on the scene.
const BACKDROP_PALETTES: Record<EditorBackdrop, { core: string; edge: string; warm: string }> = {
  studio: { core: '#28405f', edge: '#05080f', warm: '#3a2a17' },
  noir: { core: '#1c2330', edge: '#04060a', warm: '#14202c' },
  warm: { core: '#4a3320', edge: '#0c0805', warm: '#5a3a18' },
};

function makeGradientTexture(variant: EditorBackdrop): THREE.DataTexture {
  const S = 128;
  const data = new Uint8Array(S * S * 4);
  const pal = BACKDROP_PALETTES[variant];
  const core = new THREE.Color(pal.core);
  const edge = new THREE.Color(pal.edge);
  const warm = new THREE.Color(pal.warm);
  const c = new THREE.Color();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nx = (x / (S - 1)) * 2 - 1;
      const ny = (y / (S - 1)) * 2 - 1;
      const r = Math.min(1, Math.hypot(nx * 0.82, ny));
      const t = 1 - r * r; // bright center → dark edge
      c.copy(edge).lerp(core, Math.max(0, t));
      // faint warm lobe low-center (echoes the app's bronze accents)
      const warmAmt = Math.max(0, 1 - Math.hypot(nx * 1.4, (ny + 0.35) * 1.6)) * 0.22;
      c.lerp(warm, warmAmt);
      const i = (y * S + x) * 4;
      data[i] = Math.round(c.r * 255);
      data[i + 1] = Math.round(c.g * 255);
      data[i + 2] = Math.round(c.b * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Backdrop() {
  const variant = useEditorShellStore((s) => s.backdrop);
  const tex = useMemo(() => makeGradientTexture(variant), [variant]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    // clicking empty space (nothing in front stops the ray) deselects.
    <mesh
      position={[0, 0, -7]}
      onClick={(e) => {
        e.stopPropagation();
        if (isDeselectGuarded()) return; // don't drop selection right after a gizmo drag
        useEditorShellStore.getState().select(null);
      }}
    >
      <planeGeometry args={[46, 28]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// ── preview-app placeholder (honest I-1 scope; running app wired in I-4) ─────
const PREVIEW_GEO = buildPaneGeometry(dockPaneParams(7.2, 4.0, { depth: 0.42, cornerRadius: 0.4 }));
function PreviewPlaceholder() {
  const mat = useMemo(() => makeDockGlass('clear'), []);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group>
      <mesh geometry={PREVIEW_GEO} material={mat} />
      <CompositeText position={[0, 0.55, 0.3]} fontSize={0.62} variant="engraved">
        PREVIEW
      </CompositeText>
      <CompositeText position={[0, -0.35, 0.3]} fontSize={0.2} variant="engraved">
        RUNNING APP · WIRED IN I-4
      </CompositeText>
    </group>
  );
}

// ── lights (key + fill over the shared studio IBL) ──────────────────────────
// I-2 SCENE-toolbar: the Lighting button cycles these presets — a real, visible
// relight of the editor scene.
const LIGHTING_PRESETS: Record<
  EditorLighting,
  { ambient: number; key: [number, string]; fill: [number, string]; spot: [number, string] }
> = {
  studio: { ambient: 0.5, key: [1.1, '#eaf2ff'], fill: [0.4, '#9fb6d6'], spot: [0.6, '#ffe9cf'] },
  cool: { ambient: 0.42, key: [1.25, '#cfe0ff'], fill: [0.5, '#8fb0e0'], spot: [0.35, '#cfe0ff'] },
  warm: { ambient: 0.55, key: [1.0, '#ffe6c4'], fill: [0.42, '#d8a86a'], spot: [0.85, '#ffd9a0'] },
};

function Lights() {
  const preset = useEditorShellStore((s) => s.lighting);
  const p = LIGHTING_PRESETS[preset];
  return (
    <>
      <ambientLight intensity={p.ambient} />
      <directionalLight position={[6, 8, 10]} intensity={p.key[0]} color={p.key[1]} />
      <directionalLight position={[-8, -2, 6]} intensity={p.fill[0]} color={p.fill[1]} />
      <spotLight position={[0, 10, 8]} angle={0.7} penumbra={0.8} intensity={p.spot[0]} color={p.spot[1]} />
    </>
  );
}

// ── verification probes (editor chrome — Law 0 authorship + headless drive) ──
function EditorProbe() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_EDITOR_SHELL_SCENE__ = scene;
    w.__PRISM_EDITOR_SHELL_STORE__ = () => {
      const st = useEditorShellStore.getState();
      return {
        view: st.view,
        activeHubId: resolveActiveHubId(),
        selectedId: st.selectedId,
        setView: (v: EditorShellView) => st.setView(v),
        setActiveHub: (id: string | null) => st.setActiveHub(id),
        allNodeIds: allGraphNodes().map((n) => n.nodeId),
        activeHubNodeIds: activeHubNodes().map((n) => n.nodeId),
        hubIds: allHubIds(),
      };
    };
    w.__PRISM_EDITOR_SET_VIEW__ = (v: EditorShellView) => useEditorShellStore.getState().setView(v);
    w.__PRISM_EDITOR_SHELL_BACKEND__ = () => {
      const b = (gl as unknown as { backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean } }).backend;
      return { isWebGPU: !!b?.isWebGPUBackend, isWebGL: !!b?.isWebGLBackend };
    };
    // Law 0 — every render maps to a backing graph node.
    w.__PRISM_EDITOR_AUTHORSHIP__ = () => {
      const rendered: { nodeId: string | null; hubId: string | null; dormant: boolean }[] = [];
      scene.traverse((o) => {
        if (o.userData?.prismEditorNode) {
          rendered.push({
            nodeId: (o.userData.prismNodeId as string) ?? null,
            hubId: (o.userData.prismHubId as string) ?? null,
            dormant: !!o.userData.prismDormant,
          });
        }
      });
      const st = useEditorShellStore.getState();
      const allNodeIds = allGraphNodes().map((n) => n.nodeId);
      const activeHubNodeIds = activeHubNodes().map((n) => n.nodeId);
      const orphans = rendered.filter((r) => !r.nodeId || !allNodeIds.includes(r.nodeId));
      const unrealizedActiveHub =
        st.view === 'canvas'
          ? activeHubNodeIds.filter((id) => !rendered.some((r) => r.nodeId === id && !r.dormant))
          : [];
      const galaxyMissing =
        st.view === 'galaxy'
          ? allNodeIds.filter((id) => !rendered.some((r) => r.nodeId === id && r.dormant))
          : [];
      return {
        view: st.view,
        activeHubId: resolveActiveHubId(),
        renderedCount: rendered.length,
        rendered,
        allNodeIds,
        activeHubNodeIds,
        orphans,
        unrealizedActiveHub,
        galaxyMissing,
        ok: orphans.length === 0 && unrealizedActiveHub.length === 0 && galaxyMissing.length === 0,
      };
    };
    // tri-state switch segment world centers (for a trusted-pointer click).
    w.__PRISM_EDITOR_SWITCH_POS__ = () => {
      const out: { view: string; world: [number, number, number] }[] = [];
      const v = new THREE.Vector3();
      scene.traverse((o) => {
        if (o.userData?.prismEditorSwitch) {
          o.getWorldPosition(v);
          out.push({ view: o.userData.prismEditorSwitch as string, world: [v.x, v.y, v.z] });
        }
      });
      return out;
    };
    w.__PRISM_EDITOR_AUTHORSHIP_SELFTEST__ = () => {
      const ids = allGraphNodes().map((n) => n.nodeId);
      const synthetic = [{ nodeId: ids[0] ?? '__none__' }, { nodeId: '__orphan__' }, { nodeId: null }];
      const caught = synthetic.filter((r) => !r.nodeId || !ids.includes(r.nodeId));
      return { live: caught.length === 2, caughtCount: caught.length };
    };
  }
  return null;
}

function EditorReviewRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const gl = useThree((s) => s.gl);
  if (typeof window !== 'undefined') {
    (window as unknown as { __PRISM_EDITOR_SHELL_CAM__?: unknown }).__PRISM_EDITOR_SHELL_CAM__ = {
      camera,
      controls,
      set(px: number, py: number, pz: number, tx = 0, ty = 0, tz = 0) {
        camera.position.set(px, py, pz);
        const c = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
        if (c?.target) { c.target.set(tx, ty, tz); c.update(); } else camera.lookAt(tx, ty, tz);
      },
      project(x: number, y: number, z: number): [number, number] {
        const v = new THREE.Vector3(x, y, z).project(camera);
        const el = gl.domElement;
        return [(v.x * 0.5 + 0.5) * el.clientWidth, (1 - (v.y * 0.5 + 0.5)) * el.clientHeight];
      },
    };
  }
  return null;
}

export function EditorShellScene() {
  const view = useEditorShellStore((s) => s.view);
  return (
    <>
      <StudioEnv />
      <Lights />
      <Backdrop />
      <EditorGraphViewport />
      <EditorConnectors />
      <SelectionOverlay />
      <EditorGizmo />
      {view === 'preview-app' && <PreviewPlaceholder />}
      <EditorDocks />
      <EditorToolbarDock />
      <EditorLibraryDock />
      <EditorInspectorDock />
      <EditorKeyframeDock />
      <EditorModeSwitch />
      <EditorProbe />
      <EditorReviewRig />
    </>
  );
}
