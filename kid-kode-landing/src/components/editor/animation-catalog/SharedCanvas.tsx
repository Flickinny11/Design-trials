'use client';

// SharedCanvas — the single fixed, full-viewport <canvas> the whole catalog
// renders through. Mounted once by CatalogGallery; acquires the SharedTileRenderer
// singleton. It sits BEHIND the (transparent-windowed) catalog content so each
// tile's scissored viewport shows through its DOM "hole".

import { useEffect, useRef } from 'react';
import { sharedRig } from './shared-tile-renderer';

export default function SharedCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    void sharedRig.acquire(c);
    // The rig is a page-lifetime singleton; we intentionally do NOT dispose it
    // on unmount so HMR / Strict-Mode double-mounts never churn the GL context
    // (the whole point of the shared rig). It is torn down on full page unload.
  }, []);
  return (
    <canvas
      ref={ref}
      data-component="shared-rig-canvas"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
