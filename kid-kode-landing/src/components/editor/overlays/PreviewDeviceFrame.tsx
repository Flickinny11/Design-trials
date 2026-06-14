'use client';

/**
 * APP-REALITY P5 — Preview device modes (Desktop / Tablet / Mobile).
 *
 * The switch flips `deviceMode`, which the assembled scene reads to apply each
 * node's `responsiveScenePos` override — the built composition genuinely
 * RE-LAYS-OUT for the device (not a resized frame), and the camera pulls in to
 * fill the device. For tablet/mobile this overlay also frames the live preview
 * inside a device bezel (dimmed surround) so it reads as the real device view.
 *
 * Self-gates to preview-app. Editor overlay scope (DOM is fine here).
 */

import type { ReactNode } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import type { DeviceMode } from '@/lib/prism-graph/types';

const DEVICES: { id: DeviceMode; label: string; icon: ReactNode }[] = [
  { id: 'desktop', label: 'Desktop', icon: (
    <svg width="15" height="13" viewBox="0 0 15 13" aria-hidden><rect x="0.7" y="0.7" width="13.6" height="8.6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.1" /><line x1="5" y1="11.8" x2="10" y2="11.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>
  ) },
  { id: 'tablet', label: 'Tablet', icon: (
    <svg width="11" height="14" viewBox="0 0 11 14" aria-hidden><rect x="0.7" y="0.7" width="9.6" height="12.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.1" /><circle cx="5.5" cy="11.4" r="0.7" fill="currentColor" /></svg>
  ) },
  { id: 'mobile', label: 'Mobile', icon: (
    <svg width="9" height="14" viewBox="0 0 9 14" aria-hidden><rect x="0.7" y="0.7" width="7.6" height="12.6" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.1" /><line x1="3.4" y1="11.6" x2="5.6" y2="11.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>
  ) },
];

export default function PreviewDeviceFrame() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const deviceMode = useGraphEditorStore((s) => s.deviceMode);
  const setDeviceMode = useGraphEditorStore((s) => s.setDeviceMode);

  if (viewMode !== 'preview-app') return null;

  const framed = deviceMode !== 'desktop';
  const isMobile = deviceMode === 'mobile';

  return (
    <>
      {/* Device bezel — frames the live preview as the real device view. */}
      {framed && (
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          style={{
            height: isMobile ? 'min(78vh, 720px)' : 'min(82vh, 960px)',
            aspectRatio: isMobile ? '9 / 19.5' : '3 / 4',
            borderRadius: isMobile ? 40 : 24,
            boxShadow:
              '0 0 0 100vmax rgba(4,5,10,0.9), inset 0 0 0 2px rgba(var(--ds-brass-200-rgb),0.22), inset 0 0 0 7px rgba(4,5,10,0.55), inset 0 8px 40px rgba(0,0,0,0.55)',
          }}
        >
          {isMobile && (
            <div className="absolute top-[7px] left-1/2 -translate-x-1/2 w-16 h-[5px] rounded-full" style={{ background: 'rgba(4,5,10,0.85)' }} />
          )}
        </div>
      )}

      {/* Device switcher (always in preview-app). */}
      <div className="absolute top-[58px] left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <div className="ds-glass ds-edge--brass ds-reveal flex items-center gap-0.5 rounded-full p-0.5">
          {DEVICES.map((d) => {
            const active = deviceMode === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDeviceMode(d.id)}
                title={d.label}
                aria-pressed={active}
                className="ds-press flex items-center gap-1.5 h-7 px-2.5 rounded-full transition-colors"
                style={{
                  background: active ? 'var(--ds-grad-brass)' : 'transparent',
                  color: active ? '#2a1f12' : 'var(--ds-text-mid)',
                }}
              >
                {d.icon}
                <span className="text-[9.5px] font-ui font-medium tracking-wide">{d.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
