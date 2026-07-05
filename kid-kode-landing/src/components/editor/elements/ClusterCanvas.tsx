'use client';

// ClusterCanvas — the single fixed, full-viewport <canvas> the element-library
// browser renders its preview tiles through. Mounted once by
// ElementLibraryBrowser; acquires the clusterRig singleton. It sits INSIDE the
// browser modal's stacking context: ABOVE the dim backdrop layer but BELOW the
// panel chrome, so each tile's transparent preview "hole" reveals the rig frame
// (not the modal's dark panel). Mirror of animation-catalog/SharedCanvas.tsx,
// with a configurable zIndex so it can be sandwiched between the modal backdrop
// and the panel content.
//
// The canvas itself is full-viewport `fixed inset-0` (the rig scissors each
// tile into its on-screen rect via getBoundingClientRect, so the canvas must
// span the viewport even though the modal is centered).

import { useEffect, useRef } from 'react';
import { clusterRig } from './cluster-tile-renderer';

export default function ClusterCanvas({ zIndex = 0 }: { zIndex?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    void clusterRig.acquire(c);
    // The rig is a page-lifetime singleton; we intentionally do NOT dispose it
    // on unmount so HMR / Strict-Mode double-mounts never churn the GL context
    // (the whole point of the shared rig). It is torn down on full page unload.
  }, []);
  return (
    <canvas
      ref={ref}
      data-component="cluster-rig-canvas"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex,
        pointerEvents: 'none',
      }}
    />
  );
}
