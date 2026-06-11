'use client';

// PRISM EDITOR CHROME LAYER — mode-morph conductor (UI-FIDELITY-2 W2).
//
// Editor state changes must read as MORPHING INTO the workspace, not panel
// swaps (the Slider-Revolution smash brief #4/#10). Two mechanisms:
//
//  1. THE SWEEP PANE — a full-height refractive glass slab (a real chrome-layer
//     glass instance, so it lenses + disperses whatever the live scene is
//     showing) that GSAP-sweeps across the viewport on every viewMode change.
//     For galaxy ↔ canvas the R3F Canvas remounts (contentKey flip): the pane
//     is timed so the swap happens behind the brightest part of the sweep.
//     This is DESIGN-REFERENCES §5 (Barba-class transition choreography) and
//     §11 (refraction) executed natively in the one renderer.
//
//  2. STAGGERED SURFACE REVEAL — incoming chrome containers (dock, panels,
//     HUD) get a GSAP stagger (y/opacity with expo ease). Because GPU slabs
//     track DOM rects per frame, animating the DOM animates the rendered
//     material for free.
//
//  3. BOOT LIGHT SWEEP — when the chrome layer first comes alive, the pointer
//     light makes one slow studio pass across the chrome (uniform animation),
//     reading as "the lights coming on" over real metal/glass.
//
// Respects prefers-reduced-motion: sweeps collapse to a fast crossfade and the
// boot pass is skipped.

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { detectChromeTier } from '@/components/editor/design-system/tier';
import { useChromeSlab } from './useChromeSlab';
import { getChromeSlabRegistry } from './registry';

const SURFACE_SELECTOR = [
  '[data-component="canvas-toolbar"]',
  '[data-component="top-bar"]',
  '[data-component="preview-app-nav"]',
  '[data-component="preview-app-world-badge"]',
  '[data-component="galaxy-filter-overlay"]',
].join(', ');

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function ModeTransitionConductor() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const prevMode = useRef(viewMode);
  const prevHub = useRef(activeHubId);
  const paneRef = useRef<HTMLDivElement | null>(null);
  // The sweep pane is REAL refractive glass — strongest frost, hero accent.
  const paneSlab = useChromeSlab({ material: 'glass', radius: 24, frost: 0.85, accent: 1, borderPx: 2 });
  const bootDone = useRef(false);

  // ── Boot light sweep: one slow studio pass once the layer is live.
  useEffect(() => {
    if (bootDone.current || detectChromeTier() !== 't2' || reducedMotion()) return;
    const registry = getChromeSlabRegistry();
    let cancelled = false;
    const arm = () => {
      if (cancelled || bootDone.current) return;
      if (!registry.layerActive || registry.size < 2) {
        setTimeout(arm, 400);
        return;
      }
      bootDone.current = true;
      const sweep = { x: -200, y: window.innerHeight * 0.22 };
      const apply = () => {
        window.dispatchEvent(
          new PointerEvent('pointermove', { clientX: sweep.x, clientY: sweep.y }),
        );
      };
      gsap.to(sweep, {
        x: window.innerWidth + 200,
        y: window.innerHeight * 0.4,
        duration: 2.1,
        ease: 'sine.inOut',
        delay: 0.35,
        onUpdate: apply,
      });
    };
    arm();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Hub morphs (preview-app chapter navigation): the same travelling glass
  // pane, gentler — hub changes read as turning a page of the same book.
  useEffect(() => {
    const from = prevHub.current;
    prevHub.current = activeHubId;
    if (from === activeHubId || !from || !activeHubId) return;
    if (useGraphEditorStore.getState().viewMode !== 'preview-app') return;
    if (detectChromeTier() !== 't2' || reducedMotion()) return;
    const pane = paneRef.current;
    if (!pane) return;
    const dir = activeHubId > from ? 1 : -1; // hub ids carry s1..s5 narrative order
    gsap.killTweensOf(pane);
    gsap.set(pane, { x: dir > 0 ? '-130%' : '130%', opacity: 1 });
    gsap.to(pane, {
      x: dir > 0 ? '130%' : '-130%',
      duration: 0.78,
      ease: 'power2.inOut',
      onComplete: () => gsap.set(pane, { x: '-130%', opacity: 0 }),
    });
  }, [activeHubId]);

  // ── Mode morphs.
  useEffect(() => {
    const from = prevMode.current;
    prevMode.current = viewMode;
    if (from === viewMode) return;
    if (detectChromeTier() !== 't2') return; // CSS ds-reveal stands below t2

    const pane = paneRef.current;
    const reduce = reducedMotion();

    // Staggered reveal of whatever chrome the new mode mounts (next frame,
    // after React commits the new surfaces).
    requestAnimationFrame(() => {
      const surfaces = Array.from(document.querySelectorAll<HTMLElement>(SURFACE_SELECTOR));
      if (surfaces.length && !reduce) {
        gsap.fromTo(
          surfaces,
          { y: 10, opacity: 0.0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            ease: 'expo.out',
            stagger: 0.045,
            clearProps: 'transform,opacity',
            delay: 0.12,
          },
        );
      }
    });

    if (!pane || reduce) return; // reduced motion: no travelling pane at all
    // NOTE: DOM opacity does NOT affect the GPU slab — visibility is purely
    // positional. The pane lives off-viewport except while travelling.

    // The travelling glass pane: enters from the side the mode "came from"
    // (galaxy sits left of canvas sits left of preview-app in the toggle).
    const ORDER: Record<string, number> = { galaxy: 0, canvas: 1, 'preview-app': 2 };
    const dir = (ORDER[viewMode] ?? 1) >= (ORDER[from] ?? 1) ? 1 : -1;
    gsap.killTweensOf(pane);
    gsap.set(pane, { x: dir > 0 ? '-130%' : '130%', opacity: 1 });
    gsap.to(pane, {
      x: dir > 0 ? '130%' : '-130%',
      duration: 0.62,
      ease: 'power3.inOut',
      onComplete: () => gsap.set(pane, { x: '-130%', opacity: 0 }),
    });
  }, [viewMode]);

  return (
    <div
      ref={(el) => {
        paneRef.current = el;
        paneSlab.ref(el);
      }}
      data-component="mode-sweep-pane"
      aria-hidden
      className="fixed inset-y-0 z-[70] pointer-events-none"
      // Wide pane with soft diagonal: the GPU slab renders the actual glass;
      // this DOM twin only carries geometry. Starts parked off-screen.
      style={{ left: '-10%', width: '120%', transform: 'translateX(-130%)', opacity: 0 }}
    />
  );
}
