'use client';

// CANVAS-FINAL — shared modal shell for the Change Artifact wizards
// (canvas-spec §12). Same Observatory-Brass vocabulary as AddNodeDialog
// (frosted-glass plate over a smoked scrim, ds-title/ds-kicker, machined close
// key), widened with an internal scroll region and a sticky footer for the
// generate/apply actions. Mobile-aware: near-full-screen below 640px.

import { useEffect, type ReactNode } from 'react';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { DS, dsAlpha } from '@/components/editor/design-system';

export default function WizardWindow({
  title,
  kicker,
  onClose,
  onBack,
  footer,
  children,
  width = 720,
}: {
  title: string;
  kicker?: string;
  onClose: () => void;
  onBack?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const panelSlab = useChromeSlab({ material: 'glass', radius: 18, frost: 0.6 });

  // Esc closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      data-component="change-artifact-window"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{
        background: dsAlpha(DS.void, 0.62),
        backdropFilter: 'var(--ds-frost-light)',
        WebkitBackdropFilter: 'var(--ds-frost-light)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelSlab.ref}
        className="ds-glass ds-edge rounded-ds-lg ds-reveal flex flex-col w-full max-h-[92vh]"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0"
          style={{ borderBottom: `1px solid ${dsAlpha(DS.brass400, 0.16)}` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                data-role="wizard-back"
                onClick={onBack}
                className="ds-btn ds-btn--quiet ds-press w-8 h-8 px-0 text-[16px] leading-none shrink-0"
                aria-label="Back"
              >
                ‹
              </button>
            )}
            <div className="min-w-0">
              <div className="ds-title tracking-tight truncate">{title}</div>
              {kicker && <div className="ds-kicker mt-0.5">{kicker}</div>}
            </div>
          </div>
          <button
            type="button"
            data-role="wizard-close"
            onClick={onClose}
            className="ds-btn ds-btn--quiet ds-press w-8 h-8 px-0 text-[18px] leading-none shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 ds-scroll">{children}</div>

        {/* Sticky footer */}
        {footer && (
          <div
            className="px-5 py-3 shrink-0 flex items-center justify-end gap-2 flex-wrap"
            style={{ borderTop: `1px solid ${dsAlpha(DS.brass400, 0.16)}` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
