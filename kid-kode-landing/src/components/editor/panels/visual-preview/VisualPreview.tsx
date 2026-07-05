'use client';

// T07 — VisualPreview: live R3F sub-canvas for the editor's Visual tab.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L477 — "Visual tab —
// replaces static image preview with a live R3F sub-canvas that mounts the
// actual node code with sliders bound to visualSpec fields. Real-time
// slider feedback driven by `createNode` re-execution on debounced slider
// input."
//
// §3 L65: editor uses `@react-three/fiber` v9 + the async `gl` factory
// pattern for WebGPU init, with WebGL2 as the documented fallback.
//
// The pure-logic surface (slider definitions) lives in:
//   - `@/lib/prism-graph/visual-spec-sliders`  (buildVisualSpecSliders)
// This component composes them with R3F + a synchronous createNode mount
// path. Slider changes update local state synchronously; the Three.js scene
// re-applies position/scale/alpha via refs (no full createNode re-execution
// on every slider tick) so feedback stays under the §17 L538 100ms budget.
// `createNode` is re-invoked when the underlying node identity changes
// (selection switch) — never per-slider tick.
//
// EDITOR-EXP NE-SC-14 / FP-NE-5 (retired 2nd save/build path): VisualPreview
// used to own its OWN edit/save/build path — a "Save & Verify" button that
// POSTed the slider-edited node to `./regen-api` (a SECOND, independent
// save/build path alongside the canonical overlay → Save → Build). That path
// is RETIRED. VisualPreview is now DISPLAY-ONLY: a live R3F sub-canvas that
// mounts the node's ACTUAL artifact, with the sliders scrubbing a local,
// non-persisting preview of transform/alpha. All real editing routes through
// the single canonical path — the Visual-tab color pickers + Material editor
// stage on usePreviewStateStore (overlay), the canvas gizmo owns transform,
// "Save" = commitPreviewToSource, "Build" = rebuildNode. `regen-api.ts` no
// longer has a live caller from here.

import { Canvas, type RootState, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Box3, Group, MathUtils, Object3D, Vector3, type PerspectiveCamera } from 'three';
import type { PrismNode } from '@/lib/prism-graph/types';
import {
  buildVisualSpecSliders,
  type VisualSpecSlider,
} from '@/lib/prism-graph/visual-spec-sliders';
import {
  type CreateNodeFn,
  type NodeContext,
} from '@/lib/prism/runtime/shared/adapter';
import { getSharedNodeContext } from '@/lib/prism/runtime/shared-context';
import { defaultRenderModeFactory } from '@/lib/prism/runtime/factories/default-factory';
import { buildPerNodeFactory } from '@/lib/prism/runtime/factories/coderef-factory';
import { DS } from '@/components/editor/design-system';

// Default createNode pipeline — the SAME factory chain the editor's
// ArtifactNode uses (per-node codeRef dispatch over defaultRenderModeFactory)
// so the Visual tab previews the node's ACTUAL artifact instead of the old
// empty-Group stand-in (which rendered the LIVE PREVIEW well solid black —
// FP-R3 territory). runPrimitives:false keeps the authoring preview static
// (slider edits drive transforms directly, per the header note above);
// nodeMaterials:false keeps default image planes on the legacy plain
// materials, matching the editor surface. Built lazily and cached at module
// level — the chain is stateless per node, and each mount produces a fresh
// Object3D, so nothing is ever stolen from the main scene's artifact cache.
let cachedPreviewFactory: CreateNodeFn | null = null;
function getPreviewFactory(): CreateNodeFn {
  if (!cachedPreviewFactory) {
    cachedPreviewFactory = buildPerNodeFactory((node, ctx) =>
      defaultRenderModeFactory(node, ctx, { runPrimitives: false, nodeMaterials: false }),
    );
  }
  return cachedPreviewFactory;
}

export interface VisualPreviewProps {
  node: PrismNode;
  /** Optional override of the createNode factory — defaults to the real
   *  editor artifact pipeline (per-node codeRef dispatch over
   *  defaultRenderModeFactory; see getPreviewFactory above). */
  createNode?: CreateNodeFn;
  /** Optional context override for tests. Production builds compose this
   *  via the runtime mount.ts. */
  ctx?: NodeContext;
  /** Disables the preview-scrub sliders (used when the node is frozen by the
   *  editor). NE-SC-14: there is no longer a Save/build path here, so this
   *  only gates the local preview scrub. */
  frozen?: boolean;
}

interface MountedNode {
  group: Group;
  object: Object3D;
  cleanup: () => void;
}

// Async `gl` factory: WebGPU when available, falls through to R3F's
// default WebGLRenderer otherwise. Spec §3 L65.
async function asyncGlFactory(props: Record<string, unknown>): Promise<unknown> {
  type WebGPUMod = { default?: unknown; WebGPURenderer?: unknown };
  type RendererCtor = new (p: Record<string, unknown>) => {
    init: () => Promise<unknown>;
    forceWebGL?: boolean;
  };
  try {
    const mod = (await import('three/webgpu')) as WebGPUMod;
    const Ctor = (mod.WebGPURenderer ?? mod.default) as RendererCtor | undefined;
    if (!Ctor) throw new Error('WebGPURenderer export missing');
    const r = new Ctor(props);
    await r.init();
    return r;
  } catch {
    // Returning null lets R3F build its own WebGLRenderer (WebGL2 fallback).
    return null;
  }
}

interface SceneContentProps {
  node: PrismNode;
  values: Record<string, number>;
  createNode: CreateNodeFn;
  ctx: NodeContext;
  onMount?: (info: { renderer: 'webgpu' | 'webgl2' }) => void;
}

function SceneContent({ node, values, createNode, ctx, onMount }: SceneContentProps) {
  const containerRef = useRef<Group>(null);
  const mountedRef = useRef<MountedNode | null>(null);

  // Mount / re-mount when node identity changes. Slider edits do NOT
  // re-invoke createNode (per spec §13 L477 the *editor* drives slider
  // changes via in-place transform updates; codegen re-runs on Save &
  // Verify). This keeps feedback well inside the 100ms budget.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (mountedRef.current) {
      mountedRef.current.cleanup();
      mountedRef.current = null;
    }
    const obj = createNode(node, ctx);
    container.add(obj);
    mountedRef.current = {
      group: container,
      object: obj,
      cleanup: () => {
        const fn = obj.userData?.cleanup;
        if (typeof fn === 'function') {
          try { fn(); } catch { /* ignore */ }
        }
        if (obj.parent) obj.parent.remove(obj);
      },
    };
    return () => {
      mountedRef.current?.cleanup();
      mountedRef.current = null;
    };
  }, [node, createNode, ctx]);

  // Apply slider values to the mounted object's transform / material on every
  // render. R3F flushes refs synchronously after parent state changes — so
  // a slider input → setState → render → ref-update → next paint round-trip
  // is bounded by browser rAF (~16ms on a 60Hz display).
  useEffect(() => {
    const obj = mountedRef.current?.object;
    if (!obj) return;
    const px = values['pos.x'];
    const py = values['pos.y'];
    const pz = values['pos.z'];
    const ry = values['rot.y'];
    const su = values['scale.uniform'];
    if (typeof px === 'number') obj.position.x = px;
    if (typeof py === 'number') obj.position.y = py;
    if (typeof pz === 'number') obj.position.z = pz;
    if (typeof ry === 'number') obj.rotation.y = ry;
    if (typeof su === 'number') obj.scale.set(su, su, su);
  }, [values]);

  return (
    <>
      {/* Light rig — small ambient + key + soft opposing fill so lit
          artifacts (mesh nodes, receivesLighting planes) read in the well
          and keep a visible backside under the rot.y slider. UNLIT image
          planes (the §10 default) ignore all three by design. */}
      <ambientLight intensity={0.6} />
      <directionalLight intensity={0.9} position={[3, 5, 4]} />
      <directionalLight intensity={0.25} position={[-4, -2, -3]} />
      <group ref={containerRef} />
      <FrameRig subjectRef={containerRef} nodeKey={node.nodeId} />
      <RendererProbe onProbe={(kind) => onMount?.({ renderer: kind })} />
    </>
  );
}

// Fits the camera to the mounted artifact's bounding box (frontal, +z) with a
// small margin — without this the fixed [0,0,4] camera missed artifacts whose
// scenePosition sits off-origin or whose plane exceeds the frustum (the black
// LIVE PREVIEW well). Re-fits while async loads (textures, MSDF atlas) are
// still changing the box; once the box holds still for SETTLE_FRAMES frames
// the rig locks so slider-driven transforms visibly move the artifact instead
// of the camera chasing it. Re-arms when the node selection changes.
const FIT_MARGIN = 1.35;
const SETTLE_FRAMES = 45; // ~0.75s at 60Hz — covers texture/atlas resolution.

function FrameRig({ subjectRef, nodeKey }: { subjectRef: RefObject<Group | null>; nodeKey: string }) {
  const camera = useThree((s) => s.camera);
  const settleRef = useRef(0);
  const lastSizeRef = useRef(new Vector3(-1, -1, -1));

  // Re-arm the settle window on selection switch (the mount effect above
  // swaps the artifact under the same container group).
  useEffect(() => {
    settleRef.current = 0;
    lastSizeRef.current.set(-1, -1, -1);
  }, [nodeKey]);

  useFrame(() => {
    if (settleRef.current >= SETTLE_FRAMES) return;
    const subject = subjectRef.current;
    const persp = camera as PerspectiveCamera;
    if (!subject || !persp.isPerspectiveCamera) return;
    const box = new Box3().setFromObject(subject);
    if (box.isEmpty()) return;
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    if (size.distanceToSquared(lastSizeRef.current) < 1e-8) {
      settleRef.current += 1;
    } else {
      settleRef.current = 0;
      lastSizeRef.current.copy(size);
    }
    const halfV = MathUtils.degToRad(persp.fov) / 2;
    const halfH = Math.atan(Math.tan(halfV) * persp.aspect);
    const dist =
      Math.max(size.y / 2 / Math.tan(halfV), size.x / 2 / Math.tan(halfH)) * FIT_MARGIN +
      size.z / 2;
    persp.position.set(center.x, center.y, center.z + Math.max(dist, persp.near * 4));
    persp.lookAt(center);
  });
  return null;
}

// R3F-internal child that reads the active renderer via `useThree` (the
// canonical way to inspect renderer state). Side effect lives in
// `useEffect` so render stays pure.
function RendererProbe({ onProbe }: { onProbe: (kind: 'webgpu' | 'webgl2') => void }) {
  const gl = useThree((s) => s.gl as { isWebGPURenderer?: boolean; constructor?: { name?: string } });
  const reportedRef = useRef(false);
  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    const isWebGPU = !!gl?.isWebGPURenderer || gl?.constructor?.name === 'WebGPURenderer';
    onProbe(isWebGPU ? 'webgpu' : 'webgl2');
  }, [gl, onProbe]);
  return null;
}

export default function VisualPreview({
  node,
  createNode,
  ctx,
  frozen,
}: VisualPreviewProps) {
  const sliders = useMemo<VisualSpecSlider[]>(() => buildVisualSpecSliders(node), [node]);
  const [values, setValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    for (const s of sliders) v[s.key] = s.value;
    return v;
  });

  // Re-seed values when the node identity changes (different selection).
  useEffect(() => {
    const v: Record<string, number> = {};
    for (const s of sliders) v[s.key] = s.value;
    setValues(v);
  }, [sliders]);

  const [renderer, setRenderer] = useState<'webgpu' | 'webgl2' | 'pending'>('pending');

  const factory = createNode ?? getPreviewFactory();
  const fallbackCtx = useMemo(
    () => getSharedNodeContext({ runPrimitives: false }),
    [],
  );
  const previewCtx = ctx ?? fallbackCtx;

  const onSliderInput = (key: string, value: number) => {
    if (frozen) return;
    setValues((v) => ({ ...v, [key]: value }));
  };

  // NE-SC-14: the regen-api "Save & Verify" handler is RETIRED. The sliders
  // now scrub a local, non-persisting preview only; real edits route through
  // the canonical overlay → Save (commitPreviewToSource) → Build (rebuildNode)
  // path owned by the Inspector header / canvas object flyout.

  const grouped: Record<VisualSpecSlider['group'], VisualSpecSlider[]> = {
    transform: [],
    visual: [],
    'render-mode': [],
  };
  for (const s of sliders) grouped[s.group].push(s);

  return (
    <div className="visual-preview" data-render-mode={node.renderMode ?? 'sprite'}>
      {/* Subtle observatory-void backdrop (charcoal→void vignette, matching
          the Animation tab's preview well) instead of a flat near-black. */}
      <div className="visual-preview-canvas-wrap" style={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 12, overflow: 'hidden', background: `radial-gradient(ellipse at center, ${DS.charcoal}, ${DS.void})` }}>
        <Canvas
          gl={asyncGlFactory as unknown as never}
          camera={{ position: [0, 0, 4], fov: 45, near: 0.1, far: 100 }}
          onCreated={(state: RootState) => {
            const gl = state.gl as { isWebGPURenderer?: boolean; constructor?: { name?: string } };
            const isWebGPU = !!gl?.isWebGPURenderer || gl?.constructor?.name === 'WebGPURenderer';
            setRenderer(isWebGPU ? 'webgpu' : 'webgl2');
          }}
        >
          <Suspense fallback={null}>
            <SceneContent
              node={node}
              values={values}
              createNode={factory}
              ctx={previewCtx}
              onMount={(info) => setRenderer(info.renderer)}
            />
          </Suspense>
        </Canvas>
        <div
          data-role="renderer-tag"
          style={{ position: 'absolute', bottom: 8, right: 8, fontFamily: 'ui-monospace, monospace', fontSize: 10, padding: '3px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.6)', color: DS.ice300 }}
        >
          {renderer}
        </div>
      </div>

      {(['transform', 'visual', 'render-mode'] as const).map((g) => {
        const list = grouped[g];
        if (list.length === 0) return null;
        return (
          <fieldset key={g} data-slider-group={g} style={{ border: 0, padding: 0, margin: '12px 0 0' }}>
            <legend style={{ fontSize: 9, letterSpacing: 1.4, color: DS.textMid, textTransform: 'uppercase', padding: 0 }}>{g}</legend>
            {list.map((s) => (
              <div
                key={s.key}
                data-slider-row
                data-slider-key={s.key}
                // Mobile MUST-FIX (advocate 2026-06-11): the range input's
                // intrinsic min-width (~129px) kept the 1fr track from
                // shrinking on narrow cards, pushing the value column past the
                // card edge ("0." instead of "0.18"). minWidth:0 everywhere +
                // a shrinkable label column lets the row fit any card width
                // with the value always fully rendered.
                style={{ display: 'grid', gridTemplateColumns: 'minmax(64px, 110px) minmax(0, 1fr) 44px', alignItems: 'center', gap: 8, marginTop: 6 }}
              >
                <label style={{ fontSize: 11, color: DS.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</label>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={values[s.key] ?? s.value}
                  data-role="visual-spec-slider"
                  data-slider-key={s.key}
                  disabled={frozen}
                  style={{ minWidth: 0, width: '100%' }}
                  onChange={(e) => onSliderInput(s.key, Number(e.currentTarget.value))}
                />
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: DS.metal300, textAlign: 'right' }}>
                  {(values[s.key] ?? s.value).toFixed(2)}
                </span>
              </div>
            ))}
          </fieldset>
        );
      })}

      {/* NE-SC-14: the regen-api "Save & Verify" button is RETIRED — this was
          a second, independent save/build path. Editing is unified on the
          single overlay → Save → Build path (Inspector header / canvas object
          flyout). The sliders above scrub a local live preview only. */}
      <div data-role="visual-preview-note" style={{ fontSize: 10, color: DS.textLow, marginTop: 14, lineHeight: 1.5 }}>
        Sliders scrub a live preview. Use the canvas gizmo and the color &amp;
        material editors to make changes, then Save to keep them.
      </div>
    </div>
  );
}
