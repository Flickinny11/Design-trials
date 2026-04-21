'use client';

import { useEffect, useRef, useState } from 'react';
import { mount, type MountResult } from '@/lib/prism/player';

interface Props {
  prismUrl?: string;
  onMounted?: (result: MountResult) => void;
}

export default function PrismHost({ prismUrl = '/prism-assets/mock-app.prism', onMounted }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let result: MountResult | null = null;
    let cancelled = false;

    (async () => {
      try {
        result = await mount(canvas, prismUrl);
        if (cancelled) { result.unmount(); return; }
        setStatus('ready');
        onMounted?.(result);
      } catch (e) {
        console.error('[PrismHost] mount failed:', e);
        setError((e as Error).message);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      result?.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prismUrl]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#04050a]">
      <canvas
        ref={canvasRef}
        className="w-full h-full block focus:outline-none"
        style={{ display: 'block' }}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-[#5d8bff]/30 border-t-[#5d8bff] animate-spin" />
            </div>
            <div className="text-[10px] font-mono tracking-widest text-white/45">
              LOADING PRISM RUNTIME
            </div>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div className="text-[12px] font-mono tracking-widest text-[#ff5577] mb-2">PRISM BOOT FAILED</div>
            <div className="text-[11px] font-mono text-white/60 break-words">{error}</div>
            <div className="text-[10px] text-white/40 mt-3">
              Did you run <code className="text-white/70">npm run build:stubs &amp;&amp; npm run build:prism</code>?
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
