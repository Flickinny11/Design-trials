'use client';

// PRISM SHELL — CONFIRM DIALOG (SHELL W4)
//
// Reusable confirmation for irreversible/heavy gallery actions (delete a
// project, restore a checkpoint). Focus-trapped + Escape + labelled (WCAG 2.2,
// the W3 modal idiom). Clean-but-premium DOM (Decision A) — the working-surface
// register; the page's 3D moments are the hero + thumbnails.

import { useEffect, useRef } from 'react';

export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function focusables(): HTMLElement[] {
      const root = ref.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>('button:not([disabled])'),
      );
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="dw-confirm-backdrop" role="presentation" onClick={onCancel}>
      <div
        ref={ref}
        className="dw-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dw-confirm-title"
        aria-describedby="dw-confirm-body"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dw-confirm-title" className="dw-confirm-title">
          {title}
        </h2>
        <p id="dw-confirm-body" className="dw-confirm-body">
          {body}
        </p>
        <div className="dw-confirm-actions">
          <button
            type="button"
            className="dw-btn dw-btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="dw-btn"
            data-danger={danger ? 'true' : 'false'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
