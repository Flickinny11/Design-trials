'use client';

// SHELL W0 — lazy mount wrapper for the premium 3D icon set (DL8: heavy 3D
// showpieces lazy-load behind meaningful first paint; the stage paints its
// machined frame immediately, the WebGL island streams in after).

import dynamic from 'next/dynamic';

const PremiumIconSet = dynamic(
  () => import('@/components/shell/showpiece/PremiumIconSet'),
  {
    ssr: false,
    loading: () => <div className="sw0-icon-loading">Machining icons…</div>,
  },
);

const LABELS = ['build', 'deploy', 'integrate', 'project', 'settings', 'chat'];

export default function IconShowpiece() {
  return (
    <div className="sw0-icon-stage">
      <div>
        <PremiumIconSet />
      </div>
      <div className="sw0-icon-labels" aria-hidden="true">
        {LABELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}
