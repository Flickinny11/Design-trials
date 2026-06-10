'use client';

// TextFillPreviewStrip — Logan directive 2026-06-10 (LOGAN-INBOX):
// the AI texture-fill picker renders each candidate as the USER'S ACTUAL
// SELECTED TEXT with that texture poured into the real letterforms — not a
// generic texture thumbnail — and it renders in real 3D (these are the same
// MSDF TextObjects the scene mounts, gently swaying in perspective so depth
// reads). One shared WebGPU canvas for all candidates (catalog shared-rig
// precedent — never one renderer per tile); transparent overlay buttons keep
// the `ai-fill-swatch` hit/test surface.
//
// The preview spec is the node's CURRENT effective textSpec (font, weight,
// spacing, outline, glow, opacity…) with ONLY the fill swapped per candidate,
// so every row previews exactly what clicking it will produce.

import { useEffect, useMemo, useRef } from 'react';
import { PerspectiveCamera, Scene, TextureLoader, type Texture } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import type { TextSpec } from '@/lib/prism-graph/types';
import type { TextFillSuggestion } from '@/lib/prism/text/contract';
import type { LoadedFontAtlas, TextObjectHandle } from '@/lib/prism/text/contract';
import { createTextObject } from '@/lib/prism/text/text-object';
import { getFontRegistry } from '@/lib/prism/text/font-registry';

const ROW_H = 42; // CSS px per candidate row
const CAM_Z = 3.0;
const SWAY = 0.16; // radians of idle yaw sway (proves 3D)

// Component-local pigment loader (data-URL procedural tiles).
const texCache = new Map<string, Promise<Texture>>();
function loadFillTexture(url: string): Promise<Texture> {
  const hit = texCache.get(url);
  if (hit) return hit;
  const p = new Promise<Texture>((resolve, reject) => {
    new TextureLoader().load(url, resolve, undefined, (e) =>
      reject(e instanceof Error ? e : new Error(String(e))),
    );
  });
  texCache.set(url, p);
  p.catch(() => texCache.delete(url));
  return p;
}

export default function TextFillPreviewStrip({
  spec,
  candidates,
  activeUrl,
  onPick,
}: {
  /** The node's effective textSpec (fill is replaced per candidate). */
  spec: TextSpec;
  candidates: TextFillSuggestion[];
  activeUrl?: string;
  onPick: (s: TextFillSuggestion) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef(false);

  // Key the rebuild on everything that changes the rendered previews.
  const specKey = useMemo(
    () => JSON.stringify({ ...spec, fill: undefined }),
    [spec],
  );
  const urlsKey = useMemo(() => candidates.map((c) => c.url).join('|'), [candidates]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candidates.length === 0) return;
    let disposed = false;
    let raf = 0;
    const handles: TextObjectHandle[] = [];
    const scene = new Scene();
    const rows = candidates.length;

    const cssW = canvas.clientWidth || 240;
    const cssH = rows * ROW_H;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssW, cssH, false);

    // Camera frames a vertical stack of rows; world rowH = 1.
    const aspect = cssW / cssH;
    const worldH = rows; // 1 world unit per row
    const fov = 30;
    const camera = new PerspectiveCamera(fov, aspect, 0.1, 50);
    // Distance so the stack height fits the frustum.
    const dist = worldH / 2 / Math.tan((fov * Math.PI) / 360);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    const worldW = worldH * aspect;

    let frame = () => {};

    (async () => {
      await renderer.init();
      if (disposed) return;
      const family = spec.fontFamily ?? 'Inter';
      const weight = spec.fontWeight ?? 400;
      const reg = getFontRegistry();
      let atlas: LoadedFontAtlas;
      try {
        atlas = reg.peekAtlas(family, weight) ?? (await reg.resolveAtlas(family, weight));
      } catch {
        return; // offline — strip stays blank; CSS fallback row titles remain
      }
      if (disposed) return;

      candidates.forEach((c, i) => {
        const handle = createTextObject(
          {
            ...spec,
            fill: { kind: 'texture', url: c.url },
            // Per-glyph so the sway can ripple subtly later if wanted.
            decompose: spec.decompose ?? 'glyph',
          },
          atlas,
          { lit: false, resolveFillTexture: loadFillTexture },
        );
        const m = handle.measure();
        // Fit within 92% of row width / 70% of row height, centered on row i.
        const s = Math.min((worldW * 0.92) / Math.max(m.width, 1e-3), 0.7 / Math.max(m.height, 1e-3));
        handle.object.scale.setScalar(s);
        handle.object.position.set(0, worldH / 2 - 0.5 - i, 0);
        scene.add(handle.object);
        handles.push(handle);
      });

      scene.background = null;

      const t0 = performance.now();
      frame = () => {
        if (disposed) return;
        const t = (performance.now() - t0) / 1000;
        for (let i = 0; i < handles.length; i++) {
          // Gentle alternating yaw sway — visibly 3D, never illegible.
          handles[i].object.rotation.y = Math.sin(t * 0.9 + i * 0.7) * SWAY;
          handles[i].object.rotation.x = Math.sin(t * 0.6 + i) * SWAY * 0.25;
        }
        void renderer.render(scene, camera);
        // Animate continuously while hovered; otherwise settle after 2s of
        // intro motion and re-render only on texture arrivals.
        if (hoverRef.current || t < 2) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      // Re-render when async pigment textures land (texture rebuilds swap
      // unit materials in place; one extra frame shows them).
      const settle = setInterval(() => {
        if (disposed) return;
        if (!hoverRef.current) void renderer.render(scene, camera);
      }, 500);
      const stopSettle = setTimeout(() => clearInterval(settle), 6000);
      const cleanupTimers = () => { clearInterval(settle); clearTimeout(stopSettle); };
      (renderer as unknown as { __cleanupTimers?: () => void }).__cleanupTimers = cleanupTimers;
    })();

    const onEnter = () => {
      hoverRef.current = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };
    const onLeave = () => { hoverRef.current = false; };
    canvas.addEventListener('pointerenter', onEnter);
    canvas.addEventListener('pointerleave', onLeave);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerenter', onEnter);
      canvas.removeEventListener('pointerleave', onLeave);
      (renderer as unknown as { __cleanupTimers?: () => void }).__cleanupTimers?.();
      for (const h of handles) h.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on serialized inputs
  }, [specKey, urlsKey]);

  return (
    <div className="relative w-full" style={{ height: candidates.length * ROW_H }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full rounded-ds-xs"
        style={{ display: 'block' }}
      />
      {/* Hit overlay — one transparent button per candidate row. Keeps the
          ai-fill-swatch test/a11y surface from the thumbnail era. */}
      <div className="absolute inset-0 flex flex-col">
        {candidates.map((c) => {
          const isActive = activeUrl === c.url;
          return (
            <button
              key={c.label}
              type="button"
              data-testid="ai-fill-swatch"
              title={`${c.label} (local procedural)`}
              aria-label={`Apply fill: ${c.label}`}
              onClick={() => onPick(c)}
              className="flex-1 w-full ds-press transition-all rounded-ds-xs"
              style={{
                background: 'transparent',
                boxShadow: isActive
                  ? 'inset 0 0 0 1.5px rgba(var(--ds-brass-300-rgb, 205,159,85), 0.85)'
                  : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
