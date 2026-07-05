'use client';

// P2 TOOLBAR WIRING (Task B) — the Animation flyout's mount context for the
// shared catalog rig (the ONE WebGPU canvas every live preview tile draws
// through — the catalog-rig precedent; spec §8.3, INV-R1-compatible: this is
// editor chrome, not a second runtime render path).
//
// Why a body-mounted singleton (not a React-mounted <SharedCanvas/>):
//   • sharedRig.acquire() binds the renderer to ONE canvas for the page's
//     lifetime (idempotent; re-acquire with a different canvas is ignored).
//     CanvasToolbar unmounts whenever viewMode leaves 'canvas', so a canvas
//     owned by React here would detach and orphan the rig. A document.body
//     canvas survives toolbar/flyout unmounts exactly like the catalog
//     page's page-lifetime SharedCanvas.
//   • The rig maps tile rects in viewport CSS px onto the canvas, so the
//     canvas MUST be fixed, full-viewport at (0,0). Sharpness at dpr 2 is the
//     rig's own contract (setPixelRatio(min(devicePixelRatio, 2))).
//   • It sits ABOVE the frosted flyout glass (z-index 60, pointer-events
//     none): the rig clears the buffer to transparent and paints ONLY the
//     registered tile windows, so nothing else is occluded. Mounting it
//     BEHIND the flyout can't work — the ds-glass backdrop-filter plate would
//     paint over the transparent tile windows.
//   • The flyout publishes its content rect each frame as a clip-path so
//     previews can never bleed outside the flyout while its inner plate
//     scrolls (the rig itself knows nothing about scroll containers).
//
// DOM access is sanctioned here: this is component land (src/components/**),
// not the prism runtime.

import { sharedRig } from '@/components/editor/animation-catalog/shared-tile-renderer';

const HIDDEN_CLIP = 'inset(0 0 100% 0)';

let canvasEl: HTMLCanvasElement | null = null;
let lastClip = '';

/** Idempotent: create + body-mount the rig canvas and bind the shared rig to
 *  it. Safe to call on every flyout open. Returns null during SSR. */
export function ensureFlyoutRig(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (!canvasEl) {
    const c = document.createElement('canvas');
    c.setAttribute('data-component', 'animation-flyout-rig-canvas');
    c.style.position = 'fixed';
    c.style.inset = '0';
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.zIndex = '60';
    c.style.pointerEvents = 'none';
    c.style.clipPath = HIDDEN_CLIP;
    lastClip = HIDDEN_CLIP;
    canvasEl = c;
  }
  if (!canvasEl.isConnected) document.body.appendChild(canvasEl);
  void sharedRig.acquire(canvasEl);
  return canvasEl;
}

/** Clip the rig canvas to the flyout's content rect (viewport CSS px) so live
 *  previews never paint outside the flyout. Pass null to hide (flyout
 *  closed — the rig also clears to transparent once its tiles unregister). */
export function setRigClip(
  rect: { top: number; right: number; bottom: number; left: number } | null,
  radius = 0,
): void {
  if (!canvasEl || typeof window === 'undefined') return;
  const next = rect
    ? `inset(${Math.max(0, rect.top)}px ${Math.max(0, window.innerWidth - rect.right)}px ${Math.max(
        0,
        window.innerHeight - rect.bottom,
      )}px ${Math.max(0, rect.left)}px round ${radius}px)`
    : HIDDEN_CLIP;
  if (next === lastClip) return;
  lastClip = next;
  canvasEl.style.clipPath = next;
}
