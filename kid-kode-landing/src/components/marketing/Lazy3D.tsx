'use client';

// PRISM MARKETING — LAZY 3D MOUNT GUARD (SHELL W6, DL8)
//
// DL8: heavy 3D showpieces lazy-load behind meaningful first paint and never
// block LCP. This wrapper renders a static poster immediately (the poster is
// the LCP-eligible element), then mounts the real 3D island only once it
// scrolls near the viewport — and only when the device can take it. It also
// contains any renderer failure (e.g. no WebGL/WebGPU) to the poster via an
// error boundary, so a hero that can't render degrades to a premium still
// instead of a blank box. Reserved dimensions prevent layout shift (CLS).

import { Component, useEffect, useRef, useState, type ReactNode } from 'react';

class RenderBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/** The device capability tier stamped pre-paint by the engine boot script
 *  (data-ds-tier on <html>). T0 = low; keep such devices on the poster for a
 *  `heavy` island. Unknown/absent tier is treated as capable. */
function isLowTier(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.dsTier === 'T0';
}

export default function Lazy3D({
  poster,
  children,
  heavy = false,
  rootMargin = '240px',
  className,
}: {
  /** Static fallback: shown until the island mounts, and permanently on
   *  low-tier devices or render failure. Should carry the visual weight. */
  poster: ReactNode;
  /** The 3D island (already wrapped in next/dynamic ssr:false by the caller). */
  children: ReactNode;
  /** Heavy islands stay on the poster for low-tier (T0) devices. */
  heavy?: boolean;
  rootMargin?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (failed) return;
    if (heavy && isLowTier()) return; // low-GPU → poster only (DL8)
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMount(true);
      return;
    }
    // Sync the live island to viewport proximity: mount near-viewport, UNMOUNT
    // once far offscreen. This bounds the number of concurrent WebGL/WebGPU
    // contexts to what is actually on screen (the poster covers the gap during
    // unmount), preventing context exhaustion on pages with many 3D islands.
    const io = new IntersectionObserver(
      (entries) => {
        const on = entries.some((e) => e.isIntersecting);
        setMount(on);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [heavy, rootMargin, failed]);

  // The poster carries the visual until the live island mounts (it is the
  // SSR/LCP element and the permanent fallback). Once the island is mounted it
  // replaces the poster — so a transparent 3D canvas never shows the still
  // bleeding through behind it. On failure or when scrolled far offscreen the
  // poster returns.
  const showLive = mount && !failed;
  return (
    <div ref={ref} className={className} style={{ position: 'absolute', inset: 0 }}>
      {showLive ? null : poster}
      {showLive ? (
        <RenderBoundary onError={() => setFailed(true)}>{children}</RenderBoundary>
      ) : null}
    </div>
  );
}
