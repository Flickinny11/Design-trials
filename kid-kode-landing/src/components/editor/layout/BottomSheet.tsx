'use client';

/**
 * BottomSheet — premium draggable bottom sheet for compact editor density
 * (UI-WOW-2 P0). Re-houses the Inspector family + tool flyouts on phones and
 * narrow embedded panes so they stop being full-bleed takeovers that occlude
 * the scene.
 *
 * Design:
 *  - Renders `absolute` inside its positioned ancestor (the editor pane / main),
 *    NOT `fixed` to the viewport — so it spans a narrow EMBEDDED pane correctly
 *    rather than the whole browser. The pane's `overflow:hidden` clips the part
 *    that slides below.
 *  - Snap points: peek / half / full. GSAP spring open + drag-to-snap on the
 *    grab handle (transform-only motion per the DS contract; never animates
 *    backdrop-filter). Reduced-motion → instant snaps.
 *  - Glass via `.ds-glass--heavy` CSS (crisp under drag; the chrome-slab layer's
 *    per-frame rect sampling would lag a fast transform, which is why the mode
 *    toggle thumb is also CSS). Below t2 this is the only path anyway (INV-9).
 *  - Single-active coordination via useBottomSheetStore: opening one sheet
 *    fronts it; closing the front restores any sheet whose owner still wants it.
 *  - Lenis momentum on the body for fine pointers; native momentum on touch.
 *  - safe-area-inset-bottom aware; Esc / scrim-tap / drag-dismiss close it.
 *
 * Editor-shell component — window/document are legal here (FP-05 scopes to
 * runtime modules). Additive; no schema or store rename.
 */

import { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useBottomSheetStore, type SheetSnap } from '@/stores/useBottomSheetStore';
import { useEditorLayoutStore } from '@/stores/useEditorLayoutStore';
import { useLenis } from '@/components/editor/design-system/use-lenis';
import { Icon } from '@/components/editor/icons/Icon';

export interface BottomSheetProps {
  /** Stable id for the single-active coordinator (e.g. 'inspector', 'toolgroup'). */
  id: string;
  /** Owner wants the sheet shown (e.g. a node is selected). */
  open: boolean;
  /** Owner-side close (clear selection / active group). Called on dismiss. */
  onClose: () => void;
  title?: React.ReactNode;
  /** Optional kicker above the title (e.g. "INSPECTOR"). */
  kicker?: string;
  /** Snap to open at. Default 'half'. */
  initialSnap?: SheetSnap;
  children: React.ReactNode;
}

const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'full'];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function BottomSheet({ id, open, onClose, title, kicker, initialSnap = 'half', children }: BottomSheetProps) {
  const activeId = useBottomSheetStore((s) => s.activeId);
  const snap = useBottomSheetStore((s) => s.snap);
  const containerH = useEditorLayoutStore((s) => s.height);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const prevOpenRef = useRef(false);
  const dragRef = useRef<{ startY: number; baseTy: number; ty: number; moved: boolean } | null>(null);
  const { ref: bodyRef } = useLenis<HTMLDivElement>({ lerp: 0.14 });

  const isFront = activeId === id;

  // Geometry — heights are fractions of the CONTAINER (pane) box, not viewport,
  // so an embedded narrow pane gets a correctly-sized sheet.
  const sheetH = Math.max(220, Math.round(containerH * 0.92));
  const revealPx = useCallback(
    (s: SheetSnap): number => {
      if (s === 'peek') return Math.min(150, Math.round(containerH * 0.3));
      if (s === 'half') return Math.round(containerH * 0.6);
      return sheetH; // full
    },
    [containerH, sheetH],
  );
  // translateY that reveals `revealPx` from the bottom (0 = fully shown, sheetH = hidden).
  const tyFor = useCallback((s: SheetSnap) => sheetH - revealPx(s), [sheetH, revealPx]);

  // ── single-active coordination ────────────────────────────────────────────
  const openStore = useBottomSheetStore((s) => s.open);
  const closeStore = useBottomSheetStore((s) => s.close);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (open && !wasOpen) openStore(id, initialSnap); // explicit open → front
    else if (open && activeId === null) openStore(id, initialSnap); // restore after front closed
    else if (!open && wasOpen) closeStore(id);
  }, [open, activeId, id, initialSnap, openStore, closeStore]);

  // ── animate to current snap when fronted; off-screen when not ──────────────
  useEffect(() => {
    const el = sheetRef.current;
    const scrim = scrimRef.current;
    if (!el) return;
    const target = isFront ? tyFor(snap) : sheetH;
    const scrimTarget = isFront ? (snap === 'peek' ? 0.18 : snap === 'half' ? 0.42 : 0.6) : 0;
    if (prefersReducedMotion()) {
      gsap.set(el, { y: target });
      if (scrim) gsap.set(scrim, { opacity: scrimTarget });
      return;
    }
    gsap.to(el, { y: target, duration: 0.46, ease: isFront ? 'back.out(1.05)' : 'power3.in', overwrite: true });
    if (scrim) gsap.to(scrim, { opacity: scrimTarget, duration: 0.4, ease: 'power2.out', overwrite: true });
  }, [isFront, snap, sheetH, tyFor]);

  // ── Esc to dismiss when front ──────────────────────────────────────────────
  useEffect(() => {
    if (!isFront) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); closeStore(id); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFront, onClose, closeStore, id]);

  const dismiss = useCallback(() => { onClose(); closeStore(id); }, [onClose, closeStore, id]);

  // ── drag the handle to change snap / dismiss ───────────────────────────────
  const onHandleDown = useCallback((e: React.PointerEvent) => {
    const el = sheetRef.current;
    if (!el) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const baseTy = (gsap.getProperty(el, 'y') as number) || 0;
    dragRef.current = { startY: e.clientY, baseTy, ty: baseTy, moved: false };
    gsap.killTweensOf(el);
  }, []);
  const onHandleMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    const el = sheetRef.current;
    if (!d || !el) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 3) d.moved = true;
    const ty = Math.max(0, Math.min(sheetH, d.baseTy + dy));
    d.ty = ty;
    gsap.set(el, { y: ty });
    const scrim = scrimRef.current;
    if (scrim) gsap.set(scrim, { opacity: Math.max(0, 0.6 * (1 - ty / sheetH)) });
  }, [sheetH]);
  const onHandleUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    // dismiss if dragged below the peek reveal
    if (d.ty > sheetH - revealPx('peek') * 0.55) { dismiss(); return; }
    // snap to nearest of peek/half/full by resulting translateY
    let best: SheetSnap = 'half';
    let bestDist = Infinity;
    for (const s of SNAP_ORDER) {
      const dist = Math.abs(tyFor(s) - d.ty);
      if (dist < bestDist) { bestDist = dist; best = s; }
    }
    useBottomSheetStore.getState().setSnap(best);
  }, [sheetH, revealPx, tyFor, dismiss]);

  if (!open && !isFront) return null;

  return (
    <>
      {/* Scrim — absolute within the pane; tap to dismiss. */}
      <div
        ref={scrimRef}
        aria-hidden
        onClick={dismiss}
        className="absolute inset-0 pointer-events-auto"
        style={{ background: 'rgba(2,3,8,0.66)', opacity: 0, zIndex: 'var(--ds-z-sheet-scrim)' as unknown as number }}
      />
      {/* Sheet surface */}
      <section
        ref={sheetRef}
        data-component="bottom-sheet"
        data-sheet-id={id}
        role="dialog"
        aria-modal="true"
        className="ds-glass ds-glass--heavy ds-edge--metal absolute left-0 right-0 bottom-0 flex flex-col pointer-events-auto"
        style={{
          height: sheetH,
          transform: `translateY(${sheetH}px)`,
          zIndex: 'var(--ds-z-sheet)' as unknown as number,
          borderTopLeftRadius: 'var(--ds-r-xl)',
          borderTopRightRadius: 'var(--ds-r-xl)',
          paddingBottom: 'var(--ds-safe-bottom)',
          position: 'absolute',
        }}
      >
        {/* Grab handle + header */}
        <div
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          className="shrink-0 cursor-grab active:cursor-grabbing select-none touch-none px-4 pt-2.5 pb-2"
          data-magnetic
        >
          <div
            aria-hidden
            className="mx-auto rounded-full"
            style={{ width: 44, height: 'var(--ds-sheet-handle)', background: 'var(--ds-grad-metal-soft, rgba(184,188,192,.5))', boxShadow: '0 0 10px rgba(0,0,0,.4)' }}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              {kicker && <div className="ds-kicker" style={{ color: 'var(--ds-metal-300)' }}>{kicker}</div>}
              {title && <div className="ds-title truncate">{title}</div>}
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="ds-btn ds-btn--quiet shrink-0 h-8 w-8 grid place-items-center rounded-full"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        </div>
        {/* Body — Lenis momentum (fine pointer) / native momentum (touch) */}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div>{children}</div>
        </div>
      </section>
    </>
  );
}

export default BottomSheet;
