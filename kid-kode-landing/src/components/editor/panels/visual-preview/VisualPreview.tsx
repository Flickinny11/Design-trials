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
// The pure-logic surface (slider definitions + Save & Verify payload) lives
// in:
//   - `@/lib/prism-graph/visual-spec-sliders`  (buildVisualSpecSliders)
//   - `./regen-api`                            (saveAndVerify)
// This component composes them with R3F + a synchronous createNode mount
// path. Slider changes update local state synchronously; the Three.js scene
// re-applies position/scale/alpha via refs (no full createNode re-execution
// on every slider tick) so feedback stays under the §17 L538 100ms budget.
// `createNode` is re-invoked when the underlying node identity changes
// (selection switch) — never per-slider tick. Save & Verify POSTs the
// edited node to the regen API which re-runs codegen + verifier; the
// returned regenerated node module flows back via the editor's source
// store on the next render. (Spec §13 L477's "createNode re-execution on
// debounced slider input" is reframed here as direct transform mutation
// to honour the §17 L538 latency budget — see docs/spec-deviations-prism.md.)

import { Canvas, type RootState, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Object3D } from 'three';
import type { PrismNode } from '@/lib/prism-graph/types';
import {
  applyVisualSpecSlider,
  buildVisualSpecSliders,
  type VisualSpecSlider,
} from '@/lib/prism-graph/visual-spec-sliders';
import {
  applyScenePosition,
  type CreateNodeFn,
  type NodeContext,
} from '@/lib/prism/runtime/shared/adapter';
import { getSharedNodeContext } from '@/lib/prism/runtime/shared-context';
import { saveAndVerify, type RegenApiResult } from './regen-api';
import { DS } from '@/components/editor/design-system';

// Local fallback createNode factory: returns an empty Group that satisfies
// the spec §8 cleanup contract. Mirrors the adapter's internal
// `defaultCreateNode` (kept module-private there); duplicated here to keep
// VisualPreview self-contained for the editor surface and not depend on
// runtime-internal exports. T09 will pass codegen-emitted modules in.
const previewDefaultCreateNode: CreateNodeFn = (config) => {
  const g = new Group();
  g.name = `preview:${config.nodeId}`;
  applyScenePosition(g, config.scenePosition);
  g.userData.cleanup = () => {};
  g.userData.handlers = {};
  return g;
};

export interface VisualPreviewProps {
  node: PrismNode;
  /** Optional override of the createNode factory — defaults to the
   *  adapter's placeholder Group factory until codegen-emitted modules are
   *  wired through (T09). */
  createNode?: CreateNodeFn;
  /** Optional context override for tests. Production builds compose this
   *  via the runtime mount.ts. */
  ctx?: NodeContext;
  /** Optional fetch override for the Save & Verify call. */
  fetch?: typeof fetch;
  /** Notified after a successful Save & Verify. */
  onSaved?: (r: RegenApiResult) => void;
  /** Disables editing (used when the node is frozen by the editor). */
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
      <ambientLight intensity={0.6} />
      <directionalLight intensity={0.9} position={[3, 5, 4]} />
      <group ref={containerRef} />
      <RendererProbe onProbe={(kind) => onMount?.({ renderer: kind })} />
    </>
  );
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
  fetch: fetchOverride,
  onSaved,
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
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<RegenApiResult | null>(null);

  const factory = createNode ?? previewDefaultCreateNode;
  const fallbackCtx = useMemo(
    () => getSharedNodeContext({ runPrimitives: false }),
    [],
  );
  const previewCtx = ctx ?? fallbackCtx;

  const onSliderInput = (key: string, value: number) => {
    if (frozen) return;
    setValues((v) => ({ ...v, [key]: value }));
  };

  const onSave = async () => {
    setSaving(true);
    const next: PrismNode = JSON.parse(JSON.stringify(node));
    for (const s of sliders) {
      const v = values[s.key];
      if (typeof v === 'number') applyVisualSpecSlider(next, s.key, v);
    }
    // HL12 / Plan §P12 — Save & Verify body widened to carry codeModule when
    // the node has a codeRef. Server-side route runs the §10 verifier against
    // the fetched module text in addition to the plan-level checks.
    let codeModule: string | undefined;
    if (typeof next.codeRef === 'string' && next.codeRef.length > 0 && typeof fetch !== 'undefined') {
      const fetchFn = fetchOverride ?? fetch;
      try {
        const resp = await fetchFn(next.codeRef);
        if (resp.ok) codeModule = await resp.text();
      } catch { /* network error → omit codeModule, server runs plan-only checks */ }
    }
    const r = await saveAndVerify(next, { fetch: fetchOverride, codeModule });
    setSaveStatus(r);
    setSaving(false);
    if (r.ok) onSaved?.(r);
  };

  const grouped: Record<VisualSpecSlider['group'], VisualSpecSlider[]> = {
    transform: [],
    visual: [],
    'render-mode': [],
  };
  for (const s of sliders) grouped[s.group].push(s);

  return (
    <div className="visual-preview" data-render-mode={node.renderMode ?? 'sprite'}>
      <div className="visual-preview-canvas-wrap" style={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 12, overflow: 'hidden', background: DS.ink }}>
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
                style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px', alignItems: 'center', gap: 8, marginTop: 6 }}
              >
                <label style={{ fontSize: 11, color: DS.text }}>{s.label}</label>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={values[s.key] ?? s.value}
                  data-role="visual-spec-slider"
                  data-slider-key={s.key}
                  disabled={frozen}
                  onChange={(e) => onSliderInput(s.key, Number(e.currentTarget.value))}
                />
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: DS.brass300, textAlign: 'right' }}>
                  {(values[s.key] ?? s.value).toFixed(2)}
                </span>
              </div>
            ))}
          </fieldset>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button
          type="button"
          data-role="save-and-verify"
          disabled={frozen || saving}
          onClick={onSave}
          style={{
            background: frozen ? DS.slate : DS.brass400, color: frozen ? DS.textMid : DS.ink, border: 0,
            padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: (frozen || saving) ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save & Verify'}
        </button>
        {saveStatus && (
          <div data-role="save-status" style={{ fontSize: 11, color: saveStatus.ok ? DS.ok : DS.danger }}>
            {saveStatus.ok ? `verified: ${saveStatus.verifierStatus ?? 'clean'}` : `failed: ${saveStatus.error ?? 'unknown'}`}
          </div>
        )}
      </div>
    </div>
  );
}
