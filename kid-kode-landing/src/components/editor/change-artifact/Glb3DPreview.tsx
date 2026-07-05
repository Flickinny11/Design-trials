'use client';

// Glb3DPreview — an INTERACTIVE 3D result viewport for the Change Artifact
// wizard (canvas-spec §12.2 "if 3D, the viewport is interactive"; criterion
// 20). The user can orbit/spin a loaded .glb; it auto-rotates gently until they
// grab it.
//
// This is an ISOLATED PREVIEW WIDGET, not the main scene renderer: it spins up
// its own React-Three-Fiber <Canvas> (default WebGL renderer) that mounts only
// while the wizard is open and tears down cleanly on unmount. It deliberately
// does NOT touch the unified three/webgpu graph scene.
//
// Chrome: Chrome-Arc — recessed WELL frame, engraved SectionLabel
// caption, brass/ice tones, the project <Icon>, a GSAP entrance, and native
// magnetic hover on the caption hint (all honoring prefers-reduced-motion). No
// purple; design-system tokens only; plain-language copy (no machine ids, no
// provider names).

import { Component, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Bounds,
  Center,
  Environment,
  Lightformer,
  OrbitControls,
  useGLTF,
} from '@react-three/drei';
import { gsap } from 'gsap';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { attachMagnetic } from '@/components/editor/animation-tools/magnetic';
import { SectionLabel, WELL_BG, WELL_SHADOW } from '@/components/editor/animation-tools/ui';
import type { Glb3DPreviewProps } from './wizard-types';

// Plain-language copy (constants so apostrophes stay typographic and the
// strings stay greppable — no spec citations, no machine ids, no providers).
const LOADING_COPY = 'Loading the 3D preview…';
const LOAD_FAIL_COPY = "Couldn't load the 3D preview.";
const SPIN_HINT = 'Drag to spin';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Native magnetic hover on a key face (reuses animation-tools/magnetic). */
function useMagnetic<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    return attachMagnetic(el, { maxShift: 3, scale: 1.02 });
  }, []);
  return ref;
}

// ── The loaded model, auto-centered and framed ──────────────────────────────
// useGLTF caches by URL (drei) and suspends while loading; on a load error it
// throws, which the surrounding ModelErrorBoundary catches. <Bounds fit clip
// observe> frames the model to the viewport; <Center> re-origins it so the
// orbit pivot sits at the model's middle regardless of its authored transform.
function Model({ url, onReady }: { url: string; onReady: () => void }) {
  const gltf = useGLTF(url);
  // Fires once the model has resolved (Suspense released) — clears the DOM
  // loading/poster overlay below.
  useEffect(() => {
    onReady();
  }, [onReady]);
  return (
    <Bounds fit clip observe margin={1.15}>
      <Center>
        <primitive object={gltf.scene} />
      </Center>
    </Bounds>
  );
}

// ── Soft neutral studio environment, fully self-contained ────────────────────
// Inline Lightformer "rig" so the env needs no remote HDRI fetch (robust inside
// the isolated widget) — a soft white key plane plus a cool fill, paired with a
// real ambient + key directional so geometry reads with gentle, neutral light.
function PreviewLights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} />
      <directionalLight position={[-5, 2, -3]} intensity={0.35} />
      <Environment resolution={128}>
        {/* Soft neutral studio rig — colors routed through DS tokens (warm-
            white key, cool ice fill + rim). No raw hex, no purple. */}
        <Lightformer
          form="rect"
          intensity={1.6}
          position={[0, 4, 4]}
          scale={[8, 6, 1]}
          color={DS.textHi}
        />
        <Lightformer
          form="rect"
          intensity={0.7}
          position={[-4, 1, -4]}
          scale={[6, 6, 1]}
          color={DS.ice200}
        />
        <Lightformer
          form="ring"
          intensity={0.6}
          position={[3, -2, 3]}
          scale={[4, 4, 1]}
          color={DS.ice300}
        />
      </Environment>
    </>
  );
}

// ── Error boundary — a model that fails to load shows the brass failure copy
//    instead of crashing the modal ──────────────────────────────────────────
class ModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ── DOM-side fallback / failure panels (poster, loading, error) ─────────────
function FallbackPanel({
  poster,
  message,
  tone,
}: {
  poster?: string;
  message: string;
  tone: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-4 text-center">
      {poster ? (
        // Poster preview while the model streams in. Plain <img>, contained so
        // it never overflows the rounded well on narrow hosts.
        <img
          src={poster}
          alt=""
          className="max-w-full max-h-full object-contain rounded-ds-xs"
          style={{ opacity: 0.85 }}
        />
      ) : (
        <Icon name="cube" size={26} color={tone} glow />
      )}
      <span
        className="text-[10px] font-mono leading-relaxed"
        style={{ color: 'var(--ds-text-mid)' }}
      >
        {message}
      </span>
    </div>
  );
}

export default function Glb3DPreview({
  url,
  poster,
  height,
  autoRotate,
  className,
}: Glb3DPreviewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hintRef = useMagnetic<HTMLDivElement>();
  const spin = autoRotate ?? true;
  const viewportHeight = height ?? 300;
  const hasUrl = typeof url === 'string' && url.trim().length > 0;

  // `false` while the model streams in → the DOM loading/poster overlay shows;
  // flips true once <Model> resolves and clears it. Re-armed if the url changes.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
  }, [url]);

  // Open choreography — a soft rise + fade on the whole widget. Transform/
  // opacity only; killed on unmount; skipped under prefers-reduced-motion.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const tween = gsap.fromTo(
      root,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' },
    );
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-component="glb-3d-preview"
      className={`flex flex-col gap-1.5 w-full min-w-0${className ? ` ${className}` : ''}`}
    >
      {/* ── Interactive viewport (recessed brass well) ───────────────────── */}
      <div
        className="relative w-full overflow-hidden rounded-ds-sm"
        style={{
          height: viewportHeight,
          background: WELL_BG,
          boxShadow: WELL_SHADOW,
          border: `1px solid ${dsAlpha(DS.metal400, 0.16)}`,
        }}
      >
        {hasUrl ? (
          <ModelErrorBoundary
            fallback={
              <FallbackPanel poster={poster} message={LOAD_FAIL_COPY} tone={DS.ice300} />
            }
          >
            <Canvas
              // Default WebGL renderer; transparent so the brass modal shows
              // through. Isolated to this widget — not the main scene.
              gl={{ alpha: true, antialias: true }}
              dpr={[1, 2]}
              camera={{ position: [0, 0, 4], fov: 40 }}
              style={{ background: 'transparent' }}
            >
              <PreviewLights />
              <Suspense fallback={null}>
                <Model url={url} onReady={() => setReady(true)} />
              </Suspense>
              <OrbitControls
                makeDefault
                autoRotate={spin}
                autoRotateSpeed={1.5}
                enablePan={false}
                enableDamping
                dampingFactor={0.08}
                minDistance={1.5}
                maxDistance={12}
              />
            </Canvas>
            {/* DOM loading/poster overlay — shown (over the transparent canvas)
                while the model streams in; cleared once <Model> resolves. */}
            {!ready && (
              <div className="absolute inset-0 pointer-events-none">
                <FallbackPanel poster={poster} message={LOADING_COPY} tone={DS.metal300} />
              </div>
            )}
          </ModelErrorBoundary>
        ) : (
          <FallbackPanel poster={poster} message={LOAD_FAIL_COPY} tone={DS.ice300} />
        )}
      </div>

      {/* ── Caption row: engraved label + plain-language spin hint ───────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
        <div className="min-w-0">
          <SectionLabel>3D preview</SectionLabel>
        </div>
        <div
          ref={hintRef}
          className="flex items-center gap-1.5 px-2 py-1 rounded-ds-xs shrink-0"
          style={{
            background: WELL_BG,
            boxShadow: WELL_SHADOW,
            border: `1px solid ${dsAlpha(DS.metal400, 0.14)}`,
          }}
        >
          <Icon name="rotate" size={11} color={DS_ACCENT} glow />
          <span
            className="text-[9px] font-mono tracking-wide whitespace-nowrap"
            style={{ color: 'var(--ds-text-mid)' }}
          >
            {SPIN_HINT}
          </span>
        </div>
      </div>
    </div>
  );
}
